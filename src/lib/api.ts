import { VapiClient, type VapiAssistant, type VapiCall, type VapiPhoneNumber } from './vapi';
import type { Agent, Call, MetricsSummary, DashboardMetrics, KeywordTrend } from '../types';

// Helper functions to convert Voice AI API data to our format
function convertVapiAssistantToAgent(vapiAssistant: VapiAssistant, phoneNumber?: string | null): Agent {
  return {
    id: vapiAssistant.id,
    name: vapiAssistant.name || 'Unnamed Assistant',
    voice_id: vapiAssistant.voice?.voiceId || '',
    voice_name: vapiAssistant.voice?.provider || 'Default Voice',
    tone: 'professional',
    response_style: 'adaptive',
    system_prompt: vapiAssistant.model?.messages?.[0]?.content || '',
    conversation_prompt: vapiAssistant.firstMessage || '',
    is_active: true,
    api_key: '',
    phone_number: phoneNumber || null,
    created_at: vapiAssistant.createdAt,
    updated_at: vapiAssistant.updatedAt,
  };
}

function convertVapiCallToCall(vapiCall: VapiCall): Call {
  const duration = vapiCall.startedAt && vapiCall.endedAt
    ? Math.floor((new Date(vapiCall.endedAt).getTime() - new Date(vapiCall.startedAt).getTime()) / 1000)
    : 0;

  const wasAnswered = vapiCall.status === 'ended' && duration > 0;

  // Extract sentiment from analysis
  let sentimentScore = 0;
  if (vapiCall.analysis?.sentiment) {
    const sentiment = vapiCall.analysis.sentiment.toLowerCase();
    if (sentiment.includes('positive')) sentimentScore = 0.7;
    else if (sentiment.includes('negative')) sentimentScore = -0.7;
  }

  return {
    id: vapiCall.id,
    agent_id: vapiCall.assistantId || '',
    call_date: vapiCall.createdAt,
    duration_seconds: duration,
    was_answered: wasAnswered,
    language: 'en', // Voice AI API doesn't expose this directly
    summary: vapiCall.summary || null,
    summary_length: vapiCall.summary?.length || 0,
    is_qualified_lead: vapiCall.analysis?.successEvaluation === 'true' || false,
    has_appointment_intent: vapiCall.summary?.toLowerCase().includes('appointment') || false,
    crm_lead_created: false,
    crm_sync_status: 'pending',
    sentiment_score: sentimentScore,
    transcript: vapiCall.transcript || null,
    created_at: vapiCall.createdAt,
  };
}

// Mock data for demo mode
const mockAgent: Agent = {
  id: '1',
  name: 'Sales Agent',
  voice_id: 'en-US-neural-pro-1',
  voice_name: 'Professional Female Voice',
  tone: 'professional',
  response_style: 'adaptive',
  system_prompt: 'You are a helpful sales assistant for a voice AI company.',
  conversation_prompt: 'Greet the caller and ask how you can help them today.',
  is_active: true,
  api_key: 'demo_api_key_12345',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCalls: Call[] = Array.from({ length: 30 }, (_, i) => ({
  id: `call-${i}`,
  agent_id: '1',
  call_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
  duration_seconds: 120 + Math.floor(Math.random() * 300),
  was_answered: Math.random() > 0.15,
  language: Math.random() > 0.3 ? 'en' : 'es',
  summary: 'Demo call summary - customer inquired about services and pricing options.',
  summary_length: 150 + Math.floor(Math.random() * 200),
  is_qualified_lead: Math.random() > 0.6,
  has_appointment_intent: Math.random() > 0.7,
  crm_lead_created: Math.random() > 0.5,
  crm_sync_status: Math.random() > 0.2 ? 'success' : 'error',
  sentiment_score: -0.5 + Math.random() * 1.5,
  transcript: 'Demo transcript - This is a sample conversation between the agent and customer.',
  created_at: new Date().toISOString()
}));

export const agentApi = {
  async getAll(vapiClient?: VapiClient | null, filterOptions?: { orgId?: string | null; namePattern?: string | null }): Promise<Agent[]> {
    // ALWAYS fetch directly from VAPI API (no cache) for real-time updates
    if (vapiClient) {
      try {
        console.log('[agentApi.getAll] Fetching assistants directly from API...');
        const assistants = await vapiClient.listAssistants() as VapiAssistant[];
        console.log(`[agentApi.getAll] Received ${assistants.length} assistants from API`);

        let filteredAssistants = assistants;

        // Filter by organization if orgId is provided
        if (filterOptions?.orgId) {
          filteredAssistants = filteredAssistants.filter(a => a.orgId === filterOptions.orgId);
        }

        // Filter by name pattern if provided (case-insensitive partial match)
        if (filterOptions?.namePattern) {
          const pattern = filterOptions.namePattern.toLowerCase();
          filteredAssistants = filteredAssistants.filter(a =>
            a.name?.toLowerCase().includes(pattern)
          );
        }

        // Fetch phone numbers and create a map of assistantId -> phone number
        let phoneNumberMap = new Map<string, string>();
        try {
          const phoneNumbers = await vapiClient.listPhoneNumbers() as VapiPhoneNumber[];
          phoneNumbers.forEach(phone => {
            if (phone.assistantId && phone.number) {
              phoneNumberMap.set(phone.assistantId, phone.number);
            }
          });
        } catch (phoneError) {
          console.warn('Failed to fetch phone numbers:', phoneError);
        }

        const result = filteredAssistants.map(assistant =>
          convertVapiAssistantToAgent(assistant, phoneNumberMap.get(assistant.id))
        );
        console.log(`[agentApi.getAll] Returning ${result.length} filtered assistants`);
        return result;
      } catch (vapiError) {
        console.error('[agentApi.getAll] API error:', vapiError);
      }
    }

    // Fallback to demo data if no client or error
    console.warn('[agentApi.getAll] No client available, returning demo data');
    return Promise.resolve([mockAgent]);
  },

  async getById(id: string, vapiClient?: VapiClient | null): Promise<Agent | null> {
    // ALWAYS fetch directly from VAPI API (no cache) for real-time updates
    if (vapiClient) {
      try {
        console.log(`[agentApi.getById] Fetching assistant ${id} directly from API...`);
        const assistant = await vapiClient.getAssistant(id) as VapiAssistant;

        // Fetch phone numbers to find the one assigned to this assistant
        let phoneNumber: string | null = null;
        try {
          const phoneNumbers = await vapiClient.listPhoneNumbers() as VapiPhoneNumber[];
          const assignedPhone = phoneNumbers.find(phone => phone.assistantId === id);
          phoneNumber = assignedPhone?.number || null;
        } catch (phoneError) {
          console.warn('Failed to fetch phone numbers:', phoneError);
        }

        return convertVapiAssistantToAgent(assistant, phoneNumber);
      } catch (vapiError) {
        console.error('[agentApi.getById] API error:', vapiError);
      }
    }

    // Fallback to demo data if no client or error
    console.warn('[agentApi.getById] No client available, returning demo data');
    return Promise.resolve(mockAgent);
  },

  async update(id: string, updates: Partial<Agent>, vapiClient?: VapiClient | null): Promise<Agent> {
    // ALWAYS use direct VAPI API (no cache) for real-time updates
    if (!vapiClient) {
      throw new Error('API client is required for updating assistants');
    }

    try {
      console.log(`[agentApi.update] Updating assistant ${id} directly via API...`);

      // First get the current assistant to preserve all fields
      const currentAssistant = await vapiClient.getAssistant(id) as VapiAssistant;

      // Build update object, preserving existing values if not being updated
      const vapiUpdates: any = {};

      // Only include fields that are being updated
      if (updates.name !== undefined) {
        vapiUpdates.name = updates.name;
      }

      if (updates.voice_id !== undefined || updates.voice_name !== undefined) {
        vapiUpdates.voice = {
          provider: 'vapi',
          voiceId: updates.voice_id || currentAssistant.voice?.voiceId
        };
      }

      if (updates.system_prompt !== undefined || updates.conversation_prompt !== undefined) {
        vapiUpdates.model = {
          provider: currentAssistant.model?.provider || 'openai',
          model: currentAssistant.model?.model || 'gpt-4o',
          temperature: currentAssistant.model?.temperature,
          maxTokens: currentAssistant.model?.maxTokens,
          messages: [{
            role: 'system',
            content: updates.system_prompt ?? currentAssistant.model?.messages?.[0]?.content ?? ''
          }]
        };
      }

      if (updates.conversation_prompt !== undefined) {
        vapiUpdates.firstMessage = updates.conversation_prompt;
      }

      // Update directly via VAPI API
      const updatedAssistant = await vapiClient.updateAssistant(id, vapiUpdates) as VapiAssistant;
      console.log('[agentApi.update] Assistant updated successfully');

      return convertVapiAssistantToAgent(updatedAssistant);
    } catch (error) {
      console.error('[agentApi.update] Update error:', error);
      throw error;
    }
  },

  async create(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>, vapiClient?: VapiClient | null, serverUrl?: string): Promise<Agent> {
    // ALWAYS use direct VAPI API (no cache) for real-time updates
    if (!vapiClient) {
      throw new Error('API client is required for creating assistants');
    }

    try {
      console.log('[agentApi.create] Creating assistant directly via API...');

      const vapiAgent: any = {
        name: agent.name,
        voice: {
          provider: 'vapi',
          voiceId: agent.voice_id
        },
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [{ role: 'system', content: agent.system_prompt }]
        },
        firstMessage: agent.conversation_prompt,
      };

      // Add server URL if provided (webhook attachment)
      if (serverUrl) {
        vapiAgent.server = {
          url: serverUrl,
          timeoutSeconds: 30
        };
      }

      // Create directly via VAPI API
      const createdAssistant = await vapiClient.createAssistant(vapiAgent) as VapiAssistant;
      console.log('[agentApi.create] Assistant created successfully:', createdAssistant.id);

      return convertVapiAssistantToAgent(createdAssistant);
    } catch (error) {
      console.error('[agentApi.create] Create error:', error);
      throw error;
    }
  },

  async delete(id: string, vapiClient?: VapiClient | null): Promise<void> {
    // ALWAYS use direct VAPI API (no cache) for real-time updates
    if (!vapiClient) {
      throw new Error('API client is required for deleting assistants');
    }

    try {
      console.log(`[agentApi.delete] Deleting assistant ${id} directly via API...`);
      await vapiClient.deleteAssistant(id);
      console.log('[agentApi.delete] Assistant deleted successfully');
    } catch (error) {
      console.error('[agentApi.delete] Delete error:', error);
      throw error;
    }
  }
};

export const callsApi = {
  async getAll(agentId?: string, dateFrom?: string, dateTo?: string, vapiClient?: VapiClient | null): Promise<Call[]> {
    // Try Voice AI API first if client is provided
    if (vapiClient) {
      try {
        const params: any = { limit: 1000 };
        if (agentId) params.assistantId = agentId;
        if (dateFrom) params.createdAtGt = dateFrom;
        if (dateTo) params.createdAtLt = dateTo;

        const vapiCalls = await vapiClient.listCalls(params) as VapiCall[];
        return vapiCalls.map(convertVapiCallToCall);
      } catch (error) {
        console.error('CHAU Voice AI API error, falling back to demo data:', error);
      }
    }

    // Fallback to demo data
    let filteredCalls = [...mockCalls];

    if (dateFrom) {
      filteredCalls = filteredCalls.filter(c => c.call_date >= dateFrom);
    }
    if (dateTo) {
      filteredCalls = filteredCalls.filter(c => c.call_date <= dateTo);
    }

    return Promise.resolve(filteredCalls);
  },

  async getMetrics(agentId?: string, dateFrom?: string, dateTo?: string, vapiClient?: VapiClient | null): Promise<DashboardMetrics> {
    const calls = await this.getAll(agentId, dateFrom, dateTo, vapiClient);

    const totalCalls = calls.length;
    const answeredCalls = calls.filter(c => c.was_answered).length;
    const unansweredCalls = totalCalls - answeredCalls;
    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;

    const spanishCalls = calls.filter(c => c.language === 'es').length;
    const englishCalls = calls.filter(c => c.language === 'en').length;
    const spanishCallsPercent = totalCalls > 0 ? (spanishCalls / totalCalls) * 100 : 0;
    const englishCallsPercent = totalCalls > 0 ? (englishCalls / totalCalls) * 100 : 0;

    const summaries = calls.filter(c => c.summary_length > 0);
    const avgSummaryLength = summaries.length > 0
      ? summaries.reduce((sum, c) => sum + c.summary_length, 0) / summaries.length
      : 0;

    const qualifiedLeadsCount = calls.filter(c => c.is_qualified_lead).length;
    const qualificationRate = answeredCalls > 0 ? (qualifiedLeadsCount / answeredCalls) * 100 : 0;

    const appointmentsDetected = calls.filter(c => c.has_appointment_intent).length;
    const appointmentDetectionRate = answeredCalls > 0 ? (appointmentsDetected / answeredCalls) * 100 : 0;

    const crmSuccessful = calls.filter(c => c.crm_lead_created && c.crm_sync_status === 'success').length;
    const crmAttempts = calls.filter(c => c.crm_sync_status !== 'pending').length;
    const crmSuccessRate = crmAttempts > 0 ? (crmSuccessful / crmAttempts) * 100 : 0;

    const sentimentCalls = calls.filter(c => c.was_answered);
    const avgSentiment = sentimentCalls.length > 0
      ? sentimentCalls.reduce((sum, c) => sum + c.sentiment_score, 0) / sentimentCalls.length
      : 0;

    const avgHandlingTime = answeredCalls > 0
      ? calls.filter(c => c.was_answered).reduce((sum, c) => sum + c.duration_seconds, 0) / answeredCalls
      : 0;

    const automationRate = answeredCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;

    return {
      totalCalls,
      answeredCalls,
      unansweredCalls,
      answerRate,
      spanishCallsPercent,
      englishCallsPercent,
      avgSummaryLength,
      qualifiedLeadsCount,
      qualificationRate,
      appointmentDetectionRate,
      crmSuccessRate,
      avgSentiment,
      avgHandlingTime,
      automationRate
    };
  },

  async getKeywordTrends(_agentId?: string, _limit: number = 10): Promise<KeywordTrend[]> {
    // Return demo data (could be enhanced to extract from Voice AI call summaries in the future)
    return Promise.resolve([
      { keyword: 'appointment', count: 287 },
      { keyword: 'pricing', count: 245 },
      { keyword: 'schedule', count: 198 },
      { keyword: 'availability', count: 176 },
      { keyword: 'urgent', count: 142 }
    ]);
  }
};

export const metricsApi = {
  async getDailySummary(_agentId?: string, _days: number = 30): Promise<MetricsSummary[]> {
    // Return empty array (metrics are calculated from calls data instead)
    return Promise.resolve([]);
  }
};
