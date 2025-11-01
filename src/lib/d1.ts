/**
 * Cloudflare D1 Client
 * Connects to Cloudflare Workers API for database operations
 */

const D1_API_URL = import.meta.env.VITE_D1_API_URL || 'http://localhost:8787';

export interface D1KnowledgeFile {
  id: string;
  agent_id: string;
  vapi_file_id: string;
  file_name: string;
  file_size: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  created_at: number;
  updated_at: number;
}

class D1Client {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`D1 API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Knowledge Base Files
  async listKnowledgeFiles(agentId: string): Promise<D1KnowledgeFile[]> {
    return this.request(`/api/knowledge-files/${agentId}`, {
      method: 'GET',
    });
  }

  async createKnowledgeFile(data: {
    agent_id: string;
    vapi_file_id: string;
    file_name: string;
    file_size: number;
    status?: 'uploading' | 'processing' | 'ready' | 'error';
  }): Promise<D1KnowledgeFile> {
    return this.request('/api/knowledge-files', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteKnowledgeFile(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/knowledge-files/${id}`, {
      method: 'DELETE',
    });
  }

  // User Settings
  async getUserSettings(): Promise<{
    privateKey?: string;
    publicKey?: string;
    selectedAssistantId?: string;
    selectedPhoneId?: string;
    selectedOrgId?: string;
    openaiApiKey?: string;
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    transferPhoneNumber?: string;
  }> {
    return this.request('/api/settings', {
      method: 'GET',
    });
  }

  async updateUserSettings(data: {
    privateKey?: string;
    publicKey?: string;
    selectedAssistantId?: string | null;
    selectedPhoneId?: string | null;
    selectedOrgId?: string | null;
    openaiApiKey?: string | null;
    twilioAccountSid?: string | null;
    twilioAuthToken?: string | null;
    transferPhoneNumber?: string | null;
  }): Promise<{ message: string }> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Webhooks
  async createWebhook(name: string): Promise<{
    id: string;
    url: string;
    name: string;
    is_active: boolean;
    created_at: number;
  }> {
    return this.request('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async listWebhooks(): Promise<Array<{
    id: string;
    webhook_url: string;
    name: string;
    is_active: boolean;
    created_at: number;
    call_count: number;
  }>> {
    return this.request('/api/webhooks', {
      method: 'GET',
    });
  }

  async deleteWebhook(webhookId: string): Promise<{ message: string }> {
    return this.request(`/api/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }

  async getWebhookCalls(params?: {
    webhook_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<{
    id: string;
    webhook_id: string;
    vapi_call_id: string | null;
    phone_number: string | null;
    customer_number: string | null;
    recording_url: string | null;
    ended_reason: string;
    summary: string;
    structured_data: Record<string, any> | null;
    raw_payload: any;
    created_at: number;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.webhook_id) queryParams.append('webhook_id', params.webhook_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/webhook-calls${query ? '?' + query : ''}`, {
      method: 'GET',
    });
  }

  // Addons
  async getAddons(): Promise<{
    addons: Array<{
      addon_type: string;
      is_enabled: number;
      settings: string | null;
    }>;
  }> {
    return this.request('/api/addons', {
      method: 'GET',
    });
  }

  async toggleAddon(addonType: string, enabled: boolean): Promise<{ message: string; enabled: boolean }> {
    return this.request('/api/addons/toggle', {
      method: 'POST',
      body: JSON.stringify({ addonType, enabled }),
    });
  }

  async getAddonResults(callId: string): Promise<{
    results: Array<{
      addon_type: string;
      status: string;
      result_data: string | null;
      error_message: string | null;
      execution_time_ms: number;
      created_at: number;
    }>;
  }> {
    return this.request(`/api/addon-results/${callId}`, {
      method: 'GET',
    });
  }

  // Intent Analysis (with KV caching)
  async getIntentAnalysis(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    calls: Array<any>;
    stats: {
      totalCalls: number;
      answeredCalls: number;
      avgConfidence: number;
      intentDistribution: Array<{ intent: string; count: number }>;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/intent-analysis${query ? '?' + query : ''}`, {
      method: 'GET',
    });
  }

  // Get top keywords with sentiment
  async getKeywords(): Promise<Array<{
    keyword: string;
    count: number;
    positive_count: number;
    neutral_count: number;
    negative_count: number;
    avg_sentiment: number;
    last_detected_at: number;
  }>> {
    return this.request('/api/keywords', {
      method: 'GET',
    });
  }
}

// Export singleton instance
export const d1Client = new D1Client(D1_API_URL);

// Check if D1 is configured
export const isD1Configured = !!import.meta.env.VITE_D1_API_URL;

