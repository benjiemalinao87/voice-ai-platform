// VAPI API Client
const VAPI_BASE_URL = 'https://api.vapi.ai';

const vapiPrivateKey = import.meta.env.VITE_VAPI_PRIVATE_KEY;
const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;

class VapiClient {
  private privateKey: string;

  constructor(privateKey: string) {
    this.privateKey = privateKey;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${VAPI_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.privateKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Assistants
  async listAssistants(limit = 100) {
    return this.request('/assistant', {
      method: 'GET',
    });
  }

  async getAssistant(assistantId: string) {
    return this.request(`/assistant/${assistantId}`, {
      method: 'GET',
    });
  }

  async updateAssistant(assistantId: string, data: any) {
    return this.request(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createAssistant(data: any) {
    return this.request('/assistant', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Calls
  async listCalls(params?: {
    assistantId?: string;
    limit?: number;
    createdAtGt?: string;
    createdAtLt?: string;
  }) {
    const queryParams = new URLSearchParams();

    if (params?.assistantId) queryParams.append('assistantId', params.assistantId);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.createdAtGt) queryParams.append('createdAtGt', params.createdAtGt);
    if (params?.createdAtLt) queryParams.append('createdAtLt', params.createdAtLt);

    const query = queryParams.toString();
    return this.request(`/call${query ? '?' + query : ''}`, {
      method: 'GET',
    });
  }

  async getCall(callId: string) {
    return this.request(`/call/${callId}`, {
      method: 'GET',
    });
  }

  // Phone Numbers
  async listPhoneNumbers() {
    return this.request('/phone-number', {
      method: 'GET',
    });
  }

  async getPhoneNumber(phoneNumberId: string) {
    return this.request(`/phone-number/${phoneNumberId}`, {
      method: 'GET',
    });
  }

  // Analytics
  async getCallAnalytics(params?: {
    assistantId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    // Note: This may need to be adjusted based on VAPI's actual analytics endpoints
    const calls = await this.listCalls({
      assistantId: params?.assistantId,
      createdAtGt: params?.startDate,
      createdAtLt: params?.endDate,
      limit: 1000,
    });

    return calls;
  }

  // Files (Knowledge Base)
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${VAPI_BASE_URL}/file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.privateKey}`,
        // Don't set Content-Type - browser will set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async deleteFile(fileId: string) {
    const response = await fetch(`${VAPI_BASE_URL}/file/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.privateKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async listFiles() {
    return this.request('/file', {
      method: 'GET',
    });
  }
}

// Helper to get credentials from D1 (user-specific) or fallback to env
// IMPORTANT: This should NOT use localStorage for API keys to ensure user isolation
async function getUserVapiCredentials(): Promise<{ privateKey?: string; publicKey?: string } | null> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // No user logged in, use env variables as fallback for demo
      return vapiPrivateKey ? { privateKey: vapiPrivateKey, publicKey: vapiPublicKey } : null;
    }

    // Import D1 client to fetch user settings
    const { d1Client } = await import('./d1');
    const { decrypt } = await import('./encryption');

    const settings = await d1Client.getUserSettings();

    if (!settings.encryptedPrivateKey) {
      // User hasn't configured API keys yet
      return null;
    }

    // For now, we can't decrypt without password
    // This is a limitation - we need the password to decrypt
    // The Settings component handles this properly
    // For API calls, we'll need to pass the decrypted keys directly
    return null;
  } catch (error) {
    console.error('Error loading user VAPI credentials:', error);
    return null;
  }
}

// Create VAPI client with user-specific credentials
// This is now async and requires credentials to be passed explicitly
export function createVapiClient(privateKey: string): VapiClient {
  return new VapiClient(privateKey);
}

// Export the class so components can create clients with user-specific keys
export { VapiClient };

// DEPRECATED: Using localStorage for API keys is a security risk
// These functions are kept for backward compatibility but should not be used
export const vapiConfig = {
  get publicKey() {
    return vapiPublicKey;
  },
  get privateKey() {
    return vapiPrivateKey;
  },
  get phoneNumberId() {
    return import.meta.env.VITE_VAPI_PHONE_NUMBER_ID;
  },
  get assistantId() {
    return import.meta.env.VITE_VAPI_ASSISTANT_ID;
  },
};

// For backward compatibility - will be null unless env variables are set
export const vapiClient = vapiPrivateKey ? new VapiClient(vapiPrivateKey) : null;
export const isVapiConfigured = !!vapiClient;

// Type definitions for VAPI responses
export interface VapiAssistant {
  id: string;
  orgId: string;
  name: string;
  model?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    messages?: any[];
  };
  voice?: {
    provider: string;
    voiceId: string;
    speed?: number;
    fillerInjectionEnabled?: boolean;
  };
  firstMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VapiCall {
  id: string;
  orgId: string;
  assistantId?: string;
  phoneNumberId?: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  costBreakdown?: {
    transport?: number;
    stt?: number;
    llm?: number;
    tts?: number;
    vapi?: number;
    total?: number;
  };
  messages?: any[];
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  analysis?: {
    sentiment?: string;
    successEvaluation?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VapiPhoneNumber {
  id: string;
  orgId: string;
  number: string;
  name?: string;
  assistantId?: string;
  createdAt: string;
  updatedAt: string;
}
