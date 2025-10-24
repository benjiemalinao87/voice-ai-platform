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

        await env.DB.prepare(
          'INSERT INTO user_settings (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind(settingsId, userId, timestamp, timestamp).run();

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
          'SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key FROM user_settings WHERE user_id = ?'
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
          openaiApiKey: settings.openai_api_key
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
          openaiApiKey
        } = await request.json() as any;

        const timestamp = now();

        await env.DB.prepare(
          'UPDATE user_settings SET private_key = ?, public_key = ?, selected_assistant_id = ?, selected_phone_id = ?, selected_org_id = ?, openai_api_key = ?, updated_at = ? WHERE user_id = ?'
        ).bind(
          privateKey || null,
          publicKey || null,
          selectedAssistantId || null,
          selectedPhoneId || null,
          selectedOrgId || null,
          openaiApiKey || null,
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

        // Try to get from cache first (only if no webhook filter and reasonable page size)
        if (!webhookId && limit <= 100) {
          const cached = await cache.getCachedRecordings(userId, page, limit);
          if (cached) {
            console.log(`Cache HIT for recordings: user=${userId}, page=${page}, limit=${limit}`);
            return jsonResponse(cached);
          }
        }

        console.log(`Cache MISS for recordings: user=${userId}, page=${page}, limit=${limit}`);

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
            wc.created_at,
            ar.result_data as enhanced_data
          FROM webhook_calls wc
          LEFT JOIN addon_results ar ON ar.call_id = wc.id AND ar.addon_type = 'enhanced_data' AND ar.status = 'success'
          WHERE wc.user_id = ?
          ${webhookId ? 'AND wc.webhook_id = ?' : ''}
          ORDER BY wc.created_at DESC
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

        // Parse structured_data, raw_payload, and enhanced_data JSON for each result
        const parsedResults = (results || []).map((row: any) => ({
          ...row,
          structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
          raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
          enhanced_data: row.enhanced_data ? JSON.parse(row.enhanced_data) : null
        }));

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
        const call = message.call || {};
        const customer = call.customer || {};
        const phoneNumber = call.phoneNumber || {};
        const artifact = message.artifact || {};
        const analysis = message.analysis || {};

        const callId = generateId();
        const timestamp = now();

        // Store call data
        try {
          await env.DB.prepare(
            `INSERT INTO webhook_calls (
              id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
              recording_url, ended_reason, summary, structured_data, raw_payload, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            timestamp
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
                    // Calculate appointment_datetime if both date and time are present
                    let appointmentDatetime: number | null = null;
                    if (analysisResult.appointment_date && analysisResult.appointment_time) {
                      try {
                        const dateTimeStr = `${analysisResult.appointment_date} ${analysisResult.appointment_time}`;
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
                      analysisResult.customer_name,
                      analysisResult.customer_email,
                      analysisResult.appointment_date,
                      analysisResult.appointment_time,
                      appointmentDatetime,
                      analysisResult.appointment_type,
                      analysisResult.appointment_notes,
                      now(),
                      callId
                    ).run();

                    // Invalidate cache for this specific call since analysis is now complete
                    const cache = new VoiceAICache(env.CACHE);
                    await cache.invalidateCallCache(webhook.user_id, callId);

                    // Trigger Scheduling Webhook if appointment was booked
                    if (analysisResult.intent === 'Scheduling' && analysisResult.appointment_date && analysisResult.appointment_time) {
                      await triggerSchedulingWebhook(env, webhook.user_id, callId);
                    }
                  }
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
