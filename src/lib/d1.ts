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

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
    customerconnectWorkspaceId?: string | null;
    customerconnectApiKey?: string | null;
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

  // Get call ended reasons data (timeline view)
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

  // Get call ended reason counts (total counts, no date grouping)
  async getCallEndedReasonCounts(): Promise<Record<string, number>> {
    return this.request('/api/call-ended-reason-counts', {
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

  async resetMemberPassword(workspaceId: string, memberId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/workspaces/${workspaceId}/members/${memberId}/reset-password`, {
      method: 'POST',
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
    assistant_id: string;
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
  // AGENT FLOWS METHODS
  // ============================================

  /**
   * Save agent flow data
   * Links visual flow to a VAPI assistant
   */
  async saveAgentFlow(vapiAssistantId: string, flowData: any, configData: any): Promise<{
    success: boolean;
    id: string;
    vapiAssistantId: string;
  }> {
    return this.request('/api/agent-flows', {
      method: 'POST',
      body: JSON.stringify({ vapiAssistantId, flowData, configData }),
    });
  }

  /**
   * Get agent flow data by VAPI assistant ID
   */
  async getAgentFlow(vapiAssistantId: string): Promise<{
    exists: boolean;
    id?: string;
    vapiAssistantId?: string;
    flowData?: any;
    configData?: any;
    createdAt?: number;
    updatedAt?: number;
  }> {
    try {
      return await this.request(`/api/agent-flows/${vapiAssistantId}`, {
        method: 'GET',
      });
    } catch (error: any) {
      // If 404, return exists: false
      if (error.message?.includes('404')) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Update agent flow data
   */
  async updateAgentFlow(vapiAssistantId: string, flowData: any, configData: any): Promise<{
    success: boolean;
    vapiAssistantId: string;
  }> {
    return this.request(`/api/agent-flows/${vapiAssistantId}`, {
      method: 'PUT',
      body: JSON.stringify({ flowData, configData }),
    });
  }

  /**
   * Delete agent flow data
   */
  async deleteAgentFlow(vapiAssistantId: string): Promise<{ success: boolean }> {
    return this.request(`/api/agent-flows/${vapiAssistantId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Check which agents have flow data
   * Returns a map of assistantId -> hasFlow
   */
  async checkAgentFlows(assistantIds: string[]): Promise<Record<string, boolean>> {
    if (assistantIds.length === 0) {
      return {};
    }

    try {
      const response = await this.request<{ hasFlow: Record<string, boolean> }>('/api/agent-flows/check', {
        method: 'POST',
        body: JSON.stringify({ assistantIds }),
      });
      return response.hasFlow;
    } catch (error) {
      console.error('Error checking agent flows:', error);
      return {};
    }
  }

  // ============================================
  // AUTO WARM TRANSFER METHODS
  // ============================================

  /**
   * Get transfer agents for an assistant
   */
  async getTransferAgents(assistantId: string): Promise<{
    agents: Array<{
      id: string;
      assistant_id: string;
      phone_number: string;
      agent_name: string | null;
      priority: number;
      is_active: number;
      created_at: number;
      updated_at: number;
    }>;
    assistantId: string;
  }> {
    return this.request(`/api/assistants/${assistantId}/transfer-agents`, {
      method: 'GET',
    });
  }

  /**
   * Add a transfer agent to an assistant
   */
  async addTransferAgent(assistantId: string, data: {
    phone_number: string;
    agent_name?: string;
    priority?: number;
  }): Promise<{
    id: string;
    assistant_id: string;
    phone_number: string;
    agent_name: string | null;
    priority: number;
    is_active: number;
  }> {
    return this.request(`/api/assistants/${assistantId}/transfer-agents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a transfer agent
   */
  async updateTransferAgent(assistantId: string, agentId: string, data: {
    phone_number?: string;
    agent_name?: string;
    priority?: number;
    is_active?: boolean;
  }): Promise<any> {
    return this.request(`/api/assistants/${assistantId}/transfer-agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a transfer agent
   */
  async deleteTransferAgent(assistantId: string, agentId: string): Promise<{ success: boolean }> {
    return this.request(`/api/assistants/${assistantId}/transfer-agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get transfer settings for an assistant
   */
  async getTransferSettings(assistantId: string): Promise<{
    assistant_id: string;
    ring_timeout_seconds: number;
    max_attempts: number;
    enabled: number;
    announcement_message: string | null;
  }> {
    return this.request(`/api/assistants/${assistantId}/transfer-settings`, {
      method: 'GET',
    });
  }

  /**
   * Update transfer settings for an assistant
   */
  async updateTransferSettings(assistantId: string, data: {
    ring_timeout_seconds?: number;
    max_attempts?: number;
    enabled?: boolean;
    announcement_message?: string;
  }): Promise<any> {
    return this.request(`/api/assistants/${assistantId}/transfer-settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get auto transfer logs
   */
  async getAutoTransferLogs(params?: {
    assistant_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: Array<{
      id: string;
      transfer_id: string;
      vapi_call_id: string;
      assistant_id: string;
      agent_phone: string;
      agent_name: string | null;
      attempt_number: number;
      status: string;
      reason: string | null;
      started_at: number;
      ended_at: number | null;
      duration_seconds: number | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.assistant_id) queryParams.set('assistant_id', params.assistant_id);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const url = `/api/auto-transfer-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(url, { method: 'GET' });
  }

  /**
   * Get specific transfer details with all attempts
   */
  async getAutoTransferDetails(transferId: string): Promise<{
    transfer_id: string;
    attempts: Array<any>;
  }> {
    return this.request(`/api/auto-transfer-logs/${transferId}`, {
      method: 'GET',
    });
  }

  // ============================================
  // API KEYS METHODS
  // ============================================

  /**
   * List API keys for the current user
   */
  async getApiKeys(): Promise<{
    apiKeys: Array<{
      id: string;
      name: string;
      key_prefix: string;
      workspace_id: string | null;
      last_used_at: number | null;
      expires_at: number | null;
      created_at: number;
    }>;
  }> {
    return this.request('/api/api-keys', { method: 'GET' });
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: {
    name: string;
    expires_in_days?: number;
  }): Promise<{
    success: boolean;
    apiKey: string;
    keyPrefix: string;
    message: string;
  }> {
    return this.request('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // CAMPAIGNS METHODS
  // ============================================

  /**
   * List campaigns for the current workspace
   */
  async getCampaigns(): Promise<{
    campaigns: Array<{
      id: string;
      workspace_id: string;
      name: string;
      assistant_id: string;
      phone_number_id: string;
      status: string;
      scheduled_at: number | null;
      started_at: number | null;
      completed_at: number | null;
      total_leads: number;
      calls_completed: number;
      calls_answered: number;
      calls_failed: number;
      created_at: number;
      updated_at: number;
    }>;
  }> {
    return this.request('/api/campaigns', { method: 'GET' });
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: {
    name: string;
    assistant_id: string;
    phone_number_id: string;
    scheduled_at?: number;
    prompt_template?: string | null;
    first_message_template?: string | null;
  }): Promise<{ success: boolean; id: string; message: string }> {
    return this.request('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get campaign details
   */
  async getCampaign(campaignId: string): Promise<{
    campaign: {
      id: string;
      workspace_id: string;
      name: string;
      assistant_id: string;
      phone_number_id: string;
      status: string;
      scheduled_at: number | null;
      started_at: number | null;
      completed_at: number | null;
      total_leads: number;
      calls_completed: number;
      calls_answered: number;
      calls_failed: number;
      created_at: number;
      updated_at: number;
    };
  }> {
    return this.request(`/api/campaigns/${campaignId}`, { method: 'GET' });
  }

  /**
   * Update a campaign
   */
  async updateCampaign(campaignId: string, updates: {
    name?: string;
    assistant_id?: string;
    phone_number_id?: string;
    scheduled_at?: number | null;
    prompt_template?: string | null;
    first_message_template?: string | null;
  }): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(campaignId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/campaigns/${campaignId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Add leads to a campaign
   */
  async addLeadsToCampaign(campaignId: string, leadIds: string[]): Promise<{
    success: boolean;
    added: number;
    message: string;
  }> {
    return this.request(`/api/campaigns/${campaignId}/leads`, {
      method: 'POST',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
  }

  /**
   * Get campaign leads with call status
   */
  async getCampaignLeads(campaignId: string): Promise<{
    leads: Array<{
      id: string;
      campaign_id: string;
      lead_id: string;
      call_status: string;
      vapi_call_id: string | null;
      call_duration: number | null;
      call_outcome: string | null;
      called_at: number | null;
      firstname: string | null;
      lastname: string | null;
      phone: string;
      email: string | null;
      lead_source: string | null;
      product: string | null;
    }>;
  }> {
    return this.request(`/api/campaigns/${campaignId}/leads`, { method: 'GET' });
  }

  /**
   * Start a campaign
   */
  async startCampaign(campaignId: string): Promise<{
    success: boolean;
    message: string;
    status: string;
  }> {
    return this.request(`/api/campaigns/${campaignId}/start`, {
      method: 'POST',
    });
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<{
    success: boolean;
    message: string;
    status: string;
  }> {
    return this.request(`/api/campaigns/${campaignId}/pause`, {
      method: 'POST',
    });
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId: string): Promise<{
    success: boolean;
    message: string;
    status: string;
  }> {
    return this.request(`/api/campaigns/${campaignId}/cancel`, {
      method: 'POST',
    });
  }

  // ============================================
  // LEADS METHODS
  // ============================================

  /**
   * List leads for the current workspace
   */
  async getLeads(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{
    leads: Array<{
      id: string;
      workspace_id: string;
      firstname: string | null;
      lastname: string | null;
      phone: string;
      email: string | null;
      lead_source: string | null;
      product: string | null;
      notes: string | null;
      status: string;
      created_at: number;
      updated_at: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.status) queryParams.set('status', params.status);

    const url = `/api/leads${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(url, { method: 'GET' });
  }

  /**
   * Create a single lead
   */
  async createLead(lead: {
    firstname?: string;
    lastname?: string;
    phone: string;
    email?: string;
    lead_source?: string;
    product?: string;
    notes?: string;
  }): Promise<{ success: boolean; id: string; message: string }> {
    return this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(lead),
    });
  }

  /**
   * Bulk upload leads
   */
  async uploadLeads(leads: Array<{
    firstname?: string;
    lastname?: string;
    phone: string;
    email?: string;
    lead_source?: string;
    product?: string;
    notes?: string;
  }>): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: string[];
    message: string;
  }> {
    return this.request('/api/leads/upload', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    });
  }

  /**
   * Delete a lead
   */
  async deleteLead(leadId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/leads/${leadId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Update a lead
   */
  async updateLead(leadId: string, updates: {
    firstname?: string;
    lastname?: string;
    phone?: string;
    email?: string;
    lead_source?: string;
    product?: string;
    notes?: string;
    status?: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Get/create leads webhook URL for the workspace
   */
  async getLeadsWebhook(): Promise<{
    id: string;
    webhookUrl: string;
    token: string;
    isActive: boolean;
    createdAt: number;
  }> {
    return this.request('/api/leads/webhook', {
      method: 'GET',
    });
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

