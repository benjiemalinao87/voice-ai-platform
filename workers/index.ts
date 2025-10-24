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

export interface Env {
  DB: D1Database;
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
async function analyzeCallWithOpenAI(
  summary: string,
  transcript: string,
  openaiApiKey: string
): Promise<{ intent: string; sentiment: string; outcome: string } | null> {
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
- intent: The customer's primary intent (e.g., "Scheduling", "Information", "Complaint", "Purchase", "Support")
- sentiment: The overall sentiment of the call ("Positive", "Neutral", or "Negative")
- outcome: The call outcome ("Successful", "Unsuccessful", "Follow-up Required", "Abandoned")

Only respond with the JSON object, no additional text.`
          },
          {
            role: 'user',
            content: `Call Summary: ${summary}\n\nTranscript Preview: ${transcript.substring(0, 1000)}`
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
      outcome: result.outcome || 'Unknown'
    };
  } catch (error) {
    console.error('Error analyzing call with OpenAI:', error);
    return null;
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
        const webhookUrl = `${url.origin}/webhook/${webhookId}`;
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

      // Get webhook calls
      if (url.pathname === '/api/webhook-calls' && request.method === 'GET') {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const webhookId = url.searchParams.get('webhook_id');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = env.DB.prepare(
          `SELECT
            id,
            webhook_id,
            vapi_call_id,
            phone_number,
            customer_number,
            recording_url,
            ended_reason,
            summary,
            structured_data,
            raw_payload,
            intent,
            sentiment,
            outcome,
            analysis_completed,
            analyzed_at,
            created_at
          FROM webhook_calls
          WHERE user_id = ?
          ${webhookId ? 'AND webhook_id = ?' : ''}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`
        );

        const params = webhookId
          ? [userId, webhookId, limit, offset]
          : [userId, limit, offset];

        const { results } = await query.bind(...params).all();

        // Parse structured_data and raw_payload JSON for each result
        const parsedResults = (results || []).map((row: any) => ({
          ...row,
          structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
          raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null
        }));

        return jsonResponse(parsedResults);
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
        const destination = call.destination || {};
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
            destination.number || null,  // AI agent's phone number
            customer.number || null,      // Customer's phone number
            artifact.recordingUrl || null,
            message.endedReason || 'unknown',
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

          // Trigger OpenAI analysis in the background (don't wait for it)
          ctx.waitUntil(
            (async () => {
              try {
                // Get user's OpenAI API key
                const settings = await env.DB.prepare(
                  'SELECT openai_api_key FROM user_settings WHERE user_id = ?'
                ).bind(webhook.user_id).first() as any;

                if (settings?.openai_api_key) {
                  const transcript = artifact.transcript || '';
                  const summary = message.summary || '';

                  // Analyze with OpenAI
                  const analysisResult = await analyzeCallWithOpenAI(
                    summary,
                    transcript,
                    settings.openai_api_key
                  );

                  if (analysisResult) {
                    // Update call with analysis results
                    await env.DB.prepare(
                      `UPDATE webhook_calls
                       SET intent = ?, sentiment = ?, outcome = ?, analysis_completed = 1, analyzed_at = ?
                       WHERE id = ?`
                    ).bind(
                      analysisResult.intent,
                      analysisResult.sentiment,
                      analysisResult.outcome,
                      now(),
                      callId
                    ).run();
                  }
                }
              } catch (error) {
                console.error('Background analysis error:', error);
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
