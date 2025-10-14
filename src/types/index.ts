export interface Agent {
  id: string;
  name: string;
  voice_id: string;
  voice_name: string;
  system_prompt: string;
  conversation_prompt: string;
  tone: 'professional' | 'friendly' | 'casual';
  response_style: 'concise' | 'detailed' | 'adaptive';
  api_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  agent_id: string;
  call_date: string;
  duration_seconds: number;
  language: 'en' | 'es';
  was_answered: boolean;
  sentiment_score: number;
  summary: string | null;
  summary_length: number;
  is_qualified_lead: boolean;
  has_appointment_intent: boolean;
  crm_lead_created: boolean;
  crm_sync_status: 'success' | 'error' | 'pending';
  transcript: string | null;
  created_at: string;
}

export interface CallKeyword {
  id: string;
  call_id: string;
  keyword: string;
  frequency: number;
  created_at: string;
}

export interface MetricsSummary {
  id: string;
  agent_id: string;
  date: string;
  total_calls: number;
  answered_calls: number;
  spanish_calls: number;
  english_calls: number;
  avg_duration_seconds: number;
  avg_sentiment: number;
  qualified_leads: number;
  appointments_detected: number;
  crm_leads_created: number;
  created_at: string;
}

export interface DashboardMetrics {
  totalCalls: number;
  answeredCalls: number;
  unansweredCalls: number;
  answerRate: number;
  spanishCallsPercent: number;
  englishCallsPercent: number;
  avgSummaryLength: number;
  qualifiedLeadsCount: number;
  qualificationRate: number;
  appointmentDetectionRate: number;
  crmSuccessRate: number;
  avgSentiment: number;
  avgHandlingTime: number;
  automationRate: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface LanguageDistribution {
  language: string;
  count: number;
  percentage: number;
}

export interface KeywordTrend {
  keyword: string;
  count: number;
}
