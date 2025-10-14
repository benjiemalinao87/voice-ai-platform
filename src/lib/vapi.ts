// VAPI API Client
const VAPI_BASE_URL = 'https://api.vapi.ai';

const vapiPrivateKey = import.meta.env.VITE_VAPI_PRIVATE_KEY;
const vapiPublicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;

export const isVapiConfigured = !!vapiPrivateKey;

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
}

// Export singleton instance
export const vapiClient = vapiPrivateKey ? new VapiClient(vapiPrivateKey) : null;

export const vapiConfig = {
  publicKey: vapiPublicKey,
  privateKey: vapiPrivateKey,
  phoneNumberId: import.meta.env.VITE_VAPI_PHONE_NUMBER_ID,
  assistantId: import.meta.env.VITE_VAPI_ASSISTANT_ID,
};

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
