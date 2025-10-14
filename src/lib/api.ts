import { supabase, isDemo } from './supabase';
import type { Agent, Call, MetricsSummary, DashboardMetrics, KeywordTrend } from '../types';

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
  summary_length: 150 + Math.floor(Math.random() * 200),
  is_qualified_lead: Math.random() > 0.6,
  has_appointment_intent: Math.random() > 0.7,
  crm_lead_created: Math.random() > 0.5,
  crm_sync_status: Math.random() > 0.2 ? 'success' : 'error',
  sentiment_score: -0.5 + Math.random() * 1.5,
  created_at: new Date().toISOString()
}));

export const agentApi = {
  async getAll(): Promise<Agent[]> {
    if (isDemo) {
      return Promise.resolve([mockAgent]);
    }
    const { data, error } = await supabase!
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Agent | null> {
    if (isDemo) {
      return Promise.resolve(mockAgent);
    }
    const { data, error } = await supabase!
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Agent>): Promise<Agent> {
    if (isDemo) {
      return Promise.resolve({ ...mockAgent, ...updates });
    }
    const { data, error } = await supabase!
      .from('agents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async create(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> {
    if (isDemo) {
      return Promise.resolve({ ...mockAgent, ...agent });
    }
    const { data, error } = await supabase!
      .from('agents')
      .insert([agent])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

export const callsApi = {
  async getAll(agentId?: string, dateFrom?: string, dateTo?: string): Promise<Call[]> {
    if (isDemo) {
      let filteredCalls = [...mockCalls];

      if (dateFrom) {
        filteredCalls = filteredCalls.filter(c => c.call_date >= dateFrom);
      }
      if (dateTo) {
        filteredCalls = filteredCalls.filter(c => c.call_date <= dateTo);
      }

      return Promise.resolve(filteredCalls);
    }

    let query = supabase!.from('calls').select('*');

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    if (dateFrom) {
      query = query.gte('call_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('call_date', dateTo);
    }

    const { data, error } = await query.order('call_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getMetrics(agentId?: string, dateFrom?: string, dateTo?: string): Promise<DashboardMetrics> {
    const calls = await this.getAll(agentId, dateFrom, dateTo);

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

  async getKeywordTrends(agentId?: string, limit: number = 10): Promise<KeywordTrend[]> {
    if (isDemo) {
      return Promise.resolve([
        { keyword: 'appointment', count: 287 },
        { keyword: 'pricing', count: 245 },
        { keyword: 'schedule', count: 198 },
        { keyword: 'availability', count: 176 },
        { keyword: 'urgent', count: 142 }
      ]);
    }

    let query = supabase!
      .from('call_keywords')
      .select('keyword, frequency');

    if (agentId) {
      query = query.eq('call_id', agentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const keywordMap = new Map<string, number>();
    data?.forEach(item => {
      const current = keywordMap.get(item.keyword) || 0;
      keywordMap.set(item.keyword, current + item.frequency);
    });

    return Array.from(keywordMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
};

export const metricsApi = {
  async getDailySummary(agentId?: string, days: number = 30): Promise<MetricsSummary[]> {
    if (isDemo) {
      return Promise.resolve([]);
    }

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    let query = supabase!
      .from('metrics_summary')
      .select('*')
      .gte('date', dateFrom.toISOString().split('T')[0]);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }
};
