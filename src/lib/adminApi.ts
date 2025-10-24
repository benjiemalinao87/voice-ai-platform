/**
 * Admin API Service
 * Connects to deepseek-test-livechat backend (/api/admin/*)
 * Handles SaaS owner operations: workspace management, subscriptions, monitoring
 */

// Backend URL - update this to match your deepseek-test-livechat backend
const ADMIN_API_BASE_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000/api/admin';

/**
 * Get JWT token from auth context
 */
const getAuthToken = async (): Promise<string | null> => {
  try {
    // Check localStorage for auth token (set by AuthContext)
    const token = localStorage.getItem('auth_token');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Make authenticated request to admin API
 */
const makeAdminRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  const url = `${ADMIN_API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Admin API Methods
 */
export const adminApi = {
  /**
   * Check if current user has admin access
   */
  async checkAdminAccess(): Promise<boolean> {
    try {
      const response = await makeAdminRequest('/dashboard');
      return response.success === true;
    } catch (error) {
      console.error('Admin access check failed:', error);
      return false;
    }
  },

  /**
   * Get dashboard overview statistics
   */
  async getDashboardOverview() {
    return makeAdminRequest('/dashboard');
  },

  /**
   * Get all workspaces with subscription details
   */
  async getWorkspaces() {
    return makeAdminRequest('/workspaces');
  },

  /**
   * Update workspace subscription plan
   */
  async updateWorkspaceSubscription(workspaceId: string, planName: string, reason: string) {
    return makeAdminRequest(`/workspaces/${workspaceId}/subscription`, {
      method: 'PUT',
      body: JSON.stringify({ planName, reason }),
    });
  },

  /**
   * Get workspace usage statistics
   */
  async getWorkspaceUsage(workspaceId: string) {
    return makeAdminRequest(`/workspaces/${workspaceId}/usage`);
  },

  /**
   * Get all subscription plans
   */
  async getSubscriptionPlans() {
    return makeAdminRequest('/subscription-plans');
  },

  /**
   * Update subscription plan configuration
   */
  async updateSubscriptionPlan(planId: string, updates: any) {
    return makeAdminRequest(`/subscription-plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Get admin action audit logs
   */
  async getAdminLogs(limit?: number, actionType?: string) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (actionType) params.append('action_type', actionType);

    const query = params.toString() ? `?${params}` : '';
    return makeAdminRequest(`/logs${query}`);
  },

  /**
   * Get user activity data for charts
   */
  async getUserActivity(timeRange: string = '7days') {
    return makeAdminRequest(`/user-activity?timeRange=${timeRange}`);
  },

  /**
   * Get user-workspace relationship details
   */
  async getUserWorkspaceDetails() {
    return makeAdminRequest('/user-workspace-details');
  },

  /**
   * Get API request summary
   */
  async getApiRequestSummary(timeRange: string = '24hours') {
    return makeAdminRequest(`/api-requests/summary?timeRange=${timeRange}`);
  },

  /**
   * Get endpoint usage for a workspace
   */
  async getEndpointUsage(workspaceId: string, timeRange: string = '24hours') {
    return makeAdminRequest(`/workspaces/${workspaceId}/endpoint-usage?timeRange=${timeRange}`);
  },

  /**
   * Get API key usage for a workspace
   */
  async getApiKeyUsage(workspaceId: string, timeRange: string = '24hours') {
    return makeAdminRequest(`/workspaces/${workspaceId}/api-key-usage?timeRange=${timeRange}`);
  },

  /**
   * Get rate limit violations
   */
  async getRateLimitViolations(workspaceId?: string, timeRange: string = '24hours') {
    const params = new URLSearchParams({ timeRange });
    if (workspaceId) params.append('workspaceId', workspaceId);

    return makeAdminRequest(`/rate-limit-violations?${params}`);
  },
};
