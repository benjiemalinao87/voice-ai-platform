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
  phone_number?: string;
  customer_name?: string;
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

export interface AgentKnowledgeFile {
  id: string;
  agent_id: string;
  vapi_file_id: string;
  file_name: string;
  file_size: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CallIntent {
  id: string;
  call_id: string;
  intent: string;
  intent_reasoning: string;
  mood: 'positive' | 'neutral' | 'negative';
  mood_confidence: number;
  mood_reasoning: string;
  call_date: string;
  duration_seconds: number;
  language: 'en' | 'es';
  was_answered: boolean;
  transcript_excerpt: string;
  customer_name?: string;
  phone_number?: string;
}

// ============================================
// WEBHOOK INTERFACES
// ============================================

export interface Webhook {
  id: string;
  user_id: string;
  webhook_url: string;
  name: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  call_count?: number; // From JOIN with webhook_calls
}

export interface WebhookCall {
  id: string;
  webhook_id: string;
  user_id: string;
  vapi_call_id: string | null;
  phone_number: string | null;
  customer_number: string | null;
  recording_url: string | null;
  ended_reason: string;
  summary: string;
  structured_data: Record<string, any> | null;
  raw_payload?: string; // Not usually needed in frontend
  enhanced_data?: Record<string, any> | null; // Phone enrichment data from addons
  created_at: number;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  status: 'success' | 'error';
  http_status: number | null;
  payload_size: number | null;
  error_message: string | null;
  created_at: number;
}

// VAPI Webhook Payload Structure
export interface VapiWebhookPayload {
  message: {
    type: 'end-of-call-report';
    call: {
      id: string;
      assistantId?: string;
      startedAt?: string;
      endedAt?: string;
      cost?: number;
      costBreakdown?: Record<string, any>;
    };
    phoneNumber?: {
      number: string;
      country?: string;
      carrier?: string;
    };
    customer?: {
      number?: string;
      name?: string;
      email?: string;
    };
    artifact?: {
      recordingUrl?: string;
      transcript?: string;
      stereoRecordingUrl?: string;
    };
    endedReason: 'hangup' | 'assistant-error' | 'pipeline-error' | 'assistant-request' | string;
    summary?: string;
    transcript?: string;
    analysis?: {
      structuredData?: Record<string, any>;
      sentiment?: string;
      intent?: string;
      successEvaluation?: boolean;
    };
  };
}
