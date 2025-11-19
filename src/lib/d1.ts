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
    selectedWorkspaceId?: string;
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
    selectedWorkspaceId?: string | null;
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
    _t?: number; // Cache-busting timestamp
  }): Promise<{
    results: Array<{
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
      customer_name?: string | null;
      caller_name?: string | null;
      intent?: string | null;
      sentiment?: string | null;
      outcome?: string | null;
      duration_seconds?: number | null;
      enhanced_data?: any | null;
      caller_type?: string | null;
      carrier_name?: string | null;
      line_type?: string | null;
    }>;
    total: number;
  } | any> {
    const queryParams = new URLSearchParams();
    if (params?.webhook_id) queryParams.append('webhook_id', params.webhook_id);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?._t) queryParams.append('_t', params._t.toString()); // Cache-busting

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

  async saveEmbeddingSettings(url: string, buttonName: string): Promise<{ message: string }> {
    return this.request('/api/addons/embedding/settings', {
      method: 'POST',
      body: JSON.stringify({ url, buttonName }),
    });
  }

  async getEmbeddingSettings(): Promise<{ url: string | null; buttonName: string | null; isEnabled: boolean }> {
    return this.request('/api/addons/embedding/settings', {
      method: 'GET',
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

  // Get appointments data from structured outputs
  async getAppointments(): Promise<Array<{
    id: string;
    vapi_call_id: string;
    phone_number: string | null;
    customer_name: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    quality_score: number | null;
    issue_type: string | null;
    customer_frustrated: boolean | null;
    escalation_required: boolean | null;
    call_summary: string | null;
    product: string | null;
    created_at: number;
  }>> {
    return this.request('/api/appointments', {
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

  // Translate text using OpenAI
  async translateText(text: string, targetLanguage: string): Promise<{
    success: boolean;
    translatedText?: string;
    error?: string;
  }> {
    return this.request('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text, targetLanguage }),
    });
  }

  // Get concurrent calls stats
  async getConcurrentCalls(): Promise<{
    current: number;
    peak: number;
  }> {
    return this.request('/api/concurrent-calls', {
      method: 'GET',
    });
  }

  // Get concurrent calls time-series data
  async getConcurrentCallsTimeSeries(params?: {
    granularity?: 'minute' | 'hour' | 'day';
    limit?: number;
  }): Promise<{
    data: number[];
    labels: string[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.granularity) queryParams.append('granularity', params.granularity);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString();
    return this.request(`/api/concurrent-calls/timeseries${query ? '?' + query : ''}`, {
      method: 'GET',
    });
  }

  // Get call ended reasons data
  async getCallEndedReasons(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<{
    dates: string[];
    reasons: Record<string, number[]>;
    colors: Record<string, string>;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const query = queryParams.toString();
    return this.request(`/api/call-ended-reasons${query ? '?' + query : ''}`, {
      method: 'GET',
    });
  }

  // Phone Numbers Management
  async getTwilioPhoneNumbers(): Promise<Array<{
    sid: string;
    phoneNumber: string;
    friendlyName?: string;
    capabilities?: {
      voice?: boolean;
      sms?: boolean;
    };
  }>> {
    return this.request('/api/twilio/phone-numbers', {
      method: 'GET',
    });
  }

  async importTwilioNumber(payload: {
    sid?: string;
    phoneNumber?: string;
    name?: string;
  }): Promise<{
    id: string;
    number: string;
    name?: string;
  }> {
    return this.request('/api/vapi/import-twilio', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createVapiPhoneNumber(payload: {
    areaCode: string;
    name?: string;
  }): Promise<{
    id: string;
    number: string;
    name?: string;
  }> {
    return this.request('/api/vapi/phone-number', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async assignAssistantToPhoneNumber(phoneNumberId: string, assistantId: string | null): Promise<void> {
    return this.request(`/api/vapi/phone-number/${phoneNumberId}/assistant`, {
      method: 'PATCH',
      body: JSON.stringify({ assistantId }),
    });
  }

  async getAssistants(): Promise<{ assistants: any[], cached: boolean }> {
    return this.request('/api/assistants', {
      method: 'GET',
    });
  }

  async getAssistant(assistantId: string): Promise<{ assistant: any, cached: boolean }> {
    return this.request(`/api/assistants/${assistantId}`, {
      method: 'GET',
    });
  }

  async updateAssistant(assistantId: string, updates: any): Promise<{ assistant: any }> {
    return this.request(`/api/assistants/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async createAssistant(assistantData: any): Promise<{ assistant: any }> {
    return this.request('/api/assistants', {
      method: 'POST',
      body: JSON.stringify(assistantData),
    });
  }

  async deleteAssistant(assistantId: string): Promise<{ success: boolean }> {
    return this.request(`/api/assistants/${assistantId}`, {
      method: 'DELETE',
    });
  }

  // Workspaces
  async getWorkspaces(): Promise<{
    workspaces: Array<{
      id: string;
      name: string;
      owner_user_id: string;
      role: string;
      status: string;
      created_at: number;
      updated_at: number;
    }>;
  }> {
    return this.request('/api/workspaces', {
      method: 'GET',
    });
  }

  async createWorkspace(name: string): Promise<{
    id: string;
    name: string;
    owner_user_id: string;
    created_at: number;
    updated_at: number;
  }> {
    return this.request('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async inviteWorkspaceMember(workspaceId: string, email: string, role?: string): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role: role || 'member' }),
    });
  }

  async getWorkspaceMembers(workspaceId: string): Promise<{
    workspace: { id: string; name: string };
    members: Array<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      joinedAt: number | null;
    }>;
  }> {
    return this.request(`/api/workspaces/${workspaceId}/members`, {
      method: 'GET',
    });
  }

  async removeWorkspaceMember(workspaceId: string, memberId: string): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' });
  }

  async updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: 'member' | 'admin'): Promise<{ success: boolean }> {
    return this.request(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  // Dashboard Summary - SQL-optimized metrics
  async getDashboardSummary(): Promise<{
    totalCalls: number;
    answeredCalls: number;
    unansweredCalls: number;
    answerRate: number;
    avgHandlingTime: number;
    avgSummaryLength: number;
    qualifiedLeadsCount: number;
    appointmentsDetected: number;
    totalCallMinutes: number;
    positiveCalls: number;
    negativeCalls: number;
    neutralCalls: number;
  }> {
    return this.request('/api/dashboard-summary', {
      method: 'GET',
    });
  }

  // Get call distribution by voice agent
  async getAgentDistribution(): Promise<Array<{
    assistant_name: string;
    call_count: number;
  }>> {
    return this.request('/api/agent-distribution', {
      method: 'GET',
    });
  }

  // ============================================
  // SALESFORCE INTEGRATION
  // ============================================

  /**
   * Initiate Salesforce OAuth flow
   * Opens a popup window for user to authorize Salesforce access
   */
  async initiateSalesforceOAuth(): Promise<{ authUrl: string }> {
    const response = await this.request<{ success: boolean; authUrl: string }>(
      '/api/salesforce/oauth/initiate',
      { method: 'GET' }
    );
    return { authUrl: response.authUrl };
  }

  /**
   * Get Salesforce connection status
   * Returns whether Salesforce is connected and token expiration
   */
  async getSalesforceStatus(): Promise<{
    connected: boolean;
    instanceUrl: string | null;
    tokenExpiresAt: number | null;
  }> {
    const response = await this.request<{
      success: boolean;
      connected: boolean;
      instanceUrl: string | null;
      tokenExpiresAt: number | null;
    }>('/api/salesforce/status', { method: 'GET' });

    return {
      connected: response.connected,
      instanceUrl: response.instanceUrl,
      tokenExpiresAt: response.tokenExpiresAt,
    };
  }

  /**
   * Disconnect Salesforce
   * Removes OAuth tokens and disconnects integration
   */
  async disconnectSalesforce(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      '/api/salesforce/disconnect',
      { method: 'DELETE' }
    );
  }

  /**
   * Get Salesforce sync logs
   * Returns paginated list of sync attempts with their status
   */
  async getSalesforceSyncLogs(params?: {
    limit?: number;
    offset?: number;
    status?: 'success' | 'error' | 'skipped';
  }): Promise<{
    logs: Array<{
      id: string;
      call_id: string;
      salesforce_record_id: string | null;
      salesforce_task_id: string | null;
      salesforce_event_id: string | null;
      appointment_created: boolean;
      status: 'success' | 'error' | 'skipped';
      error_message: string | null;
      phone_number: string | null;
      created_at: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.status) queryParams.set('status', params.status);

    const url = `/api/salesforce/sync-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    return this.request<{
      success: boolean;
      logs: Array<any>;
      total: number;
      limit: number;
      offset: number;
    }>(url, { method: 'GET' }).then(response => ({
      logs: response.logs,
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    }));
  }

  // ============================================
  // HUBSPOT INTEGRATION
  // ============================================

  /**
   * Initiate HubSpot OAuth flow
   * Opens a popup window for user to authorize HubSpot access
   */
  async initiateHubSpotOAuth(): Promise<{ authUrl: string }> {
    const response = await this.request<{ success: boolean; authUrl: string }>(
      '/api/hubspot/oauth/initiate',
      { method: 'GET' }
    );
    return { authUrl: response.authUrl };
  }

  /**
   * Get HubSpot connection status
   * Returns whether HubSpot is connected and token expiration
   */
  async getHubSpotStatus(): Promise<{
    connected: boolean;
    tokenExpiresAt: number | null;
  }> {
    const response = await this.request<{
      success: boolean;
      connected: boolean;
      tokenExpiresAt: number | null;
    }>('/api/hubspot/status', { method: 'GET' });

    return {
      connected: response.connected,
      tokenExpiresAt: response.tokenExpiresAt,
    };
  }

  /**
   * Disconnect HubSpot
   * Removes OAuth tokens and disconnects integration
   */
  async disconnectHubSpot(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      '/api/hubspot/disconnect',
      { method: 'DELETE' }
    );
  }

  /**
   * Get HubSpot sync logs
   * Returns paginated list of sync attempts with their status
   */
  async getHubSpotSyncLogs(params?: {
    limit?: number;
    offset?: number;
    status?: 'success' | 'error' | 'skipped';
  }): Promise<{
    logs: Array<{
      id: string;
      call_id: string;
      contact_id: string | null;
      engagement_id: string | null;
      status: 'success' | 'error' | 'skipped';
      error_message: string | null;
      phone_number: string | null;
      created_at: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.status) queryParams.set('status', params.status);

    const url = `/api/hubspot/sync-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    return this.request<{
      success: boolean;
      logs: Array<any>;
      total: number;
      limit: number;
      offset: number;
    }>(url, { method: 'GET' }).then(response => ({
      logs: response.logs,
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    }));
  }

  // ============================================
  // DYNAMICS 365 INTEGRATION
  // ============================================

  /**
   * Initiate Dynamics 365 OAuth flow
   * Opens a popup window for user to authorize Dynamics 365 access
   */
  async initiateDynamicsOAuth(instanceUrl: string): Promise<{ authUrl: string }> {
    const response = await this.request<{ success: boolean; authUrl: string }>(
      `/api/dynamics/oauth/initiate?instanceUrl=${encodeURIComponent(instanceUrl)}`,
      { method: 'GET' }
    );
    return { authUrl: response.authUrl };
  }

  /**
   * Get Dynamics 365 connection status
   * Returns whether Dynamics 365 is connected and token expiration
   */
  async getDynamicsStatus(): Promise<{
    connected: boolean;
    instanceUrl: string | null;
    tokenExpiresAt: number | null;
  }> {
    const response = await this.request<{
      success: boolean;
      connected: boolean;
      instanceUrl: string | null;
      tokenExpiresAt: number | null;
    }>('/api/dynamics/status', { method: 'GET' });

    return {
      connected: response.connected,
      instanceUrl: response.instanceUrl,
      tokenExpiresAt: response.tokenExpiresAt,
    };
  }

  /**
   * Disconnect Dynamics 365
   * Removes OAuth tokens and disconnects integration
   */
  async disconnectDynamics(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      '/api/dynamics/disconnect',
      { method: 'DELETE' }
    );
  }

  /**
   * Get Dynamics 365 sync logs
   * Returns paginated list of sync attempts with their status
   */
  async getDynamicsSyncLogs(params?: {
    limit?: number;
    offset?: number;
    status?: 'success' | 'error' | 'skipped';
  }): Promise<{
    logs: Array<{
      id: string;
      call_id: string;
      dynamics_record_id: string | null;
      dynamics_activity_id: string | null;
      dynamics_appointment_id: string | null;
      appointment_created: boolean;
      lead_created: boolean;
      status: 'success' | 'error' | 'skipped';
      error_message: string | null;
      phone_number: string | null;
      created_at: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.status) queryParams.set('status', params.status);

    const url = `/api/dynamics/sync-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    return this.request<{
      success: boolean;
      logs: Array<any>;
      total: number;
      limit: number;
      offset: number;
    }>(url, { method: 'GET' }).then(response => ({
      logs: response.logs,
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    }));
  }

  // ============================================
  // GENERIC HTTP METHODS
  // ============================================

  // Generic HTTP methods for custom API calls
  async get<T = any>(endpoint: string, token?: string): Promise<T> {
    return this.request(endpoint, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    });
  }

  async post<T = any>(endpoint: string, data: any, token?: string): Promise<T> {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    });
  }

  async patch<T = any>(endpoint: string, data: any, token?: string): Promise<T> {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    });
  }

  async delete<T = any>(endpoint: string, token?: string): Promise<T> {
    return this.request(endpoint, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    });
  }
}

// Export singleton instance
export const d1Client = new D1Client(D1_API_URL);

// Check if D1 is configured
export const isD1Configured = !!import.meta.env.VITE_D1_API_URL;

