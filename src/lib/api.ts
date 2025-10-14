import { supabase } from './supabase';
import type { Agent, Call, MetricsSummary, DashboardMetrics, KeywordTrend } from '../types';

export const agentApi = {
  async getAll(): Promise<Agent[]> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Agent>): Promise<Agent> {
    const { data, error } = await supabase
      .from('agents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async create(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> {
    const { data, error } = await supabase
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
    let query = supabase.from('calls').select('*');

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
    let query = supabase
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
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    let query = supabase
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
