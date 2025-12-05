/**
 * Cloudflare Worker API for Voice AI Dashboard
 * Provides D1 database access and authentication
 */

import {
  generateId,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  encrypt,
  decrypt,
  generateSalt,
  generateTemporaryPassword
} from './auth';
import { VoiceAICache, CACHE_TTL } from './cache';
import { dispatchToOutboundWebhooks } from './outbound-webhooks';
import { sendTeamInviteEmail, sendPasswordResetEmail } from './email-service';
import {
  createOutboundWebhook,
  listOutboundWebhooks,
  updateOutboundWebhook,
  deleteOutboundWebhook,
  getOutboundWebhookLogs
} from './outbound-webhooks-api';
import {
  buildAuthUrl,
  exchangeCodeForToken,
  ensureValidToken
} from './salesforce-service';
import {
  buildAuthUrl as buildHubSpotAuthUrl,
  exchangeCodeForToken as exchangeHubSpotCodeForToken,
  ensureValidToken as ensureValidHubSpotToken,
  syncCallToHubSpot
} from './hubspot-service';
import {
  buildAuthUrl as buildDynamicsAuthUrl,
  exchangeCodeForToken as exchangeDynamicsCodeForToken,
  ensureValidToken as ensureValidDynamicsToken,
  syncCallToDynamics
} from './dynamics-service';
import {
  generateConferenceTwiML,
  generateAgentAnnouncementTwiML,
  dialAgentWithAnnouncement
} from './twilio-conference';

// Export Durable Object class
export { ActiveCallsRoom } from './active-calls-do';

// Cloudflare Worker types
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all(): Promise<D1Result>;
  first(): Promise<any>;
  run(): Promise<D1Result>;
}

interface D1Result {
  results: any[];
  success: boolean;
  meta: any;
}

interface KVNamespace {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: any): Promise<R2Object>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<R2Object | null>;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  body?: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

// Durable Object namespace type
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  RECORDINGS: R2Bucket;
  ACTIVE_CALLS: DurableObjectNamespace; // Durable Object for real-time active calls
  JWT_SECRET: string; // Set this in wrangler.toml as a secret
  SALESFORCE_CLIENT_ID: string;
  SALESFORCE_CLIENT_SECRET: string;
  HUBSPOT_CLIENT_ID: string;
  HUBSPOT_CLIENT_SECRET: string;
  DYNAMICS_CLIENT_ID: string;
  DYNAMICS_CLIENT_SECRET: string;
  DYNAMICS_TENANT_ID: string;
  SENDGRID_API_KEY?: string; // Set via: wrangler secret put SENDGRID_API_KEY
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper: JSON response with CORS
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Helper: Get current timestamp
function now(): number {
  return Math.floor(Date.now() / 1000);
}

// Helper: Analyze call with OpenAI
interface CallAnalysisResult {
  intent: string;
  sentiment: string;
  outcome: string;
  customer_name?: string;
  customer_email?: string;
  appointment_date?: string;
  appointment_time?: string;
  appointment_type?: string;
  appointment_notes?: string;
}

async function analyzeCallWithOpenAI(
  summary: string,
  transcript: string,
  openaiApiKey: string
): Promise<CallAnalysisResult | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI that analyzes customer service call recordings. Analyze the call and respond with a JSON object containing:

REQUIRED FIELDS:
- intent: The customer's primary intent (e.g., "Scheduling", "Information", "Complaint", "Purchase", "Support")
- sentiment: The overall sentiment of the call ("Positive", "Neutral", or "Negative")
- outcome: The call outcome ("Successful", "Unsuccessful", "Follow-up Required", "Abandoned")

OPTIONAL FIELDS (extract if mentioned in the call):
- customer_name: The customer's full name (if mentioned)
- customer_email: The customer's email address (if mentioned)

APPOINTMENT FIELDS (ONLY if intent is "Scheduling" and appointment was successfully booked):
- appointment_date: The appointment date in ISO format (YYYY-MM-DD). Extract from phrases like "tomorrow", "next Monday", "January 15th", etc.
- appointment_time: The appointment time in 12-hour format (e.g., "2:00 PM", "10:30 AM")
- appointment_type: Type of appointment (e.g., "Consultation", "Service Call", "Follow-up", "Installation")
- appointment_notes: Any special notes about the appointment (e.g., "Bring ID", "Gate code: 1234")

IMPORTANT: Only include appointment fields if an appointment was ACTUALLY SCHEDULED. If the customer just inquired about scheduling but didn't book, do NOT include appointment fields.

Only respond with the JSON object, no additional text.`
          },
          {
            role: 'user',
            content: `Call Summary: ${summary}\n\nFull Transcript:\n${transcript}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return null;
    }

    const data = await response.json() as any;
    const result = JSON.parse(data.choices[0].message.content);

    return {
      intent: result.intent || 'Unknown',
      sentiment: result.sentiment || 'Neutral',
      outcome: result.outcome || 'Unknown',
      customer_name: result.customer_name || null,
      customer_email: result.customer_email || null,
      appointment_date: result.appointment_date || null,
      appointment_time: result.appointment_time || null,
      appointment_type: result.appointment_type || null,
      appointment_notes: result.appointment_notes || null
    };
  } catch (error) {
    console.error('Error analyzing call with OpenAI:', error);
    return null;
  }
}

// Helper: Extract keywords from transcript
function extractKeywords(transcript: string): string[] {
  if (!transcript || transcript.trim().length === 0) {
    return [];
  }

  // Common stop words to filter out
  const stopWords = new Set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
    'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
    'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'yeah',
    'yes', 'okay', 'ok', 'um', 'uh', 'like', 'know', 'think', 'get', 'got', 'would',
    'could', 'want', 'need', 'see', 'go', 'going', 'come', 'let', 'one', 'two', 'make'
  ]);

  // Convert to lowercase and split into words
  const words = transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word =>
      word.length > 3 && // At least 4 characters
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // Not just numbers
    );

  // Count word frequency
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  // Get top keywords (mentioned at least twice, sorted by frequency)
  const keywords = Array.from(wordCount.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20) // Top 20 keywords
    .map(([word]) => word);

  return keywords;
}

// Helper: Store keywords in database with sentiment tracking
async function storeKeywords(
  keywords: string[],
  userId: string,
  sentiment: string,
  db: D1Database
): Promise<void> {
  if (keywords.length === 0) return;

  const timestamp = Date.now();

  // Convert sentiment string to numeric score for averaging
  // Positive = 1, Neutral = 0, Negative = -1
  let sentimentScore = 0;
  if (sentiment === 'Positive') sentimentScore = 1;
  else if (sentiment === 'Negative') sentimentScore = -1;

  for (const keyword of keywords) {
    try {
      // Check if keyword already exists for this user
      const existing = await db.prepare(
        `SELECT id, count, positive_count, neutral_count, negative_count, avg_sentiment
         FROM call_keywords WHERE user_id = ? AND keyword = ?`
      ).bind(userId, keyword).first() as any;

      if (existing) {
        // Calculate new counts
        const newPositiveCount = existing.positive_count + (sentiment === 'Positive' ? 1 : 0);
        const newNeutralCount = existing.neutral_count + (sentiment === 'Neutral' ? 1 : 0);
        const newNegativeCount = existing.negative_count + (sentiment === 'Negative' ? 1 : 0);
        const newTotalCount = existing.count + 1;

        // Calculate new average sentiment
        const newAvgSentiment = ((existing.avg_sentiment * existing.count) + sentimentScore) / newTotalCount;

        // Update with new sentiment data
        await db.prepare(
          `UPDATE call_keywords
           SET count = ?, positive_count = ?, neutral_count = ?, negative_count = ?,
               avg_sentiment = ?, last_detected_at = ?
           WHERE id = ?`
        ).bind(
          newTotalCount,
          newPositiveCount,
          newNeutralCount,
          newNegativeCount,
          newAvgSentiment,
          timestamp,
          existing.id
        ).run();
      } else {
        // Insert new keyword with sentiment
        const initialPositiveCount = sentiment === 'Positive' ? 1 : 0;
        const initialNeutralCount = sentiment === 'Neutral' ? 1 : 0;
        const initialNegativeCount = sentiment === 'Negative' ? 1 : 0;

        await db.prepare(
          `INSERT INTO call_keywords
           (id, user_id, keyword, count, positive_count, neutral_count, negative_count,
            avg_sentiment, last_detected_at, created_at)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(),
          userId,
          keyword,
          initialPositiveCount,
          initialNeutralCount,
          initialNegativeCount,
          sentimentScore,
          timestamp,
          timestamp
        ).run();
      }
    } catch (error) {
      console.error('Error storing keyword:', keyword, error);
    }
  }
}

// Helper: Inject context from Action nodes when a call starts
// This is the SERVER-SIDE implementation for production phone calls
async function injectActionNodeContext(
  env: Env,
  assistantId: string,
  userId: string,
  vapiCallId: string,
  customerPhone: string
): Promise<void> {
  console.log('[Action Context] ========================================');
  console.log('[Action Context] Starting context injection');
  console.log('[Action Context] Assistant ID:', assistantId);
  console.log('[Action Context] Call ID:', vapiCallId);
  console.log('[Action Context] Customer phone:', customerPhone);

  try {
    // 1. Get workspace settings (for VAPI API key)
    const settings = await getWorkspaceSettingsForUser(env, userId);
    if (!settings?.private_key) {
      console.warn('[Action Context] No VAPI API key configured');
      return;
    }

    // 2. Look up the agent flow configuration
    const flowRecord = await env.DB.prepare(
      'SELECT flow_data, config_data FROM agent_flows WHERE vapi_assistant_id = ? AND user_id = ?'
    ).bind(assistantId, userId).first() as any;

    if (!flowRecord) {
      console.log('[Action Context] No flow configuration found for assistant');
      return;
    }

    const flowData = JSON.parse(flowRecord.flow_data || '{}');
    const nodes = flowData.nodes || [];

    // 3. Find action nodes with API configs
    const actionNodes = nodes.filter((node: any) => 
      node.type === 'action' && 
      node.data?.apiConfig?.endpoint
    );

    if (actionNodes.length === 0) {
      console.log('[Action Context] No action nodes with API configs found');
      return;
    }

    console.log('[Action Context] Found', actionNodes.length, 'action node(s) with API configs');

    // 4. Get call details from VAPI to get controlUrl
    const getCallResponse = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${settings.private_key}` }
    });

    if (!getCallResponse.ok) {
      console.error('[Action Context] Failed to get call details:', getCallResponse.status);
      return;
    }

    const callDetails = await getCallResponse.json() as any;
    const controlUrl = callDetails.monitor?.controlUrl;

    if (!controlUrl) {
      console.warn('[Action Context] No controlUrl in call details');
      return;
    }

    console.log('[Action Context] Got controlUrl:', controlUrl);

    // 5. Execute each action API and collect context
    const contextParts: string[] = [];

    for (const actionNode of actionNodes) {
      const apiConfig = actionNode.data.apiConfig;
      console.log('[Action Context] Executing API:', apiConfig.endpoint);

      try {
        // Replace {phone} placeholder with actual phone number
        let endpoint = apiConfig.endpoint.replace(/{phone}/g, encodeURIComponent(customerPhone));
        
        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (apiConfig.headers) {
          for (const h of apiConfig.headers) {
            if (h.key && h.value) {
              headers[h.key] = h.value;
            }
          }
        }

        // Make the API call
        const apiResponse = await fetch(endpoint, {
          method: apiConfig.method || 'GET',
          headers
        });

        if (!apiResponse.ok) {
          console.error('[Action Context] API call failed:', apiResponse.status);
          continue;
        }

        const data = await apiResponse.json();
        console.log('[Action Context] API response received');

        // Extract context using response mapping
        const responseMapping = apiConfig.responseMapping || [];
        const enabledMappings = responseMapping.filter((m: any) => m.enabled);

        if (enabledMappings.length === 0) {
          console.log('[Action Context] No enabled response mappings');
          continue;
        }

        // Helper to get value by path (e.g., "data.0.appointment_date")
        const getValueByPath = (obj: any, path: string): any => {
          const parts = path.split('.');
          let current = obj;
          for (const part of parts) {
            if (current == null) return undefined;
            current = current[part];
          }
          return current;
        };

        const contextLines = enabledMappings.map((mapping: any) => {
          const value = getValueByPath(data, mapping.path);
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'N/A');
          return `- ${mapping.label}: ${displayValue}`;
        });

        if (contextLines.length > 0) {
          contextParts.push(...contextLines);
        }
      } catch (apiError) {
        console.error('[Action Context] Error executing API:', apiError);
      }
    }

    // 6. Inject context if we have any
    if (contextParts.length === 0) {
      console.log('[Action Context] No context to inject');
      return;
    }

    const context = `[CONTEXT UPDATE] Customer information retrieved:\n${contextParts.join('\n')}`;
    console.log('[Action Context] Injecting context:', context);

    const injectResponse = await fetch(controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'add-message',
        message: {
          role: 'system',
          content: context
        }
      })
    });

    if (injectResponse.ok) {
      console.log('[Action Context] ✅ Context injected successfully!');
    } else {
      console.error('[Action Context] Failed to inject context:', injectResponse.status);
    }

  } catch (error) {
    console.error('[Action Context] Error:', error);
  }
}

// Helper: Lookup caller info using Twilio API
interface TwilioCallerInfo {
  callerName: string | null;
  callerType: string | null;
  carrierName: string | null;
  lineType: string | null;
}

async function lookupCallerWithTwilio(
  phoneNumber: string,
  twilioAccountSid: string,
  twilioAuthToken: string,
  env?: Env
): Promise<TwilioCallerInfo | null> {
  try {
    // Twilio Lookup API requires phone number in E.164 format (+1234567890)
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

    // Check cache first (if env.DB is available)
    if (env?.DB) {
      const cached = await env.DB.prepare(
        'SELECT * FROM phone_lookup_cache WHERE phone_number = ? AND expires_at > ?'
      ).bind(cleanNumber, Math.floor(Date.now() / 1000)).first();

      if (cached) {
        console.log('[Twilio Lookup] Using cached data for:', cleanNumber);
        return {
          callerName: cached.caller_name || null,
          callerType: cached.caller_type || null,
          carrierName: cached.carrier_name || null,
          lineType: cached.line_type || null
        };
      }
    }

    // Make API call if not cached
    console.log('[Twilio Lookup] Fetching fresh data for:', cleanNumber);
    const response = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(cleanNumber)}?Fields=caller_name,line_type_intelligence`,
      {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
        }
      }
    );

    if (!response.ok) {
      console.error('Twilio API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as any;

    const twilioInfo: TwilioCallerInfo = {
      callerName: data.caller_name?.caller_name || null,
      callerType: data.caller_name?.caller_type || null,
      carrierName: data.line_type_intelligence?.carrier_name || null,
      lineType: data.line_type_intelligence?.type || null
    };

    // Cache the result (90 days expiration)
    if (env?.DB) {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + (90 * 24 * 60 * 60); // 90 days

      await env.DB.prepare(
        `INSERT OR REPLACE INTO phone_lookup_cache
        (id, phone_number, caller_name, caller_type, carrier_name, line_type, cached_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        cleanNumber,
        twilioInfo.callerName,
        twilioInfo.callerType,
        twilioInfo.carrierName,
        twilioInfo.lineType,
        now,
        expiresAt
      ).run();

      console.log('[Twilio Lookup] Cached data for:', cleanNumber);
    }

    return twilioInfo;
  } catch (error) {
    console.error('Error looking up caller with Twilio:', error);
    return null;
  }
}

// Helper: Trigger scheduling webhook when appointment is booked
async function triggerSchedulingWebhook(env: Env, userId: string, callId: string): Promise<void> {
  try {
    // Get active scheduling triggers for this user
    const triggers = await env.DB.prepare(
      'SELECT * FROM scheduling_triggers WHERE user_id = ? AND is_active = 1'
    ).bind(userId).all();

    if (!triggers.results || triggers.results.length === 0) {
      console.log('No active scheduling triggers found for user:', userId);
      return;
    }

    // Get call data with enhanced data
    const call = await env.DB.prepare(`
      SELECT
        wc.*,
        ar.result_data as enhanced_data
      FROM webhook_calls wc
      LEFT JOIN addon_results ar ON ar.call_id = wc.id AND ar.addon_type = 'enhanced_data'
      WHERE wc.id = ?
    `).bind(callId).first() as any;

    if (!call) {
      console.error('Call not found:', callId);
      return;
    }

    // Build webhook payload
    const payload: any = {
      name: call.customer_name || 'Unknown',
      email: call.customer_email || null,
      phone: call.customer_number || call.phone_number || null,
      phone_being_called: call.phone_number || null,
      appointment_date: call.appointment_date,
      appointment_time: call.appointment_time,
      appointment_type: call.appointment_type || null,
      appointment_notes: call.appointment_notes || null,
      recording: call.recording_url || null,
      call_summary: call.summary || null,
      call_id: call.id,
      intent: call.intent,
      sentiment: call.sentiment,
      outcome: call.outcome
    };

    // Add enhanced data if available and trigger is configured to send it
    for (const trigger of triggers.results) {
      const triggerData = trigger as any;

      if (triggerData.send_enhanced_data && call.enhanced_data) {
        try {
          payload.enhanced_data = JSON.parse(call.enhanced_data);
        } catch (e) {
          console.error('Error parsing enhanced data:', e);
        }
      }

      // Send webhook
      try {
        const response = await fetch(triggerData.destination_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Trigger-Type': 'appointment-scheduled',
            'X-Call-ID': callId
          },
          body: JSON.stringify(payload)
        });

        const responseBody = await response.text();
        const logId = generateId();

        // Log the webhook delivery
        await env.DB.prepare(
          `INSERT INTO scheduling_trigger_logs
           (id, trigger_id, call_id, status, http_status, response_body, error_message, payload_sent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          logId,
          triggerData.id,
          callId,
          response.ok ? 'success' : 'error',
          response.status,
          responseBody.substring(0, 1000), // Limit response body size
          response.ok ? null : `HTTP ${response.status}: ${responseBody}`,
          JSON.stringify(payload),
          now()
        ).run();

        console.log(`Scheduling webhook sent to ${triggerData.destination_url}: ${response.status}`);
      } catch (error: any) {
        const logId = generateId();

        // Log the error
        await env.DB.prepare(
          `INSERT INTO scheduling_trigger_logs
           (id, trigger_id, call_id, status, http_status, response_body, error_message, payload_sent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          logId,
          triggerData.id,
          callId,
          'error',
          null,
          null,
          error.message || 'Unknown error',
          JSON.stringify(payload),
          now()
        ).run();

        console.error('Error sending scheduling webhook:', error);
      }
    }
  } catch (error) {
    console.error('Error in triggerSchedulingWebhook:', error);
  }
}

// Helper: Hash API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Generate a secure random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  let key = 'sk_live_';
  for (let i = 0; i < 32; i++) {
    key += chars[randomBytes[i] % chars.length];
  }
  return key;
}

// Helper: Extract user from Authorization header (supports both JWT and API keys)
async function getUserFromToken(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // Check if it's an API key (starts with sk_live_)
  if (token.startsWith('sk_live_')) {
    const keyHash = await hashApiKey(token);
    const apiKey = await env.DB.prepare(
      'SELECT user_id, workspace_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
    ).bind(keyHash, now()).first() as any;
    
    if (apiKey) {
      // Update last_used_at
      await env.DB.prepare(
        'UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?'
      ).bind(now(), keyHash).run();
      
      return apiKey.user_id;
    }
    return null;
  }
  
  // Otherwise treat as JWT token
  const secret = env.JWT_SECRET || 'default-secret-change-me';
  const decoded = await verifyToken(token, secret);

  if (!decoded) {
    return null;
  }

  return decoded.userId;
}

// Helper: Get workspace ID for user
// Returns the user's selected workspace ID, or their owned workspace if no selection
async function getWorkspaceIdForUser(env: Env, userId: string): Promise<string | null> {
  // Check for selected workspace
  const userSettings = await env.DB.prepare(
    'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
  ).bind(userId).first() as any;

  if (userSettings?.selected_workspace_id) {
    return userSettings.selected_workspace_id;
  }

  // Fall back to owned workspace
  const ownedWorkspace = await env.DB.prepare(
    'SELECT id FROM workspaces WHERE owner_user_id = ?'
  ).bind(userId).first() as any;

  if (ownedWorkspace) {
    return ownedWorkspace.id;
  }

  // Check if user is a member of any workspace
  const membership = await env.DB.prepare(
    'SELECT workspace_id FROM workspace_members WHERE user_id = ? AND status = "active" LIMIT 1'
  ).bind(userId).first() as any;

  return membership?.workspace_id || null;
}

// Helper: Get effective user ID for workspace context
// Returns workspace owner's user_id if workspace is selected, otherwise the authenticated user's ID
async function getEffectiveUserId(env: Env, userId: string): Promise<{ effectiveUserId: string; isWorkspaceContext: boolean }> {
  const settings = await env.DB.prepare(
    'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
  ).bind(userId).first() as any;

  if (!settings || !settings.selected_workspace_id) {
    return { effectiveUserId: userId, isWorkspaceContext: false };
  }

  // Verify user has access to this workspace
  const workspace = await env.DB.prepare(
    'SELECT owner_user_id FROM workspaces WHERE id = ?'
  ).bind(settings.selected_workspace_id).first() as any;

  if (!workspace) {
    return { effectiveUserId: userId, isWorkspaceContext: false };
  }

  // Check if user is owner or active member
  const isOwner = workspace.owner_user_id === userId;
  const membership = await env.DB.prepare(
    'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
  ).bind(settings.selected_workspace_id, userId).first() as any;

  if (isOwner || membership) {
    return { effectiveUserId: workspace.owner_user_id, isWorkspaceContext: true };
  }

  // User doesn't have access, fall back to personal
  return { effectiveUserId: userId, isWorkspaceContext: false };
}

// Helper: Find user and workspace by CustomerConnect workspace_id
// This is used to associate tool logs with the correct user who has CHAU Text Engine configured
async function findUserByCustomerConnectWorkspace(env: Env, customerconnectWorkspaceId: string): Promise<{
  userId: string;
  workspaceId: string;
} | null> {
  // Find workspace_settings that has this customerconnect_workspace_id
  const wsSettings = await env.DB.prepare(
    'SELECT workspace_id FROM workspace_settings WHERE customerconnect_workspace_id = ?'
  ).bind(customerconnectWorkspaceId).first() as any;
  
  if (wsSettings?.workspace_id) {
    // Find the owner of this workspace
    const workspace = await env.DB.prepare(
      'SELECT owner_user_id FROM workspaces WHERE id = ?'
    ).bind(wsSettings.workspace_id).first() as any;
    
    if (workspace?.owner_user_id) {
      return {
        userId: workspace.owner_user_id,
        workspaceId: wsSettings.workspace_id
      };
    }
  }
  
  return null;
}

// Helper: Find CustomerConnect credentials from ANY user's workspace (for tool calls)
// This allows the tool to work even if the webhook owner doesn't have it configured
async function findAnyCustomerConnectCredentials(env: Env): Promise<{
  userId: string;
  workspaceId: string;
  customerconnect_workspace_id: string;
  customerconnect_api_key: string;
} | null> {
  // Find any workspace that has CustomerConnect configured
  const wsSettings = await env.DB.prepare(
    `SELECT ws.workspace_id, ws.customerconnect_workspace_id, ws.customerconnect_api_key, w.owner_user_id
     FROM workspace_settings ws
     JOIN workspaces w ON ws.workspace_id = w.id
     WHERE ws.customerconnect_workspace_id IS NOT NULL 
       AND ws.customerconnect_workspace_id != ''
       AND ws.customerconnect_api_key IS NOT NULL
       AND ws.customerconnect_api_key != ''
     LIMIT 1`
  ).first() as any;
  
  if (wsSettings) {
    return {
      userId: wsSettings.owner_user_id,
      workspaceId: wsSettings.workspace_id,
      customerconnect_workspace_id: wsSettings.customerconnect_workspace_id,
      customerconnect_api_key: wsSettings.customerconnect_api_key
    };
  }
  
  return null;
}

// Helper: Get workspace settings for a user (finds their workspace and returns its credentials)
async function getWorkspaceSettingsForUser(env: Env, userId: string): Promise<{
  private_key?: string;
  openai_api_key?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  transfer_phone_number?: string;
  customerconnect_workspace_id?: string;
  customerconnect_api_key?: string;
} | null> {
  // Find user's workspace (they own it or are a member)
  const userSettings = await env.DB.prepare(
    'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
  ).bind(userId).first() as any;

  if (!userSettings || !userSettings.selected_workspace_id) {
    // User has no workspace, check if they own one
    const ownedWorkspace = await env.DB.prepare(
      'SELECT id FROM workspaces WHERE owner_user_id = ?'
    ).bind(userId).first() as any;

    if (ownedWorkspace) {
      const wsSettings = await env.DB.prepare(
        'SELECT workspace_id, private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, customerconnect_workspace_id, customerconnect_api_key FROM workspace_settings WHERE workspace_id = ?'
      ).bind(ownedWorkspace.id).first() as any;
      return wsSettings || null;
    }
    return null;
  }

  const workspaceId = userSettings.selected_workspace_id;
  let wsSettings = await env.DB.prepare(
    'SELECT workspace_id, private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, customerconnect_workspace_id, customerconnect_api_key FROM workspace_settings WHERE workspace_id = ?'
  ).bind(workspaceId).first() as any;

  // FALLBACK: If workspace_settings is empty, try user_settings (migration path)
  if (!wsSettings || !wsSettings.private_key) {
    const workspace = await env.DB.prepare(
      'SELECT owner_user_id FROM workspaces WHERE id = ?'
    ).bind(workspaceId).first() as any;

    if (workspace) {
      const ownerSettings = await env.DB.prepare(
        'SELECT private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM user_settings WHERE user_id = ?'
      ).bind(workspace.owner_user_id).first() as any;

      if (ownerSettings && ownerSettings.private_key) {
        wsSettings = ownerSettings;
      }
    }
  }

  return wsSettings || null;
}

// Helper: Log tool call to database
async function logToolCall(env: Env, data: {
  userId: string;
  workspaceId?: string;
  vapiCallId?: string | null;
  toolName: string;
  phoneNumber?: string | null;
  status: 'success' | 'not_found' | 'error' | 'not_configured';
  requestTimestamp: number;
  responseTimestamp?: number;
  responseTimeMs?: number;
  customerName?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  household?: string | null;
  errorMessage?: string | null;
  rawResponse?: string | null;
}): Promise<void> {
  try {
    const logId = generateId();
    await env.DB.prepare(
      `INSERT INTO tool_call_logs (
        id, user_id, workspace_id, vapi_call_id, tool_name, phone_number,
        status, request_timestamp, response_timestamp, response_time_ms,
        customer_name, appointment_date, appointment_time, household,
        error_message, raw_response, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      data.userId,
      data.workspaceId || null,
      data.vapiCallId || null,
      data.toolName,
      data.phoneNumber || null,
      data.status,
      data.requestTimestamp,
      data.responseTimestamp || null,
      data.responseTimeMs || null,
      data.customerName || null,
      data.appointmentDate || null,
      data.appointmentTime || null,
      data.household || null,
      data.errorMessage || null,
      data.rawResponse || null,
      Date.now()
    ).run();

    console.log('[Tool Call Log] Saved log entry:', logId, 'Status:', data.status);
  } catch (error) {
    console.error('[Tool Call Log] Error saving log:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

// Helper: Log auto-transfer attempt to database
async function logAutoTransferAttempt(env: Env, data: {
  transferId: string;
  vapiCallId: string;
  assistantId: string;
  userId: string;
  agentPhone: string;
  agentName?: string | null;
  attemptNumber: number;
  status: 'dialing' | 'answered' | 'no_answer' | 'busy' | 'failed';
  twilioCallSid?: string | null;
  reason?: string | null;
  errorMessage?: string | null;
  startedAt: number;
  endedAt?: number | null;
  durationSeconds?: number | null;
}): Promise<void> {
  try {
    const logId = generateId();
    await env.DB.prepare(
      `INSERT INTO auto_transfer_logs (
        id, transfer_id, vapi_call_id, assistant_id, user_id, 
        agent_phone, agent_name, attempt_number, status, 
        twilio_call_sid, reason, error_message, started_at, ended_at, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      data.transferId,
      data.vapiCallId,
      data.assistantId,
      data.userId,
      data.agentPhone,
      data.agentName || null,
      data.attemptNumber,
      data.status,
      data.twilioCallSid || null,
      data.reason || null,
      data.errorMessage || null,
      data.startedAt,
      data.endedAt || null,
      data.durationSeconds || null
    ).run();

    console.log('[Auto Transfer Log] Saved attempt:', data.attemptNumber, 'Status:', data.status);
  } catch (error) {
    console.error('[Auto Transfer Log] Error saving log:', error);
  }
}

// Helper: Auto-dial agent loop for automated warm transfers
// This function tries agents sequentially until one answers or all fail
async function autoDialAgentLoop(env: Env, params: {
  transferId: string;
  vapiCallId: string;
  assistantId: string;
  userId: string;
  agents: Array<{ id: string; phone_number: string; agent_name?: string; priority: number }>;
  transferSettings: { ring_timeout_seconds: number; max_attempts: number; announcement_message?: string };
  twilioConfig: {
    accountSid: string;
    authToken: string;
    workerUrl: string;
    twilioPhoneNumber: string;
  };
  vapiPrivateKey: string;
  reason: string;
}): Promise<{ success: boolean; answeredAgent?: string }> {
  const {
    transferId,
    vapiCallId,
    assistantId,
    userId,
    agents,
    transferSettings,
    twilioConfig,
    vapiPrivateKey,
    reason
  } = params;

  console.log('[Auto Transfer] ========================================');
  console.log('[Auto Transfer] Starting auto-dial loop');
  console.log('[Auto Transfer] Transfer ID:', transferId);
  console.log('[Auto Transfer] VAPI Call ID:', vapiCallId);
  console.log('[Auto Transfer] Agents to try:', agents.length);
  console.log('[Auto Transfer] Ring timeout:', transferSettings.ring_timeout_seconds, 'seconds');
  console.log('[Auto Transfer] Max attempts:', transferSettings.max_attempts);
  console.log('[Auto Transfer] ========================================');

  const maxAttempts = Math.min(agents.length, transferSettings.max_attempts);
  const ringTimeout = transferSettings.ring_timeout_seconds * 1000; // Convert to ms
  const announcement = transferSettings.announcement_message || `You have an incoming transfer. Reason: ${reason}. Please stay on the line.`;

  for (let i = 0; i < maxAttempts; i++) {
    const agent = agents[i];
    const attemptNumber = i + 1;
    const attemptStartTime = Date.now();

    console.log(`[Auto Transfer] Attempt ${attemptNumber}/${maxAttempts}: Dialing ${agent.agent_name || 'Agent'} at ${agent.phone_number}`);

    // Log the attempt as 'dialing'
    await logAutoTransferAttempt(env, {
      transferId,
      vapiCallId,
      assistantId,
      userId,
      agentPhone: agent.phone_number,
      agentName: agent.agent_name,
      attemptNumber,
      status: 'dialing',
      reason,
      startedAt: Math.floor(attemptStartTime / 1000)
    });

    try {
      // Make Twilio call to agent
      const twimlUrl = `${twilioConfig.workerUrl}/twiml/auto-transfer-announcement/${transferId}?announcement=${encodeURIComponent(announcement)}&attempt=${attemptNumber}`;
      
      const bodyParams = new URLSearchParams();
      bodyParams.append('To', agent.phone_number);
      bodyParams.append('From', twilioConfig.twilioPhoneNumber);
      bodyParams.append('Url', twimlUrl);
      bodyParams.append('Timeout', String(transferSettings.ring_timeout_seconds));
      bodyParams.append('StatusCallback', `${twilioConfig.workerUrl}/webhook/auto-transfer-status/${transferId}`);
      bodyParams.append('StatusCallbackEvent', 'initiated');
      bodyParams.append('StatusCallbackEvent', 'ringing');
      bodyParams.append('StatusCallbackEvent', 'answered');
      bodyParams.append('StatusCallbackEvent', 'completed');
      bodyParams.append('StatusCallbackMethod', 'POST');

      const callResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams,
        }
      );

      if (!callResponse.ok) {
        const errorText = await callResponse.text();
        console.error(`[Auto Transfer] Failed to dial agent ${attemptNumber}:`, errorText);
        
        const attemptEndTime = Date.now();
        await logAutoTransferAttempt(env, {
          transferId,
          vapiCallId,
          assistantId,
          userId,
          agentPhone: agent.phone_number,
          agentName: agent.agent_name,
          attemptNumber,
          status: 'failed',
          reason,
          errorMessage: `Twilio error: ${callResponse.status}`,
          startedAt: Math.floor(attemptStartTime / 1000),
          endedAt: Math.floor(attemptEndTime / 1000),
          durationSeconds: Math.floor((attemptEndTime - attemptStartTime) / 1000)
        });
        continue; // Try next agent
      }

      const callData = await callResponse.json() as any;
      const callSid = callData.sid;

      console.log(`[Auto Transfer] Call initiated to agent ${attemptNumber}, SID:`, callSid);

      // Poll for call status until answered, completed, or timeout
      let callAnswered = false;
      let callStatus = 'queued';
      const pollStartTime = Date.now();
      const pollInterval = 2000; // Check every 2 seconds

      while (Date.now() - pollStartTime < ringTimeout + 5000) { // Add 5s buffer
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Check call status
        const statusResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls/${callSid}.json`,
          {
            method: 'GET',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`),
            },
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json() as any;
          callStatus = statusData.status;

          console.log(`[Auto Transfer] Agent ${attemptNumber} call status:`, callStatus);

          if (callStatus === 'in-progress') {
            // Agent answered!
            callAnswered = true;
            break;
          } else if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)) {
            // Call ended without answering
            break;
          }
        }
      }

      const attemptEndTime = Date.now();
      const durationSeconds = Math.floor((attemptEndTime - attemptStartTime) / 1000);

      if (callAnswered) {
        console.log(`[Auto Transfer] SUCCESS! Agent ${attemptNumber} (${agent.agent_name || agent.phone_number}) answered!`);

        // Log successful answer
        await logAutoTransferAttempt(env, {
          transferId,
          vapiCallId,
          assistantId,
          userId,
          agentPhone: agent.phone_number,
          agentName: agent.agent_name,
          attemptNumber,
          status: 'answered',
          twilioCallSid: callSid,
          reason,
          startedAt: Math.floor(attemptStartTime / 1000),
          endedAt: Math.floor(attemptEndTime / 1000),
          durationSeconds
        });

        // Wait a moment for agent to hear announcement
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Now transfer the customer to this agent's phone via VAPI
        try {
          // Get VAPI call's controlUrl
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${vapiPrivateKey}` }
          });

          if (getCallResponse.ok) {
            const callDetails = await getCallResponse.json() as any;
            const controlUrl = callDetails.monitor?.controlUrl;
            const vapiCallStatus = callDetails.status;

            if (vapiCallStatus !== 'ended' && controlUrl) {
              // Transfer customer to agent
              const transferPayload = {
                type: 'transfer',
                destination: {
                  type: 'number',
                  number: agent.phone_number
                }
              };

              console.log('[Auto Transfer] Sending transfer command to VAPI...');

              const transferResponse = await fetch(controlUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transferPayload)
              });

              if (transferResponse.ok) {
                console.log('[Auto Transfer] Customer transfer initiated successfully!');
                return { success: true, answeredAgent: agent.agent_name || agent.phone_number };
              } else {
                console.error('[Auto Transfer] Failed to transfer customer:', await transferResponse.text());
              }
            } else {
              console.log('[Auto Transfer] VAPI call already ended or no controlUrl');
            }
          }
        } catch (transferError) {
          console.error('[Auto Transfer] Error transferring customer:', transferError);
        }

        // Even if transfer failed, agent answered - return success
        return { success: true, answeredAgent: agent.agent_name || agent.phone_number };
      } else {
        // Agent didn't answer
        console.log(`[Auto Transfer] Agent ${attemptNumber} did not answer. Status: ${callStatus}`);

        await logAutoTransferAttempt(env, {
          transferId,
          vapiCallId,
          assistantId,
          userId,
          agentPhone: agent.phone_number,
          agentName: agent.agent_name,
          attemptNumber,
          status: callStatus === 'busy' ? 'busy' : 'no_answer',
          twilioCallSid: callSid,
          reason,
          startedAt: Math.floor(attemptStartTime / 1000),
          endedAt: Math.floor(attemptEndTime / 1000),
          durationSeconds
        });

        // Hang up the agent call if still active
        try {
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls/${callSid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ 'Status': 'completed' }),
            }
          );
        } catch (hangupError) {
          // Ignore hangup errors
        }
      }
    } catch (error) {
      console.error(`[Auto Transfer] Error dialing agent ${attemptNumber}:`, error);
      
      const attemptEndTime = Date.now();
      await logAutoTransferAttempt(env, {
        transferId,
        vapiCallId,
        assistantId,
        userId,
        agentPhone: agent.phone_number,
        agentName: agent.agent_name,
        attemptNumber,
        status: 'failed',
        reason,
        errorMessage: String(error),
        startedAt: Math.floor(attemptStartTime / 1000),
        endedAt: Math.floor(attemptEndTime / 1000),
        durationSeconds: Math.floor((attemptEndTime - attemptStartTime) / 1000)
      });
    }
  }

  console.log('[Auto Transfer] All agents tried, none answered. AI will continue handling the call.');
  console.log('[Auto Transfer] ========================================');

  return { success: false };
}

// Helper: Lookup customer from CustomerConnect API
async function lookupCustomerFromCustomerConnect(
  phoneNumber: string,
  workspaceId: string,
  apiKey: string
): Promise<{
  found: boolean;
  name?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  household?: string;
}> {
  try {
    // Clean phone number - remove non-digits and ensure proper format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    console.log('[CustomerConnect] Looking up customer:', cleanPhone);
    
    const response = await fetch(
      `https://api-customerconnect.app/api/v3/contacts/search?workspace_id=${workspaceId}&phone_number=${cleanPhone}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('[CustomerConnect] API error:', response.status, await response.text());
      return { found: false };
    }

    const data = await response.json() as any;
    
    if (!data.success || !data.data || data.data.length === 0) {
      console.log('[CustomerConnect] No customer found for phone:', cleanPhone);
      return { found: false };
    }

    const customer = data.data[0];
    console.log('[CustomerConnect] Customer found:', customer.name);

    return {
      found: true,
      name: customer.name || `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
      appointmentDate: customer.appointment_date_display || null,
      appointmentTime: customer.appointment_time || null,
      household: customer.metadata?.custom_fields?.household || null
    };
  } catch (error) {
    console.error('[CustomerConnect] Error looking up customer:', error);
    return { found: false };
  }
}

// Helper: Enhanced Data addon - fetch phone number enrichment
async function executeEnhancedDataAddon(
  phoneNumber: string
): Promise<any> {
  try {
    const response = await fetch(
      `https://enhance-data-production.up.railway.app/phone?phone=${encodeURIComponent(phoneNumber)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Enhanced Data addon error:', error);
    return null;
  }
}

// Helper: Process addons for a call
async function processAddonsForCall(
  env: Env,
  userId: string,
  callId: string,
  customerPhone: string | null
): Promise<void> {
  if (!customerPhone) {
    return;
  }

  try {
    // Initialize cache
    const cache = new VoiceAICache(env.CACHE);

    // Get user's workspace
    const userSettings = await env.DB.prepare(
      'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
    ).bind(userId).first() as any;

    let workspaceId = userSettings?.selected_workspace_id;

    // Fallback: if no selected workspace, find user's workspace (owned or member)
    if (!workspaceId) {
      const ownedWorkspace = await env.DB.prepare(
        'SELECT id FROM workspaces WHERE owner_user_id = ?'
      ).bind(userId).first() as any;
      
      if (ownedWorkspace) {
        workspaceId = ownedWorkspace.id;
      } else {
        const memberWorkspace = await env.DB.prepare(
          'SELECT workspace_id FROM workspace_members WHERE user_id = ? AND status = "active" LIMIT 1'
        ).bind(userId).first() as any;
        
        if (memberWorkspace) {
          workspaceId = memberWorkspace.workspace_id;
        }
      }
    }

    if (!workspaceId) {
      console.log('[Addons] No workspace found for user, skipping addon processing');
      return;
    }

    // Get enabled addons for workspace (fallback to user_addons for backward compatibility)
    let enabledAddons = await env.DB.prepare(
      'SELECT addon_type, settings FROM workspace_addons WHERE workspace_id = ? AND is_enabled = 1'
    ).bind(workspaceId).all();

    // Fallback to user_addons for backward compatibility
    if (!enabledAddons.results || enabledAddons.results.length === 0) {
      enabledAddons = await env.DB.prepare(
        'SELECT addon_type, settings FROM user_addons WHERE user_id = ? AND is_enabled = 1'
      ).bind(userId).all();
    }

    if (!enabledAddons.results || enabledAddons.results.length === 0) {
      return;
    }

    // Process each enabled addon
    for (const addon of enabledAddons.results as any[]) {
      const startTime = Date.now();
      let status = 'failed';
      let resultData = null;
      let errorMessage: string | null = null;

      try {
        if (addon.addon_type === 'enhanced_data') {
          // Check cache first
          const cachedData = await cache.getCachedEnhancedData(userId, callId);
          if (cachedData) {
            console.log(`Cache HIT for enhanced data: callId=${callId}`);
            resultData = cachedData;
            status = 'success';
          } else {
            console.log(`Cache MISS for enhanced data: callId=${callId}`);
            resultData = await executeEnhancedDataAddon(customerPhone);
            status = resultData ? 'success' : 'failed';
            if (!resultData) {
              errorMessage = 'Failed to fetch enhanced data';
            } else {
              // Cache the result for 30 minutes
              await cache.cacheEnhancedData(userId, callId, resultData, CACHE_TTL.ENHANCED_DATA);
            }
          }
        }
        // Add more addon types here in the future
      } catch (error: any) {
        errorMessage = error.message || 'Unknown error';
      }

      const executionTime = Date.now() - startTime;

      // Store addon result
      await env.DB.prepare(
        `INSERT INTO addon_results (
          id, call_id, user_id, addon_type, status, result_data, error_message, execution_time_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        callId,
        userId,
        addon.addon_type,
        status,
        resultData ? JSON.stringify(resultData) : null,
        errorMessage,
        executionTime,
        now()
      ).run();
    }
  } catch (error) {
    console.error('Error processing addons:', error);
  }
}

// Helper: Replace lead placeholders in template strings
function replaceLeadPlaceholders(template: string, lead: any): string {
  return template
    .replace(/\{firstname\}/gi, lead.firstname || '')
    .replace(/\{lastname\}/gi, lead.lastname || '')
    .replace(/\{product\}/gi, lead.product || '')
    .replace(/\{notes\}/gi, lead.notes || '')
    .replace(/\{lead_source\}/gi, lead.lead_source || '')
    .replace(/\{email\}/gi, lead.email || '')
    .replace(/\{phone\}/gi, lead.phone || '');
}

// Helper: Execute campaign calls via VAPI
async function executeCampaignCalls(env: Env, campaignId: string, vapiKey: string): Promise<void> {
  console.log(`[Campaign ${campaignId}] Starting campaign execution`);
  
  try {
    // Get campaign details
    const campaign = await env.DB.prepare(
      'SELECT * FROM campaigns WHERE id = ?'
    ).bind(campaignId).first() as any;

    if (!campaign) {
      console.error(`[Campaign ${campaignId}] Campaign not found`);
      return;
    }

    // Debug: Log campaign template settings
    console.log(`[Campaign ${campaignId}] Campaign data:`, JSON.stringify({
      name: campaign.name,
      assistant_id: campaign.assistant_id,
      first_message_template: campaign.first_message_template,
      prompt_template: campaign.prompt_template
    }))
    
    // Get pending leads (including notes for template personalization)
    const pendingLeads = await env.DB.prepare(
      `SELECT cl.*, l.firstname, l.lastname, l.phone, l.email, l.product, l.lead_source, l.notes
       FROM campaign_leads cl
       JOIN leads l ON cl.lead_id = l.id
       WHERE cl.campaign_id = ? AND cl.call_status = 'pending'
       ORDER BY cl.created_at ASC`
    ).bind(campaignId).all();
    
    if (!pendingLeads.results || pendingLeads.results.length === 0) {
      console.log(`[Campaign ${campaignId}] No pending leads, marking as completed`);
      await env.DB.prepare(
        'UPDATE campaigns SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
      ).bind('completed', now(), now(), campaignId).run();
      return;
    }
    
    console.log(`[Campaign ${campaignId}] Processing ${pendingLeads.results.length} pending leads`);
    
    // Process leads one at a time
    for (const lead of pendingLeads.results as any[]) {
      // Check if campaign is still running (might have been paused/cancelled)
      const currentCampaign = await env.DB.prepare(
        'SELECT status FROM campaigns WHERE id = ?'
      ).bind(campaignId).first() as any;
      
      if (currentCampaign?.status !== 'running') {
        console.log(`[Campaign ${campaignId}] Campaign is no longer running (status: ${currentCampaign?.status}), stopping`);
        return;
      }
      
      // Update lead status to calling
      await env.DB.prepare(
        'UPDATE campaign_leads SET call_status = ?, called_at = ? WHERE id = ?'
      ).bind('calling', now(), lead.id).run();
      
      try {
        // Make outbound call via VAPI
        const customerName = [lead.firstname, lead.lastname].filter(Boolean).join(' ') || 'Customer';
        
        // Build assistant overrides with template personalization
        const assistantOverrides: any = {
          variableValues: {
            customerName: lead.firstname || customerName,
            customerEmail: lead.email || '',
            product: lead.product || '',
            leadSource: lead.lead_source || '',
            notes: lead.notes || ''
          }
        };
        
        // Add personalized first message if template exists
        if (campaign.first_message_template) {
          assistantOverrides.firstMessage = replaceLeadPlaceholders(campaign.first_message_template, lead);
          console.log(`[Campaign ${campaignId}] Using personalized first message: "${assistantOverrides.firstMessage.substring(0, 50)}..."`);
        }
        
        // Note: We no longer override the system prompt to preserve the assistant's original instructions
        // Lead data is passed via variableValues which the assistant can use if its prompt has placeholders
        // The first message is still personalized via firstMessage override above
        console.log(`[Campaign ${campaignId}] Lead context passed via variableValues (assistant prompt preserved)`);
        
        const callPayload = {
          assistantId: campaign.assistant_id,
          phoneNumberId: campaign.phone_number_id,
          customer: {
            number: lead.phone,
            name: customerName
          },
          assistantOverrides
        };
        
        console.log(`[Campaign ${campaignId}] Calling ${lead.phone} (${customerName})`);
        console.log(`[Campaign ${campaignId}] Using VAPI key: ${vapiKey.substring(0, 10)}...`);
        
        const response = await fetch('https://api.vapi.ai/call/phone', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vapiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(callPayload)
        });
        
        // Check response status first
        const responseText = await response.text();
        let result: any;
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          // VAPI returned non-JSON (likely HTML error page)
          console.error(`[Campaign ${campaignId}] VAPI returned non-JSON response:`, response.status, responseText.substring(0, 200));
          throw new Error(`VAPI API error (${response.status}): Invalid response - check VAPI API key`);
        }
        
        if (response.ok && result.id) {
          // Call initiated successfully
          await env.DB.prepare(
            'UPDATE campaign_leads SET vapi_call_id = ? WHERE id = ?'
          ).bind(result.id, lead.id).run();
          
          console.log(`[Campaign ${campaignId}] Call initiated: ${result.id}`);
          
          // Update campaign stats
          await env.DB.prepare(
            'UPDATE campaigns SET calls_completed = calls_completed + 1, updated_at = ? WHERE id = ?'
          ).bind(now(), campaignId).run();
          
          // Mark as completed (actual outcome will be updated by webhook)
          await env.DB.prepare(
            'UPDATE campaign_leads SET call_status = ? WHERE id = ?'
          ).bind('completed', lead.id).run();
          
        } else {
          // Call failed to initiate
          console.error(`[Campaign ${campaignId}] Call failed:`, result);
          
          await env.DB.prepare(
            'UPDATE campaign_leads SET call_status = ?, call_outcome = ? WHERE id = ?'
          ).bind('failed', JSON.stringify(result), lead.id).run();
          
          await env.DB.prepare(
            'UPDATE campaigns SET calls_failed = calls_failed + 1, updated_at = ? WHERE id = ?'
          ).bind(now(), campaignId).run();
        }
        
      } catch (error: any) {
        console.error(`[Campaign ${campaignId}] Error calling ${lead.phone}:`, error);
        
        await env.DB.prepare(
          'UPDATE campaign_leads SET call_status = ?, call_outcome = ? WHERE id = ?'
        ).bind('failed', error.message || 'Unknown error', lead.id).run();
        
        await env.DB.prepare(
          'UPDATE campaigns SET calls_failed = calls_failed + 1, updated_at = ? WHERE id = ?'
        ).bind(now(), campaignId).run();
      }
      
      // Small delay between calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Check if all leads have been processed
    const remainingLeads = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM campaign_leads WHERE campaign_id = ? AND call_status = 'pending'`
    ).bind(campaignId).first() as any;
    
    if (!remainingLeads || remainingLeads.count === 0) {
      console.log(`[Campaign ${campaignId}] All leads processed, marking as completed`);
      await env.DB.prepare(
        'UPDATE campaigns SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
      ).bind('completed', now(), now(), campaignId).run();
    }
    
  } catch (error) {
    console.error(`[Campaign ${campaignId}] Execution error:`, error);
    // Don't mark as failed - might be a temporary issue
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ============================================
      // AUTHENTICATION ENDPOINTS
      // ============================================

      // Register new user
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const { email, password, name } = await request.json() as any;

        if (!email || !password) {
          return jsonResponse({ error: 'Email and password required' }, 400);
        }

        // Check if user exists
        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();

        if (existing) {
          return jsonResponse({ error: 'Email already registered' }, 409);
        }

        // Create user
        const userId = generateId();
        const passwordHash = await hashPassword(password);
        const timestamp = now();

        await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(userId, email, passwordHash, name || null, timestamp, timestamp).run();

        // Generate token
        const secret = env.JWT_SECRET || 'default-secret-change-me';
        const token = await generateToken(userId, secret);

        // Create session
        const sessionId = generateId();
        const tokenHash = await hashPassword(token);
        const expiresAt = timestamp + (7 * 24 * 60 * 60); // 7 days

        await env.DB.prepare(
          'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(sessionId, userId, tokenHash, expiresAt, timestamp).run();

        // Check for pending invitations for this email
        const pendingInvitations = await env.DB.prepare(
          'SELECT id, workspace_id, role, token, expires_at FROM workspace_invitations WHERE email = ? AND status = \"pending\" AND expires_at > ?'
        ).bind(email, timestamp).all();

        let defaultWorkspaceId: string | null = null;

        if (pendingInvitations.results && pendingInvitations.results.length > 0) {
          // User has pending invitations - accept them automatically
          for (const invitation of pendingInvitations.results as any[]) {
            // Add user to workspace
            const membershipId = generateId();
            await env.DB.prepare(
              'INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_user_id, invited_at, joined_at, created_at, updated_at) VALUES (?, ?, ?, ?, \"active\", ?, ?, ?, ?, ?)'
            ).bind(
              membershipId,
              invitation.workspace_id,
              userId,
              invitation.role,
              null, // We don't have invited_by stored yet in old invitations
              timestamp,
              timestamp,
              timestamp,
              timestamp
            ).run();

            // Mark invitation as accepted
            await env.DB.prepare(
              'UPDATE workspace_invitations SET status = \"accepted\", accepted_at = ? WHERE id = ?'
            ).bind(timestamp, invitation.id).run();

            // Use first invited workspace as default
            if (!defaultWorkspaceId) {
              defaultWorkspaceId = invitation.workspace_id;
            }
          }
        }

        // Create default workspace for new user only if they don't have invitations
        if (!defaultWorkspaceId) {
          const workspaceId = 'ws_' + generateId();
          const workspaceName = name?.trim() || email.split('@')[0] || 'My Workspace';
          await env.DB.prepare(
            'INSERT INTO workspaces (id, name, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(workspaceId, workspaceName, userId, timestamp, timestamp).run();
          defaultWorkspaceId = workspaceId;
        }

        // Create empty settings
        const settingsId = generateId();
        const encryptionSalt = generateSalt();

        await env.DB.prepare(
          'INSERT INTO user_settings (id, user_id, encryption_salt, selected_workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(settingsId, userId, encryptionSalt, defaultWorkspaceId, timestamp, timestamp).run();

        return jsonResponse({
          token,
          user: {
            id: userId,
            email,
            name: name || null
          }
        });
      }

      // Login
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json() as any;

        if (!email || !password) {
          return jsonResponse({ error: 'Email and password required' }, 400);
        }

        // Find user
        const user = await env.DB.prepare(
          'SELECT id, email, password_hash, name FROM users WHERE email = ?'
        ).bind(email).first() as any;

        if (!user) {
          return jsonResponse({ error: 'Invalid credentials' }, 401);
        }

        // Verify password
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          return jsonResponse({ error: 'Invalid credentials' }, 401);
        }

        // Update last login
        await env.DB.prepare(
          'UPDATE users SET last_login_at = ? WHERE id = ?'
        ).bind(now(), user.id).run();

        // Generate token
        const secret = env.JWT_SECRET || 'default-secret-change-me';
        const token = await generateToken(user.id, secret);

        // Create session
        const sessionId = generateId();
        const tokenHash = await hashPassword(token);
        const timestamp = now();
        const expiresAt = timestamp + (7 * 24 * 60 * 60); // 7 days

        await env.DB.prepare(
          'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(sessionId, user.id, tokenHash, expiresAt, timestamp).run();

        return jsonResponse({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      }

      // Logout
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Delete all sessions for this user (optional: could delete just current session)
        await env.DB.prepare(
          'DELETE FROM sessions WHERE user_id = ?'
        ).bind(userId).run();

        return jsonResponse({ message: 'Logged out successfully' });
      }

      // Get current user
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const user = await env.DB.prepare(
          'SELECT id, email, name, created_at FROM users WHERE id = ?'
        ).bind(userId).first() as any;

        if (!user) {
          return jsonResponse({ error: 'User not found' }, 404);
        }

        return jsonResponse({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        });
      }

      // Test Twilio Lookup with Caching
      if (url.pathname === '/api/test-twilio-lookup' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { phoneNumber } = await request.json() as any;
        if (!phoneNumber) {
          return jsonResponse({ error: 'Phone number required' }, 400);
        }

        const wsSettings = await getWorkspaceSettingsForUser(env, userId);
        if (!wsSettings?.twilio_account_sid || !wsSettings?.twilio_auth_token) {
          return jsonResponse({ error: 'Twilio credentials not configured' }, 400);
        }

        const startTime = Date.now();
        const result = await lookupCallerWithTwilio(
          phoneNumber,
          wsSettings.twilio_account_sid,
          wsSettings.twilio_auth_token,
          env
        );
        const duration = Date.now() - startTime;

        return jsonResponse({
          phoneNumber,
          result,
          duration: `${duration}ms`,
          cached: duration < 100 // If very fast, likely from cache
        });
      }

      // ============================================
      // API KEYS ENDPOINTS (Protected)
      // ============================================

      // List API keys for user
      if (url.pathname === '/api/api-keys' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const results = await env.DB.prepare(
          `SELECT id, name, key_prefix, workspace_id, last_used_at, expires_at, created_at
           FROM api_keys 
           WHERE user_id = ? AND revoked_at IS NULL 
           ORDER BY created_at DESC`
        ).bind(userId).all();

        return jsonResponse({ apiKeys: results.results || [] });
      }

      // Create new API key
      if (url.pathname === '/api/api-keys' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const body = await request.json() as any;
        const name = body.name || 'API Key';
        const expiresInDays = body.expires_in_days; // Optional: null = never expires

        // Generate the API key
        const apiKey = generateApiKey();
        const keyHash = await hashApiKey(apiKey);
        const keyPrefix = apiKey.substring(0, 12) + '...'; // sk_live_XXXX...

        // Get user's selected workspace
        const workspaceId = await getWorkspaceIdForUser(env, userId);

        const timestamp = now();
        const expiresAt = expiresInDays 
          ? timestamp + (expiresInDays * 24 * 60 * 60)
          : null;

        await env.DB.prepare(
          `INSERT INTO api_keys (id, user_id, workspace_id, name, key_prefix, key_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(),
          userId,
          workspaceId,
          name,
          keyPrefix,
          keyHash,
          expiresAt,
          timestamp
        ).run();

        // Return the full key only once - user must save it
        return jsonResponse({
          success: true,
          apiKey: apiKey,
          keyPrefix: keyPrefix,
          message: 'Save this API key now - you won\'t be able to see it again!'
        }, 201);
      }

      // Revoke API key
      if (url.pathname.match(/^\/api\/api-keys\/[^/]+$/) && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const keyId = url.pathname.split('/').pop();

        // Verify key belongs to user
        const apiKey = await env.DB.prepare(
          'SELECT id FROM api_keys WHERE id = ? AND user_id = ?'
        ).bind(keyId, userId).first();

        if (!apiKey) {
          return jsonResponse({ error: 'API key not found' }, 404);
        }

        await env.DB.prepare(
          'UPDATE api_keys SET revoked_at = ? WHERE id = ?'
        ).bind(now(), keyId).run();

        return jsonResponse({ success: true, message: 'API key revoked' });
      }

      // ============================================
      // USER SETTINGS ENDPOINTS (Protected)
      // ============================================

      // Get user settings
      // Get settings - workspace-scoped (returns workspace owner's credentials)
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's selected workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          // No workspace selected, return empty settings
          return jsonResponse({
            privateKey: null,
            publicKey: null,
            selectedAssistantId: null,
            selectedPhoneId: null,
            selectedOrgId: null,
            selectedWorkspaceId: null,
            openaiApiKey: null,
            twilioAccountSid: null,
            twilioAuthToken: null,
            transferPhoneNumber: null
          });
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify user has access to this workspace
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        // Get workspace settings (workspace owner's credentials)
        const wsSettings = await env.DB.prepare(
          'SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, customerconnect_workspace_id, customerconnect_api_key FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        // FALLBACK: If workspace_settings is empty, try to get from user_settings (migration path)
        let finalSettings = wsSettings;
        if (!wsSettings || !wsSettings.private_key) {
          const ownerSettings = await env.DB.prepare(
            'SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM user_settings WHERE user_id = ?'
          ).bind(workspace.owner_user_id).first() as any;

          if (ownerSettings && ownerSettings.private_key) {
            finalSettings = ownerSettings;

            // Auto-migrate to workspace_settings if user is owner
            if (isOwner) {
              const timestamp = Date.now();
              const wsSettingsId = generateId();

              await env.DB.prepare(
                `INSERT OR REPLACE INTO workspace_settings (
                  id, workspace_id, private_key, public_key, openai_api_key,
                  twilio_account_sid, twilio_auth_token, transfer_phone_number,
                  selected_assistant_id, selected_phone_id, selected_org_id,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                wsSettingsId,
                workspaceId,
                ownerSettings.private_key,
                ownerSettings.public_key,
                ownerSettings.openai_api_key,
                ownerSettings.twilio_account_sid,
                ownerSettings.twilio_auth_token,
                ownerSettings.transfer_phone_number,
                ownerSettings.selected_assistant_id,
                ownerSettings.selected_phone_id,
                ownerSettings.selected_org_id,
                timestamp,
                timestamp
              ).run();

              console.log(`Auto-migrated settings for workspace ${workspaceId}`);
            }
          }
        }

        return jsonResponse({
          privateKey: finalSettings?.private_key || null,
          publicKey: finalSettings?.public_key || null,
          selectedAssistantId: finalSettings?.selected_assistant_id || null,
          selectedPhoneId: finalSettings?.selected_phone_id || null,
          selectedOrgId: finalSettings?.selected_org_id || null,
          selectedWorkspaceId: workspaceId,
          openaiApiKey: finalSettings?.openai_api_key || null,
          twilioAccountSid: finalSettings?.twilio_account_sid || null,
          twilioAuthToken: finalSettings?.twilio_auth_token || null,
          transferPhoneNumber: finalSettings?.transfer_phone_number || null,
          customerconnectWorkspaceId: finalSettings?.customerconnect_workspace_id || null,
          customerconnectApiKey: finalSettings?.customerconnect_api_key || null,
          isWorkspaceOwner: isOwner
        });
      }

      // Update settings - workspace-scoped (only workspace owner can update)
      if (url.pathname === '/api/settings' && request.method === 'PUT') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const {
          privateKey,
          publicKey,
          selectedAssistantId,
          selectedPhoneId,
          selectedOrgId,
          selectedWorkspaceId,
          openaiApiKey,
          twilioAccountSid,
          twilioAuthToken,
          transferPhoneNumber,
          customerconnectWorkspaceId,
          customerconnectApiKey
        } = await request.json() as any;

        // Validate workspace selection
        if (!selectedWorkspaceId) {
          return jsonResponse({ error: 'Workspace selection is required' }, 400);
        }

        // Verify user is workspace owner
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(selectedWorkspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        if (workspace.owner_user_id !== userId) {
          return jsonResponse({ error: 'Only workspace owner can update API credentials' }, 403);
        }

        const timestamp = now();

        // Update or insert workspace settings
        const existing = await env.DB.prepare(
          'SELECT id FROM workspace_settings WHERE workspace_id = ?'
        ).bind(selectedWorkspaceId).first() as any;

        if (existing) {
          await env.DB.prepare(
            'UPDATE workspace_settings SET private_key = ?, public_key = ?, selected_assistant_id = ?, selected_phone_id = ?, selected_org_id = ?, openai_api_key = ?, twilio_account_sid = ?, twilio_auth_token = ?, transfer_phone_number = ?, customerconnect_workspace_id = ?, customerconnect_api_key = ?, updated_at = ? WHERE workspace_id = ?'
          ).bind(
            privateKey || null,
            publicKey || null,
            selectedAssistantId || null,
            selectedPhoneId || null,
            selectedOrgId || null,
            openaiApiKey || null,
            twilioAccountSid || null,
            twilioAuthToken || null,
            transferPhoneNumber || null,
            customerconnectWorkspaceId || null,
            customerconnectApiKey || null,
            timestamp,
            selectedWorkspaceId
          ).run();
        } else {
          const settingsId = generateId();
          await env.DB.prepare(
            'INSERT INTO workspace_settings (id, workspace_id, private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, customerconnect_workspace_id, customerconnect_api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            settingsId,
            selectedWorkspaceId,
            privateKey || null,
            publicKey || null,
            selectedAssistantId || null,
            selectedPhoneId || null,
            selectedOrgId || null,
            openaiApiKey || null,
            twilioAccountSid || null,
            twilioAuthToken || null,
            transferPhoneNumber || null,
            customerconnectWorkspaceId || null,
            customerconnectApiKey || null,
            timestamp,
            timestamp
          ).run();
        }

        // Update user's selected workspace
        await env.DB.prepare(
          'UPDATE user_settings SET selected_workspace_id = ?, updated_at = ? WHERE user_id = ?'
        ).bind(selectedWorkspaceId, timestamp, userId).run();

        return jsonResponse({ message: 'Settings updated successfully' });
      }

      // ============================================
      // TRANSLATION ENDPOINT (Protected)
      // ============================================
      if (url.pathname === '/api/translate' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { text, targetLanguage } = await request.json() as { text: string; targetLanguage: string };

        if (!text || !targetLanguage) {
          return jsonResponse({ error: 'Missing required fields: text, targetLanguage' }, 400);
        }

        // Get user's workspace settings to retrieve OpenAI API key
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceSettings = await env.DB.prepare(
          'SELECT openai_api_key FROM workspace_settings WHERE workspace_id = ?'
        ).bind(userSettings.selected_workspace_id).first() as any;

        if (!workspaceSettings || !workspaceSettings.openai_api_key) {
          return jsonResponse({
            success: false,
            error: 'OpenAI API key not configured. Please add it in Settings.'
          });
        }

        try {
          // Call OpenAI API to translate
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${workspaceSettings.openai_api_key}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `You are a professional translator. Translate the following English text to ${targetLanguage}, maintaining the same tone and meaning.`
                },
                {
                  role: 'user',
                  content: text
                }
              ],
              temperature: 0.3
            })
          });

          if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`);
          }

          const data = await openaiResponse.json() as any;
          const translatedText = data.choices[0].message.content;

          return jsonResponse({
            success: true,
            translatedText
          });
        } catch (error: any) {
          console.error('[Translation] Error:', error);
          return jsonResponse({
            success: false,
            error: error.message || 'Translation failed'
          });
        }
      }

      // ============================================
      // SALESFORCE INTEGRATION ENDPOINTS (Protected)
      // ============================================

      // Initiate Salesforce OAuth flow
      if (url.pathname === '/api/salesforce/oauth/initiate' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Generate OAuth URL
        const authUrl = buildAuthUrl(workspaceId, env);

        return jsonResponse({
          success: true,
          authUrl
        });
      }

      // Handle Salesforce OAuth callback
      if (url.pathname === '/api/salesforce/oauth/callback' && request.method === 'GET') {
        try {
          // Extract code and state from query params
          const code = url.searchParams.get('code');
          const workspaceId = url.searchParams.get('state'); // We passed workspace ID as state

          if (!code || !workspaceId) {
            return new Response('Missing code or state parameter', { status: 400 });
          }

          // Exchange code for tokens
          const tokens = await exchangeCodeForToken(code, env);

          // Store tokens in database
          const timestamp = now();
          await env.DB.prepare(
            `UPDATE workspace_settings
             SET salesforce_instance_url = ?,
                 salesforce_access_token = ?,
                 salesforce_refresh_token = ?,
                 salesforce_token_expires_at = ?,
                 updated_at = ?
             WHERE workspace_id = ?`
          ).bind(
            tokens.instance_url,
            tokens.access_token,
            tokens.refresh_token,
            tokens.expires_in,
            timestamp,
            workspaceId
          ).run();

          // Redirect to integration page with success message
          return new Response(null, {
            status: 302,
            headers: {
              'Location': 'https://voice-config.channelautomation.com/integrations?salesforce=connected'
            }
          });
        } catch (error: any) {
          console.error('[Salesforce OAuth] Error:', error);
          // Redirect to integration page with error
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `https://voice-config.channelautomation.com/integrations?salesforce=error&message=${encodeURIComponent(error.message)}`
            }
          });
        }
      }

      // Get Salesforce connection status
      if (url.pathname === '/api/salesforce/status' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get Salesforce settings
        const settings = await env.DB.prepare(
          `SELECT salesforce_instance_url, salesforce_access_token,
                  salesforce_refresh_token, salesforce_token_expires_at
           FROM workspace_settings
           WHERE workspace_id = ?`
        ).bind(workspaceId).first() as any;

        const connected = !!(settings && settings.salesforce_refresh_token);
        const tokenExpiresAt = settings?.salesforce_token_expires_at || null;

        return jsonResponse({
          success: true,
          connected,
          instanceUrl: connected ? settings.salesforce_instance_url : null,
          tokenExpiresAt
        });
      }

      // Disconnect Salesforce
      if (url.pathname === '/api/salesforce/disconnect' && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Clear Salesforce tokens
        const timestamp = now();
        await env.DB.prepare(
          `UPDATE workspace_settings
           SET salesforce_instance_url = NULL,
               salesforce_access_token = NULL,
               salesforce_refresh_token = NULL,
               salesforce_token_expires_at = NULL,
               updated_at = ?
           WHERE workspace_id = ?`
        ).bind(timestamp, workspaceId).run();

        return jsonResponse({
          success: true,
          message: 'Salesforce disconnected successfully'
        });
      }

      // Get Salesforce sync logs
      if (url.pathname === '/api/salesforce/sync-logs' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get query parameters
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status'); // 'success', 'error', 'skipped'

        // Build query
        let query = `
          SELECT id, call_id, salesforce_record_id, salesforce_task_id,
                 salesforce_event_id, appointment_created, status,
                 error_message, phone_number, created_at
          FROM salesforce_sync_logs
          WHERE workspace_id = ?
        `;
        const params: any[] = [workspaceId];

        if (status) {
          query += ' AND status = ?';
          params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = await env.DB.prepare(query).bind(...params).all();

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM salesforce_sync_logs WHERE workspace_id = ?';
        const countParams: any[] = [workspaceId];

        if (status) {
          countQuery += ' AND status = ?';
          countParams.push(status);
        }

        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first() as any;

        return jsonResponse({
          success: true,
          logs: logs.results || [],
          total: countResult?.count || 0,
          limit,
          offset
        });
      }

      // ============================================
      // HUBSPOT INTEGRATION ENDPOINTS (Protected)
      // ============================================

      // Initiate HubSpot OAuth flow
      if (url.pathname === '/api/hubspot/oauth/initiate' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Generate OAuth URL
        const authUrl = buildHubSpotAuthUrl(workspaceId, env);

        return jsonResponse({
          success: true,
          authUrl
        });
      }

      // Handle HubSpot OAuth callback
      if (url.pathname === '/api/hubspot/oauth/callback' && request.method === 'GET') {
        try {
          // Extract code and state from query params
          const code = url.searchParams.get('code');
          const workspaceId = url.searchParams.get('state'); // We passed workspace ID as state

          if (!code || !workspaceId) {
            return new Response('Missing code or state parameter', { status: 400 });
          }

          // Exchange code for tokens
          const tokens = await exchangeHubSpotCodeForToken(code, env);

          // Get workspace owner
          const workspace = await env.DB.prepare(
            'SELECT owner_user_id FROM workspaces WHERE id = ?'
          ).bind(workspaceId).first() as any;

          if (!workspace) {
            return new Response('Workspace not found', { status: 404 });
          }

          const userId = workspace.owner_user_id;

          // Check if token entry exists (workspace-level)
          const existing = await env.DB.prepare(
            'SELECT id FROM hubspot_oauth_tokens WHERE workspace_id = ? LIMIT 1'
          ).bind(workspaceId).first();

          const timestamp = now();
          const tokenId = generateId();

          if (existing) {
            // Update existing tokens (workspace-level)
            await env.DB.prepare(
              `UPDATE hubspot_oauth_tokens
               SET access_token = ?,
                   refresh_token = ?,
                   expires_at = ?,
                   updated_at = ?,
                   user_id = ?
               WHERE workspace_id = ?`
            ).bind(
              tokens.access_token,
              tokens.refresh_token,
              tokens.expires_in,
              timestamp,
              userId, // Update user_id to current owner for audit
              workspaceId
            ).run();
          } else {
            // Insert new tokens
            await env.DB.prepare(
              `INSERT INTO hubspot_oauth_tokens (
                id, user_id, workspace_id, access_token, refresh_token,
                expires_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              tokenId,
              userId,
              workspaceId,
              tokens.access_token,
              tokens.refresh_token,
              tokens.expires_in,
              timestamp,
              timestamp
            ).run();
          }

          // Redirect back to integration page with success message
          return new Response(null, {
            status: 302,
            headers: {
              'Location': 'https://voice-config.channelautomation.com/?hubspot=connected',
              ...corsHeaders
            }
          });
        } catch (error: any) {
          console.error('[HubSpot OAuth Error]:', error);
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `https://voice-config.channelautomation.com/?hubspot=error&message=${encodeURIComponent(error.message)}`,
              ...corsHeaders
            }
          });
        }
      }

      // Get HubSpot connection status
      if (url.pathname === '/api/hubspot/status' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get HubSpot tokens (workspace-level, any user_id)
        const tokens = await env.DB.prepare(
          'SELECT access_token, refresh_token, expires_at FROM hubspot_oauth_tokens WHERE workspace_id = ? LIMIT 1'
        ).bind(workspaceId).first() as any;

        const connected = !!(tokens && tokens.refresh_token);
        const tokenExpiresAt = tokens?.expires_at || null;

        return jsonResponse({
          success: true,
          connected,
          tokenExpiresAt
        });
      }

      // Disconnect HubSpot
      if (url.pathname === '/api/hubspot/disconnect' && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Delete HubSpot tokens (workspace-level)
        await env.DB.prepare(
          'DELETE FROM hubspot_oauth_tokens WHERE workspace_id = ?'
        ).bind(workspaceId).run();

        return jsonResponse({
          success: true,
          message: 'HubSpot disconnected successfully'
        });
      }

      // Get HubSpot sync logs
      if (url.pathname === '/api/hubspot/sync-logs' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get query parameters
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status'); // 'success', 'error', 'skipped'

        // Build query (workspace-level - all members see all sync logs)
        let query = `
          SELECT id, call_id, contact_id, engagement_id, status,
                 error_message, phone_number, created_at
          FROM hubspot_sync_logs
          WHERE workspace_id = ?
        `;
        const params: any[] = [workspaceId];

        if (status) {
          query += ' AND status = ?';
          params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = await env.DB.prepare(query).bind(...params).all();

        // Get total count (workspace-level)
        let countQuery = 'SELECT COUNT(*) as count FROM hubspot_sync_logs WHERE workspace_id = ?';
        const countParams: any[] = [workspaceId];

        if (status) {
          countQuery += ' AND status = ?';
          countParams.push(status);
        }

        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first() as any;

        return jsonResponse({
          success: true,
          logs: logs.results || [],
          total: countResult?.count || 0,
          limit,
          offset
        });
      }

      // ============================================
      // DYNAMICS 365 INTEGRATION ENDPOINTS (Protected)
      // ============================================

      // Initiate Dynamics 365 OAuth flow
      if (url.pathname === '/api/dynamics/oauth/initiate' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get instance URL from query parameter (user must provide their D365 instance)
        const instanceUrl = url.searchParams.get('instanceUrl');
        if (!instanceUrl) {
          return jsonResponse({ error: 'Instance URL is required' }, 400);
        }

        // Generate OAuth URL
        const authUrl = buildDynamicsAuthUrl(workspaceId, env, instanceUrl);

        return jsonResponse({
          success: true,
          authUrl
        });
      }

      // Handle Dynamics 365 OAuth callback
      if (url.pathname === '/api/dynamics/oauth/callback' && request.method === 'GET') {
        try {
          // Extract code and state from query params
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state'); // Contains "workspaceId|instanceUrl"

          if (!code || !state) {
            return new Response('Missing code or state parameter', { status: 400 });
          }

          // Parse state
          const [workspaceId, instanceUrl] = state.split('|');

          // Exchange code for tokens
          const tokens = await exchangeDynamicsCodeForToken(code, env, instanceUrl);

          // Store tokens in database
          const timestamp = now();
          await env.DB.prepare(
            `UPDATE workspace_settings
             SET dynamics_instance_url = ?,
                 dynamics_access_token = ?,
                 dynamics_refresh_token = ?,
                 dynamics_token_expires_at = ?,
                 updated_at = ?
             WHERE workspace_id = ?`
          ).bind(
            instanceUrl,
            tokens.access_token,
            tokens.refresh_token,
            tokens.expires_in,
            timestamp,
            workspaceId
          ).run();

          // Redirect to integration page with success message
          return new Response(null, {
            status: 302,
            headers: {
              'Location': 'https://voice-config.channelautomation.com/integrations?dynamics=connected'
            }
          });
        } catch (error: any) {
          console.error('[Dynamics 365 OAuth] Error:', error);
          // Redirect to integration page with error
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `https://voice-config.channelautomation.com/integrations?dynamics=error&message=${encodeURIComponent(error.message)}`
            }
          });
        }
      }

      // Get Dynamics 365 connection status
      if (url.pathname === '/api/dynamics/status' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get Dynamics 365 settings
        const settings = await env.DB.prepare(
          `SELECT dynamics_instance_url, dynamics_access_token,
                  dynamics_refresh_token, dynamics_token_expires_at
           FROM workspace_settings
           WHERE workspace_id = ?`
        ).bind(workspaceId).first() as any;

        const connected = !!(settings && settings.dynamics_refresh_token);
        const tokenExpiresAt = settings?.dynamics_token_expires_at || null;

        return jsonResponse({
          success: true,
          connected,
          instanceUrl: connected ? settings.dynamics_instance_url : null,
          tokenExpiresAt
        });
      }

      // Disconnect Dynamics 365
      if (url.pathname === '/api/dynamics/disconnect' && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Clear Dynamics 365 tokens
        const timestamp = now();
        await env.DB.prepare(
          `UPDATE workspace_settings
           SET dynamics_instance_url = NULL,
               dynamics_access_token = NULL,
               dynamics_refresh_token = NULL,
               dynamics_token_expires_at = NULL,
               updated_at = ?
           WHERE workspace_id = ?`
        ).bind(timestamp, workspaceId).run();

        return jsonResponse({
          success: true,
          message: 'Dynamics 365 disconnected successfully'
        });
      }

      // Get Dynamics 365 sync logs
      if (url.pathname === '/api/dynamics/sync-logs' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Get query parameters
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status'); // 'success', 'error', 'skipped'

        // Build query
        let query = `
          SELECT id, call_id, dynamics_record_id, dynamics_activity_id,
                 dynamics_appointment_id, appointment_created, status,
                 error_message, phone_number, created_at
          FROM dynamics_sync_logs
          WHERE workspace_id = ?
        `;
        const params: any[] = [workspaceId];

        if (status) {
          query += ' AND status = ?';
          params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = await env.DB.prepare(query).bind(...params).all();

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM dynamics_sync_logs WHERE workspace_id = ?';
        const countParams: any[] = [workspaceId];

        if (status) {
          countQuery += ' AND status = ?';
          countParams.push(status);
        }

        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first() as any;

        return jsonResponse({
          success: true,
          logs: logs.results || [],
          total: countResult?.count || 0,
          limit,
          offset
        });
      }

      // ============================================
      // WORKSPACES ENDPOINTS (Protected)
      // ============================================

      // List workspaces for current user (owner or active member)
      if (url.pathname === '/api/workspaces' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const query = `
          SELECT DISTINCT w.id, w.name, w.owner_user_id, w.created_at, w.updated_at,
            CASE WHEN w.owner_user_id = ? THEN 'owner' ELSE wm.role END AS role,
            CASE WHEN w.owner_user_id = ? THEN 'active' ELSE wm.status END AS status
          FROM workspaces w
          LEFT JOIN workspace_members wm
            ON wm.workspace_id = w.id AND wm.user_id = ?
          WHERE w.owner_user_id = ? OR wm.user_id = ?
          ORDER BY w.created_at DESC`;

        const { results } = await env.DB.prepare(query).bind(userId, userId, userId, userId, userId).all();
        return jsonResponse({ workspaces: results || [] });
      }

      // Create workspace - DISABLED: Users get one workspace automatically on registration
      // Keeping endpoint for backward compatibility but returning error
      if (url.pathname === '/api/workspaces' && request.method === 'POST') {
        return jsonResponse({ error: 'Workspace creation is not allowed. Each user automatically gets one workspace on registration.' }, 403);
      }

      // Invite a member to a workspace by email (supports pending invitations for non-existing users)
      if (url.pathname.startsWith('/api/workspaces/') && url.pathname.endsWith('/invite') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const parts = url.pathname.split('/');
        const workspaceId = parts[3];
        const { email, role } = await request.json() as any;
        if (!email) {
          return jsonResponse({ error: 'Email is required' }, 400);
        }

        // Verify requester has permission (owner or admin)
        const ws = await env.DB.prepare('SELECT owner_user_id FROM workspaces WHERE id = ?').bind(workspaceId).first() as any;
        if (!ws) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }
        if (ws.owner_user_id !== userId) {
          const membership = await env.DB.prepare(
            'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = \"active\"'
          ).bind(workspaceId, userId).first() as any;
          if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
            return jsonResponse({ error: 'Forbidden' }, 403);
          }
        }

        const timestamp = now();

        // Check if user exists
        const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first() as any;

        if (user) {
          // User exists - add them directly as active member
          const membershipId = generateId();
          try {
            await env.DB.prepare(
              'INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_user_id, invited_at, joined_at, created_at, updated_at) VALUES (?, ?, ?, ?, \"active\", ?, ?, ?, ?, ?)'
            ).bind(membershipId, workspaceId, user.id, role || 'member', userId, timestamp, timestamp, timestamp, timestamp).run();
          } catch (e) {
            // If unique constraint, update status/role
            await env.DB.prepare(
              'UPDATE workspace_members SET role = ?, status = \"active\", invited_by_user_id = ?, invited_at = ?, joined_at = ?, updated_at = ? WHERE workspace_id = ? AND user_id = ?'
            ).bind(role || 'member', userId, timestamp, timestamp, timestamp, workspaceId, user.id).run();
          }
          return jsonResponse({ success: true, message: 'User added to workspace' });
        } else {
          // User doesn't exist - create account with temporary password
          const temporaryPassword = generateTemporaryPassword();
          const passwordHash = await hashPassword(temporaryPassword);
          const newUserId = generateId();

          // Get workspace name for email
          const workspaceInfo = await env.DB.prepare('SELECT name FROM workspaces WHERE id = ?').bind(workspaceId).first() as any;
          const workspaceName = workspaceInfo?.name || 'the workspace';

          // Create user account
          await env.DB.prepare(
            'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(newUserId, email, passwordHash, null, timestamp, timestamp).run();

          // Create default workspace for the new user
          const newUserWorkspaceId = 'ws_' + generateId();
          const defaultWorkspaceName = email.split('@')[0] || 'My Workspace';
          await env.DB.prepare(
            'INSERT INTO workspaces (id, name, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(newUserWorkspaceId, defaultWorkspaceName, newUserId, timestamp, timestamp).run();

          // Create user settings with the invited workspace as selected
          const settingsId = generateId();
          const encryptionSalt = generateSalt();
          await env.DB.prepare(
            'INSERT INTO user_settings (id, user_id, encryption_salt, selected_workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(settingsId, newUserId, encryptionSalt, workspaceId, timestamp, timestamp).run();

          // Add user to the workspace they were invited to
          const membershipId = generateId();
          await env.DB.prepare(
            'INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_user_id, invited_at, joined_at, created_at, updated_at) VALUES (?, ?, ?, ?, \"active\", ?, ?, ?, ?, ?)'
          ).bind(membershipId, workspaceId, newUserId, role || 'member', userId, timestamp, timestamp, timestamp, timestamp).run();

          // Mark any pending invitations as accepted
          await env.DB.prepare(
            'UPDATE workspace_invitations SET status = \"accepted\", accepted_at = ? WHERE email = ? AND workspace_id = ? AND status = \"pending\"'
          ).bind(timestamp, email, workspaceId).run();

          // Send invitation email (don't fail the request if email fails)
          if (env.SENDGRID_API_KEY) {
            console.log(`[Email] Attempting to send team invite email to: ${email}`);
            sendTeamInviteEmail(env.SENDGRID_API_KEY, {
              to: email,
              workspaceName: workspaceName,
              email: email,
              temporaryPassword: temporaryPassword,
            })
            .then((result) => {
              if (result.success) {
                console.log(`[Email] Successfully sent team invite email to: ${email}`);
              } else {
                console.error(`[Email] Failed to send team invite email to ${email}:`, result.error);
              }
            })
            .catch((error) => {
              console.error(`[Email] Error sending team invite email to ${email}:`, error);
              // Don't throw - email failure shouldn't fail the invitation
            });
          } else {
            console.warn('[Email] SENDGRID_API_KEY not configured, skipping email send');
          }

          return jsonResponse({
            success: true,
            message: 'User account created and added to workspace',
            credentials: {
              email: email,
              temporaryPassword: temporaryPassword
            }
          });
        }
      }

      // Get workspace members
      if (url.pathname.startsWith('/api/workspaces/') && url.pathname.endsWith('/members') && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const parts = url.pathname.split('/');
        const workspaceId = parts[3];

        // Verify user has access to this workspace
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id, name FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status, role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && (!membership || membership.status !== 'active')) {
          return jsonResponse({ error: 'Access denied' }, 403);
        }

        // Get owner info
        const owner = await env.DB.prepare(
          'SELECT id, email, name FROM users WHERE id = ?'
        ).bind(workspace.owner_user_id).first() as any;

        // Get all members including owner
        const members = await env.DB.prepare(`
          SELECT wm.id, wm.role, wm.status, wm.joined_at, wm.invited_at,
                 u.id as user_id, u.email, u.name
          FROM workspace_members wm
          JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = ? AND wm.status = 'active'
          ORDER BY wm.joined_at DESC
        `).bind(workspaceId).all() as any;

        const membersList = (members.results || []).map((m: any) => ({
          id: m.user_id,
          email: m.email,
          name: m.name,
          role: m.role,
          status: m.status,
          joinedAt: m.joined_at,
        }));

        // Add owner to list if not already included
        const ownerInList = membersList.find((m: any) => m.id === owner.id);
        if (!ownerInList) {
          membersList.unshift({
            id: owner.id,
            email: owner.email,
            name: owner.name,
            role: 'owner',
            status: 'active',
            joinedAt: null,
          });
        }

        return jsonResponse({
          workspace: { id: workspaceId, name: workspace.name },
          members: membersList,
        });
      }

      // Remove member from workspace
      if (url.pathname.includes('/api/workspaces/') && url.pathname.includes('/members/') && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const parts = url.pathname.split('/');
        const workspaceId = parts[3];
        const memberId = parts[5];

        // Verify user has permission (must be owner or admin)
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && (!membership || membership.role !== 'admin')) {
          return jsonResponse({ error: 'Only owners and admins can remove members' }, 403);
        }

        // memberId is actually user_id (from frontend)
        const userIdToRemove = memberId;

        // Cannot remove owner
        if (userIdToRemove === workspace.owner_user_id) {
          return jsonResponse({ error: 'Cannot remove workspace owner' }, 400);
        }

        // Get the member to remove (lookup by user_id, not workspace_members.id)
        const member = await env.DB.prepare(
          'SELECT id, user_id FROM workspace_members WHERE user_id = ? AND workspace_id = ?'
        ).bind(userIdToRemove, workspaceId).first() as any;

        if (!member) {
          return jsonResponse({ error: 'Member not found' }, 404);
        }

        // Remove member (delete by workspace_members.id)
        await env.DB.prepare(
          'DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?'
        ).bind(member.id, workspaceId).run();

        return jsonResponse({ success: true, message: 'Member removed successfully' });
      }

      // Update member role
      if (url.pathname.includes('/api/workspaces/') && url.pathname.includes('/members/') && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const parts = url.pathname.split('/');
        const workspaceId = parts[3];
        const memberId = parts[5];
        const { role } = await request.json() as any;

        if (!role || !['member', 'admin'].includes(role)) {
          return jsonResponse({ error: 'Invalid role. Must be "member" or "admin"' }, 400);
        }

        // Verify user has permission (must be owner)
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        if (workspace.owner_user_id !== userId) {
          return jsonResponse({ error: 'Only workspace owner can change roles' }, 403);
        }

        // memberId is actually user_id (from frontend)
        const userIdToUpdate = memberId;

        // Get the member to update (lookup by user_id)
        const member = await env.DB.prepare(
          'SELECT id, user_id FROM workspace_members WHERE user_id = ? AND workspace_id = ?'
        ).bind(userIdToUpdate, workspaceId).first() as any;

        if (!member) {
          return jsonResponse({ error: 'Member not found' }, 404);
        }

        // Update role (update by workspace_members.id)
        const timestamp = now();
        await env.DB.prepare(
          'UPDATE workspace_members SET role = ?, updated_at = ? WHERE id = ? AND workspace_id = ?'
        ).bind(role, timestamp, member.id, workspaceId).run();

        return jsonResponse({ success: true, message: 'Member role updated successfully' });
      }

      // Reset member password
      if (url.pathname.includes('/api/workspaces/') && url.pathname.includes('/members/') && url.pathname.endsWith('/reset-password') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const parts = url.pathname.split('/');
        const workspaceId = parts[3];
        const memberId = parts[5];

        // Verify user has permission (must be owner or admin)
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && (!membership || membership.role !== 'admin')) {
          return jsonResponse({ error: 'Only owners and admins can reset passwords' }, 403);
        }

        // memberId is actually user_id (from frontend)
        const userIdToReset = memberId;

        // Get the member to reset password for (lookup by user_id)
        const member = await env.DB.prepare(
          'SELECT user_id FROM workspace_members WHERE user_id = ? AND workspace_id = ?'
        ).bind(userIdToReset, workspaceId).first() as any;

        if (!member) {
          return jsonResponse({ error: 'Member not found' }, 404);
        }

        // Get user email
        const user = await env.DB.prepare(
          'SELECT email FROM users WHERE id = ?'
        ).bind(userIdToReset).first() as any;

        if (!user) {
          return jsonResponse({ error: 'User not found' }, 404);
        }

        // Generate new temporary password
        const newPassword = generateTemporaryPassword();
        const passwordHash = await hashPassword(newPassword);
        const timestamp = now();

        // Update user's password
        await env.DB.prepare(
          'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
        ).bind(passwordHash, timestamp, userIdToReset).run();

        // Send password reset email (don't fail the request if email fails)
        if (env.SENDGRID_API_KEY) {
          sendPasswordResetEmail(env.SENDGRID_API_KEY, {
            to: user.email,
            email: user.email,
            newPassword: newPassword,
          }).catch((error) => {
            console.error('Failed to send password reset email:', error);
            // Don't throw - email failure shouldn't fail the password reset
          });
        }

        return jsonResponse({
          success: true,
          message: 'Password reset successfully. An email with the new password has been sent.',
        });
      }

      // ============================================
      // PHONE NUMBERS ENDPOINTS (Protected)
      // ============================================

      // Get Twilio phone numbers
      if (url.pathname === '/api/twilio/phone-numbers' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected. Please select a workspace first.' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const settings = await env.DB.prepare(
          'SELECT twilio_account_sid, twilio_auth_token FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        if (!settings || !settings.twilio_account_sid || !settings.twilio_auth_token) {
          return jsonResponse({ error: 'Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration.' }, 400);
        }

        try {
          // Fetch Twilio phone numbers
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/IncomingPhoneNumbers.json`;
          const twilioAuth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);
          
          const twilioResponse = await fetch(twilioUrl, {
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
            },
          });

          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            return jsonResponse({ error: `Twilio API error: ${twilioResponse.status} - ${errorText}` }, 400);
          }

          const twilioData = await twilioResponse.json() as any;
          
          // Filter to voice-capable numbers only
          const voiceNumbers = (twilioData.incoming_phone_numbers || []).filter((num: any) => 
            num.capabilities?.voice === true
          ).map((num: any) => ({
            sid: num.sid,
            phoneNumber: num.phone_number,
            friendlyName: num.friendly_name,
            capabilities: {
              voice: num.capabilities?.voice || false,
              sms: num.capabilities?.sms || false,
            }
          }));

          return jsonResponse(voiceNumbers);
        } catch (error: any) {
          console.error('Error fetching Twilio numbers:', error);
          return jsonResponse({ error: `Failed to fetch Twilio numbers: ${error.message}` }, 500);
        }
      }

      // Import Twilio number to Vapi
      if (url.pathname === '/api/vapi/import-twilio' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { sid, phoneNumber, name } = await request.json() as any;

        if (!sid && !phoneNumber) {
          return jsonResponse({ error: 'Either sid or phoneNumber is required' }, 400);
        }

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected. Please select a workspace first.' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const settings = await env.DB.prepare(
          'SELECT private_key, twilio_account_sid, twilio_auth_token FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration.' }, 400);
        }

        if (!settings.twilio_account_sid || !settings.twilio_auth_token) {
          return jsonResponse({ error: 'Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration.' }, 400);
        }

        try {
          // Import phone number to CHAU Voice Engine
          // According to Vapi docs, we need to POST to /phone-number with import parameters
          const vapiUrl = 'https://api.vapi.ai/phone-number';
          const payload: any = {
            provider: 'twilio',
            twilioAccountSid: settings.twilio_account_sid,
            twilioAuthToken: settings.twilio_auth_token,
          };

          if (sid) {
            payload.twilioPhoneNumberSid = sid;
          } else if (phoneNumber) {
            payload.number = phoneNumber;
          }

          if (name) {
            payload.name = name;
          }

          // Ensure SMS is disabled, only voice
          payload.smsEnabled = false;

          const vapiResponse = await fetch(vapiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }

          const vapiData = await vapiResponse.json() as any;

          return jsonResponse({
            id: vapiData.id,
            number: vapiData.number || vapiData.phoneNumber,
            name: vapiData.name || name,
          });
        } catch (error: any) {
          console.error('Error importing Twilio number:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to import Twilio number: ${errorMessage}` }, 500);
        }
      }

      // Get all phone numbers from VAPI
      if (url.pathname === '/api/vapi/phone-numbers' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          return jsonResponse({ error: 'VAPI API key not configured' }, 400);
        }

        try {
          const response = await fetch('https://api.vapi.ai/phone-number', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json() as any;

          if (!response.ok) {
            return jsonResponse({ error: data.message || 'Failed to fetch phone numbers' }, response.status);
          }

          // Format phone numbers for frontend
          const phoneNumbers = (Array.isArray(data) ? data : []).map((p: any) => ({
            id: p.id,
            number: p.number || p.phoneNumber || 'Unknown',
            name: p.name || p.friendlyName || '',
            provider: p.provider || 'unknown',
            assignedAssistantId: p.assistantId || null
          }));

          return jsonResponse({ phoneNumbers });
        } catch (error: any) {
          console.error('Error fetching VAPI phone numbers:', error);
          return jsonResponse({ error: `Failed to fetch phone numbers: ${error.message}` }, 500);
        }
      }

      // Create free CHAU Voice Engine phone number
      if (url.pathname === '/api/vapi/phone-number' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { areaCode, name } = await request.json() as any;

        if (!areaCode || !/^\d{3}$/.test(areaCode)) {
          return jsonResponse({ error: 'Valid 3-digit area code is required' }, 400);
        }

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected. Please select a workspace first.' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const settings = await env.DB.prepare(
          'SELECT private_key, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration.' }, 400);
        }

        try {
          // Create free CHAU Voice Engine phone number (provider: "vapi")
          // CHAU Voice Engine provides free US phone numbers - no Twilio purchase needed
          // Up to 10 free numbers per account
          const vapiUrl = 'https://api.vapi.ai/phone-number';
          const payload: any = {
            provider: 'vapi',
            numberDesiredAreaCode: areaCode, // Correct field name from Vapi dashboard
          };

          if (name) {
            payload.name = name;
          }

          // Set fallback destination to transfer number if available
          if (settings.transfer_phone_number) {
            payload.fallbackDestination = {
              type: 'number',
              number: settings.transfer_phone_number,
            };
          }

          const vapiResponse = await fetch(vapiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            try {
              // Try to parse error JSON to extract meaningful message
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) {
                errorText = errorJson.message;
              } else if (errorJson.error) {
                errorText = errorJson.error;
              }
            } catch {
              // If not JSON, use error text as is
            }

            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');

            return jsonResponse({ error: errorText }, 400);
          }

          const vapiData = await vapiResponse.json() as any;

          return jsonResponse({
            id: vapiData.id,
            number: vapiData.number || vapiData.phoneNumber,
            name: vapiData.name || name,
          });
        } catch (error: any) {
          console.error('Error creating CHAU Voice Engine phone number:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to create phone number: ${errorMessage}` }, 500);
        }
      }

      // Update phone number assistant assignment
      if (url.pathname.startsWith('/api/vapi/phone-number/') && url.pathname.endsWith('/assistant') && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Extract ID from /api/vapi/phone-number/{id}/assistant
        const pathParts = url.pathname.split('/').filter(Boolean);
        const phoneNumberId = pathParts.length >= 4 ? pathParts[3] : null; // ['api', 'vapi', 'phone-number', '{id}', 'assistant']
        const { assistantId } = await request.json() as any;

        if (!phoneNumberId) {
          return jsonResponse({ error: 'Phone number ID required' }, 400);
        }

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected. Please select a workspace first.' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        let settings = await env.DB.prepare(
          'SELECT private_key FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        // FALLBACK: If workspace_settings is empty, try user_settings
        if (!settings || !settings.private_key) {
          const ownerSettings = await env.DB.prepare(
            'SELECT private_key FROM user_settings WHERE user_id = ?'
          ).bind(workspace.owner_user_id).first() as any;

          if (ownerSettings && ownerSettings.private_key) {
            settings = ownerSettings;
          }
        }

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration.' }, 400);
        }

        try {
          // Update phone number via Vapi API
          const vapiUrl = `https://api.vapi.ai/phone-number/${phoneNumberId}`;
          const payload: any = {};
          
          // If assistantId is null/undefined, set it to null to remove assignment
          // If assistantId is provided, set it to assign
          if (assistantId === null || assistantId === undefined || assistantId === '') {
            payload.assistantId = null;
          } else {
            payload.assistantId = assistantId;
          }

          const vapiResponse = await fetch(vapiUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }

          const vapiData = await vapiResponse.json() as any;
          
          return jsonResponse({
            success: true,
            phoneNumber: {
              id: vapiData.id,
              number: vapiData.number || vapiData.phoneNumber,
              assistantId: vapiData.assistantId || null,
            }
          });
        } catch (error: any) {
          console.error('Error updating phone number assistant:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to update phone number: ${errorMessage}` }, 500);
        }
      }

      // ============================================
      // ASSISTANTS ENDPOINTS (Protected with Caching)
      // ============================================

      // Get all assistants (cache-first, supports workspace context)
      if (url.pathname === '/api/assistants' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user settings including selected_workspace_id
        const settings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!settings) {
          return jsonResponse({ error: 'User settings not found' }, 404);
        }

        // Determine effective user ID for API key and cache lookup
        let effectiveUserId = userId;
        let privateKey: string | null = null;

        // If workspace is selected, use workspace settings (workspace-scoped credentials)
        if (settings.selected_workspace_id) {
          // Verify user has access to this workspace
          const workspace = await env.DB.prepare(
            'SELECT owner_user_id FROM workspaces WHERE id = ?'
          ).bind(settings.selected_workspace_id).first() as any;

          if (workspace) {
            // Check if user is owner or active member
            const isOwner = workspace.owner_user_id === userId;
            const membership = await env.DB.prepare(
              'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
            ).bind(settings.selected_workspace_id, userId).first() as any;

            if (isOwner || membership) {
              // Use workspace settings (workspace-scoped credentials)
              const wsSettings = await env.DB.prepare(
                'SELECT private_key FROM workspace_settings WHERE workspace_id = ?'
              ).bind(settings.selected_workspace_id).first() as any;

              if (wsSettings && wsSettings.private_key) {
                privateKey = wsSettings.private_key;
                effectiveUserId = workspace.owner_user_id;
              } else {
                // No workspace credentials - return empty list instead of error
                return jsonResponse({ assistants: [] });
              }
            } else {
              return jsonResponse({ error: 'Access denied to workspace' }, 403);
            }
          } else {
            // Workspace not found - return empty list
            return jsonResponse({ assistants: [] });
          }
        } else {
          // No workspace selected - return empty list (credentials are now workspace-scoped only)
          return jsonResponse({ assistants: [] });
        }

        if (!privateKey) {
          // No credentials found - return empty list
          return jsonResponse({ assistants: [] });
        }

        // Check for nocache parameter
        const noCache = url.searchParams.get('nocache') === 'true';

        try {
          // Check cache first (unless nocache is requested)
          if (!noCache) {
            const allCached = await env.DB.prepare(
              'SELECT id, vapi_data, cached_at, updated_at FROM assistants_cache WHERE user_id = ? ORDER BY cached_at DESC'
            ).bind(effectiveUserId).all();

            // Check if we have fresh cache data (any assistant cached within last 5 minutes means full list is fresh)
            if (allCached && allCached.results && allCached.results.length > 0) {
              const cacheAgeLimit = now() - (5 * 60); // 5 minutes ago
              const mostRecentCache = allCached.results[0] as any;

              // If the most recently cached assistant is still fresh, return ALL cached assistants
              if (mostRecentCache.cached_at > cacheAgeLimit) {
                const assistants = allCached.results.map((row: any) => JSON.parse(row.vapi_data));
                return jsonResponse({ assistants, cached: true });
              }
            }
          }

          // Cache miss, stale, or nocache requested - fetch from Vapi
          const vapiUrl = 'https://api.vapi.ai/assistant';
          const vapiResponse = await fetch(vapiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${privateKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }

          const assistants = await vapiResponse.json() as any[];
          const timestamp = now();

          // Clear old cache for this user first (remove deleted assistants)
          await env.DB.prepare(
            'DELETE FROM assistants_cache WHERE user_id = ?'
          ).bind(effectiveUserId).run();

          // Update cache using effective user ID (workspace owner if applicable)
          for (const assistant of assistants) {
            await env.DB.prepare(
              'INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)'
            ).bind(
              assistant.id,
              effectiveUserId,
              JSON.stringify(assistant),
              timestamp,
              new Date(assistant.updatedAt || assistant.createdAt).getTime() / 1000 || timestamp
            ).run();
          }

          return jsonResponse({ assistants, cached: false });
        } catch (error: any) {
          console.error('Error fetching assistants:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to fetch assistants: ${errorMessage}` }, 500);
        }
      }

      // Get single assistant (cache-first)
      // Note: Only match /api/assistants/{id} - NOT sub-routes like /api/assistants/{id}/transfer-agents
      if (url.pathname.match(/^\/api\/assistants\/[^/]+$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const assistantId = url.pathname.split('/').pop();
        if (!assistantId) {
          return jsonResponse({ error: 'Assistant ID required' }, 400);
        }

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const settings = await env.DB.prepare(
          'SELECT private_key FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured' }, 400);
        }

        const effectiveUserId = workspace.owner_user_id;

        try {
          // Check cache first (use workspace owner's user_id for cache)
          const cached = await env.DB.prepare(
            'SELECT vapi_data, cached_at FROM assistants_cache WHERE id = ? AND user_id = ?'
          ).bind(assistantId, effectiveUserId).first() as any;

          if (cached) {
            const cacheAge = now() - cached.cached_at;
            // If cached within last 5 minutes, use cache
            if (cacheAge < 5 * 60) {
              return jsonResponse({ assistant: JSON.parse(cached.vapi_data), cached: true });
            }
          }

          // Cache miss or stale - fetch from Vapi
          const vapiUrl = `https://api.vapi.ai/assistant/${assistantId}`;
          const vapiResponse = await fetch(vapiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }

          const assistant = await vapiResponse.json() as any;
          const timestamp = now();

          // Update cache (use workspace owner's user_id for cache)
          await env.DB.prepare(
            'INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            assistant.id,
            effectiveUserId,
            JSON.stringify(assistant),
            timestamp,
            new Date(assistant.updatedAt || assistant.createdAt).getTime() / 1000 || timestamp
          ).run();

          return jsonResponse({ assistant, cached: false });
        } catch (error: any) {
          console.error('Error fetching assistant:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to fetch assistant: ${errorMessage}` }, 500);
        }
      }

      // Update assistant (write-through cache)
      // Note: Only match /api/assistants/{id} - NOT sub-routes like /api/assistants/{id}/transfer-settings
      if (url.pathname.match(/^\/api\/assistants\/[^/]+$/) && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const assistantId = url.pathname.split('/').pop();
        const updates = await request.json() as any;

        if (!assistantId) {
          return jsonResponse({ error: 'Assistant ID required' }, 400);
        }

        // Get user's selected workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        let settings;

        // If user has selected a workspace, use workspace settings
        if (userSettings?.selected_workspace_id) {
          const workspaceId = userSettings.selected_workspace_id;

          // Verify workspace access
          const workspace = await env.DB.prepare(
            'SELECT owner_user_id FROM workspaces WHERE id = ?'
          ).bind(workspaceId).first() as any;

          if (!workspace) {
            return jsonResponse({ error: 'Workspace not found' }, 404);
          }

          const isOwner = workspace.owner_user_id === userId;
          const membership = await env.DB.prepare(
            'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
          ).bind(workspaceId, userId).first() as any;

          if (!isOwner && !membership) {
            return jsonResponse({ error: 'Access denied to workspace' }, 403);
          }

          // Get workspace settings
          settings = await env.DB.prepare(
            'SELECT private_key FROM workspace_settings WHERE workspace_id = ?'
          ).bind(workspaceId).first() as any;

          // FALLBACK: If workspace_settings is empty, try user_settings
          if (!settings || !settings.private_key) {
            const ownerSettings = await env.DB.prepare(
              'SELECT private_key FROM user_settings WHERE user_id = ?'
            ).bind(workspace.owner_user_id).first() as any;

            if (ownerSettings && ownerSettings.private_key) {
              settings = ownerSettings;
            }
          }
        } else {
          // No workspace selected, use user settings
          settings = await env.DB.prepare(
            'SELECT private_key FROM user_settings WHERE user_id = ?'
          ).bind(userId).first() as any;
        }

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured' }, 400);
        }

        try {
          // 1. Update in Vapi first (source of truth)
          const vapiUrl = `https://api.vapi.ai/assistant/${assistantId}`;
          const vapiResponse = await fetch(vapiUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }

          const updatedAssistant = await vapiResponse.json() as any;
          const timestamp = now();

          // 2. Update D1 cache (write-through)
          await env.DB.prepare(
            'INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            updatedAssistant.id,
            userId,
            JSON.stringify(updatedAssistant),
            timestamp,
            new Date(updatedAssistant.updatedAt || updatedAssistant.createdAt).getTime() / 1000 || timestamp
          ).run();

          return jsonResponse({ assistant: updatedAssistant });
        } catch (error: any) {
          console.error('Error updating assistant:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to update assistant: ${errorMessage}` }, 500);
        }
      }

      // Create assistant (write-through cache)
      if (url.pathname === '/api/assistants' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const assistantData = await request.json() as any;

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected. Please select a workspace first.' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const settings = await env.DB.prepare(
          'SELECT private_key FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured. Please configure workspace API keys in Settings.' }, 400);
        }

        try {
          // 1. Create in Vapi first (source of truth)
          const vapiUrl = 'https://api.vapi.ai/assistant';
          const vapiResponse = await fetch(vapiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(assistantData),
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            try {
              // Try to parse error JSON to extract meaningful message
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) {
                errorText = errorJson.message;
              } else if (errorJson.error) {
                errorText = errorJson.error;
              }
            } catch {
              // If not JSON, use error text as is
            }
            return jsonResponse({ error: errorText }, 400);
          }

          const newAssistant = await vapiResponse.json() as any;
          const timestamp = now();

          // 2. Add to D1 cache (write-through) - use workspace owner's user_id for cache
          const effectiveUserId = workspace.owner_user_id;
          await env.DB.prepare(
            'INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            newAssistant.id,
            effectiveUserId,
            JSON.stringify(newAssistant),
            timestamp,
            new Date(newAssistant.updatedAt || newAssistant.createdAt).getTime() / 1000 || timestamp
          ).run();

          return jsonResponse({ assistant: newAssistant });
        } catch (error: any) {
          console.error('Error creating assistant:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to create assistant: ${errorMessage}` }, 500);
        }
      }

      // Delete assistant (write-through cache)
      // Note: Only match /api/assistants/{id} - NOT sub-routes
      if (url.pathname.match(/^\/api\/assistants\/[^/]+$/) && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const assistantId = url.pathname.split('/').pop();
        if (!assistantId) {
          return jsonResponse({ error: 'Assistant ID required' }, 400);
        }

        // Get workspace settings (workspace-scoped)
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const settings = await env.DB.prepare(
          'SELECT private_key FROM workspace_settings WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        if (!settings || !settings.private_key) {
          return jsonResponse({ error: 'CHAU Voice Engine API key not configured' }, 400);
        }

        const effectiveUserId = workspace.owner_user_id;

        try {
          // 1. Delete from Vapi first (source of truth)
          const vapiUrl = `https://api.vapi.ai/assistant/${assistantId}`;
          const vapiResponse = await fetch(vapiUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`,
              'Content-Type': 'application/json',
            },
          });

          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            // Remove Vapi branding from error messages
            errorText = errorText.replace(/Vapi free phone numbers/gi, 'free phone numbers');
            errorText = errorText.replace(/Vapi/gi, 'CHAU Voice Engine');
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }

          // 2. Delete from D1 cache (write-through) - use workspace owner's user_id
          await env.DB.prepare(
            'DELETE FROM assistants_cache WHERE id = ? AND user_id = ?'
          ).bind(assistantId, effectiveUserId).run();

          return jsonResponse({ success: true });
        } catch (error: any) {
          console.error('Error deleting assistant:', error);
          // Remove Vapi branding from error messages
          let errorMessage = error.message || 'Unknown error';
          errorMessage = errorMessage.replace(/Vapi free phone numbers/gi, 'free phone numbers');
          errorMessage = errorMessage.replace(/Vapi/gi, 'CHAU Voice Engine');
          return jsonResponse({ error: `Failed to delete assistant: ${errorMessage}` }, 500);
        }
      }

      // ============================================
      // AGENT FLOWS ENDPOINTS (Protected)
      // ============================================

      // Save agent flow (CREATE)
      if (url.pathname === '/api/agent-flows' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        try {
          const { vapiAssistantId, flowData, configData } = await request.json() as any;

          if (!vapiAssistantId) {
            return jsonResponse({ error: 'VAPI assistant ID is required' }, 400);
          }

          if (!flowData || !configData) {
            return jsonResponse({ error: 'Flow data and config data are required' }, 400);
          }

          const id = crypto.randomUUID();
          const timestamp = now();

          await env.DB.prepare(
            'INSERT INTO agent_flows (id, vapi_assistant_id, user_id, flow_data, config_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            id,
            vapiAssistantId,
            userId,
            JSON.stringify(flowData),
            JSON.stringify(configData),
            timestamp,
            timestamp
          ).run();

          return jsonResponse({ 
            success: true, 
            id,
            vapiAssistantId 
          });
        } catch (error: any) {
          console.error('Error saving agent flow:', error);
          return jsonResponse({ error: `Failed to save agent flow: ${error.message}` }, 500);
        }
      }

      // Get agent flow by VAPI assistant ID
      if (url.pathname.startsWith('/api/agent-flows/') && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const vapiAssistantId = url.pathname.split('/').pop();
        if (!vapiAssistantId) {
          return jsonResponse({ error: 'VAPI assistant ID is required' }, 400);
        }

        try {
          const flow = await env.DB.prepare(
            'SELECT id, vapi_assistant_id, flow_data, config_data, created_at, updated_at FROM agent_flows WHERE vapi_assistant_id = ? AND user_id = ?'
          ).bind(vapiAssistantId, userId).first() as any;

          if (!flow) {
            return jsonResponse({ error: 'Flow not found', exists: false }, 404);
          }

          return jsonResponse({
            exists: true,
            id: flow.id,
            vapiAssistantId: flow.vapi_assistant_id,
            flowData: JSON.parse(flow.flow_data),
            configData: JSON.parse(flow.config_data),
            createdAt: flow.created_at,
            updatedAt: flow.updated_at
          });
        } catch (error: any) {
          console.error('Error getting agent flow:', error);
          return jsonResponse({ error: `Failed to get agent flow: ${error.message}` }, 500);
        }
      }

      // Update agent flow
      if (url.pathname.startsWith('/api/agent-flows/') && request.method === 'PUT') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const vapiAssistantId = url.pathname.split('/').pop();
        if (!vapiAssistantId) {
          return jsonResponse({ error: 'VAPI assistant ID is required' }, 400);
        }

        try {
          const { flowData, configData } = await request.json() as any;

          if (!flowData || !configData) {
            return jsonResponse({ error: 'Flow data and config data are required' }, 400);
          }

          const timestamp = now();

          const result = await env.DB.prepare(
            'UPDATE agent_flows SET flow_data = ?, config_data = ?, updated_at = ? WHERE vapi_assistant_id = ? AND user_id = ?'
          ).bind(
            JSON.stringify(flowData),
            JSON.stringify(configData),
            timestamp,
            vapiAssistantId,
            userId
          ).run();

          if (result.meta.changes === 0) {
            return jsonResponse({ error: 'Flow not found or not authorized' }, 404);
          }

          return jsonResponse({ success: true, vapiAssistantId });
        } catch (error: any) {
          console.error('Error updating agent flow:', error);
          return jsonResponse({ error: `Failed to update agent flow: ${error.message}` }, 500);
        }
      }

      // Delete agent flow
      if (url.pathname.startsWith('/api/agent-flows/') && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const vapiAssistantId = url.pathname.split('/').pop();
        if (!vapiAssistantId) {
          return jsonResponse({ error: 'VAPI assistant ID is required' }, 400);
        }

        try {
          await env.DB.prepare(
            'DELETE FROM agent_flows WHERE vapi_assistant_id = ? AND user_id = ?'
          ).bind(vapiAssistantId, userId).run();

          return jsonResponse({ success: true });
        } catch (error: any) {
          console.error('Error deleting agent flow:', error);
          return jsonResponse({ error: `Failed to delete agent flow: ${error.message}` }, 500);
        }
      }

      // Check if agent has flow data (lightweight check)
      if (url.pathname === '/api/agent-flows/check' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        try {
          const { assistantIds } = await request.json() as any;

          if (!Array.isArray(assistantIds)) {
            return jsonResponse({ error: 'assistantIds must be an array' }, 400);
          }

          const placeholders = assistantIds.map(() => '?').join(',');
          const { results } = await env.DB.prepare(
            `SELECT vapi_assistant_id FROM agent_flows WHERE vapi_assistant_id IN (${placeholders}) AND user_id = ?`
          ).bind(...assistantIds, userId).all();

          const flowIds = new Set((results || []).map((r: any) => r.vapi_assistant_id));
          const hasFlow: Record<string, boolean> = {};
          
          assistantIds.forEach((id: string) => {
            hasFlow[id] = flowIds.has(id);
          });

          return jsonResponse({ hasFlow });
        } catch (error: any) {
          console.error('Error checking agent flows:', error);
          return jsonResponse({ error: `Failed to check agent flows: ${error.message}` }, 500);
        }
      }

      // ============================================
      // ADDONS ENDPOINTS (Protected)
      // ============================================

      // Get workspace addons configuration
      if (url.pathname === '/api/addons' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        // Query workspace_addons (fallback to user_addons for backward compatibility)
        const { results: workspaceResults } = await env.DB.prepare(
          'SELECT addon_type, is_enabled, settings FROM workspace_addons WHERE workspace_id = ?'
        ).bind(workspaceId).all();

        if (workspaceResults && workspaceResults.length > 0) {
          return jsonResponse({ addons: workspaceResults || [] });
        }

        // Fallback: check user_addons for backward compatibility
        const { results: userResults } = await env.DB.prepare(
          'SELECT addon_type, is_enabled, settings FROM user_addons WHERE user_id = ?'
        ).bind(userId).all();

        return jsonResponse({ addons: userResults || [] });
      }

      // Toggle addon on/off
      if (url.pathname === '/api/addons/toggle' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { addonType, enabled } = await request.json() as any;

        if (!addonType) {
          return jsonResponse({ error: 'addon_type required' }, 400);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const timestamp = now();

        // Check if workspace addon config exists
        const existing = await env.DB.prepare(
          'SELECT id FROM workspace_addons WHERE workspace_id = ? AND addon_type = ?'
        ).bind(workspaceId, addonType).first();

        if (existing) {
          // Update existing
          await env.DB.prepare(
            'UPDATE workspace_addons SET is_enabled = ?, updated_at = ? WHERE workspace_id = ? AND addon_type = ?'
          ).bind(enabled ? 1 : 0, timestamp, workspaceId, addonType).run();
        } else {
          // Create new
          await env.DB.prepare(
            'INSERT INTO workspace_addons (id, workspace_id, addon_type, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(generateId(), workspaceId, addonType, enabled ? 1 : 0, timestamp, timestamp).run();
        }

        return jsonResponse({ message: 'Addon updated successfully', enabled });
      }

      // Get addon results for a call
      if (url.pathname.startsWith('/api/addon-results/') && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/').pop();

        const { results } = await env.DB.prepare(
          'SELECT addon_type, status, result_data, error_message, execution_time_ms, created_at FROM addon_results WHERE call_id = ? AND user_id = ?'
        ).bind(callId, userId).all();

        return jsonResponse({ results: results || [] });
      }

      // Save embedding settings
      if (url.pathname === '/api/addons/embedding/settings' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { url: embeddingUrl, buttonName } = await request.json() as any;

        if (!embeddingUrl || typeof embeddingUrl !== 'string') {
          return jsonResponse({ error: 'URL is required' }, 400);
        }

        if (!buttonName || typeof buttonName !== 'string' || buttonName.trim().length === 0) {
          return jsonResponse({ error: 'Button name is required' }, 400);
        }

        // Validate URL format
        try {
          const urlObj = new URL(embeddingUrl);
          if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return jsonResponse({ error: 'URL must use http:// or https://' }, 400);
          }
        } catch {
          return jsonResponse({ error: 'Invalid URL format' }, 400);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        const timestamp = now();
        const settings = JSON.stringify({ url: embeddingUrl, buttonName: buttonName.trim() });

        // Check if workspace embedding addon exists
        const existing = await env.DB.prepare(
          'SELECT id FROM workspace_addons WHERE workspace_id = ? AND addon_type = ?'
        ).bind(workspaceId, 'embedding').first();

        if (existing) {
          // Update existing
          await env.DB.prepare(
            'UPDATE workspace_addons SET settings = ?, updated_at = ? WHERE workspace_id = ? AND addon_type = ?'
          ).bind(settings, timestamp, workspaceId, 'embedding').run();
        } else {
          // Create new with enabled by default
          await env.DB.prepare(
            'INSERT INTO workspace_addons (id, workspace_id, addon_type, is_enabled, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(generateId(), workspaceId, 'embedding', 1, settings, timestamp, timestamp).run();
        }

        return jsonResponse({ message: 'Embedding settings saved successfully' });
      }

      // Get embedding settings
      if (url.pathname === '/api/addons/embedding/settings' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get user's workspace
        const userSettings = await env.DB.prepare(
          'SELECT selected_workspace_id FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: 'No workspace selected' }, 400);
        }

        const workspaceId = userSettings.selected_workspace_id;

        // Verify workspace access
        const workspace = await env.DB.prepare(
          'SELECT owner_user_id FROM workspaces WHERE id = ?'
        ).bind(workspaceId).first() as any;

        if (!workspace) {
          return jsonResponse({ error: 'Workspace not found' }, 404);
        }

        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first() as any;

        if (!isOwner && !membership) {
          return jsonResponse({ error: 'Access denied to workspace' }, 403);
        }

        // Query workspace_addons (fallback to user_addons for backward compatibility)
        let result = await env.DB.prepare(
          'SELECT settings, is_enabled FROM workspace_addons WHERE workspace_id = ? AND addon_type = ?'
        ).bind(workspaceId, 'embedding').first();

        // Fallback to user_addons for backward compatibility
        if (!result || !result.settings) {
          result = await env.DB.prepare(
            'SELECT settings, is_enabled FROM user_addons WHERE user_id = ? AND addon_type = ?'
          ).bind(userId, 'embedding').first();
        }

        if (!result || !result.settings) {
          return jsonResponse({ url: null, buttonName: null, isEnabled: false });
        }

        try {
          const settings = JSON.parse(result.settings as string);
          return jsonResponse({ 
            url: settings.url || null,
            buttonName: settings.buttonName || null,
            isEnabled: result.is_enabled === 1
          });
        } catch {
          return jsonResponse({ url: null, buttonName: null, isEnabled: false });
        }
      }

      // ============================================
      // SCHEDULING TRIGGERS ENDPOINTS (Protected)
      // ============================================

      // Get all scheduling triggers for user
      if (url.pathname === '/api/scheduling-triggers' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { results } = await env.DB.prepare(
          'SELECT * FROM scheduling_triggers WHERE user_id = ? ORDER BY created_at DESC'
        ).bind(userId).all();

        return jsonResponse(results || []);
      }

      // Create scheduling trigger
      if (url.pathname === '/api/scheduling-triggers' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { name, destination_url, send_enhanced_data } = await request.json() as any;

        if (!name || !destination_url) {
          return jsonResponse({ error: 'Name and destination URL are required' }, 400);
        }

        const triggerId = generateId();
        const timestamp = now();

        await env.DB.prepare(
          `INSERT INTO scheduling_triggers (id, user_id, name, destination_url, send_enhanced_data, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          triggerId,
          userId,
          name,
          destination_url,
          send_enhanced_data ? 1 : 0,
          1, // active by default
          timestamp,
          timestamp
        ).run();

        return jsonResponse({ id: triggerId, message: 'Scheduling trigger created successfully' });
      }

      // Update scheduling trigger
      if (url.pathname.startsWith('/api/scheduling-triggers/') && request.method === 'PUT') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const triggerId = url.pathname.split('/').pop();
        const { name, destination_url, send_enhanced_data, is_active } = await request.json() as any;

        await env.DB.prepare(
          `UPDATE scheduling_triggers
           SET name = ?, destination_url = ?, send_enhanced_data = ?, is_active = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        ).bind(
          name,
          destination_url,
          send_enhanced_data ? 1 : 0,
          is_active ? 1 : 0,
          now(),
          triggerId,
          userId
        ).run();

        return jsonResponse({ message: 'Scheduling trigger updated successfully' });
      }

      // Delete scheduling trigger
      if (url.pathname.startsWith('/api/scheduling-triggers/') && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const triggerId = url.pathname.split('/').pop();

        await env.DB.prepare(
          'DELETE FROM scheduling_triggers WHERE id = ? AND user_id = ?'
        ).bind(triggerId, userId).run();

        return jsonResponse({ message: 'Scheduling trigger deleted successfully' });
      }

      // Get scheduling trigger logs
      if (url.pathname === '/api/scheduling-trigger-logs' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const triggerId = url.searchParams.get('trigger_id');

        let query = `
          SELECT stl.*, st.name as trigger_name, wc.customer_name, wc.appointment_date, wc.appointment_time
          FROM scheduling_trigger_logs stl
          JOIN scheduling_triggers st ON st.id = stl.trigger_id
          JOIN webhook_calls wc ON wc.id = stl.call_id
          WHERE st.user_id = ?
        `;

        const params = [userId];

        if (triggerId) {
          query += ' AND stl.trigger_id = ?';
          params.push(triggerId);
        }

        query += ' ORDER BY stl.created_at DESC LIMIT 100';

        const { results } = await env.DB.prepare(query).bind(...params).all();

        return jsonResponse(results || []);
      }

      // ============================================
      // KNOWLEDGE BASE ENDPOINTS (Protected)
      // ============================================

      // List knowledge files for an agent
      if (url.pathname.startsWith('/api/knowledge-files/') && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const agentId = url.pathname.split('/').pop();
        
        const { results } = await env.DB.prepare(
          'SELECT * FROM agent_knowledge_files WHERE agent_id = ? ORDER BY created_at DESC'
        ).bind(agentId).all();

        return jsonResponse(results || []);
      }

      // Create knowledge file record
      if (url.pathname === '/api/knowledge-files' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { agent_id, vapi_file_id, file_name, file_size, status } = await request.json() as any;

        if (!agent_id || !vapi_file_id || !file_name) {
          return jsonResponse({ error: 'Missing required fields' }, 400);
        }

        const id = generateId();
        const timestamp = now();

        await env.DB.prepare(
          'INSERT INTO agent_knowledge_files (id, agent_id, vapi_file_id, file_name, file_size, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, agent_id, vapi_file_id, file_name, file_size || 0, status || 'ready', timestamp, timestamp).run();

        return jsonResponse({
          id,
          agent_id,
          vapi_file_id,
          file_name,
          file_size: file_size || 0,
          status: status || 'ready',
          created_at: timestamp,
          updated_at: timestamp
        }, 201);
      }

      // Delete knowledge file record
      if (url.pathname.startsWith('/api/knowledge-files/') && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const id = url.pathname.split('/').pop();

        await env.DB.prepare(
          'DELETE FROM agent_knowledge_files WHERE id = ?'
        ).bind(id).run();

        return jsonResponse({ message: 'File deleted successfully' });
      }

      // ============================================
      // WEBHOOK ENDPOINTS
      // ============================================

      // Create new webhook
      if (url.pathname === '/api/webhooks' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { name } = await request.json() as any;

        if (!name) {
          return jsonResponse({ error: 'Webhook name required' }, 400);
        }

        // Generate unique webhook ID
        const webhookId = 'wh_' + generateId();
        const webhookUrl = `https://api.voice-config.channelautomation.com/webhook/${webhookId}`;
        const timestamp = now();

        await env.DB.prepare(
          'INSERT INTO webhooks (id, user_id, webhook_url, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(webhookId, userId, webhookUrl, name, 1, timestamp, timestamp).run();

        return jsonResponse({
          id: webhookId,
          url: webhookUrl,
          name,
          is_active: true,
          created_at: timestamp
        }, 201);
      }

      // List webhooks for user (supports workspace context)
      if (url.pathname === '/api/webhooks' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const { results } = await env.DB.prepare(
          `SELECT
            w.id,
            w.webhook_url,
            w.name,
            w.is_active,
            w.created_at,
            COUNT(wc.id) as call_count
          FROM webhooks w
          LEFT JOIN webhook_calls wc ON w.id = wc.webhook_id
          WHERE w.user_id = ?
          GROUP BY w.id
          ORDER BY w.created_at DESC`
        ).bind(effectiveUserId).all();

        return jsonResponse(results || []);
      }

      // Delete webhook
      if (url.pathname.startsWith('/api/webhooks/') && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const webhookId = url.pathname.split('/').pop();

        // Verify ownership
        const webhook = await env.DB.prepare(
          'SELECT user_id FROM webhooks WHERE id = ?'
        ).bind(webhookId).first() as any;

        if (!webhook) {
          return jsonResponse({ error: 'Webhook not found' }, 404);
        }

        if (webhook.user_id !== userId) {
          return jsonResponse({ error: 'Forbidden' }, 403);
        }

        // Delete webhook (cascade will delete calls and logs)
        await env.DB.prepare(
          'DELETE FROM webhooks WHERE id = ?'
        ).bind(webhookId).run();

        return jsonResponse({ message: 'Webhook deleted successfully' });
      }

      // ============================================
      // OUTBOUND WEBHOOKS ENDPOINTS
      // ============================================

      // Create outbound webhook
      if (url.pathname === '/api/outbound-webhooks' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        return await createOutboundWebhook(request, env, userId);
      }

      // List outbound webhooks
      if (url.pathname === '/api/outbound-webhooks' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        return await listOutboundWebhooks(env, userId);
      }

      // Update outbound webhook
      if (url.pathname.startsWith('/api/outbound-webhooks/') && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const webhookId = url.pathname.split('/').pop()!;
        return await updateOutboundWebhook(request, env, userId, webhookId);
      }

      // Delete outbound webhook
      if (url.pathname.startsWith('/api/outbound-webhooks/') && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const webhookId = url.pathname.split('/').pop()!;
        return await deleteOutboundWebhook(env, userId, webhookId);
      }

      // Get outbound webhook logs
      if (url.pathname.match(/^\/api\/outbound-webhooks\/[^/]+\/logs$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const webhookId = url.pathname.split('/')[3];
        return await getOutboundWebhookLogs(env, userId, webhookId);
      }

      // ============================================
      // LEADS ENDPOINTS (Protected)
      // ============================================

      // List leads for workspace
      if (url.pathname === '/api/leads' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status');

        let query = `SELECT * FROM leads WHERE workspace_id = ?`;
        const params: any[] = [workspaceId];

        if (status) {
          query += ` AND status = ?`;
          params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const results = await env.DB.prepare(query).bind(...params).all();
        
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM leads WHERE workspace_id = ?`;
        const countParams: any[] = [workspaceId];
        if (status) {
          countQuery += ` AND status = ?`;
          countParams.push(status);
        }
        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first() as any;

        return jsonResponse({
          leads: results.results || [],
          total: countResult?.total || 0,
          limit,
          offset
        });
      }

      // Create single lead
      if (url.pathname === '/api/leads' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const body = await request.json() as any;
        
        if (!body.phone) {
          return jsonResponse({ error: 'Phone number is required' }, 400);
        }

        const timestamp = now();
        const leadId = generateId();

        await env.DB.prepare(
          `INSERT INTO leads (id, workspace_id, firstname, lastname, phone, email, lead_source, product, notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          leadId,
          workspaceId,
          body.firstname || null,
          body.lastname || null,
          body.phone,
          body.email || null,
          body.lead_source || null,
          body.product || null,
          body.notes || null,
          body.status || 'new',
          timestamp,
          timestamp
        ).run();

        return jsonResponse({
          success: true,
          id: leadId,
          message: 'Lead created successfully'
        }, 201);
      }

      // Bulk upload leads (CSV)
      if (url.pathname === '/api/leads/upload' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const body = await request.json() as any;
        const leads = body.leads as any[];

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
          return jsonResponse({ error: 'No leads provided' }, 400);
        }

        const timestamp = now();
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          
          if (!lead.phone) {
            errorCount++;
            errors.push(`Row ${i + 1}: Phone number is required`);
            continue;
          }

          try {
            const leadId = generateId();
            await env.DB.prepare(
              `INSERT INTO leads (id, workspace_id, firstname, lastname, phone, email, lead_source, product, notes, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              leadId,
              workspaceId,
              lead.firstname || null,
              lead.lastname || null,
              lead.phone,
              lead.email || null,
              lead.lead_source || null,
              lead.product || null,
              lead.notes || null,
              'new',
              timestamp,
              timestamp
            ).run();
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`Row ${i + 1}: ${error.message || 'Unknown error'}`);
          }
        }

        return jsonResponse({
          success: true,
          imported: successCount,
          failed: errorCount,
          errors: errors.slice(0, 10), // Return first 10 errors
          message: `Imported ${successCount} leads${errorCount > 0 ? `, ${errorCount} failed` : ''}`
        });
      }

      // Delete lead
      if (url.pathname.match(/^\/api\/leads\/[^/]+$/) && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const leadId = url.pathname.split('/').pop();

        // Verify lead belongs to workspace
        const lead = await env.DB.prepare(
          'SELECT id FROM leads WHERE id = ? AND workspace_id = ?'
        ).bind(leadId, workspaceId).first();

        if (!lead) {
          return jsonResponse({ error: 'Lead not found' }, 404);
        }

        await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(leadId).run();

        return jsonResponse({ success: true, message: 'Lead deleted' });
      }

      // Update lead status
      if (url.pathname.match(/^\/api\/leads\/[^/]+$/) && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const leadId = url.pathname.split('/').pop();
        const body = await request.json() as any;

        // Verify lead belongs to workspace
        const lead = await env.DB.prepare(
          'SELECT id FROM leads WHERE id = ? AND workspace_id = ?'
        ).bind(leadId, workspaceId).first();

        if (!lead) {
          return jsonResponse({ error: 'Lead not found' }, 404);
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (body.status !== undefined) {
          updates.push('status = ?');
          params.push(body.status);
        }
        if (body.firstname !== undefined) {
          updates.push('firstname = ?');
          params.push(body.firstname);
        }
        if (body.lastname !== undefined) {
          updates.push('lastname = ?');
          params.push(body.lastname);
        }
        if (body.email !== undefined) {
          updates.push('email = ?');
          params.push(body.email);
        }
        if (body.phone !== undefined) {
          updates.push('phone = ?');
          params.push(body.phone);
        }
        if (body.lead_source !== undefined) {
          updates.push('lead_source = ?');
          params.push(body.lead_source);
        }
        if (body.product !== undefined) {
          updates.push('product = ?');
          params.push(body.product);
        }
        if (body.notes !== undefined) {
          updates.push('notes = ?');
          params.push(body.notes);
        }

        if (updates.length === 0) {
          return jsonResponse({ error: 'No fields to update' }, 400);
        }

        updates.push('updated_at = ?');
        params.push(now());
        params.push(leadId);

        await env.DB.prepare(
          `UPDATE leads SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...params).run();

        return jsonResponse({ success: true, message: 'Lead updated' });
      }

      // Get/Create leads webhook for workspace
      if (url.pathname === '/api/leads/webhook' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        // Check if webhook exists
        let webhook = await env.DB.prepare(
          'SELECT * FROM lead_webhooks WHERE workspace_id = ?'
        ).bind(workspaceId).first() as any;

        // Create if doesn't exist
        if (!webhook) {
          const webhookId = generateId();
          const webhookToken = generateId() + generateId(); // Longer token for security
          const timestamp = now();

          await env.DB.prepare(
            'INSERT INTO lead_webhooks (id, workspace_id, webhook_token, is_active, created_at) VALUES (?, ?, ?, 1, ?)'
          ).bind(webhookId, workspaceId, webhookToken, timestamp).run();

          webhook = {
            id: webhookId,
            workspace_id: workspaceId,
            webhook_token: webhookToken,
            is_active: 1,
            created_at: timestamp
          };
        }

        // Build webhook URL
        const baseUrl = url.origin;
        const webhookUrl = `${baseUrl}/webhook/leads/${webhook.webhook_token}`;

        return jsonResponse({
          id: webhook.id,
          webhookUrl,
          token: webhook.webhook_token,
          isActive: webhook.is_active === 1,
          createdAt: webhook.created_at
        });
      }

      // ============================================
      // CAMPAIGNS ENDPOINTS (Protected)
      // ============================================

      // List campaigns for workspace
      if (url.pathname === '/api/campaigns' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const results = await env.DB.prepare(
          `SELECT * FROM campaigns WHERE workspace_id = ? ORDER BY created_at DESC`
        ).bind(workspaceId).all();

        return jsonResponse({ campaigns: results.results || [] });
      }

      // Create campaign
      if (url.pathname === '/api/campaigns' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const body = await request.json() as any;

        if (!body.name || !body.assistant_id || !body.phone_number_id) {
          return jsonResponse({ error: 'Name, assistant_id, and phone_number_id are required' }, 400);
        }

        const timestamp = now();
        const campaignId = generateId();

        await env.DB.prepare(
          `INSERT INTO campaigns (id, workspace_id, name, assistant_id, phone_number_id, status, scheduled_at, total_leads, prompt_template, first_message_template, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
        ).bind(
          campaignId,
          workspaceId,
          body.name,
          body.assistant_id,
          body.phone_number_id,
          body.scheduled_at ? 'scheduled' : 'draft',
          body.scheduled_at || null,
          body.prompt_template || null,
          body.first_message_template || null,
          timestamp,
          timestamp
        ).run();

        return jsonResponse({
          success: true,
          id: campaignId,
          message: 'Campaign created'
        }, 201);
      }

      // Get campaign details
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const campaignId = url.pathname.split('/').pop();

        const campaign = await env.DB.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first();

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        return jsonResponse({ campaign });
      }

      // Update campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+$/) && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const campaignId = url.pathname.split('/').pop();
        const body = await request.json() as any;

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id, status FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first() as any;

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (body.name !== undefined) {
          updates.push('name = ?');
          params.push(body.name);
        }
        if (body.assistant_id !== undefined) {
          updates.push('assistant_id = ?');
          params.push(body.assistant_id);
        }
        if (body.phone_number_id !== undefined) {
          updates.push('phone_number_id = ?');
          params.push(body.phone_number_id);
        }
        if (body.prompt_template !== undefined) {
          updates.push('prompt_template = ?');
          params.push(body.prompt_template || null);
        }
        if (body.first_message_template !== undefined) {
          updates.push('first_message_template = ?');
          params.push(body.first_message_template || null);
        }
        if (body.scheduled_at !== undefined) {
          updates.push('scheduled_at = ?');
          params.push(body.scheduled_at);
          if (body.scheduled_at && campaign.status === 'draft') {
            updates.push('status = ?');
            params.push('scheduled');
          }
        }

        if (updates.length === 0) {
          return jsonResponse({ error: 'No fields to update' }, 400);
        }

        updates.push('updated_at = ?');
        params.push(now());
        params.push(campaignId);

        await env.DB.prepare(
          `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...params).run();

        return jsonResponse({ success: true, message: 'Campaign updated' });
      }

      // Delete campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+$/) && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const campaignId = url.pathname.split('/').pop();

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first();

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        await env.DB.prepare('DELETE FROM campaigns WHERE id = ?').bind(campaignId).run();

        return jsonResponse({ success: true, message: 'Campaign deleted' });
      }

      // Add leads to campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+\/leads$/) && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const pathParts = url.pathname.split('/');
        const campaignId = pathParts[pathParts.length - 2];
        const body = await request.json() as any;

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first();

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        const leadIds = body.lead_ids as string[];
        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
          return jsonResponse({ error: 'lead_ids array is required' }, 400);
        }

        const timestamp = now();
        let addedCount = 0;

        for (const leadId of leadIds) {
          try {
            // Verify lead belongs to workspace
            const lead = await env.DB.prepare(
              'SELECT id FROM leads WHERE id = ? AND workspace_id = ?'
            ).bind(leadId, workspaceId).first();

            if (lead) {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO campaign_leads (id, campaign_id, lead_id, call_status, created_at)
                 VALUES (?, ?, ?, 'pending', ?)`
              ).bind(generateId(), campaignId, leadId, timestamp).run();
              addedCount++;
            }
          } catch (error) {
            // Ignore duplicates
          }
        }

        // Update total leads count
        const countResult = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM campaign_leads WHERE campaign_id = ?'
        ).bind(campaignId).first() as any;

        await env.DB.prepare(
          'UPDATE campaigns SET total_leads = ?, updated_at = ? WHERE id = ?'
        ).bind(countResult?.count || 0, now(), campaignId).run();

        return jsonResponse({
          success: true,
          added: addedCount,
          message: `Added ${addedCount} leads to campaign`
        });
      }

      // Get campaign leads
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+\/leads$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const pathParts = url.pathname.split('/');
        const campaignId = pathParts[pathParts.length - 2];

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first();

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        const results = await env.DB.prepare(
          `SELECT cl.*, l.firstname, l.lastname, l.phone, l.email, l.lead_source, l.product
           FROM campaign_leads cl
           JOIN leads l ON cl.lead_id = l.id
           WHERE cl.campaign_id = ?
           ORDER BY cl.created_at DESC`
        ).bind(campaignId).all();

        return jsonResponse({ leads: results.results || [] });
      }

      // Start campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+\/start$/) && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const pathParts = url.pathname.split('/');
        const campaignId = pathParts[pathParts.length - 2];

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first() as any;

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        if (campaign.status === 'running') {
          return jsonResponse({ error: 'Campaign is already running' }, 400);
        }

        if (campaign.status === 'completed') {
          return jsonResponse({ error: 'Campaign is already completed' }, 400);
        }

        // Get workspace settings for VAPI key
        console.log(`[Campaign Start] User ID: ${userId}`);
        const settings = await getWorkspaceSettingsForUser(env, userId);
        console.log(`[Campaign Start] VAPI key found: ${settings?.private_key ? settings.private_key.substring(0, 10) + '...' : 'NONE'}`);
        
        if (!settings?.private_key) {
          return jsonResponse({ error: 'VAPI API key not configured' }, 400);
        }

        // Check if there are leads to call
        const leadsCount = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM campaign_leads WHERE campaign_id = ? AND call_status = 'pending'`
        ).bind(campaignId).first() as any;

        if (!leadsCount || leadsCount.count === 0) {
          return jsonResponse({ error: 'No pending leads in campaign' }, 400);
        }

        // Update campaign status to running
        const timestamp = now();
        await env.DB.prepare(
          `UPDATE campaigns SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`
        ).bind(timestamp, timestamp, campaignId).run();

        // Start calling leads in background
        ctx.waitUntil(executeCampaignCalls(env, campaignId, settings.private_key));

        return jsonResponse({
          success: true,
          message: 'Campaign started',
          status: 'running'
        });
      }

      // Pause campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+\/pause$/) && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const pathParts = url.pathname.split('/');
        const campaignId = pathParts[pathParts.length - 2];

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id, status FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first() as any;

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        if (campaign.status !== 'running') {
          return jsonResponse({ error: 'Campaign is not running' }, 400);
        }

        await env.DB.prepare(
          'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
        ).bind('paused', now(), campaignId).run();

        return jsonResponse({
          success: true,
          message: 'Campaign paused',
          status: 'paused'
        });
      }

      // Cancel campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+\/cancel$/) && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const pathParts = url.pathname.split('/');
        const campaignId = pathParts[pathParts.length - 2];

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id, status FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first() as any;

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        if (campaign.status === 'completed' || campaign.status === 'cancelled') {
          return jsonResponse({ error: 'Campaign is already finished' }, 400);
        }

        await env.DB.prepare(
          'UPDATE campaigns SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
        ).bind('cancelled', now(), now(), campaignId).run();

        return jsonResponse({
          success: true,
          message: 'Campaign cancelled',
          status: 'cancelled'
        });
      }

      // Retry failed leads in campaign
      if (url.pathname.match(/^\/api\/campaigns\/[^/]+\/retry-failed$/) && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const workspaceId = await getWorkspaceIdForUser(env, userId);
        if (!workspaceId) {
          return jsonResponse({ error: 'No workspace found' }, 404);
        }

        const pathParts = url.pathname.split('/');
        const campaignId = pathParts[pathParts.length - 2];

        // Verify campaign belongs to workspace
        const campaign = await env.DB.prepare(
          'SELECT id, status FROM campaigns WHERE id = ? AND workspace_id = ?'
        ).bind(campaignId, workspaceId).first() as any;

        if (!campaign) {
          return jsonResponse({ error: 'Campaign not found' }, 404);
        }

        // Reset failed leads to pending
        const result = await env.DB.prepare(
          `UPDATE campaign_leads 
           SET call_status = 'pending', vapi_call_id = NULL, call_outcome = NULL, call_duration = NULL, call_summary = NULL, called_at = NULL
           WHERE campaign_id = ? AND call_status = 'failed'`
        ).bind(campaignId).run();

        // Update campaign status to draft/paused if it was completed
        if (campaign.status === 'completed' || campaign.status === 'running') {
          await env.DB.prepare(
            'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
          ).bind('paused', now(), campaignId).run();
        }

        // Recalculate campaign stats
        const stats = await env.DB.prepare(
          `SELECT 
             COUNT(*) as total,
             SUM(CASE WHEN call_status = 'failed' THEN 1 ELSE 0 END) as failed,
             SUM(CASE WHEN call_status IN ('completed') THEN 1 ELSE 0 END) as completed
           FROM campaign_leads WHERE campaign_id = ?`
        ).bind(campaignId).first() as any;

        await env.DB.prepare(
          'UPDATE campaigns SET calls_failed = ?, updated_at = ? WHERE id = ?'
        ).bind(stats?.failed || 0, now(), campaignId).run();

        return jsonResponse({
          success: true,
          message: 'Failed leads reset to pending',
          resetCount: result.meta?.changes || 0
        });
      }

      // ============================================
      // WEBHOOK CALLS
      // ============================================

      // Get webhook calls (with KV caching, supports workspace context)
      if (url.pathname === '/api/webhook-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const webhookId = url.searchParams.get('webhook_id');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const page = Math.floor(offset / limit) + 1;

        // Initialize cache
        const cache = new VoiceAICache(env.CACHE);
        
        // Check if cache-busting parameter is present
        const cacheBust = url.searchParams.get('_t');

        // Try to get from cache first (only if no webhook filter, reasonable page size, and no cache-bust)
        // Use effectiveUserId for cache key to scope by workspace owner
        if (!webhookId && limit <= 100 && !cacheBust) {
          const cached = await cache.getCachedRecordings(effectiveUserId, page, limit);
          if (cached) {
            console.log(`Cache HIT for recordings: user=${effectiveUserId}, page=${page}, limit=${limit}`);
            return jsonResponse(cached);
          }
        }

        console.log(`Cache MISS for recordings: user=${effectiveUserId}, page=${page}, limit=${limit}${cacheBust ? ' (cache-bust requested)' : ''}`);

        // First, get the total count
        // Filter out test calls (those without customer_number) to match funnel data
        let countQuery = env.DB.prepare(
          `SELECT COUNT(*) as total
          FROM webhook_calls wc
          WHERE wc.user_id = ? AND wc.customer_number IS NOT NULL
          ${webhookId ? 'AND wc.webhook_id = ?' : ''}`
        );

        const countParams = webhookId ? [effectiveUserId, webhookId] : [effectiveUserId];
        const countResult = await countQuery.bind(...countParams).first<{ total: number }>();
        const totalCount = countResult?.total || 0;

        console.log(`Total recordings count for user ${effectiveUserId}: ${totalCount}`);

        // Fetch from database with enhanced data (using effectiveUserId for workspace context)
        // Filter out test calls (those without customer_number) to match funnel data
        let query = env.DB.prepare(
          `SELECT
            wc.id,
            wc.webhook_id,
            wc.vapi_call_id,
            wc.phone_number,
            wc.customer_number,
            wc.recording_url,
            wc.ended_reason,
            wc.summary,
            wc.structured_data,
            wc.raw_payload,
            wc.intent,
            wc.sentiment,
            wc.outcome,
            wc.analysis_completed,
            wc.analyzed_at,
            wc.customer_name,
            wc.caller_name,
            wc.caller_type,
            wc.carrier_name,
            wc.line_type,
            wc.created_at,
            wc.duration_seconds,
            ar.result_data as enhanced_data
          FROM webhook_calls wc
          LEFT JOIN addon_results ar ON ar.call_id = wc.id AND ar.addon_type = 'enhanced_data' AND ar.status = 'success'
          WHERE wc.user_id = ? AND wc.customer_number IS NOT NULL
          ${webhookId ? 'AND wc.webhook_id = ?' : ''}
          ORDER BY CASE
            WHEN wc.created_at > 1000000000000 THEN wc.created_at / 1000
            ELSE wc.created_at
          END DESC
          LIMIT ? OFFSET ?`
        );

        const params = webhookId
          ? [effectiveUserId, webhookId, limit, offset]
          : [effectiveUserId, limit, offset];

        const { results } = await query.bind(...params).all();

        // Parse structured_data, raw_payload, and enhanced_data JSON for each result
        const parsedResults = (results || []).map((row: any) => ({
          ...row,
          structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
          raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
          enhanced_data: row.enhanced_data ? JSON.parse(row.enhanced_data) : null
        }));

        // Return both results and total count
        const response = {
          results: parsedResults,
          total: totalCount
        };

        // Cache the response (only if no webhook filter and reasonable page size)
        // Use effectiveUserId for cache key to scope by workspace owner
        if (!webhookId && limit <= 100) {
          await cache.cacheRecordings(effectiveUserId, response, page, limit, CACHE_TTL.RECORDINGS);
        }

        return jsonResponse(response);
      }

      // WebSocket endpoint for real-time active calls
      if (url.pathname === '/api/active-calls/ws' && request.method === 'GET') {
        // Check for WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
          return jsonResponse({ error: 'Expected WebSocket upgrade' }, 426);
        }

        // For WebSocket, browsers can't send Authorization header
        // So we accept token as query parameter
        let userId = await getUserFromToken(request, env);
        
        if (!userId) {
          // Try query parameter for WebSocket connections
          const tokenFromQuery = url.searchParams.get('token');
          if (tokenFromQuery) {
            const secret = env.JWT_SECRET || 'default-secret-change-me';
            const decoded = await verifyToken(tokenFromQuery, secret);
            if (decoded) {
              userId = decoded.userId;
            }
          }
        }
        
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Get the Durable Object instance for this user
        const doId = env.ACTIVE_CALLS.idFromName(effectiveUserId);
        const stub = env.ACTIVE_CALLS.get(doId);

        // Forward the WebSocket upgrade request to the Durable Object
        const doUrl = new URL(request.url);
        doUrl.searchParams.set('userId', effectiveUserId);

        return stub.fetch(new Request(doUrl.toString(), {
          headers: request.headers,
        }));
      }

      // Get active calls (REST fallback)
      // Get active calls (supports workspace context)
      if (url.pathname === '/api/active-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Fetch active calls from database (using effectiveUserId)
        const { results } = await env.DB.prepare(
          `SELECT
            id,
            vapi_call_id,
            customer_number,
            caller_name,
            carrier_name,
            line_type,
            status,
            started_at,
            updated_at
          FROM active_calls
          WHERE user_id = ?
          ORDER BY started_at DESC`
        ).bind(effectiveUserId).all();

        return jsonResponse(results);
      }

      // Cleanup stale active calls (manual trigger)
      if (url.pathname === '/api/active-calls/cleanup' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Clean up active calls older than 2 hours for this user
        const twoHoursAgo = Math.floor(Date.now() / 1000) - (2 * 60 * 60);

        const result = await env.DB.prepare(
          `DELETE FROM active_calls WHERE user_id = ? AND updated_at < ?`
        ).bind(effectiveUserId, twoHoursAgo).run();

        console.log('[Manual Cleanup] Stale calls removed:', {
          userId: effectiveUserId,
          deletedCalls: result.meta.changes,
          threshold: new Date(twoHoursAgo * 1000).toISOString()
        });

        return jsonResponse({
          success: true,
          deletedCalls: result.meta.changes,
          message: `Removed ${result.meta.changes} stale call(s)`
        });
      }

      // Get tool call logs (CustomerConnect lookups)
      // SECURITY: Properly authenticated and filtered by user/workspace
      if (url.pathname === '/api/tool-call-logs' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context (ensures data isolation)
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Parse query params
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const status = url.searchParams.get('status'); // filter by status
        const phone = url.searchParams.get('phone'); // filter by phone

        // IMPORTANT: Always filter by user_id for data isolation
        let query = `
          SELECT
            id, user_id, workspace_id, vapi_call_id, tool_name, phone_number,
            status, request_timestamp, response_timestamp, response_time_ms,
            customer_name, appointment_date, appointment_time, household,
            error_message, created_at
          FROM tool_call_logs
          WHERE user_id = ?
        `;
        const params: any[] = [effectiveUserId];

        if (status) {
          query += ' AND status = ?';
          params.push(status);
        }

        if (phone) {
          query += ' AND phone_number LIKE ?';
          params.push(`%${phone}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        const stmt = env.DB.prepare(query);
        const { results } = await stmt.bind(...params).all();

        // Get stats - also filtered by user_id for isolation
        const statsQuery = await env.DB.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'not_found' THEN 1 ELSE 0 END) as not_found_count,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
            SUM(CASE WHEN status = 'not_configured' THEN 1 ELSE 0 END) as not_configured_count,
            AVG(response_time_ms) as avg_response_time
          FROM tool_call_logs
          WHERE user_id = ?
        `).bind(effectiveUserId).first() as any;

        return jsonResponse({
          logs: results,
          stats: {
            total: statsQuery?.total || 0,
            success: statsQuery?.success_count || 0,
            notFound: statsQuery?.not_found_count || 0,
            errors: statsQuery?.error_count || 0,
            notConfigured: statsQuery?.not_configured_count || 0,
            avgResponseTimeMs: Math.round(statsQuery?.avg_response_time || 0)
          }
        });
      }

      // Get concurrent calls stats
      // Get concurrent calls stats (supports workspace context)
      if (url.pathname === '/api/concurrent-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Get current concurrent calls (active calls)
        const activeCallsResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM active_calls WHERE user_id = ?`
        ).bind(effectiveUserId).first() as any;
        
        const currentConcurrent = activeCallsResult?.count || 0;

        // Get historical peak concurrent calls
        // We'll analyze webhook_calls to find the maximum number of overlapping calls
        // Filter out test calls (those without customer_number)
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          AND customer_number IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1000`
        ).bind(effectiveUserId).all();

        let peakConcurrent = 0;
        
        if (results && results.length > 0) {
          // Extract call time ranges from raw_payload
          const callRanges: Array<{ start: number; end: number }> = [];
          
          for (const row of results as any[]) {
            try {
              const payload = typeof row.raw_payload === 'string' 
                ? JSON.parse(row.raw_payload) 
                : row.raw_payload;
              
              const startedAt = payload.message?.call?.startedAt;
              const endedAt = payload.message?.call?.endedAt;
              
              if (startedAt && endedAt) {
                const startTime = new Date(startedAt).getTime();
                const endTime = new Date(endedAt).getTime();
                if (startTime && endTime && startTime < endTime) {
                  callRanges.push({ start: startTime, end: endTime });
                }
              }
            } catch (error) {
              // Skip invalid payloads
              continue;
            }
          }

          // Find peak concurrent calls by checking all time points
          if (callRanges.length > 0) {
            // Collect all unique time points (start and end times)
            const timePoints = new Set<number>();
            callRanges.forEach(range => {
              timePoints.add(range.start);
              timePoints.add(range.end);
            });

            // Check concurrent calls at each time point
            const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
            
            for (const timePoint of sortedTimePoints) {
              const concurrent = callRanges.filter(range => 
                range.start <= timePoint && range.end > timePoint
              ).length;
              
              if (concurrent > peakConcurrent) {
                peakConcurrent = concurrent;
              }
            }
          }
        }

        return jsonResponse({
          current: currentConcurrent,
          peak: peakConcurrent
        });
      }

      // Get concurrent calls time-series data
      // Get concurrent calls timeseries (supports workspace context)
      if (url.pathname === '/api/concurrent-calls/timeseries' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const granularity = url.searchParams.get('granularity') || 'minute'; // minute, hour, day
        const limit = parseInt(url.searchParams.get('limit') || '1000');

        // Fetch recent calls with their time ranges (using effectiveUserId)
        // Filter out test calls (those without customer_number)
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          AND customer_number IS NOT NULL
          ORDER BY created_at DESC
          LIMIT ?`
        ).bind(effectiveUserId, limit).all();

        if (!results || results.length === 0) {
          return jsonResponse({ data: [], labels: [] });
        }

        // Extract call time ranges
        const callRanges: Array<{ start: number; end: number }> = [];
        
        for (const row of results as any[]) {
          try {
            const payload = typeof row.raw_payload === 'string' 
              ? JSON.parse(row.raw_payload) 
              : row.raw_payload;
            
            const startedAt = payload.message?.call?.startedAt;
            const endedAt = payload.message?.call?.endedAt;
            
            if (startedAt && endedAt) {
              const startTime = new Date(startedAt).getTime();
              const endTime = new Date(endedAt).getTime();
              if (startTime && endTime && startTime < endTime) {
                callRanges.push({ start: startTime, end: endTime });
              }
            }
          } catch (error) {
            continue;
          }
        }

        if (callRanges.length === 0) {
          return jsonResponse({ data: [], labels: [] });
        }

        // Determine time window
        const allTimes = callRanges.flatMap(r => [r.start, r.end]);
        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);

        // Calculate time buckets based on granularity
        let bucketSize: number;
        let dateFormatter: (date: Date) => string;

        if (granularity === 'minute') {
          bucketSize = 60 * 1000; // 1 minute
          dateFormatter = (d) => d.toISOString().slice(0, 16).replace('T', ' ');
        } else if (granularity === 'hour') {
          bucketSize = 60 * 60 * 1000; // 1 hour
          dateFormatter = (d) => d.toISOString().slice(0, 13) + ':00';
        } else { // day
          bucketSize = 24 * 60 * 60 * 1000; // 1 day
          dateFormatter = (d) => d.toISOString().split('T')[0];
        }

        // Create time buckets
        const buckets = new Map<string, number>();
        const bucketCount = Math.ceil((maxTime - minTime) / bucketSize);
        
        for (let i = 0; i <= bucketCount; i++) {
          const bucketTime = minTime + (i * bucketSize);
          const bucketKey = dateFormatter(new Date(bucketTime));
          buckets.set(bucketKey, 0);
        }

        // Count concurrent calls at each bucket's midpoint
        for (let i = 0; i <= bucketCount; i++) {
          const bucketTime = minTime + (i * bucketSize);
          const midpoint = bucketTime + (bucketSize / 2);
          const concurrent = callRanges.filter(range => 
            range.start <= midpoint && range.end > midpoint
          ).length;
          
          const bucketKey = dateFormatter(new Date(bucketTime));
          buckets.set(bucketKey, concurrent);
        }

        // Convert to arrays
        const labels = Array.from(buckets.keys());
        const data = Array.from(buckets.values());

        return jsonResponse({ data, labels });
      }

      // Get dashboard summary metrics with SQL aggregation (supports workspace context)
      if (url.pathname === '/api/dashboard-summary' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        console.log(`[Dashboard Summary] Raw userId from token:`, userId);

        if (!userId) {
          console.log(`[Dashboard Summary] No userId - returning 401`);
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId, isWorkspaceContext } = await getEffectiveUserId(env, userId);
        console.log(`[Dashboard Summary] userId=${userId}, effectiveUserId=${effectiveUserId}, isWorkspaceContext=${isWorkspaceContext}`);

        // Single SQL query to calculate all dashboard metrics
        // This runs in <50ms on the database vs seconds of JavaScript processing
        // Show all recordings including test calls
        const result = await env.DB.prepare(
          `SELECT
            COUNT(*) as total_calls,
            COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as answered_calls,
            COUNT(*) - COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as unanswered_calls,
            ROUND(CAST(COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100, 2) as answer_rate,
            ROUND(AVG(CASE WHEN recording_url IS NOT NULL THEN duration_seconds END), 2) as avg_handling_time,
            ROUND(AVG(LENGTH(summary)), 2) as avg_summary_length,
            COUNT(CASE WHEN outcome = 'Successful' THEN 1 END) as qualified_leads_count,
            COUNT(CASE WHEN intent = 'Scheduling' THEN 1 END) as appointments_detected,
            ROUND(SUM(COALESCE(duration_seconds, 0)) / 60.0, 2) as total_call_minutes,
            COUNT(CASE WHEN sentiment = 'Positive' THEN 1 END) as positive_calls,
            COUNT(CASE WHEN sentiment = 'Negative' THEN 1 END) as negative_calls,
            COUNT(*) - COUNT(CASE WHEN sentiment = 'Positive' THEN 1 END) - COUNT(CASE WHEN sentiment = 'Negative' THEN 1 END) as neutral_calls
          FROM webhook_calls
          WHERE user_id = ?`
        ).bind(effectiveUserId).first() as any;

        console.log(`[Dashboard Summary] Query result for user_id=${effectiveUserId}:`, JSON.stringify(result));

        if (!result) {
          console.log(`[Dashboard Summary] No result returned, sending zeros`);
          // Return zeroed metrics if no data
          return jsonResponse({
            totalCalls: 0,
            answeredCalls: 0,
            unansweredCalls: 0,
            answerRate: 0,
            avgHandlingTime: 0,
            avgSummaryLength: 0,
            qualifiedLeadsCount: 0,
            appointmentsDetected: 0,
            totalCallMinutes: 0,
            positiveCalls: 0,
            negativeCalls: 0,
            neutralCalls: 0
          });
        }

        // Return camelCase format for frontend
        return jsonResponse({
          totalCalls: result.total_calls || 0,
          answeredCalls: result.answered_calls || 0,
          unansweredCalls: result.unanswered_calls || 0,
          answerRate: result.answer_rate || 0,
          avgHandlingTime: result.avg_handling_time || 0,
          avgSummaryLength: result.avg_summary_length || 0,
          qualifiedLeadsCount: result.qualified_leads_count || 0,
          appointmentsDetected: result.appointments_detected || 0,
          totalCallMinutes: result.total_call_minutes || 0,
          positiveCalls: result.positive_calls || 0,
          negativeCalls: result.negative_calls || 0,
          neutralCalls: result.neutral_calls || 0
        });
      }

      // Get agent distribution - call count by voice agent
      if (url.pathname === '/api/agent-distribution' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Query to get call distribution by assistant
        // Using JSON extraction to get assistant ID from raw_payload, then joining with assistants_cache
        // Now also returns assistant_id for mapping purposes
        const { results } = await env.DB.prepare(
          `SELECT
            ac.id as assistant_id,
            json_extract(ac.vapi_data, '$.name') as assistant_name,
            COUNT(*) as call_count
          FROM webhook_calls wc
          JOIN assistants_cache ac ON json_extract(wc.raw_payload, '$.message.call.assistantId') = ac.id
          WHERE wc.user_id = ?
            AND wc.raw_payload IS NOT NULL
            AND wc.customer_number IS NOT NULL
          GROUP BY ac.id, assistant_name
          ORDER BY call_count DESC`
        ).bind(effectiveUserId).all();

        return jsonResponse(results || []);
      }

      // Get reason call ended data
      // Get call ended reasons (supports workspace context)
      if (url.pathname === '/api/call-ended-reasons' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        // Build query with optional date filtering
        // Filter out rows where created_at is null or ended_reason is null
        // Filter out test calls (those without customer_number)
        let queryStr = `SELECT
          ended_reason,
          DATE(datetime(created_at, 'unixepoch')) as call_date,
          COUNT(*) as count
        FROM webhook_calls
        WHERE user_id = ?
        AND ended_reason IS NOT NULL
        AND created_at IS NOT NULL
        AND customer_number IS NOT NULL`;
        
        const params: any[] = [effectiveUserId];
        
        if (startDate) {
          queryStr += ` AND DATE(datetime(created_at, 'unixepoch')) >= ?`;
          params.push(startDate);
        }
        if (endDate) {
          queryStr += ` AND DATE(datetime(created_at, 'unixepoch')) <= ?`;
          params.push(endDate);
        }
        
        queryStr += ` GROUP BY ended_reason, call_date ORDER BY call_date DESC, count DESC`;

        const { results } = await env.DB.prepare(queryStr).bind(...params).all();

        if (!results || results.length === 0) {
          return jsonResponse({ dates: [], reasons: {}, colors: {} });
        }

        // Group data by date and reason
        const dateSet = new Set<string>();
        const reasonsSet = new Set<string>();
        const dataMap = new Map<string, Map<string, number>>(); // date -> reason -> count

        for (const row of results as any[]) {
          const date = row.call_date;
          const reason = row.ended_reason || 'unknown';
          const count = row.count || 0;

          dateSet.add(date);
          reasonsSet.add(reason);

          if (!dataMap.has(date)) {
            dataMap.set(date, new Map());
          }
          dataMap.get(date)!.set(reason, count);
        }

        // Sort dates
        const dates = Array.from(dateSet).sort();

        // Create reason mapping with colors
        const reasons = Array.from(reasonsSet);
        const reasonColors: Record<string, string> = {};
        const colorPalette = [
          '#8b5cf6', // purple
          '#3b82f6', // blue
          '#10b981', // green
          '#f59e0b', // amber
          '#ef4444', // red
          '#06b6d4', // cyan
          '#ec4899', // pink
          '#6366f1', // indigo
        ];

        reasons.forEach((reason, idx) => {
          reasonColors[reason] = colorPalette[idx % colorPalette.length];
        });

        // Build the data structure
        const reasonData: Record<string, number[]> = {};
        reasons.forEach(reason => {
          reasonData[reason] = dates.map(date => {
            const dateData = dataMap.get(date);
            return dateData?.get(reason) || 0;
          });
        });

        return jsonResponse({
          dates,
          reasons: reasonData,
          colors: reasonColors
        });
      }

      // Get call ended reason counts (total, not by date)
      if (url.pathname === '/api/call-ended-reason-counts' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Get total counts by ended_reason (no date filtering for Recordings page)
        const { results } = await env.DB.prepare(
          `SELECT
            ended_reason,
            COUNT(*) as count
          FROM webhook_calls
          WHERE user_id = ?
          AND ended_reason IS NOT NULL
          AND customer_number IS NOT NULL
          GROUP BY ended_reason
          ORDER BY count DESC`
        ).bind(effectiveUserId).all();

        // Convert to object format
        const counts: Record<string, number> = {};
        let total = 0;

        for (const row of (results || []) as any[]) {
          counts[row.ended_reason] = row.count;
          total += row.count;
        }

        // Add total count
        counts['all'] = total;

        return jsonResponse(counts);
      }

      // Get top keywords
      // Get top keywords with sentiment (supports workspace context)
      if (url.pathname === '/api/keywords' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Fetch top keywords from database with sentiment data (limit to top 20 for heat map)
        const { results } = await env.DB.prepare(
          `SELECT
            keyword,
            count,
            positive_count,
            neutral_count,
            negative_count,
            avg_sentiment,
            last_detected_at
          FROM call_keywords
          WHERE user_id = ?
          ORDER BY count DESC
          LIMIT 20`
        ).bind(effectiveUserId).all();

        return jsonResponse(results);
      }

      // Get call listen URL for live audio streaming
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/listen') && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];

        console.log('[Call Streaming] Get listen URL request:', {
          callId,
          userId
        });

        // Get workspace settings (uses helper function with fallback to user_settings)
        const settings = await getWorkspaceSettingsForUser(env, userId);

        if (!settings?.private_key) {
          console.log('[Call Streaming] VAPI credentials not configured for user:', userId);
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        // Get call details from VAPI to retrieve listenUrl
        try {
          console.log('[Call Streaming] Fetching call details from VAPI:', callId);

          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`
            }
          });

          if (!getCallResponse.ok) {
            const error = await getCallResponse.text();
            console.error('[Call Streaming] Failed to get call details:', {
              callId,
              status: getCallResponse.status,
              error
            });
            return jsonResponse({ error: 'Failed to get call details' }, getCallResponse.status);
          }

          const callDetails = await getCallResponse.json() as any;
          const listenUrl = callDetails.monitor?.listenUrl;
          const controlUrl = callDetails.monitor?.controlUrl;

          console.log('[Call Streaming] Call details retrieved:', {
            callId,
            hasListenUrl: !!listenUrl,
            hasControlUrl: !!controlUrl,
            monitorPlan: callDetails.monitorPlan,
            fullMonitor: callDetails.monitor
          });

          if (!listenUrl) {
            console.error('[Call Streaming] No listenUrl found in call details');
            return jsonResponse({ error: 'Listen URL not available for this call' }, 400);
          }

          return jsonResponse({
            success: true,
            listenUrl,
            controlUrl,
            callId
          });
        } catch (error) {
          console.error('[Call Streaming] Error getting listen URL:', {
            callId,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse({ error: 'Failed to get listen URL' }, 500);
        }
      }

      // Batch get listen URLs for multiple calls (for voice activity monitoring)
      if (url.pathname === '/api/calls/batch-listen' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { callIds } = await request.json() as { callIds: string[] };
        
        if (!callIds || !Array.isArray(callIds) || callIds.length === 0) {
          return jsonResponse({ error: 'callIds array required' }, 400);
        }

        // Limit to prevent abuse
        if (callIds.length > 10) {
          return jsonResponse({ error: 'Maximum 10 calls at a time' }, 400);
        }

        console.log('[Batch Listen] Fetching listen URLs for', callIds.length, 'calls');

        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        // Fetch listen URLs for all calls in parallel
        const results = await Promise.all(
          callIds.map(async (callId) => {
            try {
              const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${settings.private_key}` }
              });

              if (!response.ok) {
                return { callId, error: 'Failed to get call details' };
              }

              const callDetails = await response.json() as any;
              const listenUrl = callDetails.monitor?.listenUrl;

              if (!listenUrl) {
                return { callId, error: 'Listen URL not available' };
              }

              return { callId, listenUrl };
            } catch (error) {
              return { callId, error: 'Request failed' };
            }
          })
        );

        console.log('[Batch Listen] Results:', results.length, 'processed');

        return jsonResponse({ results });
      }

      // Control: Say Message
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/control/say') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];
        const { message } = await request.json() as any;

        console.log('[Call Control] Say message request:', { callId, userId });

        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        try {
          // Get call details to get controlUrl
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.private_key}` }
          });

          if (!getCallResponse.ok) {
            return jsonResponse({ error: 'Failed to get call details' }, getCallResponse.status);
          }

          const callDetails = await getCallResponse.json() as any;
          const controlUrl = callDetails.monitor?.controlUrl;

          if (!controlUrl) {
            return jsonResponse({ error: 'Control URL not available' }, 400);
          }

          // Send say command to controlUrl
          const controlResponse = await fetch(controlUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'say',
              content: message
            })
          });

          if (!controlResponse.ok) {
            const error = await controlResponse.text();
            return jsonResponse({ error: `Control request failed: ${error}` }, controlResponse.status);
          }

          return jsonResponse({ success: true });
        } catch (error) {
          console.error('[Call Control] Error sending say command:', error);
          return jsonResponse({ error: 'Failed to send message' }, 500);
        }
      }

      // Control: Add Message
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/control/add-message') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];
        const { message } = await request.json() as any;

        console.log('[Call Control] Add message request:', { callId, userId });

        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        try {
          // Get call details to get controlUrl
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.private_key}` }
          });

          if (!getCallResponse.ok) {
            return jsonResponse({ error: 'Failed to get call details' }, getCallResponse.status);
          }

          const callDetails = await getCallResponse.json() as any;
          const controlUrl = callDetails.monitor?.controlUrl;

          if (!controlUrl) {
            return jsonResponse({ error: 'Control URL not available' }, 400);
          }

          // Send add-message command to controlUrl
          const controlResponse = await fetch(controlUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'add-message',
              message: message
            })
          });

          if (!controlResponse.ok) {
            const error = await controlResponse.text();
            return jsonResponse({ error: `Control request failed: ${error}` }, controlResponse.status);
          }

          return jsonResponse({ success: true });
        } catch (error) {
          console.error('[Call Control] Error adding message:', error);
          return jsonResponse({ error: 'Failed to add message' }, 500);
        }
      }

      // Speech-to-Text using Deepgram
      if (url.pathname === '/api/speech-to-text' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        console.log('[Speech-to-Text] Transcription request:', { userId });

        // Use hardcoded Deepgram API key (SaaS backend service)
        const DEEPGRAM_API_KEY = '387e9e57f0979fe3579c33aac166f49d1354bb0a';

        try {
          // Parse multipart form data to get audio file
          const formData = await request.formData();
          const audioFile = formData.get('audio') as File;

          if (!audioFile) {
            return jsonResponse({ error: 'No audio file provided' }, 400);
          }

          console.log('[Speech-to-Text] Audio file received:', {
            name: audioFile.name,
            type: audioFile.type,
            size: audioFile.size
          });

          // Get audio file as array buffer
          const audioBuffer = await audioFile.arrayBuffer();

          // Call Deepgram API
          const deepgramResponse = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${DEEPGRAM_API_KEY}`,
              'Content-Type': audioFile.type || 'audio/webm'
            },
            body: audioBuffer
          });

          if (!deepgramResponse.ok) {
            const error = await deepgramResponse.text();
            console.error('[Speech-to-Text] Deepgram error:', error);
            return jsonResponse({ error: `Transcription failed: ${error}` }, deepgramResponse.status);
          }

          const transcription = await deepgramResponse.json() as any;
          const text = transcription.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

          console.log('[Speech-to-Text] Transcription successful:', { text });

          return jsonResponse({
            success: true,
            text: text
          });
        } catch (error) {
          console.error('[Speech-to-Text] Error:', error);
          return jsonResponse({ error: 'Failed to transcribe audio' }, 500);
        }
      }

      // End active call
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/end') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];

        console.log('[Call Control] End call request received:', {
          callId,
          userId
        });

        // Get workspace settings (uses helper function with fallback to user_settings)
        const settings = await getWorkspaceSettingsForUser(env, userId);

        if (!settings?.private_key) {
          console.log('[Call Control] VAPI credentials not configured for user:', userId);
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        // Call VAPI API to end the call
        try {
          // Step 1: Get the call details to retrieve controlUrl
          console.log('[Call Control] Fetching call details for controlUrl:', callId);

          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`
            }
          });

          if (!getCallResponse.ok) {
            const error = await getCallResponse.text();
            console.error('[Call Control] Failed to get call details:', {
              callId,
              status: getCallResponse.status,
              error
            });
            return jsonResponse({ error: 'Failed to get call details' }, getCallResponse.status);
          }

          const callDetails = await getCallResponse.json() as any;
          const controlUrl = callDetails.monitor?.controlUrl;

          console.log('[Call Control] Call details retrieved:', {
            callId,
            hasControlUrl: !!controlUrl
          });

          if (!controlUrl) {
            console.error('[Call Control] No controlUrl found in call details');
            return jsonResponse({ error: 'Call control URL not available' }, 400);
          }

          // Step 2: Send end-call command to controlUrl
          const endCallPayload = {
            type: 'end-call'
          };

          console.log('[Call Control] Sending end-call command to controlUrl:', {
            callId,
            payload: endCallPayload
          });

          const endCallResponse = await fetch(controlUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(endCallPayload)
          });

          if (!endCallResponse.ok) {
            const error = await endCallResponse.text();
            console.error('[Call Control] End-call command failed:', {
              callId,
              status: endCallResponse.status,
              error,
              controlUrl
            });
            return jsonResponse({
              error: 'Failed to end call',
              details: error,
              status: endCallResponse.status
            }, endCallResponse.status);
          }

          console.log('[Call Control] Call ended successfully:', callId);

          return jsonResponse({ success: true, message: 'Call ended successfully' });
        } catch (error) {
          console.error('[Call Control] Error ending call:', {
            callId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          return jsonResponse({
            error: 'Failed to end call',
            details: error instanceof Error ? error.message : String(error)
          }, 500);
        }
      }

      // Transfer active call
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/transfer') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];
        const body = await request.json() as any;
        const transferNumber = body.phoneNumber;

        console.log('[Call Control] Transfer call request received:', {
          callId,
          userId,
          transferNumber
        });

        if (!transferNumber) {
          console.log('[Call Control] Transfer number missing');
          return jsonResponse({ error: 'Transfer phone number required' }, 400);
        }

        // Get workspace VAPI credentials (with fallback to user_settings for migration)
        const settings = await getWorkspaceSettingsForUser(env, userId);

        if (!settings?.private_key) {
          console.log('[Call Control] VAPI credentials not configured for user:', userId);
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        // Call VAPI API to transfer the call
        try {
          // Step 1: Get the call details to retrieve controlUrl
          console.log('[Call Control] Fetching call details for controlUrl:', callId);

          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${settings.private_key}`
            }
          });

          if (!getCallResponse.ok) {
            const error = await getCallResponse.text();
            console.error('[Call Control] Failed to get call details:', {
              callId,
              status: getCallResponse.status,
              error
            });
            return jsonResponse({ error: 'Failed to get call details' }, getCallResponse.status);
          }

          const callDetails = await getCallResponse.json() as any;
          const controlUrl = callDetails.monitor?.controlUrl;

          console.log('[Call Control] Call details retrieved:', {
            callId,
            hasControlUrl: !!controlUrl
          });

          if (!controlUrl) {
            console.error('[Call Control] No controlUrl found in call details');
            return jsonResponse({ error: 'Call control URL not available' }, 400);
          }

          // Step 2: Send transfer command to controlUrl
          const transferPayload = {
            type: 'transfer',
            destination: {
              type: 'number',
              number: transferNumber
            }
          };

          console.log('[Call Control] Sending transfer command to controlUrl:', {
            callId,
            transferNumber,
            payload: transferPayload
          });

          const transferResponse = await fetch(controlUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(transferPayload)
          });

          if (!transferResponse.ok) {
            const error = await transferResponse.text();
            console.error('[Call Control] Transfer command failed:', {
              callId,
              transferNumber,
              status: transferResponse.status,
              error
            });
            return jsonResponse({ error: 'Failed to transfer call' }, transferResponse.status);
          }

          console.log('[Call Control] Call transferred successfully:', {
            callId,
            transferNumber
          });

          return jsonResponse({ success: true, message: 'Call transferred successfully' });
        } catch (error) {
          console.error('[Call Control] Error transferring call:', {
            callId,
            transferNumber,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse({ error: 'Failed to transfer call' }, 500);
        }
      }

      // ============================================
      // WARM TRANSFER ENDPOINTS
      // ============================================

      // Initiate warm transfer - dials agent first, then connects customer
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/warm-transfer') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];
        const body = await request.json() as any;
        const agentNumber = body.agentNumber;
        const announcement = body.announcement; // Optional message to play to agent

        console.log('[Warm Transfer] Request received:', {
          callId,
          userId,
          agentNumber,
          hasAnnouncement: !!announcement
        });

        if (!agentNumber) {
          return jsonResponse({ error: 'Agent phone number required' }, 400);
        }

        // Get workspace settings for Twilio and VAPI credentials
        const settings = await getWorkspaceSettingsForUser(env, userId);

        if (!settings?.private_key) {
          return jsonResponse({ error: 'VAPI credentials not configured' }, 400);
        }

        if (!settings?.twilio_account_sid || !settings?.twilio_auth_token) {
          return jsonResponse({ error: 'Twilio credentials not configured for warm transfer' }, 400);
        }

        // Get a Twilio phone number from the USER's Twilio account to use as caller ID (FROM number)
        // This MUST be a phone number purchased in the user's own Twilio account
        let twilioPhoneNumber: string | null = null;
        
        // Fetch phone numbers from user's Twilio account
        try {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/IncomingPhoneNumbers.json?PageSize=1`,
            {
              method: 'GET',
              headers: {
                'Authorization': 'Basic ' + btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`)
              }
            }
          );
          
          if (twilioResponse.ok) {
            const data = await twilioResponse.json() as any;
            console.log('[Warm Transfer] Twilio phone numbers found:', data.incoming_phone_numbers?.length || 0);
            if (data.incoming_phone_numbers && data.incoming_phone_numbers.length > 0) {
              twilioPhoneNumber = data.incoming_phone_numbers[0].phone_number;
              console.log('[Warm Transfer] Using Twilio phone as caller ID:', twilioPhoneNumber);
            }
          } else {
            const errorText = await twilioResponse.text();
            console.error('[Warm Transfer] Failed to fetch Twilio numbers:', twilioResponse.status, errorText);
          }
        } catch (e) {
          console.error('[Warm Transfer] Failed to get Twilio phone numbers:', e);
        }

        if (!twilioPhoneNumber) {
          return jsonResponse({ 
            error: 'No phone numbers found in your Twilio account. Please purchase a phone number in Twilio first.' 
          }, 400);
        }

        // Normalize phone numbers to E.164 format (remove spaces, dashes, parentheses)
        twilioPhoneNumber = twilioPhoneNumber.replace(/[\s\-\(\)]/g, '');
        const normalizedAgentNumber = agentNumber.replace(/[\s\-\(\)]/g, '');

        console.log('[Warm Transfer] Phone numbers normalized:', {
          twilioPhoneNumber,
          agentNumber: normalizedAgentNumber
        });

        const timestamp = now();
        const transferId = generateId();

        try {
          // Step 1: Create warm transfer record
          await env.DB.prepare(
            `INSERT INTO warm_transfers (id, vapi_call_id, user_id, agent_number, announcement, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'initiated', ?, ?)`
          ).bind(transferId, callId, userId, normalizedAgentNumber, announcement || null, timestamp, timestamp).run();

          // Step 2: Get VAPI call details for controlUrl
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.private_key}` }
          });

          if (!getCallResponse.ok) {
            await env.DB.prepare(
              `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
            ).bind('Failed to get VAPI call details', now(), transferId).run();
            return jsonResponse({ error: 'Failed to get call details' }, getCallResponse.status);
          }

          const callDetails = await getCallResponse.json() as any;
          const controlUrl = callDetails.monitor?.controlUrl;

          if (!controlUrl) {
            await env.DB.prepare(
              `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
            ).bind('Call control URL not available', now(), transferId).run();
            return jsonResponse({ error: 'Call control URL not available' }, 400);
          }

          // Step 3: Dial agent using Twilio
          await env.DB.prepare(
            `UPDATE warm_transfers SET status = 'dialing_agent', updated_at = ? WHERE id = ?`
          ).bind(now(), transferId).run();

          const workerUrl = url.origin;
          const twilioConfig = {
            accountSid: settings.twilio_account_sid,
            authToken: settings.twilio_auth_token,
            workerUrl,
            twilioPhoneNumber
          };

          // Dial agent with announcement
          // Flow: Agent answers → hears announcement → call ends → customer transferred to agent
          const agentCall = await dialAgentWithAnnouncement(
            twilioConfig,
            transferId,
            normalizedAgentNumber,
            announcement || `You have an incoming transfer. Please stay on the line.`
          );

          // Update transfer record with agent call SID
          await env.DB.prepare(
            `UPDATE warm_transfers SET agent_call_sid = ?, updated_at = ? WHERE id = ?`
          ).bind(agentCall.callSid, now(), transferId).run();

          console.log('[Warm Transfer] Agent dial initiated:', {
            transferId,
            callId,
            agentCallSid: agentCall.callSid
          });

          // Return immediately - the actual transfer will happen when agent answers and hears announcement
          // Flow: Agent answers → TwiML plays announcement → call ends → webhook triggers → customer transferred
          // Frontend should poll /api/calls/:callId/warm-transfer-status to track progress
          return jsonResponse({
            success: true,
            transferId,
            status: 'dialing_agent',
            message: 'Dialing agent. Agent will hear announcement, then customer will be transferred.',
            agentCallSid: agentCall.callSid
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[Warm Transfer] Error:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            callId,
            agentNumber: normalizedAgentNumber,
            twilioPhoneNumber
          });
          
          try {
            await env.DB.prepare(
              `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
            ).bind(errorMessage, now(), transferId).run();
          } catch (dbError) {
            console.error('[Warm Transfer] Failed to update DB:', dbError);
          }
          
          return jsonResponse({ 
            error: 'Failed to initiate warm transfer', 
            details: errorMessage 
          }, 500);
        }
      }

      // Get warm transfer status
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/warm-transfer-status') && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];

        const transfer = await env.DB.prepare(
          `SELECT * FROM warm_transfers WHERE vapi_call_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`
        ).bind(callId, userId).first() as any;

        if (!transfer) {
          return jsonResponse({ error: 'No warm transfer found for this call' }, 404);
        }

        return jsonResponse({
          transferId: transfer.id,
          status: transfer.status,
          agentNumber: transfer.agent_number,
          agentCallSid: transfer.agent_call_sid,
          conferenceSid: transfer.conference_sid,
          errorMessage: transfer.error_message,
          createdAt: transfer.created_at,
          updatedAt: transfer.updated_at
        });
      }

      // Cancel warm transfer
      if (url.pathname.startsWith('/api/calls/') && url.pathname.endsWith('/warm-transfer-cancel') && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const callId = url.pathname.split('/')[3];

        const transfer = await env.DB.prepare(
          `SELECT * FROM warm_transfers WHERE vapi_call_id = ? AND user_id = ? AND status IN ('initiated', 'dialing_agent') ORDER BY created_at DESC LIMIT 1`
        ).bind(callId, userId).first() as any;

        if (!transfer) {
          return jsonResponse({ error: 'No active warm transfer found to cancel' }, 404);
        }

        const settings = await getWorkspaceSettingsForUser(env, userId);

        // Try to cancel the agent call if it exists
        if (transfer.agent_call_sid && settings?.twilio_account_sid && settings?.twilio_auth_token) {
          try {
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Calls/${transfer.agent_call_sid}.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ 'Status': 'canceled' }),
              }
            );
          } catch (e) {
            console.error('[Warm Transfer] Failed to cancel agent call:', e);
          }
        }

        await env.DB.prepare(
          `UPDATE warm_transfers SET status = 'cancelled', updated_at = ? WHERE id = ?`
        ).bind(now(), transfer.id).run();

        return jsonResponse({ success: true, message: 'Warm transfer cancelled' });
      }

      // ============================================
      // AUTO WARM TRANSFER ENDPOINTS
      // ============================================

      // List transfer agents for an assistant
      if (url.pathname.match(/^\/api\/assistants\/[^/]+\/transfer-agents$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const assistantId = pathParts[3];

        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const { results } = await env.DB.prepare(
          `SELECT * FROM assistant_transfer_agents 
           WHERE assistant_id = ? AND user_id = ? 
           ORDER BY priority ASC, created_at ASC`
        ).bind(assistantId, effectiveUserId).all();

        return jsonResponse({
          agents: results || [],
          assistantId
        });
      }

      // Add transfer agent to assistant
      if (url.pathname.match(/^\/api\/assistants\/[^/]+\/transfer-agents$/) && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const assistantId = pathParts[3];

        const body = await request.json() as any;
        const { phone_number, agent_name, priority } = body;

        if (!phone_number) {
          return jsonResponse({ error: 'Phone number is required' }, 400);
        }

        // Normalize phone number to E.164
        const normalizedPhone = phone_number.replace(/[\s\-\(\)]/g, '');

        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const timestamp = now();
        const agentId = generateId();

        // Get current max priority if not provided
        let agentPriority = priority;
        if (agentPriority === undefined || agentPriority === null) {
          const maxPriority = await env.DB.prepare(
            `SELECT MAX(priority) as max_priority FROM assistant_transfer_agents 
             WHERE assistant_id = ? AND user_id = ?`
          ).bind(assistantId, effectiveUserId).first() as any;
          agentPriority = (maxPriority?.max_priority || 0) + 1;
        }

        await env.DB.prepare(
          `INSERT INTO assistant_transfer_agents 
           (id, assistant_id, user_id, phone_number, agent_name, priority, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
        ).bind(agentId, assistantId, effectiveUserId, normalizedPhone, agent_name || null, agentPriority, timestamp, timestamp).run();

        return jsonResponse({
          id: agentId,
          assistant_id: assistantId,
          phone_number: normalizedPhone,
          agent_name: agent_name || null,
          priority: agentPriority,
          is_active: 1,
          created_at: timestamp,
          updated_at: timestamp
        }, 201);
      }

      // Update transfer agent
      if (url.pathname.match(/^\/api\/assistants\/[^/]+\/transfer-agents\/[^/]+$/) && request.method === 'PATCH') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const assistantId = pathParts[3];
        const agentId = pathParts[5];

        const body = await request.json() as any;
        const { phone_number, agent_name, priority, is_active } = body;

        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Verify agent exists and belongs to user
        const existing = await env.DB.prepare(
          `SELECT * FROM assistant_transfer_agents WHERE id = ? AND assistant_id = ? AND user_id = ?`
        ).bind(agentId, assistantId, effectiveUserId).first();

        if (!existing) {
          return jsonResponse({ error: 'Transfer agent not found' }, 404);
        }

        // Build dynamic update
        const updates: string[] = [];
        const values: any[] = [];

        if (phone_number !== undefined) {
          updates.push('phone_number = ?');
          values.push(phone_number.replace(/[\s\-\(\)]/g, ''));
        }
        if (agent_name !== undefined) {
          updates.push('agent_name = ?');
          values.push(agent_name);
        }
        if (priority !== undefined) {
          updates.push('priority = ?');
          values.push(priority);
        }
        if (is_active !== undefined) {
          updates.push('is_active = ?');
          values.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
          return jsonResponse({ error: 'No fields to update' }, 400);
        }

        updates.push('updated_at = ?');
        values.push(now());
        values.push(agentId);

        await env.DB.prepare(
          `UPDATE assistant_transfer_agents SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run();

        // Fetch updated record
        const updated = await env.DB.prepare(
          `SELECT * FROM assistant_transfer_agents WHERE id = ?`
        ).bind(agentId).first();

        return jsonResponse(updated);
      }

      // Delete transfer agent
      if (url.pathname.match(/^\/api\/assistants\/[^/]+\/transfer-agents\/[^/]+$/) && request.method === 'DELETE') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const assistantId = pathParts[3];
        const agentId = pathParts[5];

        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Verify agent exists and belongs to user
        const existing = await env.DB.prepare(
          `SELECT * FROM assistant_transfer_agents WHERE id = ? AND assistant_id = ? AND user_id = ?`
        ).bind(agentId, assistantId, effectiveUserId).first();

        if (!existing) {
          return jsonResponse({ error: 'Transfer agent not found' }, 404);
        }

        await env.DB.prepare(
          `DELETE FROM assistant_transfer_agents WHERE id = ?`
        ).bind(agentId).run();

        return jsonResponse({ success: true, message: 'Transfer agent deleted' });
      }

      // Get transfer settings for assistant
      if (url.pathname.match(/^\/api\/assistants\/[^/]+\/transfer-settings$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const assistantId = pathParts[3];

        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        let settings = await env.DB.prepare(
          `SELECT * FROM assistant_transfer_settings WHERE assistant_id = ? AND user_id = ?`
        ).bind(assistantId, effectiveUserId).first() as any;

        // Return defaults if no settings exist
        if (!settings) {
          settings = {
            assistant_id: assistantId,
            ring_timeout_seconds: 30,
            max_attempts: 3,
            enabled: 0,
            announcement_message: null
          };
        }

        return jsonResponse(settings);
      }

      // Update transfer settings for assistant
      if (url.pathname.match(/^\/api\/assistants\/[^/]+\/transfer-settings$/) && request.method === 'PUT') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const assistantId = pathParts[3];

        const body = await request.json() as any;
        const { ring_timeout_seconds, max_attempts, enabled, announcement_message, transfer_triggers } = body;

        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const timestamp = now();

        // Get current enabled state to detect toggle
        const currentSettings = await env.DB.prepare(
          `SELECT id, enabled FROM assistant_transfer_settings WHERE assistant_id = ? AND user_id = ?`
        ).bind(assistantId, effectiveUserId).first() as any;

        const wasEnabled = currentSettings?.enabled === 1;
        const willBeEnabled = enabled === true || enabled === 1;

        // If enabling/disabling auto-transfer, update VAPI assistant tools
        // IMPORTANT: Also update VAPI if enabling (even if already enabled) to ensure tool is present
        let vapiUpdateError: string | null = null;
        const shouldUpdateVapi = wasEnabled !== willBeEnabled || willBeEnabled; // Always update when enabling
        console.log('[Transfer Settings] wasEnabled:', wasEnabled, 'willBeEnabled:', willBeEnabled, 'shouldUpdateVapi:', shouldUpdateVapi);
        
        if (shouldUpdateVapi) {
          try {
            // Get workspace settings for VAPI API key
            const wsSettings = await getWorkspaceSettingsForUser(env, effectiveUserId);
            console.log('[Transfer Settings] Got workspace settings, has private_key:', !!wsSettings?.private_key);
            
            if (!wsSettings?.private_key) {
              vapiUpdateError = 'No API key configured in workspace settings';
              console.error('[Transfer Settings]', vapiUpdateError);
            } else {
              // Fetch current assistant to get existing tools
              console.log('[Transfer Settings] Fetching assistant:', assistantId);
              const vapiGetResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${wsSettings.private_key}` }
              });

              if (!vapiGetResponse.ok) {
                const errorText = await vapiGetResponse.text();
                vapiUpdateError = `Failed to fetch assistant: ${vapiGetResponse.status} - ${errorText}`;
                console.error('[Transfer Settings]', vapiUpdateError);
              } else {
                const assistant = await vapiGetResponse.json() as any;
                let tools = assistant.model?.tools || [];
                
                // Get the assistant's webhook URL for tool calls
                const webhookUrl = assistant.server?.url;
                console.log('[Transfer Settings] Assistant webhook URL:', webhookUrl);
                console.log('[Transfer Settings] Current tools:', JSON.stringify(tools));
                
                // Define the transfer_to_sales tool with explicit server URL
                const transferTool: any = {
                  type: 'function',
                  function: {
                    name: 'transfer_to_sales',
                    description: 'Transfer this call to a sales representative. Call this function when the customer shows buying intent, asks for pricing, wants a quote, requests to speak with a human, or expresses interest in purchasing.',
                    parameters: {
                      type: 'object',
                      properties: {
                        reason: {
                          type: 'string',
                          description: 'Brief reason for transfer (e.g., "Customer wants a quote", "Customer asked for pricing")'
                        }
                      },
                      required: ['reason']
                    }
                  },
                  async: false,
                  messages: [
                    {
                      type: 'request-start',
                      content: 'Let me connect you with one of our specialists.'
                    }
                  ]
                };

                // Add server URL to tool if webhook is configured
                if (webhookUrl) {
                  transferTool.server = { url: webhookUrl };
                }

                // Transfer instruction marker for system prompt
                const TRANSFER_INSTRUCTION_MARKER = '\n\n[AUTO-TRANSFER INSTRUCTIONS]';
                const TRANSFER_INSTRUCTIONS = `${TRANSFER_INSTRUCTION_MARKER}
IMPORTANT: If the customer asks for pricing, a quote, wants to buy, wants to schedule a demo, or asks to speak to a human or sales representative, you MUST immediately call the transfer_to_sales function with the reason for transfer.
Examples of when to transfer:
- "How much does this cost?" → call transfer_to_sales with reason "Customer asking for pricing"
- "I want to buy" → call transfer_to_sales with reason "Customer wants to purchase"
- "Can I speak to someone?" → call transfer_to_sales with reason "Customer requested human agent"
- "I'd like a quote" → call transfer_to_sales with reason "Customer requesting quote"
[END AUTO-TRANSFER INSTRUCTIONS]`;

                // Get current system prompt
                let systemPrompt = '';
                if (assistant.model?.messages && assistant.model.messages.length > 0) {
                  const systemMessage = assistant.model.messages.find((m: any) => m.role === 'system');
                  systemPrompt = systemMessage?.content || '';
                }

                if (willBeEnabled) {
                  // Add tool if not already present
                  const hasTransferTool = tools.some((t: any) => 
                    t.function?.name === 'transfer_to_sales' || t.name === 'transfer_to_sales'
                  );
                  if (!hasTransferTool) {
                    tools = [...tools, transferTool];
                    console.log('[Transfer Settings] Adding transfer_to_sales tool');
                  } else {
                    console.log('[Transfer Settings] Tool already exists, skipping');
                  }

                  // Add transfer instructions to system prompt if not present
                  if (!systemPrompt.includes(TRANSFER_INSTRUCTION_MARKER)) {
                    systemPrompt = systemPrompt + TRANSFER_INSTRUCTIONS;
                    console.log('[Transfer Settings] Adding transfer instructions to system prompt');
                  }
                } else {
                  // Remove transfer_to_sales tool
                  tools = tools.filter((t: any) => 
                    t.function?.name !== 'transfer_to_sales' && t.name !== 'transfer_to_sales'
                  );
                  console.log('[Transfer Settings] Removing transfer_to_sales tool');

                  // Remove transfer instructions from system prompt
                  if (systemPrompt.includes(TRANSFER_INSTRUCTION_MARKER)) {
                    systemPrompt = systemPrompt.replace(/\n\n\[AUTO-TRANSFER INSTRUCTIONS\][\s\S]*?\[END AUTO-TRANSFER INSTRUCTIONS\]/g, '');
                    console.log('[Transfer Settings] Removing transfer instructions from system prompt');
                  }
                }

                // Build updated messages array
                let updatedMessages = assistant.model?.messages || [];
                const systemMessageIndex = updatedMessages.findIndex((m: any) => m.role === 'system');
                if (systemMessageIndex >= 0) {
                  updatedMessages = [...updatedMessages];
                  updatedMessages[systemMessageIndex] = { ...updatedMessages[systemMessageIndex], content: systemPrompt };
                } else if (systemPrompt) {
                  updatedMessages = [{ role: 'system', content: systemPrompt }, ...updatedMessages];
                }

                // Update assistant with modified tools AND system prompt
                const updatePayload: any = {
                  model: {
                    ...assistant.model,
                    tools: tools.length > 0 ? tools : undefined,
                    messages: updatedMessages
                  }
                };
                
                console.log('[Transfer Settings] Update payload tools:', JSON.stringify(updatePayload.model?.tools));
                console.log('[Transfer Settings] System prompt updated:', systemPrompt.includes(TRANSFER_INSTRUCTION_MARKER) ? 'YES' : 'NO');

                const vapiUpdateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${wsSettings.private_key}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(updatePayload)
                });

                if (!vapiUpdateResponse.ok) {
                  const updateErrorText = await vapiUpdateResponse.text();
                  vapiUpdateError = `Failed to update assistant: ${vapiUpdateResponse.status} - ${updateErrorText}`;
                  console.error('[Transfer Settings]', vapiUpdateError);
                } else {
                  console.log(`[Transfer Settings] ${willBeEnabled ? 'Added' : 'Removed'} transfer_to_sales tool on assistant ${assistantId}`);
                  
                  // Update cache
                  const updatedAssistant = await vapiUpdateResponse.json() as any;
                  await env.DB.prepare(
                    'INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)'
                  ).bind(
                    updatedAssistant.id,
                    effectiveUserId,
                    JSON.stringify(updatedAssistant),
                    timestamp,
                    timestamp
                  ).run();
                  console.log('[Transfer Settings] Cache updated successfully');
                }
              }
            }
          } catch (vapiError: any) {
            // Sanitize error message to remove any VAPI branding
            let errorMsg = vapiError.message || String(vapiError);
            errorMsg = errorMsg.replace(/vapi/gi, 'Voice Engine');
            vapiUpdateError = `Exception: ${errorMsg}`;
            console.error('[Transfer Settings] Error updating assistant:', vapiError);
          }
        }

        // Save settings to database
        if (currentSettings) {
          // Update existing settings
          await env.DB.prepare(
            `UPDATE assistant_transfer_settings 
             SET ring_timeout_seconds = ?, max_attempts = ?, enabled = ?, announcement_message = ?, updated_at = ?
             WHERE id = ?`
          ).bind(
            ring_timeout_seconds ?? 30,
            max_attempts ?? 3,
            willBeEnabled ? 1 : 0,
            announcement_message || null,
            timestamp,
            currentSettings.id
          ).run();
        } else {
          // Create new settings
          const settingsId = generateId();
          await env.DB.prepare(
            `INSERT INTO assistant_transfer_settings 
             (id, assistant_id, user_id, ring_timeout_seconds, max_attempts, enabled, announcement_message, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            settingsId,
            assistantId,
            effectiveUserId,
            ring_timeout_seconds ?? 30,
            max_attempts ?? 3,
            willBeEnabled ? 1 : 0,
            announcement_message || null,
            timestamp,
            timestamp
          ).run();
        }

        // Fetch updated settings
        const updated = await env.DB.prepare(
          `SELECT * FROM assistant_transfer_settings WHERE assistant_id = ? AND user_id = ?`
        ).bind(assistantId, effectiveUserId).first();

        // Sanitize any VAPI mentions from error messages before returning to frontend
        let sanitizedError = vapiUpdateError;
        if (sanitizedError) {
          sanitizedError = sanitizedError.replace(/vapi/gi, 'Voice Engine');
          sanitizedError = sanitizedError.replace(/Vapi/gi, 'Voice Engine');
          sanitizedError = sanitizedError.replace(/VAPI/gi, 'Voice Engine');
        }

        return jsonResponse({
          ...updated,
          tool_configured: willBeEnabled && !vapiUpdateError,
          error: sanitizedError || undefined
        });
      }

      // Get auto transfer logs
      if (url.pathname === '/api/auto-transfer-logs' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const assistantId = url.searchParams.get('assistant_id');
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Build query with optional filters
        let query = `SELECT * FROM auto_transfer_logs WHERE user_id = ?`;
        const params: any[] = [effectiveUserId];

        if (assistantId) {
          query += ` AND assistant_id = ?`;
          params.push(assistantId);
        }
        if (status) {
          query += ` AND status = ?`;
          params.push(status);
        }

        query += ` ORDER BY started_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const { results } = await env.DB.prepare(query).bind(...params).all();

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM auto_transfer_logs WHERE user_id = ?`;
        const countParams: any[] = [effectiveUserId];
        if (assistantId) {
          countQuery += ` AND assistant_id = ?`;
          countParams.push(assistantId);
        }
        if (status) {
          countQuery += ` AND status = ?`;
          countParams.push(status);
        }

        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first() as any;

        return jsonResponse({
          logs: results || [],
          total: countResult?.total || 0,
          limit,
          offset
        });
      }

      // Get specific transfer details (all attempts for one transfer)
      if (url.pathname.match(/^\/api\/auto-transfer-logs\/[^/]+$/) && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const pathParts = url.pathname.split('/');
        const transferId = pathParts[3];

        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const { results } = await env.DB.prepare(
          `SELECT * FROM auto_transfer_logs 
           WHERE transfer_id = ? AND user_id = ? 
           ORDER BY attempt_number ASC`
        ).bind(transferId, effectiveUserId).all();

        if (!results || results.length === 0) {
          return jsonResponse({ error: 'Transfer not found' }, 404);
        }

        return jsonResponse({
          transfer_id: transferId,
          attempts: results
        });
      }

      // Get intent analysis (supports workspace context)
      if (url.pathname === '/api/intent-analysis' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const page = Math.floor(offset / limit) + 1;

        // Initialize cache
        const cache = new VoiceAICache(env.CACHE);

        // Try to get from cache first (use effectiveUserId for cache key)
        if (limit <= 100) {
          const cached = await cache.getCachedIntentSummary(effectiveUserId);
          if (cached) {
            console.log(`Cache HIT for intent analysis: user=${effectiveUserId}`);
            return jsonResponse(cached);
          }
        }

        console.log(`Cache MISS for intent analysis: user=${effectiveUserId}`);

        // Fetch all calls from database with enhanced data (using effectiveUserId)
        // Filter out test calls (those without customer_number)
        const { results } = await env.DB.prepare(
          `SELECT
            wc.id,
            wc.webhook_id,
            wc.vapi_call_id,
            wc.phone_number,
            wc.customer_number,
            wc.recording_url,
            wc.ended_reason,
            wc.summary,
            wc.structured_data,
            wc.raw_payload,
            wc.intent,
            wc.sentiment,
            wc.outcome,
            wc.analysis_completed,
            wc.analyzed_at,
            wc.customer_name,
            wc.customer_email,
            wc.appointment_date,
            wc.appointment_time,
            wc.appointment_type,
            wc.appointment_notes,
            wc.created_at,
            ar.result_data as enhanced_data
          FROM webhook_calls wc
          LEFT JOIN addon_results ar ON ar.call_id = wc.id AND ar.addon_type = 'enhanced_data' AND ar.status = 'success'
          WHERE wc.user_id = ? AND wc.customer_number IS NOT NULL
          ORDER BY wc.created_at DESC
          LIMIT ? OFFSET ?`
        ).bind(effectiveUserId, limit, offset).all();

        // Get user email for demo data check
        const userEmail = await env.DB.prepare(
          'SELECT email FROM users WHERE id = ?'
        ).bind(userId).first() as any;

        // Helper function to generate mock enhanced data for demo
        const generateMockEnhancedData = (index: number) => {
          const mockProfiles = [
            {
              firstName: 'Sarah',
              lastName: 'Johnson',
              address: '4532 Maple Avenue',
              city: 'San Francisco',
              state: 'CA',
              zip: '94102',
              countyName: 'San Francisco',
              gender: 'F',
              age: 42,
              phones: [{
                phone: 4155551234,
                carrier: 'AT&T Mobility',
                phoneType: 1,
                workPhone: false,
                activityStatus: 'Active',
                contactabilityScore: 'High'
              }],
              data: {
                addressType: 'Single Family',
                incomeLevel: '$75K-$100K',
                creditRange: '720-780',
                householdIncome: '$85,000-$95,000',
                homeOwnership: 'Owner',
                homePrice: 875000,
                homeValue: 920000,
                age: 42
              },
              properties: [{
                propertyType: 'Single Family Residence',
                value: 920000,
                estimatedValue: 920000,
                yearBuilt: 1998,
                bedrooms: '3',
                rooms: '7',
                saleDate: '2019-05-15',
                saleAmount: 785000
              }]
            },
            {
              firstName: 'Michael',
              lastName: 'Rodriguez',
              address: '1847 Oak Street',
              city: 'Portland',
              state: 'OR',
              zip: '97201',
              countyName: 'Multnomah',
              gender: 'M',
              age: 35,
              phones: [{
                phone: 5035559876,
                carrier: 'Verizon',
                phoneType: 1,
                workPhone: false,
                activityStatus: 'Active',
                contactabilityScore: 'Medium'
              }],
              data: {
                addressType: 'Condominium',
                incomeLevel: '$100K-$150K',
                creditRange: '680-720',
                householdIncome: '$110,000-$125,000',
                homeOwnership: 'Owner',
                homePrice: 425000,
                homeValue: 465000,
                age: 35
              },
              properties: [{
                propertyType: 'Condominium',
                value: 465000,
                estimatedValue: 465000,
                yearBuilt: 2015,
                bedrooms: '2',
                rooms: '5',
                saleDate: '2021-03-22',
                saleAmount: 410000
              }]
            },
            {
              firstName: 'Jennifer',
              lastName: 'Chen',
              address: '2315 Pine Ridge Drive',
              city: 'Seattle',
              state: 'WA',
              zip: '98101',
              countyName: 'King',
              gender: 'F',
              age: 52,
              phones: [{
                phone: 2065557890,
                carrier: 'T-Mobile',
                phoneType: 1,
                workPhone: false,
                activityStatus: 'Active',
                contactabilityScore: 'Very High'
              }],
              data: {
                addressType: 'Single Family',
                incomeLevel: '$150K+',
                creditRange: '780-850',
                householdIncome: '$175,000+',
                homeOwnership: 'Owner',
                homePrice: 1200000,
                homeValue: 1350000,
                age: 52
              },
              properties: [{
                propertyType: 'Single Family Residence',
                value: 1350000,
                estimatedValue: 1350000,
                yearBuilt: 2005,
                bedrooms: '4',
                rooms: '9',
                saleDate: '2018-11-08',
                saleAmount: 1050000
              }]
            }
          ];

          return {
            identities: [mockProfiles[index % mockProfiles.length]]
          };
        };

        // Parse structured_data, raw_payload, and enhanced_data JSON for each result
        const parsedResults = (results || []).map((row: any, index: number) => {
          let enhancedData = row.enhanced_data ? JSON.parse(row.enhanced_data) : null;

          // Inject mock enhanced data for vic@channelautomation.com
          if (userEmail?.email === 'vic@channelautomation.com' && !enhancedData) {
            enhancedData = generateMockEnhancedData(index);
          }

          // Parse raw_payload to extract structured outputs
          let structuredOutputs = {};
          if (row.raw_payload) {
            const rawPayload = JSON.parse(row.raw_payload);
            const analysis = rawPayload?.message?.analysis || {};
            const artifact = rawPayload?.message?.artifact || {};
            structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || {};
          }

          return {
            ...row,
            structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
            raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
            enhanced_data: enhancedData,
            structured_outputs: structuredOutputs
          };
        });

        // Calculate summary statistics
        const totalCalls = parsedResults.length;
        const answeredCalls = parsedResults.filter(call => call.recording_url).length;
        const avgConfidence = totalCalls > 0
          ? parsedResults.reduce((sum, call) => sum + 85, 0) / totalCalls // Default confidence
          : 0;

        const intentDistribution = parsedResults.reduce((acc, call) => {
          acc[call.intent] = (acc[call.intent] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const summaryData = {
          calls: parsedResults,
          stats: {
            totalCalls,
            answeredCalls,
            avgConfidence: Math.round(avgConfidence),
            intentDistribution: Object.entries(intentDistribution).map(([intent, count]) => ({
              intent,
              count
            }))
          }
        };

        // Cache the results
        if (limit <= 100) {
          // Use effectiveUserId for cache key to scope by workspace owner
          await cache.cacheIntentSummary(effectiveUserId, summaryData, CACHE_TTL.INTENT_SUMMARY);
        }

        return jsonResponse(summaryData);
      }

      // Get appointments data from structured outputs
      if (url.pathname === '/api/appointments' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Fetch calls with structured outputs that contain appointment data
        // Prioritize calls with appointment dates, then fetch recent calls
        const { results } = await env.DB.prepare(
          `SELECT
            wc.id,
            wc.vapi_call_id,
            wc.phone_number,
            wc.customer_number,
            wc.customer_name,
            wc.raw_payload,
            wc.structured_data,
            wc.created_at,
            CASE 
              WHEN wc.structured_data LIKE '%"Appointment Date"%' 
                AND wc.structured_data NOT LIKE '%"Appointment Date":null%'
                AND wc.structured_data NOT LIKE '%"Appointment Date":""%'
                AND wc.structured_data NOT LIKE '%"Appointment Date":"N/A"%'
              THEN 1 
              ELSE 0 
            END as has_appointment
          FROM webhook_calls wc
          WHERE wc.user_id = ?
            AND wc.raw_payload IS NOT NULL
            AND wc.customer_number IS NOT NULL
          ORDER BY has_appointment DESC, wc.created_at DESC
          LIMIT 500`
        ).bind(effectiveUserId).all();

        // Parse and extract appointment data from structured outputs
        console.log(`[Appointments API] Found ${results?.length || 0} rows from database for user ${effectiveUserId}`);
        
        const appointments = (results || []).map((row: any) => {
          try {
            const rawPayload = row.raw_payload ? JSON.parse(row.raw_payload) : null;
            const structuredOutputs = rawPayload?.message?.analysis?.structuredOutputs ||
                                     rawPayload?.message?.artifact?.structuredOutputs || {};

            // Extract values - initialize all fields
            let appointmentDate: string | null = null;
            let appointmentTime: string | null = null;
            let qualityScore: number | null = null;
            let issueType: string | null = null;
            let customerFrustrated: boolean | null = null;
            let escalationRequired: boolean | null = null;
            let callSummary: string | null = null;
            let product: string | null = null;

            // Helper function to parse natural language dates
            const parseNaturalDate = (dateStr: string, callTimestamp: number): string | null => {
              if (!dateStr) return null;

              const dateLower = dateStr.toLowerCase().trim();
              const callDate = new Date(callTimestamp * 1000);

              // Handle "today"
              if (dateLower === 'today') {
                return callDate.toISOString().split('T')[0];
              }

              // Handle "tomorrow"
              if (dateLower === 'tomorrow') {
                const tomorrow = new Date(callDate);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow.toISOString().split('T')[0];
              }

              // Handle "day after tomorrow" or "in 2 days"
              if (dateLower.includes('day after tomorrow')) {
                const dayAfter = new Date(callDate);
                dayAfter.setDate(dayAfter.getDate() + 2);
                return dayAfter.toISOString().split('T')[0];
              }

              // Handle "in X days"
              const inDaysMatch = dateLower.match(/in (\d+) days?/);
              if (inDaysMatch) {
                const daysAhead = parseInt(inDaysMatch[1]);
                const futureDate = new Date(callDate);
                futureDate.setDate(futureDate.getDate() + daysAhead);
                return futureDate.toISOString().split('T')[0];
              }

              // Handle "next week"
              if (dateLower.includes('next week')) {
                const nextWeek = new Date(callDate);
                nextWeek.setDate(nextWeek.getDate() + 7);
                return nextWeek.toISOString().split('T')[0];
              }

              // Handle "this [day]" format (e.g., "this friday", "this thursday")
              const thisDayMatch = dateLower.match(/this (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
              if (thisDayMatch) {
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const targetDayName = thisDayMatch[1];
                const dayIndex = dayNames.indexOf(targetDayName);
                if (dayIndex !== -1) {
                  const currentDay = callDate.getDay();
                  let daysUntil = dayIndex - currentDay;
                  if (daysUntil <= 0) daysUntil += 7; // Next week's day
                  const targetDate = new Date(callDate);
                  targetDate.setDate(targetDate.getDate() + daysUntil);
                  return targetDate.toISOString().split('T')[0];
                }
              }

              // Handle "next [day]" format (e.g., "next thursday", "next friday")
              // "next [day]" always means the day in the following week (at least 7 days away)
              const nextDayMatch = dateLower.match(/next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
              if (nextDayMatch) {
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const targetDayName = nextDayMatch[1];
                const dayIndex = dayNames.indexOf(targetDayName);
                if (dayIndex !== -1) {
                  const currentDay = callDate.getDay();
                  let daysUntil = dayIndex - currentDay;
                  // Always add at least 7 days for "next [day]" to ensure it's next week
                  if (daysUntil <= 0) {
                    daysUntil += 7; // Next week's day
                  } else {
                    daysUntil += 7; // Always add 7 to make it next week
                  }
                  const targetDate = new Date(callDate);
                  targetDate.setDate(targetDate.getDate() + daysUntil);
                  return targetDate.toISOString().split('T')[0];
                }
              }

              // Handle combined formats like "Monday, the 24th" or "Friday, the 21st"
              const combinedMatch = dateLower.match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday).*?(\d+)(?:st|nd|rd|th)/);
              if (combinedMatch) {
                const day = parseInt(combinedMatch[2]);
                if (day >= 1 && day <= 31) {
                  const targetDate = new Date(callDate);
                  targetDate.setDate(day);
                  
                  // If the day has already passed this month, assume next month
                  if (targetDate < callDate) {
                    targetDate.setMonth(targetDate.getMonth() + 1);
                  }
                  
                  return targetDate.toISOString().split('T')[0];
                }
              }

              // Handle day of month format like "28th", "1st", "2nd", "3rd", "15th"
              // These always refer to the current month (or next month if day has passed)
              const dayOfMonthMatch = dateLower.match(/^(\d+)(?:st|nd|rd|th)?$/);
              if (dayOfMonthMatch) {
                const day = parseInt(dayOfMonthMatch[1]);
                if (day >= 1 && day <= 31) {
                  // Use the call date's year and month, set to the specified day
                  const targetDate = new Date(callDate);
                  targetDate.setDate(day);
                  
                  // If the day has already passed this month, assume next month
                  if (targetDate < callDate) {
                    targetDate.setMonth(targetDate.getMonth() + 1);
                  }
                  
                  return targetDate.toISOString().split('T')[0];
                }
              }

              // Handle day names (e.g., "Monday", "Tuesday", "Thursday")
              const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              const dayIndex = dayNames.findIndex(day => dateLower.includes(day));
              if (dayIndex !== -1) {
                const currentDay = callDate.getDay();
                let daysUntil = dayIndex - currentDay;
                if (daysUntil <= 0) daysUntil += 7; // Next week's day
                const targetDate = new Date(callDate);
                targetDate.setDate(targetDate.getDate() + daysUntil);
                return targetDate.toISOString().split('T')[0];
              }

              // Try to parse as ISO date or standard date
              try {
                const parsed = new Date(dateStr);
                if (!isNaN(parsed.getTime())) {
                  const parsedDate = parsed.toISOString().split('T')[0];
                  
                  // Validate: if parsed date is in the past (more than 1 day ago), 
                  // assume it's the same date next year or next month
                  const parsedDateObj = new Date(parsed);
                  const oneDayAgo = new Date(callDate);
                  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                  
                  if (parsedDateObj < oneDayAgo) {
                    // Date is in the past - try to fix the year
                    const currentYear = callDate.getFullYear();
                    const parsedYear = parsedDateObj.getFullYear();
                    
                    // If year is clearly wrong (like 2023 when call is in 2025), fix it
                    if (parsedYear < currentYear - 1) {
                      parsedDateObj.setFullYear(currentYear);
                      // If still in the past, try next month
                      if (parsedDateObj < callDate) {
                        parsedDateObj.setMonth(parsedDateObj.getMonth() + 1);
                      }
                      return parsedDateObj.toISOString().split('T')[0];
                    }
                  }
                  
                  return parsedDate;
                }
              } catch (e) {
                // Continue to return original
              }

              // Return original if we can't parse it
              return dateStr;
            };

            // PRIORITY 1: Check structured_data FIRST for appointment date and time
            let customerNameFromData: string | null = null;
            if (row.structured_data) {
              try {
                const structuredData = JSON.parse(row.structured_data);

                // Primary source for appointment date (with natural language parsing)
                const rawDate = structuredData?.['appointment date'] ||
                               structuredData?.['Appointment date'] ||
                               structuredData?.['Appointment Date'] ||
                               structuredData?.['appointmentDate'] || null;

                // Only parse if rawDate exists and is not "N/A" or empty
                if (rawDate && rawDate.trim().toUpperCase() !== 'N/A' && rawDate.trim() !== '') {
                  appointmentDate = parseNaturalDate(rawDate, row.created_at);
                }

                // Primary source for appointment time
                const rawTime = structuredData?.['appointment time'] ||
                               structuredData?.['Appointment time'] ||
                               structuredData?.['Appointment Time'] ||
                               structuredData?.['appointmentTime'] || null;

                // Only set time if it exists and is not "N/A" or empty
                if (rawTime && rawTime.trim().toUpperCase() !== 'N/A' && rawTime.trim() !== '') {
                  appointmentTime = rawTime;
                }

                // Extract customer name from Firstname/Lastname or Name fields
                const firstname = structuredData?.['Firstname'] || structuredData?.['firstname'] || structuredData?.['FirstName'] || '';
                const lastname = structuredData?.['Lastname'] || structuredData?.['lastname'] || structuredData?.['LastName'] || '';
                const fullName = structuredData?.['Name'] || structuredData?.['name'] || structuredData?.['FullName'] || null;

                if (fullName) {
                  customerNameFromData = fullName;
                } else if (firstname || lastname) {
                  customerNameFromData = `${firstname} ${lastname}`.trim() || null;
                }

                // Also check for product here
                product = structuredData?.product ||
                         structuredData?.Product || null;
              } catch (e) {
                // Ignore parse error
              }
            }

            // PRIORITY 2: Extract data from structured outputs (NOT for appointment date/time - only use structured_data)
            // Note: Appointment date/time should ONLY come from structured_data for accuracy
            Object.entries(structuredOutputs).forEach(([, value]: [string, any]) => {
              if (typeof value === 'object' && value !== null && 'name' in value && 'result' in value) {
                const name = value.name.toLowerCase();
                const result = value.result;

                // Skip appointment date/time from structuredOutputs - only use structured_data
                // (structuredOutputs can have wrong years like 2023 instead of 2025)
                if (name.includes('appointment date') || name.includes('appointmentdate') || 
                    name.includes('appointment time') || name.includes('appointmenttime')) {
                  // Skip - we only use structured_data for appointment date/time
                } else if (name.includes('quality score') || name.includes('qualityscore')) {
                  qualityScore = typeof result === 'number' ? result : parseInt(result);
                } else if (name.includes('issue type') || name.includes('issuetype')) {
                  issueType = result;
                } else if (name.includes('customer frustrated') || name.includes('customerfrustrated')) {
                  customerFrustrated = typeof result === 'boolean' ? result : result === 'true';
                } else if (name.includes('escalation required') || name.includes('escalationrequired')) {
                  escalationRequired = typeof result === 'boolean' ? result : result === 'true';
                } else if (name.includes('call summary') || name.includes('callsummary') || name.includes('summary')) {
                  callSummary = result;
                } else if (name.includes('product') && !product) {
                  product = result;
                }
              }
            });

            // Get phone number from customer number or phone_number field
            const phoneNumber = row.customer_number || row.phone_number || null;

            return {
              id: row.id,
              vapi_call_id: row.vapi_call_id,
              phone_number: phoneNumber,
              customer_name: customerNameFromData || row.customer_name || null,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime,
              quality_score: qualityScore,
              issue_type: issueType,
              customer_frustrated: customerFrustrated,
              escalation_required: escalationRequired,
              call_summary: callSummary,
              product: product,
              created_at: row.created_at
            };
          } catch (error) {
            console.error('Error parsing appointment data:', error);
            return null;
          }
        }).filter((apt: any) => {
          if (!apt) return false;
          
          // Only include appointments that have a valid appointment_date
          // Exclude entries with "N/A", null, or invalid dates
          if (!apt.appointment_date) {
            return false;
          }
          
          // Validate that the date is actually a valid date string (not "Invalid Date")
          try {
            const appointmentDate = new Date(apt.appointment_date);
            
            // Check if date is valid
            if (isNaN(appointmentDate.getTime())) {
              return false; // Invalid date
            }
            
            // Filter out appointments from previous years (but keep all appointments from current year)
            const currentYear = new Date().getFullYear();
            const appointmentYear = appointmentDate.getFullYear();
            
            // Exclude if appointment is from a previous year
            if (appointmentYear < currentYear) {
              return false;
            }
          } catch (e) {
            // If date parsing fails, exclude the appointment
            return false;
          }

          return true;
        });

        console.log(`[Appointments API] Returning ${appointments.length} appointments (filtered from ${results.length} records)`);
        return jsonResponse(appointments);
      }

      // Get call analytics report data
      if (url.pathname === '/api/reports/call-analytics' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get effective user ID for workspace context
        const { effectiveUserId } = await getEffectiveUserId(env, userId);

        // Get date range from query params (default: last 30 days)
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');
        
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        
        // Start timestamp: beginning of the day (00:00:00)
        const startTimestamp = fromDate ? Math.floor(new Date(fromDate).getTime() / 1000) : thirtyDaysAgo;
        
        // End timestamp: end of the day (23:59:59) to include all calls on that day
        const endTimestamp = toDate ? Math.floor(new Date(toDate + 'T23:59:59Z').getTime() / 1000) : now;

        // Fetch all calls in date range
        const { results: allCalls } = await env.DB.prepare(
          `SELECT
            wc.id,
            wc.vapi_call_id,
            wc.phone_number,
            wc.customer_number,
            wc.customer_name,
            wc.raw_payload,
            wc.structured_data,
            wc.created_at,
            wc.ended_reason
          FROM webhook_calls wc
          WHERE wc.user_id = ?
            AND wc.created_at >= ?
            AND wc.created_at <= ?
          ORDER BY wc.created_at DESC`
        ).bind(effectiveUserId, startTimestamp, endTimestamp).all();

        console.log(`[Report API] Found ${allCalls?.length || 0} calls in date range`);

        // Initialize metrics
        let totalCalls = allCalls?.length || 0;
        let answeredCalls = 0;
        let missedCalls = 0;
        let forwardedCalls = 0;
        let voicemailCalls = 0;
        let totalMinutes = 0;
        let appointmentsBooked = 0;
        let inboundCalls = 0;
        let outboundCalls = 0;
        const endedReasons: Record<string, number> = {};
        const appointmentsList: any[] = [];

        // Process each call
        (allCalls || []).forEach((call: any) => {
          try {
            const rawPayload = call.raw_payload ? JSON.parse(call.raw_payload) : null;
            const message = rawPayload?.message || {};

            // Extract call status
            const status = message.status || 'unknown';
            const endedReason = message.endedReason || call.ended_reason || 'unknown';

            // Count call type (inbound vs outbound)
            const callType = message?.call?.type;
            if (callType === 'inboundPhoneCall') {
              inboundCalls++;
            } else if (callType === 'outboundPhoneCall') {
              outboundCalls++;
            }

            // Count ended reasons
            endedReasons[endedReason] = (endedReasons[endedReason] || 0) + 1;
            
            // Calculate duration
            const startedAt = message.startedAt ? new Date(message.startedAt).getTime() : 0;
            const endedAt = message.endedAt ? new Date(message.endedAt).getTime() : 0;
            const durationMs = endedAt - startedAt;
            const durationMinutes = durationMs > 0 ? Math.round(durationMs / 1000 / 60) : 0;
            totalMinutes += durationMinutes;
            
            // Get transcript
            const transcript = message.transcript || '';
            const transcriptWords = transcript.trim().split(/\s+/).length;
            
            // Categorize call
            if (status === 'forwarded') {
              forwardedCalls++;
            } else if (endedReason === 'voicemail') {
              voicemailCalls++;
            } else if (status === 'ended' && transcriptWords > 50) {
              // Actual conversation (has meaningful transcript)
              answeredCalls++;
            } else if (endedReason === 'assistant-ended-call' || endedReason === 'customer-ended-call') {
              answeredCalls++;
            } else {
              missedCalls++;
            }
            
            // Check for appointment
            const structuredData = call.structured_data ? JSON.parse(call.structured_data) : {};
            const appointmentDate = structuredData?.['Appointment Date'] || 
                                   structuredData?.['appointment date'] ||
                                   structuredData?.['appointmentDate'];
            const appointmentTime = structuredData?.['Appointment Time'] ||
                                   structuredData?.['appointment time'] ||
                                   structuredData?.['appointmentTime'];
            
            if (appointmentDate && 
                appointmentDate !== 'null' && 
                appointmentDate !== 'N/A' && 
                appointmentDate.trim() !== '') {
              appointmentsBooked++;
              
              // Extract quality score
              const structuredOutputs = message?.analysis?.structuredOutputs ||
                                       message?.artifact?.structuredOutputs || {};
              let qualityScore = null;
              Object.entries(structuredOutputs).forEach(([, value]: [string, any]) => {
                if (typeof value === 'object' && value !== null && 'name' in value && 'result' in value) {
                  const name = value.name.toLowerCase();
                  if (name.includes('quality score') || name.includes('qualityscore')) {
                    qualityScore = typeof value.result === 'number' ? value.result : parseInt(value.result);
                  }
                }
              });
              
              appointmentsList.push({
                id: call.id,
                phone_number: call.customer_number || call.phone_number,
                customer_name: call.customer_name,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                quality_score: qualityScore,
                created_at: call.created_at
              });
            }
          } catch (error) {
            console.error('[Report API] Error processing call:', error);
          }
        });

        // Calculate answer rate (actual conversations / total calls)
        const answerRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;
        
        // Calculate average handling time (total minutes / answered calls)
        const avgHandlingTime = answeredCalls > 0 ? Math.round(totalMinutes / answeredCalls) : 0;
        
        // Format ended reasons for response
        const endedReasonsArray = Object.entries(endedReasons).map(([reason, count]) => ({
          reason,
          count,
          percentage: totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0
        })).sort((a, b) => b.count - a.count);

        const reportData = {
          dateRange: {
            from: new Date(startTimestamp * 1000).toISOString().split('T')[0],
            to: new Date(endTimestamp * 1000).toISOString().split('T')[0]
          },
          summary: {
            totalCalls,
            answeredCalls,
            missedCalls,
            forwardedCalls,
            voicemailCalls,
            answerRate,
            totalMinutes,
            avgHandlingTime,
            appointmentsBooked,
            inboundCalls,
            outboundCalls
          },
          appointments: appointmentsList,
          endedReasons: endedReasonsArray,
          callsByStatus: {
            answered: answeredCalls,
            missed: missedCalls,
            forwarded: forwardedCalls,
            voicemail: voicemailCalls
          }
        };

        console.log(`[Report API] Returning report data:`, {
          totalCalls,
          answeredCalls,
          appointmentsBooked
        });

        return jsonResponse(reportData);
      }

      // Generate demo data for vic@channelautomation.com
      if (url.pathname === '/api/generate-demo-data' && request.method === 'POST') {
        const currentUserId = await getUserFromToken(request, env);
        if (!currentUserId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Use vic's userId for demo data
        const vicUser = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind('vic@channelautomation.com').first() as any;

        if (!vicUser) {
          return jsonResponse({ error: 'Demo account not found' }, 404);
        }

        const userId = vicUser.id;

        // Get or create webhook for this user
        let webhook = await env.DB.prepare(
          'SELECT id FROM webhooks WHERE user_id = ? LIMIT 1'
        ).bind(userId).first() as any;

        if (!webhook) {
          const webhookId = generateId();
          await env.DB.prepare(
            'INSERT INTO webhooks (id, user_id, webhook_url, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
          ).bind(webhookId, userId, `https://api.voice-config.channelautomation.com/webhooks/${webhookId}`, 'Demo Webhook', Date.now(), Date.now()).run();
          webhook = { id: webhookId };
        }

        const timestamp = Date.now();
        const demoCalls = [
          {
            id: 'demo_001_' + timestamp,
            name: 'Sarah Johnson',
            phone: '+14155551234',
            intent: 'Scheduling',
            sentiment: 'Positive',
            outcome: 'Successful',
            summary: 'Customer called to schedule a window replacement consultation. Showed strong interest in energy-efficient options.',
            transcript: 'AI: Thank you for calling EcoView Windows and Doors. This is James. Customer: Hi, this is Sarah Johnson. I am interested in getting some windows replaced. AI: Great! Are you looking for a consultation? Customer: Yes, I am particularly interested in energy-efficient windows. AI: Perfect! Let me schedule that for you.',
            appointmentDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
            appointmentTime: '2:00 PM',
            days_ago: 1
          },
          {
            id: 'demo_002_' + timestamp,
            name: 'Michael Rodriguez',
            phone: '+15035559876',
            intent: 'Information',
            sentiment: 'Neutral',
            outcome: 'Follow-up Required',
            summary: 'Customer inquired about pricing for sliding glass doors. Asked about installation timeline and warranty.',
            transcript: 'AI: Thank you for calling EcoView. This is Alex. Customer: Hi, I am interested in learning about sliding glass doors. Can you tell me about pricing? AI: Our doors range from $2,500 to $8,000. Customer: How long does installation take? AI: Usually one full day. Customer: I need to think about it.',
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 2
          },
          {
            id: 'demo_003_' + timestamp,
            name: 'Jennifer Chen',
            phone: '+12065557890',
            intent: 'Scheduling',
            sentiment: 'Positive',
            outcome: 'Successful',
            summary: 'Existing customer scheduling installation of bay window. Very satisfied with previous service.',
            transcript: 'AI: Thank you for calling EcoView. This is Maria. Customer: Hi Maria, this is Jennifer Chen. I ordered a bay window last month and want to schedule installation. AI: Of course! When works for you? Customer: Thursday morning around 10 AM. AI: Perfect! You are all set.',
            appointmentDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            appointmentTime: '10:00 AM',
            days_ago: 3
          },
          {
            id: 'demo_004_' + timestamp,
            name: 'Robert Martinez',
            phone: '+13105554321',
            intent: 'Support',
            sentiment: 'Negative',
            outcome: 'Follow-up Required',
            summary: 'Customer reported condensation between window panes. Escalated to warranty department.',
            transcript: 'AI: EcoView support. This is Tom. Customer: I have condensation between my window panes. AI: That indicates a seal failure. When were they installed? Customer: About 3 years ago. Is this covered? AI: Yes, fully covered. We will replace at no cost.',
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 4
          },
          {
            id: 'demo_005_' + timestamp,
            name: 'Amanda Foster',
            phone: '+14085556789',
            intent: 'Information',
            sentiment: 'Positive',
            outcome: 'Successful',
            summary: 'Customer asking about French doors. Requested free estimate.',
            transcript: 'AI: Good afternoon! This is Jessica. Customer: Hi! I am looking to replace my patio door with French doors. AI: Yes we offer those! Are you looking for inswing or outswing? Customer: What do you recommend? AI: For patios, outswing is better. Customer: How do I get an estimate? AI: We can schedule a free consultation.',
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 5
          },
          {
            id: 'demo_006_' + timestamp,
            name: 'David Thompson',
            phone: '+16195553456',
            intent: 'Scheduling',
            sentiment: 'Neutral',
            outcome: 'Successful',
            summary: 'Customer rescheduling consultation due to work conflict.',
            transcript: 'AI: Scheduling department. This is Rachel. Customer: I need to reschedule my Wednesday appointment. AI: No problem! When works better? Customer: Friday afternoon around 3:30? AI: Perfect! You are all set for Friday at 3:30.',
            appointmentDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            appointmentTime: '3:30 PM',
            days_ago: 6
          },
          {
            id: 'demo_007_' + timestamp,
            name: 'Lisa Anderson',
            phone: '+14155557777',
            intent: 'Purchase',
            sentiment: 'Positive',
            outcome: 'Successful',
            summary: 'Customer ready for full house window replacement. Placing deposit.',
            transcript: 'AI: Good morning! This is Brandon. Customer: I received my quote last week and I am ready to move forward! AI: Fantastic! Let me process your deposit. Customer: Can I pay with credit card? AI: Absolutely. You are making a great investment!',
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 7
          },
          {
            id: 'demo_008_' + timestamp,
            name: 'James Wilson',
            phone: '+15035558888',
            intent: 'Information',
            sentiment: 'Neutral',
            outcome: 'Follow-up Required',
            summary: 'Customer comparing window brands and prices.',
            transcript: 'AI: Thank you for calling EcoView. This is Sarah. Customer: I am getting quotes from several companies. What brands do you carry? AI: We install Milgard and Pella. Customer: How do your prices compare? AI: We are very competitive. Customer: I am still getting other quotes.',
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 8
          },
          {
            id: 'demo_009_' + timestamp,
            name: 'Patricia Lee',
            phone: '+14085559999',
            intent: 'Support',
            sentiment: 'Positive',
            outcome: 'Successful',
            summary: 'Customer asking about window maintenance. Provided care instructions.',
            transcript: 'AI: Support team. This is Kevin. Customer: I just had windows installed and want to know how to care for them. AI: For glass, use regular cleaner quarterly. For frames, warm soapy water. Customer: What about tracks? AI: Vacuum monthly. Customer: Perfect, thank you!',
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 9
          },
          {
            id: 'demo_010_' + timestamp,
            name: 'Christopher Brown',
            phone: '+16195551111',
            intent: 'Scheduling',
            sentiment: 'Positive',
            outcome: 'Successful',
            summary: 'New customer wants consultation for windows and doors. Motivated buyer.',
            transcript: 'AI: Thank you for calling EcoView! This is Michelle. Customer: I just bought a house and want to replace all windows and the front door. AI: Congratulations! How many windows? Customer: About 15 windows and a nice entry door. AI: Perfect! Thursday at 11 AM work? Customer: Perfect!',
            appointmentDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
            appointmentTime: '11:00 AM',
            days_ago: 10
          }
        ];

        // Insert demo calls
        for (const call of demoCalls) {
          const callTimestamp = timestamp - (call.days_ago * 86400000);
          const rawPayload = JSON.stringify({
            message: {
              artifact: {
                transcript: call.transcript
              }
            }
          });

          await env.DB.prepare(
            `INSERT INTO webhook_calls (
              id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
              recording_url, ended_reason, summary, intent, sentiment, outcome,
              analysis_completed, analyzed_at, customer_name, customer_email,
              appointment_date, appointment_time, appointment_type,
              structured_data, raw_payload, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            call.id,
            webhook.id,
            userId,
            call.id,
            '+18005551234',
            call.phone,
            null, // No recording URL for demo data - use actual recording URLs from real calls
            'customer-ended-call',
            call.summary,
            call.intent,
            call.sentiment,
            call.outcome,
            1,
            Math.floor(callTimestamp / 1000),
            call.name,
            null,
            call.appointmentDate,
            call.appointmentTime,
            call.appointmentDate ? 'Consultation' : null,
            '{}',
            rawPayload,
            Math.floor(callTimestamp / 1000)
          ).run();
        }

        // Invalidate cache
        const cache = new VoiceAICache(env.CACHE);
        await cache.invalidateUserCache(userId);

        return jsonResponse({
          success: true,
          message: `Created ${demoCalls.length} demo calls for vic@channelautomation.com`,
          callsCreated: demoCalls.length
        });
      }

      // Get cache statistics
      if (url.pathname === '/api/cache/stats' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const cache = new VoiceAICache(env.CACHE);
        const stats = await cache.getCacheStats();

        return jsonResponse({
          ...stats,
          ttl: {
            recordings: CACHE_TTL.RECORDINGS,
            callDetails: CACHE_TTL.CALL_DETAILS,
            intentAnalysis: CACHE_TTL.INTENT_ANALYSIS,
            intentSummary: CACHE_TTL.INTENT_SUMMARY,
            enhancedData: CACHE_TTL.ENHANCED_DATA
          }
        });
      }

      // ============================================
      // ADMIN ENDPOINTS
      // ============================================

      // Helper function to check if user is admin
      const checkAdminAccess = async (userId: string | null): Promise<boolean> => {
        if (!userId) return false;
        
        // Get user email to check admin status
        const user = await env.DB.prepare(
          'SELECT email FROM users WHERE id = ?'
        ).bind(userId).first() as any;
        
        if (!user || !user.email) return false;
        
        // Check if email is in admin list (can be configured via env var or hardcoded)
        // For now, check if email contains 'channelautomation.com' or 'admin'
        // Hardcoded admin emails for now (can be moved to env var if needed)
        const adminEmails = 'vic@channelautomation.com'.split(',').map(e => e.trim());
        return adminEmails.some(adminEmail => 
          user.email.toLowerCase() === adminEmail.toLowerCase() || 
          user.email.toLowerCase().includes(adminEmail.toLowerCase())
        );
      };

      // Admin Dashboard Overview
      if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
          return jsonResponse({ error: 'Admin access required' }, 403);
        }

        // Get basic stats
        const totalUsers = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first() as any;
        const totalCalls = await env.DB.prepare('SELECT COUNT(*) as count FROM webhook_calls').first() as any;
        const totalWebhooks = await env.DB.prepare('SELECT COUNT(*) as count FROM webhooks').first() as any;
        const activeCalls = await env.DB.prepare('SELECT COUNT(*) as count FROM active_calls').first() as any;

        // Get recent activity
        const recentUsers = await env.DB.prepare(
          'SELECT id, email, name, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 10'
        ).all();

        return jsonResponse({
          success: true,
          data: {
            overview: {
              totalUsers: totalUsers?.count || 0,
              totalCalls: totalCalls?.count || 0,
              totalWebhooks: totalWebhooks?.count || 0,
              activeCalls: activeCalls?.count || 0,
            },
            recentUsers: (recentUsers.results || []).map((u: any) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              created_at: u.created_at,
              last_login_at: u.last_login_at
            }))
          }
        });
      }

      // Admin - Get all users
      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
          return jsonResponse({ error: 'Admin access required' }, 403);
        }

        const users = await env.DB.prepare(
          'SELECT id, email, name, created_at, last_login_at FROM users ORDER BY created_at DESC'
        ).all();

        return jsonResponse({
          success: true,
          data: users.results || []
        });
      }

      // ============================================
      // PUBLIC DOCUMENTATION ROUTES (No Auth Required)
      // ============================================

      // Serve Salesforce Integration User Guide (Raw Markdown)
      if (url.pathname === '/docs/salesforce-integration' && request.method === 'GET') {
        const markdown = `# Salesforce Integration Guide

## 🎯 What This Integration Does

When you connect Salesforce to your Voice AI Dashboard, every incoming call is automatically logged in Salesforce. Here's what happens:

1. **Search by Phone Number** - We find the existing Lead or Contact in Salesforce using the caller's phone number
2. **Create Call Log** - We create a Task (call log) on that Lead/Contact record with the full call details
3. **Schedule Appointments** - If your Voice AI schedules an appointment during the call, we create an Event (appointment) in Salesforce automatically

**Best Part**: Zero programming required on your Salesforce side - just a simple OAuth connection!

---

## 📋 How It Works

\`\`\`
┌─────────────────────────────────────────────────────────────────────────┐
│                         SALESFORCE INTEGRATION                            │
└─────────────────────────────────────────────────────────────────────────┘

   One-Time Setup                      Automatic (Every Call)
   ==============                      ======================

   ┌──────────────┐                   ┌──────────────────────┐
   │   You Click  │                   │  Customer Calls      │
   │  "Connect    │                   └──────────┬───────────┘
   │ Salesforce"  │                              │
   └──────┬───────┘                              │
          │                                      ▼
          │                          ┌─────────────────────────────┐
          ▼                          │ 1. Search Salesforce        │
   ┌──────────────┐                 │    by Phone Number          │
   │  Salesforce  │                 └─────────────┬───────────────┘
   │  Login Page  │                               │
   │  Opens       │                               │
   └──────┬───────┘                    ┌──────────▼──────────┐
          │                            │ Lead/Contact Found? │
          │                            └──────────┬──────────┘
          ▼                                       │
   ┌──────────────┐                              YES
   │  Click       │                               │
   │  "Allow"     │                               ▼
   └──────┬───────┘                   ┌─────────────────────────────┐
          │                           │ 2. Create Task (Call Log)   │
          │                           │    on that record           │
          ▼                           └─────────────┬───────────────┘
   ┌──────────────┐                               │
   │  ✅ Connected│                               │
   │  Done!       │                    ┌──────────▼──────────┐
   └──────────────┘                    │ Appointment booked? │
                                       └──────────┬──────────┘
                                                  │
                                         ┌────────┴────────┐
                                         │                 │
                                        YES               NO
                                         │                 │
                                         ▼                 ▼
                              ┌──────────────────┐  ┌──────────┐
                              │ 3. Create Event  │  │  Done ✓  │
                              │    (Appointment) │  └──────────┘
                              └──────────────────┘

                                  ✅ All Done!
                          Call log + Appointment in Salesforce

\`\`\`

---

## 🔐 Simple OAuth Connection

### Why This Is Easy

No manual API key copying, no developer console needed. Just click and authorize!

\`\`\`
┌────────────────────────────────────────────────────────────────────────────┐
│                         OAUTH SETUP FLOW                                     │
└────────────────────────────────────────────────────────────────────────────┘

 Your Dashboard              Salesforce               Result
 ==============              ==========               ======

      │                         │                       │
      │  1. Click "Connect      │                       │
      │     Salesforce"         │                       │
      ├────────────────────────►│                       │
      │                         │                       │
      │  2. Popup Opens         │                       │
      │     Login to Salesforce │                       │
      │                         │                       │
      │  3. See Permission      │                       │
      │     Request:            │                       │
      │     "Allow Voice AI     │                       │
      │      to access your     │                       │
      │      data?"             │                       │
      │                         │                       │
      │  4. Click "Allow"       │                       │
      ├────────────────────────►│                       │
      │                         │                       │
      │                         │  5. Authorization     │
      │                         │     Granted           │
      │                         ├──────────────────────►│
      │                         │                       │
      │  6. Connected! ✅       │                       │  ✅ All calls now
      │     Popup Closes        │                       │    auto-log to
      │                         │                       │    Salesforce!
      │◄────────────────────────┼───────────────────────┤
      │                         │                       │

\`\`\`

---

## 🔍 How Phone Number Search Works

We use Salesforce's powerful search to find your Leads and Contacts, even with different phone formats!

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                   PHONE NUMBER SEARCH                            │
└────────────────────────────────────────────────────────────────┘

Incoming Call: +1 (555) 123-4567

Step 1: Clean Phone Number
──────────────────────────
  Remove: +, (, ), -, spaces
  Result: "15551234567"

Step 2: Search Salesforce
─────────────────────────
  Search ALL phone fields in:
  → Leads (Phone, Mobile)
  → Contacts (Phone, Mobile)

  Salesforce automatically matches:
  • "+1 (555) 123-4567"  ✓
  • "555-123-4567"        ✓
  • "5551234567"          ✓
  • "+15551234567"        ✓
  • "(555) 123-4567"      ✓

Step 3: Priority
────────────────
  1. Check Leads first (new prospects)
  2. Then check Contacts (existing customers)
  3. Use first match found

Step 4: Create Call Log
───────────────────────
  Task created on the Lead/Contact
  ✅ Appears in Activity Timeline!

\`\`\`

---

## 📞 Call Logging

Every call creates a Task in Salesforce with complete details:

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│              WHAT GETS LOGGED IN SALESFORCE                      │
└────────────────────────────────────────────────────────────────┘

Lead/Contact: John Smith
Phone: (555) 123-4567

Activity Timeline:
┌─────────────────────────────────────────────────────────────┐
│  ☎️  Task: Inbound Call                                     │
│                                                              │
│      Subject:          Inbound Call                          │
│      Status:           Completed                             │
│      Type:             Call                                  │
│      Call Type:        Inbound                               │
│      Date/Time:        Today at 10:45 AM                     │
│      Duration:         3 min 42 sec                          │
│                                                              │
│      Description:      [Full call summary from Voice AI]    │
│                       Customer inquired about premium        │
│                       service. Interested in pricing.        │
│                       Follow-up needed.                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

\`\`\`

---

## 📅 Appointment Scheduling

When your Voice AI schedules an appointment during a call, we automatically create both a call log AND a calendar event!

### How It Works

\`\`\`
┌────────────────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT BOOKING FLOW                                  │
└────────────────────────────────────────────────────────────────────────────┘

  During Call                   After Call Ends           In Salesforce
  ===========                   ===============           =============

      │                              │                         │
      │ Customer:                    │                         │
      │ "I'd like to schedule        │                         │
      │  an appointment for          │                         │
      │  next Monday at 2pm"         │                         │
      │                              │                         │
      │ AI:                          │                         │
      │ "Great! I've booked you      │                         │
      │  for January 15th at         │                         │
      │  2:00 PM"                    │                         │
      │                              │                         │
      │ [Call Ends]                  │                         │
      ├─────────────────────────────►│                         │
      │                              │                         │
      │                              │ 1. Find Lead/Contact    │
      │                              │    by phone             │
      │                              ├────────────────────────►│
      │                              │                         │
      │                              │ 2. Create Task          │
      │                              │    (Call Log) ✓         │
      │                              ├────────────────────────►│
      │                              │                         │
      │                              │ 3. Create Event         │
      │                              │    (Appointment) ✓      │
      │                              ├────────────────────────►│
      │                              │                         │

  Result in Salesforce:
  ────────────────────

  Lead: Sarah Johnson
  └── Activity Timeline
      ├── ✅ Task: "Inbound Call - Scheduled Appointment"
      │   Today at 10:30 AM
      │   Duration: 3 min 45 sec
      │
      └── 📅 Event: "Consultation Appointment"
          Monday, Jan 15 at 2:00 PM - 3:00 PM
          🔔 Reminder: 1 hour before
          Shows in Salesforce Calendar!

\`\`\`

### Task vs Event: What's The Difference?

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                  TASK VS EVENT IN SALESFORCE                     │
└────────────────────────────────────────────────────────────────┘

Task (Call Log)                    Event (Appointment)
===============                    ===================

☎️  Phone Icon                     📅 Calendar Icon

Purpose:                           Purpose:
  Record past activity               Schedule future activity

Status:                            Status:
  Completed ✓                        Scheduled/Planned

Time:                              Time:
  When call happened                 When appointment is

Shows In:                          Shows In:
  • Activity History                 • Activity History
  • Task List                        • Salesforce Calendar
                                     • Outlook/Google Calendar sync

Example:                           Example:
  "Customer called today             "Consultation scheduled for
   about pricing"                     Jan 15 at 2:00 PM"

\`\`\`

### What Gets Captured

When an appointment is booked during a call, we capture:

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│              APPOINTMENT EVENT IN SALESFORCE                     │
└────────────────────────────────────────────────────────────────┘

Event Details:
──────────────
  Subject:       "Consultation Appointment"
  Date:          January 15, 2025
  Start Time:    2:00 PM
  End Time:      3:00 PM (1 hour duration)
  Type:          Meeting
  Status:        Scheduled

  Description:   Appointment scheduled during call.

                 Notes: Bring ID and insurance card

                 Call Summary:
                 Customer called to schedule consultation.
                 Interested in premium service package.

  Reminder:      Set for 1 hour before (1:00 PM)

Visibility:
───────────
  ✓ Shows in Salesforce Activity Timeline
  ✓ Shows in Salesforce Calendar
  ✓ Syncs to Outlook/Google Calendar (if enabled)
  ✓ Rep receives reminder notification

\`\`\`

---

## 🎯 What You See in Salesforce

### Activity Timeline View

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  Lead: Michael Rodriguez                                     │
│  Phone: (555) 987-6543                                       │
│  Company: Tech Solutions Inc.                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Activity Timeline                           [Filter] [Sort] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📅 Upcoming                                                 │
│  ─────────                                                   │
│                                                               │
│  Monday, Jan 15 at 2:00 PM                                   │
│  📅  Consultation Appointment - Scheduled via Voice AI       │
│      Duration: 1 hour (2:00 PM - 3:00 PM)                    │
│      🔔 Reminder set for 1:00 PM                             │
│      [View Details] [Reschedule] [Cancel]                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ Past Activity                                            │
│  ──────────────                                              │
│                                                               │
│  Today at 10:30 AM                                           │
│  ☎️  Inbound Call - Scheduled Appointment                    │
│      Status: Completed                                       │
│      Duration: 3 min 45 sec                                  │
│      Call Type: Inbound                                      │
│                                                               │
│      Description:                                            │
│      Customer called to schedule consultation. Discussed     │
│      premium service options. Very interested. Appointment   │
│      created for next week. Requested reminder to bring ID.  │
│                                                               │
│      [View Full Details]                                     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Jan 10 at 3:15 PM                                           │
│  ☎️  Inbound Call - Information Request                      │
│      Status: Completed                                       │
│      Duration: 2 min 18 sec                                  │
│      ...                                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

\`\`\`

### Calendar View

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  Salesforce Calendar                          January 2025   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Mon 13   Tue 14   Wed 15   Thu 16   Fri 17                 │
│  ───────  ───────  ───────  ───────  ───────                │
│                                                               │
│                     📅 2:00 PM                                │
│                     Consultation                              │
│                     with Michael R.                           │
│                     (Voice AI)                                │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Click event to see:
  • Full appointment details
  • Related Lead/Contact
  • Call notes from booking
  • Reschedule/Cancel options

\`\`\`

---

## ✅ Benefits

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                   WHAT YOU GET                                   │
└────────────────────────────────────────────────────────────────┘

For Sales Reps:
───────────────
  ✓ Complete call history on every Lead/Contact
  ✓ No manual data entry after calls
  ✓ Automatic appointment scheduling
  ✓ Calendar reminders for appointments
  ✓ Full call transcripts and summaries
  ✓ All data in one place (Salesforce)

For Managers:
─────────────
  ✓ Track all inbound calls automatically
  ✓ See which Leads are being contacted
  ✓ Monitor appointment booking rate
  ✓ Complete activity history
  ✓ No missed follow-ups

For Everyone:
─────────────
  ✓ Zero manual work
  ✓ No training needed
  ✓ Works automatically 24/7
  ✓ Sync happens in real-time
  ✓ Nothing to configure after initial setup

\`\`\`

---

## 🔒 Security & Privacy

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                   YOUR DATA IS SAFE                              │
└────────────────────────────────────────────────────────────────┘

Secure OAuth Connection:
────────────────────────
  ✓ Industry-standard OAuth 2.0
  ✓ No API keys to copy/paste
  ✓ You control permissions
  ✓ Can disconnect anytime

What We Access:
───────────────
  ✓ Read Leads (to find by phone)
  ✓ Read Contacts (to find by phone)
  ✓ Create Tasks (to log calls)
  ✓ Create Events (to schedule appointments)

What We DON'T Access:
──────────────────────
  ✗ Cannot delete records
  ✗ Cannot modify existing data
  ✗ No access to other objects
  ✗ No admin permissions
  ✗ Cannot see other users' data

Workspace Isolation:
────────────────────
  ✓ Each workspace has separate connection
  ✓ No cross-workspace data sharing
  ✓ Tokens stored securely server-side
  ✓ Auto-refresh for uninterrupted service

\`\`\`

---

## 🚀 Setup Requirements

### What You Need

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                   SETUP REQUIREMENTS                             │
└────────────────────────────────────────────────────────────────┘

Salesforce Account:
───────────────────
  • Any Salesforce edition (including Professional)
  • User must have:
    → Read access to Leads
    → Read access to Contacts
    → Create access to Tasks
    → Create access to Events
  • NO System Administrator required!
  • NO Developer Console access needed!
  • NO Apex programming required!

Typical User Profiles That Work:
─────────────────────────────────
  ✓ Standard User
  ✓ Sales User
  ✓ Service User
  ✓ Salesforce Platform
  ✓ Any custom profile with object permissions above

Time Required:
──────────────
  • Initial admin setup: 10 minutes (one-time)
  • User connection: 30 seconds (per user)
  • Zero ongoing maintenance!

\`\`\`

---

## 🎓 Setup Process Overview

### For Salesforce Admins (One-Time Setup)

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│              ADMIN SETUP (10 MINUTES, ONE-TIME)                  │
└────────────────────────────────────────────────────────────────┘

Step 1: Create Connected App in Salesforce
──────────────────────────────────────────
  Navigate: Setup → Apps → App Manager → New Connected App

  Fill in:
    • App Name: "Voice AI Dashboard"
    • Contact Email: your@email.com
    • Enable OAuth Settings: ✓
    • Callback URL: (provided by us)
    • OAuth Scopes:
      - Access and manage your data (api)
      - Perform requests at any time (refresh_token)

Step 2: Get Credentials
───────────────────────
  Copy:
    • Consumer Key (Client ID)
    • Consumer Secret (Client Secret)

  Provide these to us for configuration

Step 3: Done!
────────────
  All workspace members can now connect their accounts

\`\`\`

### For Users (30 Seconds)

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                USER CONNECTION (30 SECONDS)                      │
└────────────────────────────────────────────────────────────────┘

Step 1: Go to Integrations
──────────────────────────
  Dashboard → Integrations → Salesforce

Step 2: Click "Connect"
──────────────────────
  Popup window opens to Salesforce

Step 3: Login & Allow
─────────────────────
  • Login to your Salesforce account
  • Review permissions
  • Click "Allow"

Step 4: Done! ✅
───────────────
  Connected! All calls now auto-log to Salesforce.

\`\`\`

---

## 🔄 How Auto-Refresh Works

You never have to reconnect! Our system automatically maintains your connection.

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│              AUTOMATIC CONNECTION MAINTENANCE                    │
└────────────────────────────────────────────────────────────────┘

Initial Connection:
───────────────────
  You: Click "Connect" → Login → Allow
  Result: ✅ Connected

Behind The Scenes:
──────────────────
  • We receive access token (expires in 2 hours)
  • We receive refresh token (never expires)
  • We store both securely

Every Time A Call Comes In:
───────────────────────────
  1. Check if access token is still valid
  2. If expired, automatically refresh it
  3. Use new token to create Task/Event
  4. You never notice any interruption!

You Never Need To:
──────────────────
  ✗ Re-login
  ✗ Re-authorize
  ✗ Manually refresh
  ✗ Enter credentials again

The connection works until:
───────────────────────────
  • You click "Disconnect" in our dashboard
  • You revoke access in Salesforce
  • Admin disables the Connected App

Otherwise: Always connected, always working! ✅

\`\`\`

---

## ❓ Frequently Asked Questions

### General Questions

**Q: Do I need to be a Salesforce Admin?**
A: No! Regular users can connect their own accounts. An admin only needs to do the one-time Connected App setup.

**Q: Will this work with Leads and Contacts?**
A: Yes! We search both Leads and Contacts by phone number and create call logs on whichever one we find.

**Q: What if the phone number isn't in Salesforce?**
A: We'll log a warning but won't create a Task. The call data is still saved in your Voice AI Dashboard.

**Q: Can I disconnect anytime?**
A: Yes! Click "Disconnect" in the Integrations page anytime. Your existing call logs in Salesforce won't be deleted.

### Phone Number Questions

**Q: Do phone formats need to match exactly?**
A: No! Salesforce's search handles different formats automatically:
- \`+1 (555) 123-4567\`
- \`555-123-4567\`
- \`5551234567\`
- All of these will match!

**Q: What if a Lead has multiple phone numbers?**
A: We search Phone AND Mobile Phone fields. If the incoming call matches either, we'll find it.

**Q: Can I test with a specific phone number?**
A: Yes! Use the "Test Sync" button in the integration settings to manually test any phone number.

### Appointment Questions

**Q: How does appointment scheduling work?**
A: If your Voice AI detects and confirms an appointment during the call, we automatically create both:
1. A Task (call log)
2. An Event (appointment on the calendar)

**Q: Can I customize the appointment duration?**
A: Yes! The default is 1 hour, but your Voice AI can specify different durations (30 min, 2 hours, etc.)

**Q: Will the sales rep get reminded?**
A: Yes! We set a reminder for 1 hour before the appointment. Reps will get Salesforce notifications.

**Q: What if the appointment needs to be rescheduled?**
A: The rep can reschedule directly in Salesforce. The Event is a normal Salesforce Event with all standard features.

### Technical Questions

**Q: Does this require Apex code?**
A: No! This is pure OAuth + REST API integration. Zero coding required.

**Q: Will this slow down my calls?**
A: No! The Salesforce sync happens after the call ends, so there's no impact on call quality or speed.

**Q: What Salesforce edition do I need?**
A: Professional Edition or higher. The integration uses standard Salesforce objects (Leads, Contacts, Tasks, Events).

**Q: How long does it take for calls to appear?**
A: Usually within 30 seconds of the call ending. It's near real-time!

---

## 📊 Success Metrics

After connecting Salesforce, you'll see:

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                   MEASURABLE RESULTS                             │
└────────────────────────────────────────────────────────────────┘

Data Quality:
─────────────
  • 100% of calls automatically logged
  • Zero manual data entry
  • Complete call transcripts saved
  • No missed follow-ups

Time Savings:
─────────────
  • ~5 minutes saved per call (no manual logging)
  • ~10 calls/day = 50 minutes saved daily
  • ~250 calls/month = 20+ hours saved monthly!

Sales Performance:
──────────────────
  • Complete Lead activity history
  • Never miss a scheduled appointment
  • Better follow-up rates
  • Improved customer experience

Visibility:
───────────
  • Real-time call tracking
  • Appointment booking metrics
  • Lead engagement scores
  • Full audit trail

\`\`\`

---

## 🎉 Get Started

Ready to connect Salesforce?

1. **Ask your Salesforce Admin** to set up the Connected App (takes 10 minutes)
2. **Go to Integrations** in your Voice AI Dashboard
3. **Click "Connect Salesforce"**
4. **Login and Allow**
5. **Done!** Calls start auto-logging immediately

Need help? Contact our support team anytime!

---

*Last Updated: January 2025*
*Voice AI Dashboard - Salesforce Integration*`;

        return new Response(markdown, {
          status: 200,
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            ...corsHeaders,
          },
        });
      }

      // Serve Salesforce Integration User Guide (HTML)
      if (url.pathname === '/docs/salesforce-integration/html' && request.method === 'GET') {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salesforce Integration Guide - Voice AI Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: #111827;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 0.5rem;
    }

    h2 {
      font-size: 1.875rem;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    h3 {
      font-size: 1.5rem;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      color: #374151;
    }

    p {
      margin-bottom: 1rem;
      color: #4b5563;
    }

    pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    code {
      background: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #e11d48;
    }

    pre code {
      background: transparent;
      padding: 0;
      color: #e5e7eb;
    }

    ul, ol {
      margin: 1rem 0 1rem 2rem;
    }

    li {
      margin-bottom: 0.5rem;
      color: #4b5563;
    }

    strong {
      color: #111827;
      font-weight: 600;
    }

    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2.5rem 0;
    }

    .info-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }

    .success-box {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }

    .warning-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }

    a {
      color: #3b82f6;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .faq-question {
      font-weight: 600;
      color: #111827;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .faq-answer {
      color: #4b5563;
      margin-bottom: 1rem;
      padding-left: 1rem;
    }

    @media (max-width: 768px) {
      .container {
        padding: 20px;
      }

      h1 {
        font-size: 2rem;
      }

      h2 {
        font-size: 1.5rem;
      }

      pre {
        padding: 1rem;
        font-size: 0.75rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Salesforce Integration Guide</h1>

    <h2>🎯 What This Integration Does</h2>
    <p>When you connect Salesforce to your Voice AI Dashboard, every incoming call is automatically logged in Salesforce. Here's what happens:</p>
    <ol>
      <li><strong>Search by Phone Number</strong> - We find the existing Lead or Contact in Salesforce using the caller's phone number</li>
      <li><strong>Create Call Log</strong> - We create a Task (call log) on that Lead/Contact record with the full call details</li>
      <li><strong>Schedule Appointments</strong> - If your Voice AI schedules an appointment during the call, we create an Event (appointment) in Salesforce automatically</li>
    </ol>

    <div class="success-box">
      <strong>Best Part:</strong> Zero programming required on your Salesforce side - just a simple OAuth connection!
    </div>

    <hr>

    <h2>📋 How It Works</h2>
    <pre>
┌─────────────────────────────────────────────────────────────────────────┐
│                         SALESFORCE INTEGRATION                            │
└─────────────────────────────────────────────────────────────────────────┘

   One-Time Setup                      Automatic (Every Call)
   ==============                      ======================

   ┌──────────────┐                   ┌──────────────────────┐
   │   You Click  │                   │  Customer Calls      │
   │  "Connect    │                   └──────────┬───────────┘
   │ Salesforce"  │                              │
   └──────┬───────┘                              │
          │                                      ▼
          │                          ┌─────────────────────────────┐
          ▼                          │ 1. Search Salesforce        │
   ┌──────────────┐                 │    by Phone Number          │
   │  Salesforce  │                 └─────────────┬───────────────┘
   │  Login Page  │                               │
   │  Opens       │                               │
   └──────┬───────┘                    ┌──────────▼──────────┐
          │                            │ Lead/Contact Found? │
          │                            └──────────┬──────────┘
          ▼                                       │
   ┌──────────────┐                              YES
   │  Click       │                               │
   │  "Allow"     │                               ▼
   └──────┬───────┘                   ┌─────────────────────────────┐
          │                           │ 2. Create Task (Call Log)   │
          │                           │    on that record           │
          ▼                           └─────────────┬───────────────┘
   ┌──────────────┐                               │
   │  ✅ Connected│                               │
   │  Done!       │                    ┌──────────▼──────────┐
   └──────────────┘                    │ Appointment booked? │
                                       └──────────┬──────────┘
                                                  │
                                         ┌────────┴────────┐
                                         │                 │
                                        YES               NO
                                         │                 │
                                         ▼                 ▼
                              ┌──────────────────┐  ┌──────────┐
                              │ 3. Create Event  │  │  Done ✓  │
                              │    (Appointment) │  └──────────┘
                              └──────────────────┘

                                  ✅ All Done!
                          Call log + Appointment in Salesforce
    </pre>

    <hr>

    <h2>🔐 Simple OAuth Connection</h2>
    <h3>Why This Is Easy</h3>
    <p>No manual API key copying, no developer console needed. Just click and authorize!</p>
    <pre>
┌────────────────────────────────────────────────────────────────────────────┐
│                         OAUTH SETUP FLOW                                     │
└────────────────────────────────────────────────────────────────────────────┘

 Your Dashboard              Salesforce               Result
 ==============              ==========               ======

      │                         │                       │
      │  1. Click "Connect      │                       │
      │     Salesforce"         │                       │
      ├────────────────────────►│                       │
      │                         │                       │
      │  2. Popup Opens         │                       │
      │     Login to Salesforce │                       │
      │                         │                       │
      │  3. See Permission      │                       │
      │     Request:            │                       │
      │     "Allow Voice AI     │                       │
      │      to access your     │                       │
      │      data?"             │                       │
      │                         │                       │
      │  4. Click "Allow"       │                       │
      ├────────────────────────►│                       │
      │                         │                       │
      │                         │  5. Authorization     │
      │                         │     Granted           │
      │                         ├──────────────────────►│
      │                         │                       │
      │  6. Connected! ✅       │                       │  ✅ All calls now
      │     Popup Closes        │                       │    auto-log to
      │                         │                       │    Salesforce!
      │◄────────────────────────┼───────────────────────┤
      │                         │                       │
    </pre>

    <hr>

    <h2>✅ Benefits</h2>
    <h3>For Sales Reps:</h3>
    <ul>
      <li>Complete call history on every Lead/Contact</li>
      <li>No manual data entry after calls</li>
      <li>Automatic appointment scheduling</li>
      <li>Calendar reminders for appointments</li>
      <li>Full call transcripts and summaries</li>
      <li>All data in one place (Salesforce)</li>
    </ul>

    <h3>For Managers:</h3>
    <ul>
      <li>Track all inbound calls automatically</li>
      <li>See which Leads are being contacted</li>
      <li>Monitor appointment booking rate</li>
      <li>Complete activity history</li>
      <li>No missed follow-ups</li>
    </ul>

    <h3>For Everyone:</h3>
    <ul>
      <li>Zero manual work</li>
      <li>No training needed</li>
      <li>Works automatically 24/7</li>
      <li>Sync happens in real-time</li>
      <li>Nothing to configure after initial setup</li>
    </ul>

    <hr>

    <h2>🔒 Security & Privacy</h2>

    <div class="info-box">
      <h3>Secure OAuth Connection:</h3>
      <ul>
        <li>Industry-standard OAuth 2.0</li>
        <li>No API keys to copy/paste</li>
        <li>You control permissions</li>
        <li>Can disconnect anytime</li>
      </ul>
    </div>

    <h3>What We Access:</h3>
    <ul>
      <li>Read Leads (to find by phone)</li>
      <li>Read Contacts (to find by phone)</li>
      <li>Create Tasks (to log calls)</li>
      <li>Create Events (to schedule appointments)</li>
    </ul>

    <h3>What We DON'T Access:</h3>
    <ul>
      <li>Cannot delete records</li>
      <li>Cannot modify existing data</li>
      <li>No access to other objects</li>
      <li>No admin permissions</li>
      <li>Cannot see other users' data</li>
    </ul>

    <hr>

    <h2>❓ Frequently Asked Questions</h2>

    <h3>General Questions</h3>

    <div class="faq-question">Q: Do I need to be a Salesforce Admin?</div>
    <div class="faq-answer">A: No! Regular users can connect their own accounts. An admin only needs to do the one-time Connected App setup.</div>

    <div class="faq-question">Q: Will this work with Leads and Contacts?</div>
    <div class="faq-answer">A: Yes! We search both Leads and Contacts by phone number and create call logs on whichever one we find.</div>

    <div class="faq-question">Q: What if the phone number isn't in Salesforce?</div>
    <div class="faq-answer">A: We'll log a warning but won't create a Task. The call data is still saved in your Voice AI Dashboard.</div>

    <div class="faq-question">Q: Can I disconnect anytime?</div>
    <div class="faq-answer">A: Yes! Click "Disconnect" in the Integrations page anytime. Your existing call logs in Salesforce won't be deleted.</div>

    <h3>Phone Number Questions</h3>

    <div class="faq-question">Q: Do phone formats need to match exactly?</div>
    <div class="faq-answer">A: No! Salesforce's search handles different formats automatically (e.g., +1 (555) 123-4567, 555-123-4567, 5551234567 - all will match!)</div>

    <div class="faq-question">Q: What if a Lead has multiple phone numbers?</div>
    <div class="faq-answer">A: We search Phone AND Mobile Phone fields. If the incoming call matches either, we'll find it.</div>

    <h3>Appointment Questions</h3>

    <div class="faq-question">Q: How does appointment scheduling work?</div>
    <div class="faq-answer">A: If your Voice AI detects and confirms an appointment during the call, we automatically create both: 1. A Task (call log) 2. An Event (appointment on the calendar)</div>

    <div class="faq-question">Q: Can I customize the appointment duration?</div>
    <div class="faq-answer">A: Yes! The default is 1 hour, but your Voice AI can specify different durations (30 min, 2 hours, etc.)</div>

    <div class="faq-question">Q: Will the sales rep get reminded?</div>
    <div class="faq-answer">A: Yes! We set a reminder for 1 hour before the appointment. Reps will get Salesforce notifications.</div>

    <h3>Technical Questions</h3>

    <div class="faq-question">Q: Does this require Apex code?</div>
    <div class="faq-answer">A: No! This is pure OAuth + REST API integration. Zero coding required.</div>

    <div class="faq-question">Q: Will this slow down my calls?</div>
    <div class="faq-answer">A: No! The Salesforce sync happens after the call ends, so there's no impact on call quality or speed.</div>

    <div class="faq-question">Q: What Salesforce edition do I need?</div>
    <div class="faq-answer">A: Professional Edition or higher. The integration uses standard Salesforce objects (Leads, Contacts, Tasks, Events).</div>

    <div class="faq-question">Q: How long does it take for calls to appear?</div>
    <div class="faq-answer">A: Usually within 30 seconds of the call ending. It's near real-time!</div>

    <hr>

    <h2>🎉 Get Started</h2>
    <p>Ready to connect Salesforce?</p>
    <ol>
      <li><strong>Ask your Salesforce Admin</strong> to set up the Connected App (takes 10 minutes)</li>
      <li><strong>Go to Integrations</strong> in your Voice AI Dashboard</li>
      <li><strong>Click "Connect Salesforce"</strong></li>
      <li><strong>Login and Allow</strong></li>
      <li><strong>Done!</strong> Calls start auto-logging immediately</li>
    </ol>

    <div class="success-box">
      <p><strong>Need help?</strong> Contact our support team anytime!</p>
    </div>

    <hr>

    <p style="text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 3rem;">
      <em>Last Updated: January 2025</em><br>
      <em>Voice AI Dashboard - Salesforce Integration</em>
    </p>
  </div>
</body>
</html>`;

        return new Response(htmlContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
          },
        });
      }

      // ============================================
      // PUBLIC WEBHOOK RECEIVER (No Auth Required)
      // ============================================

      // TwiML endpoint for agent announcement (warm transfer)
      // Plays announcement to agent, then hangs up so customer can be transferred
      if (url.pathname.startsWith('/twiml/agent-announcement/') && (request.method === 'POST' || request.method === 'GET')) {
        const transferId = url.pathname.split('/').pop();
        const announcement = url.searchParams.get('announcement') || 'You have an incoming transfer. The caller will be connected shortly.';
        
        console.log('[TwiML] Agent announcement for transfer:', {
          transferId,
          announcement
        });
        
        const twiml = generateAgentAnnouncementTwiML(announcement);
        
        return new Response(twiml, {
          status: 200,
          headers: {
            'Content-Type': 'text/xml',
            ...corsHeaders,
          },
        });
      }

      // TwiML endpoint for auto-transfer agent announcement
      // Similar to regular warm transfer but for automated transfers triggered by AI
      if (url.pathname.startsWith('/twiml/auto-transfer-announcement/') && (request.method === 'POST' || request.method === 'GET')) {
        const transferId = url.pathname.split('/')[3];
        const announcement = url.searchParams.get('announcement') || 'You have an incoming call. Please stay on the line.';
        const attemptNumber = url.searchParams.get('attempt') || '1';
        
        console.log('[TwiML] Auto-transfer announcement:', {
          transferId,
          attemptNumber,
          announcement
        });
        
        const twiml = generateAgentAnnouncementTwiML(announcement);
        
        return new Response(twiml, {
          status: 200,
          headers: {
            'Content-Type': 'text/xml',
            ...corsHeaders,
          },
        });
      }

      // Webhook for auto-transfer status updates (logging purposes)
      if (url.pathname.startsWith('/webhook/auto-transfer-status/') && request.method === 'POST') {
        const transferId = url.pathname.split('/').pop();
        
        try {
          const formData = await request.formData();
          const callSid = formData.get('CallSid') as string;
          const callStatus = formData.get('CallStatus') as string;
          const from = formData.get('From') as string;
          const to = formData.get('To') as string;
          
          console.log('[Auto Transfer Webhook] Status update:', {
            transferId,
            callSid,
            callStatus,
            from,
            to
          });
          
          // Just log it - the polling in autoDialAgentLoop handles the logic
        } catch (error) {
          console.error('[Auto Transfer Webhook] Error processing status:', error);
        }
        
        return new Response('OK', { status: 200 });
      }

      // TwiML endpoint for conference (kept for potential future use)
      if (url.pathname.startsWith('/twiml/join-conference/') && (request.method === 'POST' || request.method === 'GET')) {
        const conferenceName = url.pathname.split('/').pop();
        
        if (!conferenceName) {
          return new Response('Conference name required', { status: 400 });
        }

        console.log('[TwiML] Conference TwiML:', conferenceName);
        
        const twiml = generateConferenceTwiML(conferenceName);
        
        return new Response(twiml, {
          status: 200,
          headers: {
            'Content-Type': 'text/xml',
            ...corsHeaders,
          },
        });
      }

      // Webhook for agent call status updates (warm transfer)
      // Flow: Agent answers → hears announcement → call completes → customer transferred to agent's phone
      if (url.pathname === '/webhook/agent-call-status' && request.method === 'POST') {
        console.log('');
        console.log('🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
        console.log('[WEBHOOK] AGENT CALL STATUS RECEIVED!');
        console.log('🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
        console.log('');
        try {
          const formData = await request.formData();
          const callSid = formData.get('CallSid') as string;
          const callStatus = formData.get('CallStatus') as string;
          const from = formData.get('From') as string;
          const to = formData.get('To') as string;
          
          console.log('[Warm Transfer] Agent call status:', {
            callSid,
            callStatus,
            from,
            to
          });

          // Find the warm transfer record
          const transfer = await env.DB.prepare(
            `SELECT * FROM warm_transfers WHERE agent_call_sid = ?`
          ).bind(callSid).first() as any;

          if (!transfer) {
            console.log('[Warm Transfer] No transfer found for call:', callSid);
            return new Response('OK', { status: 200 });
          }

          console.log('[Warm Transfer] Found transfer record:', {
            transferId: transfer.id,
            currentStatus: transfer.status,
            agentNumber: transfer.agent_number
          });

          const timestamp = now();

          // Handle different call statuses
          if (callStatus === 'in-progress' || callStatus === 'answered') {
            // Agent answered - they are now hearing the announcement
            // Update status but don't transfer yet - wait for announcement to finish
            await env.DB.prepare(
              `UPDATE warm_transfers SET status = 'agent_answered', updated_at = ? WHERE id = ?`
            ).bind(timestamp, transfer.id).run();

            console.log('[Warm Transfer] Agent answered - hearing announcement:', {
              transferId: transfer.id,
              agentNumber: transfer.agent_number
            });

          } else if (callStatus === 'completed') {
            // Agent call completed (announcement finished)
            // Now transfer the customer to the agent's phone
            console.log('[Warm Transfer] Agent call completed, checking if ready to transfer:', {
              transferId: transfer.id,
              previousStatus: transfer.status
            });

            // Only transfer if agent actually answered (heard the announcement)
            if (transfer.status === 'agent_answered' || transfer.status === 'dialing_agent') {
              console.log('[Warm Transfer] Agent ready - initiating customer transfer');
              
              // Get user's settings
              const settings = await getWorkspaceSettingsForUser(env, transfer.user_id);
              
              if (settings?.private_key) {
                try {
                  // Get VAPI call's controlUrl
                  const getCallResponse = await fetch(`https://api.vapi.ai/call/${transfer.vapi_call_id}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${settings.private_key}` }
                  });

                  if (getCallResponse.ok) {
                    const callDetails = await getCallResponse.json() as any;
                    const controlUrl = callDetails.monitor?.controlUrl;
                    const callStatus = callDetails.status;

                    console.log('[Warm Transfer] VAPI call details:', {
                      vapiCallId: transfer.vapi_call_id,
                      hasControlUrl: !!controlUrl,
                      vapiCallStatus: callStatus
                    });

                    // Check if VAPI call is still active
                    if (callStatus !== 'ended' && controlUrl) {
                      // Transfer the VAPI call to the agent's phone number
                      const transferPayload = {
                        type: 'transfer',
                        destination: {
                          type: 'number',
                          number: transfer.agent_number
                        }
                      };

                      console.log('[Warm Transfer] Sending transfer command to VAPI:', {
                        controlUrl,
                        destination: transfer.agent_number
                      });

                      const transferResponse = await fetch(controlUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(transferPayload)
                      });

                      const transferResult = await transferResponse.text();
                      console.log('[Warm Transfer] VAPI transfer response:', {
                        status: transferResponse.status,
                        ok: transferResponse.ok,
                        result: transferResult
                      });

                      if (transferResponse.ok) {
                        await env.DB.prepare(
                          `UPDATE warm_transfers SET status = 'connected', updated_at = ? WHERE id = ?`
                        ).bind(now(), transfer.id).run();
                        
                        console.log('[Warm Transfer] SUCCESS - Customer being transferred to agent');
                      } else {
                        console.error('[Warm Transfer] VAPI transfer failed:', transferResult);
                        await env.DB.prepare(
                          `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
                        ).bind(`Transfer failed: ${transferResult}`, now(), transfer.id).run();
                      }
                    } else {
                      console.log('[Warm Transfer] VAPI call ended or no controlUrl:', {
                        callStatus,
                        hasControlUrl: !!controlUrl
                      });
                      await env.DB.prepare(
                        `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
                      ).bind('Original call ended before transfer', now(), transfer.id).run();
                    }
                  } else {
                    const error = await getCallResponse.text();
                    console.error('[Warm Transfer] Failed to get VAPI call:', error);
                    await env.DB.prepare(
                      `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
                    ).bind('Could not get call details', now(), transfer.id).run();
                  }
                } catch (e) {
                  console.error('[Warm Transfer] Error during transfer:', e);
                  await env.DB.prepare(
                    `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
                  ).bind(String(e), now(), transfer.id).run();
                }
              } else {
                console.error('[Warm Transfer] No VAPI key configured');
                await env.DB.prepare(
                  `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
                ).bind('VAPI not configured', now(), transfer.id).run();
              }
            } else {
              // Agent call completed but status wasn't agent_answered
              // This might happen if the call was cancelled
              console.log('[Warm Transfer] Call completed but not in expected state:', transfer.status);
              await env.DB.prepare(
                `UPDATE warm_transfers SET status = 'completed', updated_at = ? WHERE id = ?`
              ).bind(timestamp, transfer.id).run();
            }
            
          } else if (callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed' || callStatus === 'canceled') {
            // Agent didn't answer or call failed
            await env.DB.prepare(
              `UPDATE warm_transfers SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
            ).bind(`Agent ${callStatus}`, timestamp, transfer.id).run();
            
            console.log('[Warm Transfer] Agent call failed:', {
              transferId: transfer.id,
              reason: callStatus
            });
          } else if (callStatus === 'ringing' || callStatus === 'initiated' || callStatus === 'queued') {
            // Call still in progress, update status for tracking
            console.log('[Warm Transfer] Call in progress:', callStatus);
          }

          return new Response('OK', { status: 200 });
        } catch (error) {
          console.error('[Warm Transfer] Error processing webhook:', error);
          return new Response('Error', { status: 500 });
        }
      }

      // Webhook for conference status updates (warm transfer)
      if (url.pathname === '/webhook/conference-status' && request.method === 'POST') {
        try {
          const formData = await request.formData();
          const conferenceSid = formData.get('ConferenceSid') as string;
          const statusCallbackEvent = formData.get('StatusCallbackEvent') as string;
          const friendlyName = formData.get('FriendlyName') as string;
          
          console.log('[Warm Transfer] Conference status update:', {
            conferenceSid,
            friendlyName,
            event: statusCallbackEvent
          });

          // We can track conference events here if needed
          // For now, just log them

          return new Response('OK', { status: 200 });
        } catch (error) {
          console.error('[Warm Transfer] Error processing conference status:', error);
          return new Response('Error', { status: 500 });
        }
      }

      // ============================================
      // PUBLIC LEADS WEBHOOK (No Auth Required)
      // ============================================
      
      // Receive leads from external systems via public webhook
      if (url.pathname.startsWith('/webhook/leads/') && request.method === 'POST') {
        const webhookToken = url.pathname.split('/').pop();

        // Validate webhook token exists and is active
        const webhook = await env.DB.prepare(
          'SELECT * FROM lead_webhooks WHERE webhook_token = ? AND is_active = 1'
        ).bind(webhookToken).first() as any;

        if (!webhook) {
          return jsonResponse({ error: 'Invalid or inactive webhook' }, 404);
        }

        // Parse payload
        let payload: any;
        try {
          payload = await request.json();
        } catch (error) {
          return jsonResponse({ error: 'Invalid JSON payload' }, 400);
        }

        const timestamp = now();
        
        // Support both single lead and array of leads
        const leads = Array.isArray(payload) ? payload : [payload];
        
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          
          if (!lead.phone) {
            errorCount++;
            errors.push(`Item ${i + 1}: Phone number is required`);
            continue;
          }

          try {
            const leadId = generateId();
            await env.DB.prepare(
              `INSERT INTO leads (id, workspace_id, firstname, lastname, phone, email, lead_source, product, notes, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              leadId,
              webhook.workspace_id,
              lead.firstname || lead.first_name || null,
              lead.lastname || lead.last_name || null,
              lead.phone,
              lead.email || null,
              lead.lead_source || lead.source || null,
              lead.product || null,
              lead.notes || null,
              'new',
              timestamp,
              timestamp
            ).run();
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`Item ${i + 1}: ${error.message || 'Unknown error'}`);
          }
        }

        console.log(`[Leads Webhook] Received ${leads.length} leads for workspace ${webhook.workspace_id}. Success: ${successCount}, Failed: ${errorCount}`);

        return jsonResponse({
          success: true,
          received: leads.length,
          imported: successCount,
          failed: errorCount,
          errors: errors.length > 0 ? errors.slice(0, 5) : undefined
        });
      }

      // Receive VAPI webhook data
      if (url.pathname.startsWith('/webhook/') && request.method === 'POST') {
        const webhookId = url.pathname.split('/').pop();

        // Validate webhook exists and is active
        const webhook = await env.DB.prepare(
          'SELECT id, user_id FROM webhooks WHERE id = ? AND is_active = 1'
        ).bind(webhookId).first() as any;

        if (!webhook) {
          return jsonResponse({ error: 'Webhook not found or inactive' }, 404);
        }

        // Parse VAPI payload
        let payload: any;
        try {
          payload = await request.json();
        } catch (error) {
          // Log error
          await env.DB.prepare(
            'INSERT INTO webhook_logs (id, webhook_id, status, http_status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            generateId(),
            webhookId,
            'error',
            400,
            'Invalid JSON payload',
            now()
          ).run();

          return jsonResponse({ error: 'Invalid JSON payload' }, 400);
        }

        // Extract fields from VAPI payload
        const message = payload.message || {};
        const messageType = message.type || 'end-of-call-report';
        const call = message.call || {};
        const customer = call.customer || {};
        const phoneNumber = call.phoneNumber || {};
        const artifact = message.artifact || {};
        const analysis = message.analysis || {};

        const timestamp = now();

        // Log incoming webhook for debugging
        console.log('[Webhook Debug] Message Type:', messageType);
        console.log('[Webhook Debug] Call ID:', call.id);
        console.log('[Webhook Debug] Status:', message.status);

        // Handle status-update events (real-time call status)
        if (messageType === 'status-update') {
          const callStatus = message.status; // 'queued', 'ringing', 'in-progress', 'forwarding', 'ended'
          const vapiCallId = call.id;
          const customerNumber = customer.number || null;

          // Track active calls (ringing, in-progress, or forwarding)
          if (callStatus === 'ringing' || callStatus === 'in-progress' || callStatus === 'forwarding') {
            // Enrich caller data with Twilio Lookup
            let twilioData: TwilioCallerInfo | null = null;
            if (customerNumber) {
              try {
                const wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);

                if (wsSettings?.twilio_account_sid && wsSettings?.twilio_auth_token) {
                  twilioData = await lookupCallerWithTwilio(
                    customerNumber,
                    wsSettings.twilio_account_sid,
                    wsSettings.twilio_auth_token,
                    env
                  );
                }
              } catch (error) {
                console.error('Error enriching caller data:', error);
              }
            }

            // Insert or update active call
            await env.DB.prepare(
              `INSERT OR REPLACE INTO active_calls
              (id, user_id, vapi_call_id, customer_number, caller_name, carrier_name, line_type, status, started_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              vapiCallId,
              webhook.user_id,
              vapiCallId,
              customerNumber,
              twilioData?.callerName || null,
              twilioData?.carrierName || null,
              twilioData?.lineType || null,
              callStatus,
              timestamp,
              timestamp
            ).run();

            console.log('[Webhook Debug] Active call inserted/updated:', vapiCallId, 'Status:', callStatus, 'Caller:', twilioData?.callerName || 'Unknown');

            // Notify Durable Object for real-time WebSocket updates
            // Use effectiveUserId (workspace owner) to match the WebSocket connection
            try {
              const { effectiveUserId } = await getEffectiveUserId(env, webhook.user_id);
              const doId = env.ACTIVE_CALLS.idFromName(effectiveUserId);
              const stub = env.ACTIVE_CALLS.get(doId);
              await stub.fetch(new Request('http://do/internal/update-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: vapiCallId,
                  vapi_call_id: vapiCallId,
                  customer_number: customerNumber,
                  caller_name: twilioData?.callerName || null,
                  carrier_name: twilioData?.carrierName || null,
                  line_type: twilioData?.lineType || null,
                  status: callStatus,
                  started_at: timestamp,
                  updated_at: timestamp
                })
              }));
              console.log('[Webhook] Notified Durable Object for user:', effectiveUserId, 'call:', vapiCallId);
            } catch (doError) {
              console.error('[Webhook] Error notifying Durable Object:', doError);
            }

            // Invalidate cache
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);

            // Dispatch call.started event to outbound webhooks (only for ringing status, not in-progress)
            if (callStatus === 'ringing') {
              ctx.waitUntil(
                dispatchToOutboundWebhooks(env, webhook.user_id, 'call.started', {
                  callId: vapiCallId,
                  customerPhone: customerNumber,
                  assistantName: call.assistant?.name || 'AI Assistant',
                })
              );
            }

            // Auto-inject context from Action nodes when call becomes in-progress
            if (callStatus === 'in-progress' && customerNumber) {
              const assistantId = call.assistantId || call.assistant?.id;
              if (assistantId) {
                ctx.waitUntil(
                  injectActionNodeContext(env, assistantId, webhook.user_id, vapiCallId, customerNumber)
                );
              }
            }

            return jsonResponse({ success: true, message: 'Call status updated' });

          } else if (callStatus === 'ended') {
            // Remove from active calls
            await env.DB.prepare(
              'DELETE FROM active_calls WHERE vapi_call_id = ? AND user_id = ?'
            ).bind(vapiCallId, webhook.user_id).run();

            // Notify Durable Object for real-time WebSocket updates
            // Use effectiveUserId (workspace owner) to match the WebSocket connection
            try {
              const { effectiveUserId } = await getEffectiveUserId(env, webhook.user_id);
              const doId = env.ACTIVE_CALLS.idFromName(effectiveUserId);
              const stub = env.ACTIVE_CALLS.get(doId);
              await stub.fetch(new Request('http://do/internal/remove-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callId: vapiCallId })
              }));
              console.log('[Webhook] Notified Durable Object (remove) for user:', effectiveUserId, 'call:', vapiCallId);
            } catch (doError) {
              console.error('[Webhook] Error notifying Durable Object (remove):', doError);
            }

            // Invalidate cache
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);

            return jsonResponse({ success: true, message: 'Call ended, removed from active calls' });
          }

          return jsonResponse({ success: true, message: 'Status update received' });
        }

        // Handle tool-calls events (VAPI function/tool calls)
        if (messageType === 'tool-calls') {
          const toolCalls = message.toolCalls || [];
          const vapiCallId = call.id || null;
          console.log('[Tool Call] ========================================');
          console.log('[Tool Call] Tool calls received:', toolCalls.length);
          console.log('[Tool Call] VAPI Call ID:', vapiCallId);
          console.log('[Tool Call] User ID:', webhook.user_id);

          const results: Array<{ toolCallId: string; result: string }> = [];

          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name;
            const toolCallId = toolCall.id;
            const requestTimestamp = Date.now();

            console.log('[Tool Call] Processing:', { toolName, toolCallId });

            if (toolName === 'lookup_customer') {
              // Parse arguments
              let args: { phone_number?: string } = {};
              try {
                args = typeof toolCall.function?.arguments === 'string'
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function?.arguments || {};
              } catch (e) {
                console.error('[Tool Call] Error parsing arguments:', e);
              }

              const phoneNumber = args.phone_number;
              console.log('[Tool Call] Phone number received:', phoneNumber);

              // Log entry for missing phone number
              if (!phoneNumber) {
                console.log('[Tool Call] ERROR: No phone number provided');
                await logToolCall(env, {
                  userId: webhook.user_id,
                  vapiCallId,
                  toolName,
                  phoneNumber: null,
                  status: 'error',
                  requestTimestamp,
                  errorMessage: 'No phone number provided'
                });
                results.push({
                  toolCallId,
                  result: 'No phone number provided. Please ask the customer for their phone number.'
                });
                continue;
              }

              // Get CustomerConnect settings - first try webhook owner, then find ANY configured user
              let wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);
              let customerConnectOwnerId = webhook.user_id;
              let customerConnectWorkspaceId = wsSettings?.workspace_id;

              // If webhook owner doesn't have CustomerConnect configured, find ANY user who does
              if (!wsSettings?.customerconnect_workspace_id || !wsSettings?.customerconnect_api_key) {
                console.log('[Tool Call] Webhook owner does not have CustomerConnect, searching for configured user...');
                const anyCC = await findAnyCustomerConnectCredentials(env);
                
                if (anyCC) {
                  console.log('[Tool Call] Found CustomerConnect configured for user:', anyCC.userId);
                  // Use the CustomerConnect owner's credentials and ID for logging
                  wsSettings = {
                    ...wsSettings,
                    customerconnect_workspace_id: anyCC.customerconnect_workspace_id,
                    customerconnect_api_key: anyCC.customerconnect_api_key
                  };
                  customerConnectOwnerId = anyCC.userId;
                  customerConnectWorkspaceId = anyCC.workspaceId;
                } else {
                  console.log('[Tool Call] ERROR: No user has CustomerConnect configured');
                  await logToolCall(env, {
                    userId: webhook.user_id,
                    workspaceId: wsSettings?.workspace_id,
                    vapiCallId,
                    toolName,
                    phoneNumber,
                    status: 'not_configured',
                    requestTimestamp,
                    errorMessage: 'CustomerConnect credentials not configured'
                  });
                  results.push({
                    toolCallId,
                    result: 'Customer lookup is not configured. Proceeding without customer history.'
                  });
                  continue;
                }
              }

              console.log('[Tool Call] Calling CustomerConnect API...');
              console.log('[Tool Call] Workspace ID:', wsSettings.customerconnect_workspace_id);
              console.log('[Tool Call] Logging to user:', customerConnectOwnerId);

              // Lookup customer from CustomerConnect API
              const customerData = await lookupCustomerFromCustomerConnect(
                phoneNumber,
                wsSettings.customerconnect_workspace_id,
                wsSettings.customerconnect_api_key
              );

              const responseTimestamp = Date.now();
              const responseTimeMs = responseTimestamp - requestTimestamp;

              if (customerData.found) {
                // Build context message with appointment and household info
                let contextParts: string[] = [];
                
                if (customerData.name) {
                  contextParts.push(`Customer found: ${customerData.name}`);
                }
                
                if (customerData.appointmentDate && customerData.appointmentTime) {
                  contextParts.push(`Existing appointment: ${customerData.appointmentDate} at ${customerData.appointmentTime}`);
                } else if (customerData.appointmentDate) {
                  contextParts.push(`Existing appointment: ${customerData.appointmentDate}`);
                }
                
                if (customerData.household) {
                  contextParts.push(`Household/Decision maker: ${customerData.household}`);
                }

                const resultMessage = contextParts.length > 0
                  ? contextParts.join('. ') + '. Please acknowledge this information naturally in the conversation.'
                  : 'Customer found but no appointment or household information available.';

                console.log('[Tool Call] SUCCESS: Customer found');
                console.log('[Tool Call] Response time:', responseTimeMs, 'ms');
                console.log('[Tool Call] Customer:', customerData.name);
                console.log('[Tool Call] Appointment:', customerData.appointmentDate, customerData.appointmentTime);
                console.log('[Tool Call] Household:', customerData.household);

                // Log successful lookup - use CustomerConnect owner's ID, not webhook owner
                await logToolCall(env, {
                  userId: customerConnectOwnerId,
                  workspaceId: customerConnectWorkspaceId,
                  vapiCallId,
                  toolName,
                  phoneNumber,
                  status: 'success',
                  requestTimestamp,
                  responseTimestamp,
                  responseTimeMs,
                  customerName: customerData.name,
                  appointmentDate: customerData.appointmentDate,
                  appointmentTime: customerData.appointmentTime,
                  household: customerData.household
                });

                results.push({
                  toolCallId,
                  result: resultMessage
                });
              } else {
                console.log('[Tool Call] NOT FOUND: No customer record');
                console.log('[Tool Call] Response time:', responseTimeMs, 'ms');

                // Log not found - use CustomerConnect owner's ID, not webhook owner
                await logToolCall(env, {
                  userId: customerConnectOwnerId,
                  workspaceId: customerConnectWorkspaceId,
                  vapiCallId,
                  toolName,
                  phoneNumber,
                  status: 'not_found',
                  requestTimestamp,
                  responseTimestamp,
                  responseTimeMs
                });

                results.push({
                  toolCallId,
                  result: 'No existing customer record found for this phone number. This appears to be a new customer.'
                });
              }
            } else if (toolName === 'transfer_to_sales') {
              // Auto warm transfer - AI detected sales opportunity
              console.log('[Tool Call] TRANSFER TO SALES triggered');

              // Parse arguments
              let args: { reason?: string } = {};
              try {
                args = typeof toolCall.function?.arguments === 'string'
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function?.arguments || {};
              } catch (e) {
                console.error('[Tool Call] Error parsing transfer arguments:', e);
              }

              const transferReason = args.reason || 'Customer showed buying intent';
              const assistantId = call.assistantId || call.assistant?.id;

              console.log('[Tool Call] Transfer reason:', transferReason);
              console.log('[Tool Call] Assistant ID:', assistantId);

              if (!assistantId) {
                console.log('[Tool Call] ERROR: No assistant ID available');
                results.push({
                  toolCallId,
                  result: 'I apologize, but I cannot transfer you at this time. Let me continue to assist you.'
                });
                continue;
              }

              // Get effective user ID for the webhook owner
              const { effectiveUserId } = await getEffectiveUserId(env, webhook.user_id);

              // Check if auto-transfer is enabled for this assistant
              const transferSettings = await env.DB.prepare(
                `SELECT * FROM assistant_transfer_settings WHERE assistant_id = ? AND user_id = ?`
              ).bind(assistantId, effectiveUserId).first() as any;

              if (!transferSettings || !transferSettings.enabled) {
                console.log('[Tool Call] Auto-transfer not enabled for assistant:', assistantId);
                results.push({
                  toolCallId,
                  result: 'Auto-transfer is not enabled. I will continue to assist you directly.'
                });
                continue;
              }

              // Get agent list for this assistant
              const { results: agents } = await env.DB.prepare(
                `SELECT * FROM assistant_transfer_agents 
                 WHERE assistant_id = ? AND user_id = ? AND is_active = 1
                 ORDER BY priority ASC`
              ).bind(assistantId, effectiveUserId).all() as any;

              if (!agents || agents.length === 0) {
                console.log('[Tool Call] No agents configured for assistant:', assistantId);
                results.push({
                  toolCallId,
                  result: 'No specialists are available at this time. Let me continue to help you and I can have someone call you back.'
                });
                continue;
              }

              console.log('[Tool Call] Found', agents.length, 'agents for transfer');

              // Get workspace settings for Twilio/VAPI credentials
              const wsSettings = await getWorkspaceSettingsForUser(env, effectiveUserId);

              if (!wsSettings?.private_key || !wsSettings?.twilio_account_sid || !wsSettings?.twilio_auth_token) {
                console.log('[Tool Call] Missing credentials for auto-transfer');
                results.push({
                  toolCallId,
                  result: 'I cannot connect you to a specialist right now. Let me continue to assist you.'
                });
                continue;
              }

              // Get a Twilio phone number from the user's account
              let twilioPhoneNumber: string | null = null;
              try {
                const twilioResponse = await fetch(
                  `https://api.twilio.com/2010-04-01/Accounts/${wsSettings.twilio_account_sid}/IncomingPhoneNumbers.json?PageSize=1`,
                  {
                    method: 'GET',
                    headers: {
                      'Authorization': 'Basic ' + btoa(`${wsSettings.twilio_account_sid}:${wsSettings.twilio_auth_token}`)
                    }
                  }
                );
                if (twilioResponse.ok) {
                  const data = await twilioResponse.json() as any;
                  if (data.incoming_phone_numbers?.length > 0) {
                    twilioPhoneNumber = data.incoming_phone_numbers[0].phone_number;
                  }
                }
              } catch (e) {
                console.error('[Tool Call] Failed to get Twilio number:', e);
              }

              if (!twilioPhoneNumber) {
                console.log('[Tool Call] No Twilio phone number available');
                results.push({
                  toolCallId,
                  result: 'I cannot transfer you at this moment. Let me continue to assist you directly.'
                });
                continue;
              }

              // Generate transfer ID for tracking
              const transferId = generateId();
              const timestamp = now();

              // Start auto-dial loop in background (don't block the response)
              ctx.waitUntil(
                autoDialAgentLoop(env, {
                  transferId,
                  vapiCallId: vapiCallId!,
                  assistantId,
                  userId: effectiveUserId,
                  agents,
                  transferSettings,
                  twilioConfig: {
                    accountSid: wsSettings.twilio_account_sid,
                    authToken: wsSettings.twilio_auth_token,
                    workerUrl: url.origin,
                    twilioPhoneNumber
                  },
                  vapiPrivateKey: wsSettings.private_key,
                  reason: transferReason
                })
              );

              console.log('[Tool Call] Auto-dial loop started in background, transfer ID:', transferId);

              // Return immediate response for AI to say
              results.push({
                toolCallId,
                result: 'Great! Let me connect you with one of our specialists who can help you further. One moment please while I find someone available.'
              });
            } else {
              // Unknown tool - return empty result
              console.log('[Tool Call] Unknown tool:', toolName);
              results.push({
                toolCallId,
                result: 'Tool not implemented.'
              });
            }
          }

          console.log('[Tool Call] ========================================');

          // Return results to VAPI
          return jsonResponse({ results });
        }

        // IMPORTANT: Only process end-of-call-report events for call records
        // Other event types (speech-update, conversation-update, assistant.started, hang, etc.)
        // should NOT create call records - they are mid-call events that would inflate metrics
        if (messageType !== 'end-of-call-report') {
          console.log(`[Webhook] Ignoring non-end-of-call event: ${messageType} for call ${call.id || 'unknown'}`);
          return jsonResponse({ success: true, message: `Event type ${messageType} acknowledged` });
        }

        // Handle end-of-call-report (existing logic)
        const callId = generateId();

        // Enrich caller data with Twilio Lookup (if configured)
        let twilioData: TwilioCallerInfo | null = null;
        const customerNumber = customer.number || null;

        if (customerNumber) {
          try {
            const wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);

            if (wsSettings?.twilio_account_sid && wsSettings?.twilio_auth_token) {
              twilioData = await lookupCallerWithTwilio(
                customerNumber,
                wsSettings.twilio_account_sid,
                wsSettings.twilio_auth_token,
                env
              );
            }
          } catch (error) {
            console.error('Error enriching caller data with Twilio:', error);
          }
        }

        // Filter out test calls - skip saving if there's no customer number
        if (!customerNumber) {
          console.log('[Webhook] Skipping test call - no customer number present');
          return jsonResponse({ success: true, message: 'Test call ignored (no customer number)' });
        }

        // Calculate duration - check multiple locations in payload
        let durationSeconds: number | null = null;

        // First, try to use durationSeconds directly from message
        if (message.durationSeconds) {
          durationSeconds = Math.floor(message.durationSeconds);
        }
        // Fallback: try message.startedAt and message.endedAt (actual payload structure)
        else if (message.startedAt && message.endedAt) {
          try {
            const startTime = new Date(message.startedAt).getTime();
            const endTime = new Date(message.endedAt).getTime();
            durationSeconds = Math.floor((endTime - startTime) / 1000); // Convert to seconds
          } catch (error) {
            console.error('Error calculating call duration from message timestamps:', error);
          }
        }
        // Last fallback: try call.startedAt and call.endedAt (older structure)
        else if (call.startedAt && call.endedAt) {
          try {
            const startTime = new Date(call.startedAt).getTime();
            const endTime = new Date(call.endedAt).getTime();
            durationSeconds = Math.floor((endTime - startTime) / 1000); // Convert to seconds
          } catch (error) {
            console.error('Error calculating call duration from call timestamps:', error);
          }
        }

        // Store call data
        try {
          await env.DB.prepare(
            `INSERT INTO webhook_calls (
              id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
              recording_url, ended_reason, summary, structured_data, raw_payload, created_at,
              caller_name, caller_type, carrier_name, line_type, duration_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            callId,
            webhookId,
            webhook.user_id,
            call.id || null,
            phoneNumber.number || null,  // AI agent's phone number
            customer.number || null,      // Customer's phone number
            message.recordingUrl || artifact.recordingUrl || null,
            message.endedReason || call.endedReason || 'unknown',
            analysis.summary || message.summary || '',
            JSON.stringify(analysis.structuredData || {}),
            JSON.stringify(payload),
            timestamp,
            twilioData?.callerName || null,
            twilioData?.callerType || null,
            twilioData?.carrierName || null,
            twilioData?.lineType || null,
            durationSeconds
          ).run();

          // Log success
          await env.DB.prepare(
            'INSERT INTO webhook_logs (id, webhook_id, status, http_status, payload_size, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            generateId(),
            webhookId,
            'success',
            200,
            JSON.stringify(payload).length,
            timestamp
          ).run();

          // Invalidate user cache for new data
          const cache = new VoiceAICache(env.CACHE);
          await cache.invalidateUserCache(webhook.user_id);

          // IMPORTANT: Clean up active_calls as a safety net
          // Sometimes the status-update:ended event may not be received or processed
          // This ensures the call is removed from active calls when end-of-call-report is received
          const vapiCallId = call.id;
          if (vapiCallId) {
            try {
              await env.DB.prepare(
                'DELETE FROM active_calls WHERE vapi_call_id = ? AND user_id = ?'
              ).bind(vapiCallId, webhook.user_id).run();
              console.log('[Webhook] Cleaned up active call (end-of-call-report):', vapiCallId);

              // Notify Durable Object for real-time WebSocket updates
              const { effectiveUserId } = await getEffectiveUserId(env, webhook.user_id);
              const doId = env.ACTIVE_CALLS.idFromName(effectiveUserId);
              const stub = env.ACTIVE_CALLS.get(doId);
              await stub.fetch(new Request('http://do/internal/remove-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callId: vapiCallId })
              }));
              console.log('[Webhook] Notified Durable Object (remove via end-of-call-report) for user:', effectiveUserId);
            } catch (cleanupError) {
              console.error('[Webhook] Error cleaning up active call:', cleanupError);
              // Don't fail the webhook for cleanup errors
            }
          }

          // Dispatch to outbound webhooks in the background (call.ended event)
          ctx.waitUntil(
            dispatchToOutboundWebhooks(env, webhook.user_id, 'call.ended', {
              callId: call.id || callId,
              customerPhone: customer.number,
              assistantName: message.assistant?.name || call.assistant?.name || 'AI Assistant',
              durationSeconds,
              endedReason: message.endedReason || call.endedReason || 'unknown',
              summary: analysis.summary || message.summary || '',
              structuredData: analysis.structuredData || {},
              rawPayload: payload,
              recordingUrl: message.recordingUrl || artifact.recordingUrl || null,
            })
          );

          // Update campaign stats if this call was part of a campaign
          if (vapiCallId) {
            try {
              // Check if this call was from a campaign
              const campaignLead = await env.DB.prepare(
                'SELECT cl.id, cl.campaign_id FROM campaign_leads cl WHERE cl.vapi_call_id = ?'
              ).bind(vapiCallId).first() as any;

              if (campaignLead) {
                console.log(`[Campaign] Call ${vapiCallId} is from campaign ${campaignLead.campaign_id}`);
                
                // Determine call outcome based on duration and ended reason
                const endedReason = message.endedReason || call.endedReason || 'unknown';
                const wasAnswered = durationSeconds > 0 && !['no-answer', 'busy', 'failed', 'canceled'].includes(endedReason);
                const callOutcome = wasAnswered ? 'answered' : endedReason;

                // Update campaign_leads with call outcome
                await env.DB.prepare(
                  `UPDATE campaign_leads 
                   SET call_status = 'completed', 
                       call_duration = ?, 
                       call_outcome = ?,
                       call_summary = ?
                   WHERE id = ?`
                ).bind(
                  durationSeconds,
                  callOutcome,
                  analysis.summary || message.summary || null,
                  campaignLead.id
                ).run();

                // Update campaign stats
                if (wasAnswered) {
                  await env.DB.prepare(
                    'UPDATE campaigns SET calls_answered = calls_answered + 1, updated_at = ? WHERE id = ?'
                  ).bind(now(), campaignLead.campaign_id).run();
                  console.log(`[Campaign] Updated calls_answered for campaign ${campaignLead.campaign_id}`);
                }
              }
            } catch (campaignError) {
              console.error('[Campaign] Error updating campaign stats:', campaignError);
              // Don't fail webhook for campaign tracking errors
            }
          }

          // Trigger OpenAI analysis and addons in the background (don't wait for them)
          ctx.waitUntil(
            (async () => {
              try {
                // First, extract appointment data from VAPI's structured data
                const structuredData = analysis.structuredData || {};
                let vapiAppointmentDate = structuredData.appointmentDate || structuredData.appointment_date || null;
                let vapiAppointmentTime = structuredData.appointmentTime || structuredData.appointment_time || null;
                let vapiAppointmentType = structuredData.appointmentType || structuredData.appointment_type || null;
                let vapiCustomerName = structuredData.customerName || structuredData.customer_name || null;
                let vapiCustomerEmail = structuredData.customerEmail || structuredData.customer_email || null;

                // Get workspace OpenAI API key
                const wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);

                if (wsSettings?.openai_api_key) {
                  const transcript = artifact.transcript || '';
                  const summary = analysis.summary || message.summary || '';

                  // Analyze with OpenAI
                  const analysisResult = await analyzeCallWithOpenAI(
                    summary,
                    transcript,
                    wsSettings.openai_api_key
                  );

                  if (analysisResult) {
                    // Extract and store keywords from transcript with sentiment
                    if (transcript) {
                      const keywords = extractKeywords(transcript);
                      await storeKeywords(keywords, webhook.user_id, analysisResult.sentiment, env.DB);
                    }
                    // Prioritize VAPI structured data over OpenAI analysis for appointments
                    const finalAppointmentDate = vapiAppointmentDate || analysisResult.appointment_date;
                    const finalAppointmentTime = vapiAppointmentTime || analysisResult.appointment_time;
                    const finalAppointmentType = vapiAppointmentType || analysisResult.appointment_type;
                    const finalCustomerName = vapiCustomerName || analysisResult.customer_name;
                    const finalCustomerEmail = vapiCustomerEmail || analysisResult.customer_email;

                    // Calculate appointment_datetime if both date and time are present
                    let appointmentDatetime: number | null = null;
                    if (finalAppointmentDate && finalAppointmentTime) {
                      try {
                        const dateTimeStr = `${finalAppointmentDate} ${finalAppointmentTime}`;
                        appointmentDatetime = Math.floor(new Date(dateTimeStr).getTime() / 1000);
                      } catch (e) {
                        console.error('Error parsing appointment datetime:', e);
                      }
                    }

                    // Update call with analysis results
                    await env.DB.prepare(
                      `UPDATE webhook_calls
                       SET intent = ?, sentiment = ?, outcome = ?,
                           customer_name = ?, customer_email = ?,
                           appointment_date = ?, appointment_time = ?, appointment_datetime = ?,
                           appointment_type = ?, appointment_notes = ?,
                           analysis_completed = 1, analyzed_at = ?
                       WHERE id = ?`
                    ).bind(
                      analysisResult.intent,
                      analysisResult.sentiment,
                      analysisResult.outcome,
                      finalCustomerName,
                      finalCustomerEmail,
                      finalAppointmentDate,
                      finalAppointmentTime,
                      appointmentDatetime,
                      finalAppointmentType,
                      analysisResult.appointment_notes,
                      now(),
                      callId
                    ).run();

                    // Invalidate cache for this specific call since analysis is now complete
                    const cache = new VoiceAICache(env.CACHE);
                    await cache.invalidateCallCache(webhook.user_id, callId);

                    // Trigger Scheduling Webhook if appointment was booked
                    if (analysisResult.intent === 'Scheduling' && finalAppointmentDate && finalAppointmentTime) {
                      await triggerSchedulingWebhook(env, webhook.user_id, callId);
                    }
                  }
                } else if (vapiAppointmentDate && vapiAppointmentTime) {
                  // No OpenAI API key, but we have VAPI appointment data
                  let appointmentDatetime: number | null = null;
                  try {
                    const dateTimeStr = `${vapiAppointmentDate} ${vapiAppointmentTime}`;
                    appointmentDatetime = Math.floor(new Date(dateTimeStr).getTime() / 1000);
                  } catch (e) {
                    console.error('Error parsing appointment datetime:', e);
                  }

                  // Update call with VAPI appointment data only
                  await env.DB.prepare(
                    `UPDATE webhook_calls
                     SET customer_name = ?, customer_email = ?,
                         appointment_date = ?, appointment_time = ?, appointment_datetime = ?,
                         appointment_type = ?,
                         analysis_completed = 1, analyzed_at = ?
                     WHERE id = ?`
                  ).bind(
                    vapiCustomerName,
                    vapiCustomerEmail,
                    vapiAppointmentDate,
                    vapiAppointmentTime,
                    appointmentDatetime,
                    vapiAppointmentType,
                    now(),
                    callId
                  ).run();

                  // Invalidate cache
                  const cache = new VoiceAICache(env.CACHE);
                  await cache.invalidateCallCache(webhook.user_id, callId);

                  // Trigger Scheduling Webhook
                  await triggerSchedulingWebhook(env, webhook.user_id, callId);
                }

                // Process addons (Enhanced Data, etc.)
                await processAddonsForCall(
                  env,
                  webhook.user_id,
                  callId,
                  customer.number
                );

                // Define hasSummary once for both HubSpot and Dynamics sync
                const hasSummary = analysis?.summary || message.summary;

                // Sync to HubSpot if connected
                try {
                  const hubspotTokens = await env.DB.prepare(
                    'SELECT access_token FROM hubspot_oauth_tokens WHERE workspace_id = ? LIMIT 1'
                  ).bind(wsSettings?.workspace_id).first() as any;

                  if (hubspotTokens && customer.number && hasSummary) {
                    console.log('[HubSpot] Syncing call to HubSpot...');

                    // Extract conversation from artifact messages
                    const messages = artifact?.messages || [];
                    const conversation = messages
                      .filter((msg: any) => msg.role === 'user' || msg.role === 'bot' || msg.role === 'assistant')
                      .map((msg: any) => ({
                        role: msg.role === 'bot' ? 'assistant' : msg.role,
                        message: msg.message || msg.content || '',
                      }));

                    // Extract structured outputs (VAPI format)
                    const structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || null;

                    await syncCallToHubSpot(
                      env.DB,
                      webhook.user_id,
                      wsSettings?.workspace_id || '',
                      callId,
                      {
                        phoneNumber: customer.number,
                        summary: analysis?.summary || message.summary || '',
                        structuredData: analysis?.structuredData || {},
                        conversation,
                        structuredOutputs,
                      },
                      env
                    );
                  } else {
                    console.log('[HubSpot] Skipping sync - missing required data:', {
                      hasTokens: !!hubspotTokens,
                      hasPhone: !!customer.number,
                      hasSummary,
                    });
                  }
                } catch (hubspotError) {
                  console.error('[HubSpot] Sync error:', hubspotError);
                  // Don't fail the webhook if HubSpot sync fails
                }

                // ============================================
                // DYNAMICS 365 SYNC
                // ============================================
                try {
                  console.log('[Dynamics 365] Starting sync check...', {
                    workspaceId: wsSettings?.workspace_id,
                    customerNumber: customer.number,
                    hasSummary,
                  });

                  // Check if Dynamics 365 is connected
                  const dynamicsSettings = await env.DB.prepare(
                    'SELECT dynamics_access_token, dynamics_refresh_token, dynamics_token_expires_at, dynamics_instance_url FROM workspace_settings WHERE workspace_id = ?'
                  ).bind(wsSettings?.workspace_id || '').first();

                  console.log('[Dynamics 365] Settings check:', {
                    hasSettings: !!dynamicsSettings,
                    hasAccessToken: !!(dynamicsSettings && dynamicsSettings.dynamics_access_token),
                    hasRefreshToken: !!(dynamicsSettings && dynamicsSettings.dynamics_refresh_token),
                  });

                  const hasDynamicsTokens = dynamicsSettings && dynamicsSettings.dynamics_access_token && dynamicsSettings.dynamics_refresh_token;

                  if (hasDynamicsTokens && customer.number && hasSummary) {
                    console.log('[Dynamics 365] All checks passed, syncing call to Dynamics 365...');

                    // Parse appointment data if available
                    let appointmentData = null;
                    const structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || null;

                    if (structuredOutputs && typeof structuredOutputs === 'object') {
                      // Check for appointment in various possible locations
                      const appointment =
                        structuredOutputs.appointment ||
                        structuredOutputs.scheduled_appointment ||
                        structuredOutputs.appointmentDetails;

                      if (appointment && appointment.date && appointment.time) {
                        appointmentData = {
                          date: appointment.date,
                          time: appointment.time,
                          type: appointment.type || appointment.appointmentType || 'Call',
                          notes: appointment.notes || appointment.description || '',
                          duration: appointment.duration || 60, // Default 60 minutes
                        };
                      }
                    }

                    await syncCallToDynamics(
                      env.DB,
                      wsSettings?.workspace_id || '',
                      callId,
                      {
                        phoneNumber: customer.number,
                        duration: Math.floor(call.duration || 0),
                        summary: analysis?.summary || message.summary || '',
                        callType: call.type === 'outboundPhoneCall' ? 'outbound' : 'inbound',
                        callStartTime: call.startedAt || new Date().toISOString(),
                        appointmentData,
                      },
                      env
                    );
                  } else {
                    console.log('[Dynamics 365] Skipping sync - missing required data:', {
                      hasTokens: !!hasDynamicsTokens,
                      hasPhone: !!customer.number,
                      hasSummary,
                    });
                  }
                } catch (dynamicsError) {
                  console.error('[Dynamics 365] Sync error:', dynamicsError);
                  // Don't fail the webhook if Dynamics sync fails
                }
              } catch (error) {
                console.error('Background processing error:', error);
              }
            })()
          );

          return jsonResponse({
            received: true,
            call_id: callId
          });

        } catch (error: any) {
          // Log error
          await env.DB.prepare(
            'INSERT INTO webhook_logs (id, webhook_id, status, http_status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            generateId(),
            webhookId,
            'error',
            500,
            error.message || 'Database error',
            timestamp
          ).run();

          return jsonResponse({ error: 'Failed to store call data' }, 500);
        }
      }

      // API Proxy - allows frontend to make API calls through backend (avoids CORS)
      if (url.pathname === '/api/proxy' && request.method === 'POST') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        try {
          const body = await request.json() as {
            url: string;
            method?: string;
            headers?: Record<string, string>;
            body?: any;
          };

          if (!body.url) {
            return jsonResponse({ error: 'URL is required' }, 400);
          }

          // Make the proxied request
          const proxyHeaders: Record<string, string> = {
            ...body.headers
          };

          const proxyOptions: RequestInit = {
            method: body.method || 'GET',
            headers: proxyHeaders,
          };

          if (body.body && body.method !== 'GET') {
            proxyOptions.body = JSON.stringify(body.body);
          }

          console.log('[API Proxy] Forwarding request to:', body.url);
          
          const proxyResponse = await fetch(body.url, proxyOptions);
          
          // Try to parse as JSON, fall back to text
          let responseData;
          const contentType = proxyResponse.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            responseData = await proxyResponse.json();
          } else {
            responseData = await proxyResponse.text();
          }

          return jsonResponse({
            status: proxyResponse.status,
            statusText: proxyResponse.statusText,
            data: responseData
          }, proxyResponse.ok ? 200 : proxyResponse.status);
        } catch (error: any) {
          console.error('[API Proxy] Error:', error);
          return jsonResponse({ 
            error: error.message || 'Proxy request failed',
            status: 500
          }, 500);
        }
      }

      // Default 404
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error: any) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
  },

  /**
   * Scheduled handler for cleanup jobs
   * Runs every 6 hours to clean up stale active calls
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Scheduled] Running cleanup job at:', new Date(event.scheduledTime).toISOString());

    try {
      // Clean up active calls older than 24 hours
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

      const result = await env.DB.prepare(
        `DELETE FROM active_calls WHERE updated_at < ?`
      ).bind(twentyFourHoursAgo).run();

      console.log('[Scheduled] Cleanup complete:', {
        deletedCalls: result.meta.changes,
        threshold: new Date(twentyFourHoursAgo * 1000).toISOString()
      });
    } catch (error) {
      console.error('[Scheduled] Cleanup job failed:', error);
    }
  },
};
