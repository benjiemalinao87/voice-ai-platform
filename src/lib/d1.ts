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
    encryptedPrivateKey?: string;
    encryptedPublicKey?: string;
    selectedAssistantId?: string;
    selectedPhoneId?: string;
    encryptionSalt: string;
  }> {
    return this.request('/api/settings', {
      method: 'GET',
    });
  }

  async updateUserSettings(data: {
    encryptedPrivateKey?: string;
    encryptedPublicKey?: string;
    selectedAssistantId?: string | null;
    selectedPhoneId?: string | null;
  }): Promise<{ message: string }> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

// Export singleton instance
export const d1Client = new D1Client(D1_API_URL);

// Check if D1 is configured
export const isD1Configured = !!import.meta.env.VITE_D1_API_URL;

