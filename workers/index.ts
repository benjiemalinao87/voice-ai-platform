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
  generateSalt
} from './auth';
import { VoiceAICache, CACHE_TTL } from './cache';

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

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  JWT_SECRET: string; // Set this in wrangler.toml as a secret
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  twilioAuthToken: string
): Promise<TwilioCallerInfo | null> {
  try {
    // Twilio Lookup API requires phone number in E.164 format (+1234567890)
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

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

    return {
      callerName: data.caller_name?.caller_name || null,
      callerType: data.caller_name?.caller_type || null,
      carrierName: data.line_type_intelligence?.carrier_name || null,
      lineType: data.line_type_intelligence?.type || null
    };
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

// Helper: Extract user from Authorization header
async function getUserFromToken(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const secret = env.JWT_SECRET || 'default-secret-change-me';
  const decoded = await verifyToken(token, secret);

  if (!decoded) {
    return null;
  }

  return decoded.userId;
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

    // Get enabled addons for user
    const enabledAddons = await env.DB.prepare(
      'SELECT addon_type, settings FROM user_addons WHERE user_id = ? AND is_enabled = 1'
    ).bind(userId).all();

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

        // Create empty settings
        const settingsId = generateId();
        const encryptionSalt = generateSalt();

        await env.DB.prepare(
          'INSERT INTO user_settings (id, user_id, encryption_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(settingsId, userId, encryptionSalt, timestamp, timestamp).run();

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

      // ============================================
      // USER SETTINGS ENDPOINTS (Protected)
      // ============================================

      // Get user settings
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const settings = await env.DB.prepare(
          'SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

        if (!settings) {
          return jsonResponse({ error: 'Settings not found' }, 404);
        }

        return jsonResponse({
          privateKey: settings.private_key,
          publicKey: settings.public_key,
          selectedAssistantId: settings.selected_assistant_id,
          selectedPhoneId: settings.selected_phone_id,
          selectedOrgId: settings.selected_org_id,
          openaiApiKey: settings.openai_api_key,
          twilioAccountSid: settings.twilio_account_sid,
          twilioAuthToken: settings.twilio_auth_token,
          transferPhoneNumber: settings.transfer_phone_number
        });
      }

      // Update user settings
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
          openaiApiKey,
          twilioAccountSid,
          twilioAuthToken,
          transferPhoneNumber
        } = await request.json() as any;

        const timestamp = now();

        await env.DB.prepare(
          'UPDATE user_settings SET private_key = ?, public_key = ?, selected_assistant_id = ?, selected_phone_id = ?, selected_org_id = ?, openai_api_key = ?, twilio_account_sid = ?, twilio_auth_token = ?, transfer_phone_number = ?, updated_at = ? WHERE user_id = ?'
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
          timestamp,
          userId
        ).run();

        return jsonResponse({ message: 'Settings updated successfully' });
      }

      // ============================================
      // ADDONS ENDPOINTS (Protected)
      // ============================================

      // Get user addons configuration
      if (url.pathname === '/api/addons' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const { results } = await env.DB.prepare(
          'SELECT addon_type, is_enabled, settings FROM user_addons WHERE user_id = ?'
        ).bind(userId).all();

        return jsonResponse({ addons: results || [] });
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

        const timestamp = now();

        // Check if addon config exists
        const existing = await env.DB.prepare(
          'SELECT id FROM user_addons WHERE user_id = ? AND addon_type = ?'
        ).bind(userId, addonType).first();

        if (existing) {
          // Update existing
          await env.DB.prepare(
            'UPDATE user_addons SET is_enabled = ?, updated_at = ? WHERE user_id = ? AND addon_type = ?'
          ).bind(enabled ? 1 : 0, timestamp, userId, addonType).run();
        } else {
          // Create new
          await env.DB.prepare(
            'INSERT INTO user_addons (id, user_id, addon_type, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(generateId(), userId, addonType, enabled ? 1 : 0, timestamp, timestamp).run();
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

      // List webhooks for user
      if (url.pathname === '/api/webhooks' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

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
        ).bind(userId).all();

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

      // Get webhook calls (with KV caching)
      if (url.pathname === '/api/webhook-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const webhookId = url.searchParams.get('webhook_id');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const page = Math.floor(offset / limit) + 1;

        // Initialize cache
        const cache = new VoiceAICache(env.CACHE);
        
        // Check if cache-busting parameter is present
        const cacheBust = url.searchParams.get('_t');

        // Try to get from cache first (only if no webhook filter, reasonable page size, and no cache-bust)
        if (!webhookId && limit <= 100 && !cacheBust) {
          const cached = await cache.getCachedRecordings(userId, page, limit);
          if (cached) {
            console.log(`Cache HIT for recordings: user=${userId}, page=${page}, limit=${limit}`);
            return jsonResponse(cached);
          }
        }

        console.log(`Cache MISS for recordings: user=${userId}, page=${page}, limit=${limit}${cacheBust ? ' (cache-bust requested)' : ''}`);

        // Fetch from database with enhanced data
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
          WHERE wc.user_id = ?
          ${webhookId ? 'AND wc.webhook_id = ?' : ''}
          ORDER BY CASE 
            WHEN wc.created_at > 1000000000000 THEN wc.created_at / 1000 
            ELSE wc.created_at 
          END DESC
          LIMIT ? OFFSET ?`
        );

        const params = webhookId
          ? [userId, webhookId, limit, offset]
          : [userId, limit, offset];

        const { results } = await query.bind(...params).all();

        // Parse structured_data, raw_payload, and enhanced_data JSON for each result
        const parsedResults = (results || []).map((row: any) => ({
          ...row,
          structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
          raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
          enhanced_data: row.enhanced_data ? JSON.parse(row.enhanced_data) : null
        }));

        // Cache the results (only if no webhook filter and reasonable page size)
        if (!webhookId && limit <= 100) {
          await cache.cacheRecordings(userId, parsedResults, page, limit, CACHE_TTL.RECORDINGS);
        }

        return jsonResponse(parsedResults);
      }

      // Get intent analysis with caching
      // Get active calls
      if (url.pathname === '/api/active-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Fetch active calls from database
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
        ).bind(userId).all();

        return jsonResponse(results);
      }

      // Get concurrent calls stats
      if (url.pathname === '/api/concurrent-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        // Get current concurrent calls (active calls)
        const activeCallsResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM active_calls WHERE user_id = ?`
        ).bind(userId).first() as any;
        
        const currentConcurrent = activeCallsResult?.count || 0;

        // Get historical peak concurrent calls
        // We'll analyze webhook_calls to find the maximum number of overlapping calls
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1000`
        ).bind(userId).all();

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
      if (url.pathname === '/api/concurrent-calls/timeseries' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const granularity = url.searchParams.get('granularity') || 'minute'; // minute, hour, day
        const limit = parseInt(url.searchParams.get('limit') || '1000');

        // Fetch recent calls with their time ranges
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          ORDER BY created_at DESC
          LIMIT ?`
        ).bind(userId, limit).all();

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

      // Get reason call ended data
      if (url.pathname === '/api/call-ended-reasons' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        // Build query with optional date filtering
        // Filter out rows where created_at is null or ended_reason is null
        let queryStr = `SELECT 
          ended_reason,
          DATE(datetime(created_at, 'unixepoch')) as call_date,
          COUNT(*) as count
        FROM webhook_calls
        WHERE user_id = ?
        AND ended_reason IS NOT NULL
        AND created_at IS NOT NULL`;
        
        const params: any[] = [userId];
        
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

      // Get top keywords
      if (url.pathname === '/api/keywords' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

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
        ).bind(userId).all();

        return jsonResponse(results);
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

        // Verify the call belongs to this user
        const call = await env.DB.prepare(
          'SELECT vapi_call_id FROM active_calls WHERE vapi_call_id = ? AND user_id = ?'
        ).bind(callId, userId).first() as any;

        if (!call) {
          console.log('[Call Control] Call not found or unauthorized:', callId);
          return jsonResponse({ error: 'Call not found or unauthorized' }, 404);
        }

        // Get user's VAPI credentials
        const settings = await env.DB.prepare(
          'SELECT private_key FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

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
              error
            });
            return jsonResponse({ error: 'Failed to end call' }, endCallResponse.status);
          }

          console.log('[Call Control] Call ended successfully:', callId);

          return jsonResponse({ success: true, message: 'Call ended successfully' });
        } catch (error) {
          console.error('[Call Control] Error ending call:', {
            callId,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse({ error: 'Failed to end call' }, 500);
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

        // Verify the call belongs to this user
        const call = await env.DB.prepare(
          'SELECT vapi_call_id FROM active_calls WHERE vapi_call_id = ? AND user_id = ?'
        ).bind(callId, userId).first() as any;

        if (!call) {
          console.log('[Call Control] Call not found or unauthorized:', callId);
          return jsonResponse({ error: 'Call not found or unauthorized' }, 404);
        }

        // Get user's VAPI credentials
        const settings = await env.DB.prepare(
          'SELECT private_key FROM user_settings WHERE user_id = ?'
        ).bind(userId).first() as any;

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

      if (url.pathname === '/api/intent-analysis' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const page = Math.floor(offset / limit) + 1;

        // Initialize cache
        const cache = new VoiceAICache(env.CACHE);

        // Try to get from cache first
        if (limit <= 100) {
          const cached = await cache.getCachedIntentSummary(userId);
          if (cached) {
            console.log(`Cache HIT for intent analysis: user=${userId}`);
            return jsonResponse(cached);
          }
        }

        console.log(`Cache MISS for intent analysis: user=${userId}`);

        // Fetch analyzed calls from database with enhanced data
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
          WHERE wc.user_id = ? AND wc.analysis_completed = 1
          ORDER BY wc.created_at DESC
          LIMIT ? OFFSET ?`
        ).bind(userId, limit, offset).all();

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

          return {
            ...row,
            structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
            raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
            enhanced_data: enhancedData
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
          await cache.cacheIntentSummary(userId, summaryData, CACHE_TTL.INTENT_SUMMARY);
        }

        return jsonResponse(summaryData);
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
        const adminEmails = (env.ADMIN_EMAILS || 'vic@channelautomation.com').split(',').map(e => e.trim());
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
      // PUBLIC WEBHOOK RECEIVER (No Auth Required)
      // ============================================

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
                const userSettings = await env.DB.prepare(
                  'SELECT twilio_account_sid, twilio_auth_token FROM user_settings WHERE user_id = ?'
                ).bind(webhook.user_id).first() as any;

                if (userSettings?.twilio_account_sid && userSettings?.twilio_auth_token) {
                  twilioData = await lookupCallerWithTwilio(
                    customerNumber,
                    userSettings.twilio_account_sid,
                    userSettings.twilio_auth_token
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

            // Invalidate cache
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);

            return jsonResponse({ success: true, message: 'Call status updated' });

          } else if (callStatus === 'ended') {
            // Remove from active calls
            await env.DB.prepare(
              'DELETE FROM active_calls WHERE vapi_call_id = ? AND user_id = ?'
            ).bind(vapiCallId, webhook.user_id).run();

            // Invalidate cache
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);

            return jsonResponse({ success: true, message: 'Call ended, removed from active calls' });
          }

          return jsonResponse({ success: true, message: 'Status update received' });
        }

        // Handle end-of-call-report (existing logic)
        const callId = generateId();

        // Enrich caller data with Twilio Lookup (if configured)
        let twilioData: TwilioCallerInfo | null = null;
        const customerNumber = customer.number || null;

        if (customerNumber) {
          try {
            const userSettings = await env.DB.prepare(
              'SELECT twilio_account_sid, twilio_auth_token FROM user_settings WHERE user_id = ?'
            ).bind(webhook.user_id).first() as any;

            if (userSettings?.twilio_account_sid && userSettings?.twilio_auth_token) {
              twilioData = await lookupCallerWithTwilio(
                customerNumber,
                userSettings.twilio_account_sid,
                userSettings.twilio_auth_token
              );
            }
          } catch (error) {
            console.error('Error enriching caller data with Twilio:', error);
          }
        }

        // Calculate duration from startedAt and endedAt
        let durationSeconds: number | null = null;
        if (call.startedAt && call.endedAt) {
          try {
            const startTime = new Date(call.startedAt).getTime();
            const endTime = new Date(call.endedAt).getTime();
            durationSeconds = Math.floor((endTime - startTime) / 1000); // Convert to seconds
          } catch (error) {
            console.error('Error calculating call duration:', error);
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

                // Get user's OpenAI API key
                const settings = await env.DB.prepare(
                  'SELECT openai_api_key FROM user_settings WHERE user_id = ?'
                ).bind(webhook.user_id).first() as any;

                if (settings?.openai_api_key) {
                  const transcript = artifact.transcript || '';
                  const summary = analysis.summary || message.summary || '';

                  // Analyze with OpenAI
                  const analysisResult = await analyzeCallWithOpenAI(
                    summary,
                    transcript,
                    settings.openai_api_key
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

      // Default 404
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error: any) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
  },
};
