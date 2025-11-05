/**
 * Outbound Webhooks API Endpoints
 * CRUD operations for managing user's outbound webhook configurations
 */

import type { Env } from './index';

function generateId(): string {
  return `obwh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function jsonResponse(data: any, status = 200) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Create a new outbound webhook
 * POST /api/outbound-webhooks
 */
export async function createOutboundWebhook(request: Request, env: Env, userId: string): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { name, destination_url, events } = body;

    if (!name || !destination_url) {
      return jsonResponse({ error: 'Missing required fields: name, destination_url' }, 400);
    }

    // Validate destination URL
    try {
      new URL(destination_url);
    } catch (e) {
      return jsonResponse({ error: 'Invalid destination_url' }, 400);
    }

    // Validate events (optional, defaults to 'call.ended')
    const validEvents = ['call.started', 'call.ended'];
    const eventList = events ? events.split(',').map((e: string) => e.trim()) : ['call.ended'];
    for (const event of eventList) {
      if (!validEvents.includes(event)) {
        return jsonResponse({ error: `Invalid event: ${event}. Valid events: ${validEvents.join(', ')}` }, 400);
      }
    }

    const webhookId = generateId();
    const timestamp = now();

    await env.DB.prepare(
      `INSERT INTO outbound_webhooks
       (id, user_id, name, destination_url, is_active, events, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      webhookId,
      userId,
      name,
      destination_url,
      1, // active by default
      eventList.join(','),
      timestamp,
      timestamp
    ).run();

    return jsonResponse({
      id: webhookId,
      name,
      destination_url,
      is_active: true,
      events: eventList,
      created_at: timestamp,
    }, 201);
  } catch (error: any) {
    console.error('[Outbound Webhooks API] Create error:', error);
    return jsonResponse({ error: error.message || 'Failed to create outbound webhook' }, 500);
  }
}

/**
 * List all outbound webhooks for user
 * GET /api/outbound-webhooks
 */
export async function listOutboundWebhooks(env: Env, userId: string): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, destination_url, is_active, events, created_at, updated_at
       FROM outbound_webhooks
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(userId).all();

    // Parse events string to array
    const webhooks = (results || []).map((webhook: any) => ({
      ...webhook,
      events: webhook.events ? webhook.events.split(',') : ['call.ended'],
      is_active: Boolean(webhook.is_active),
    }));

    return jsonResponse({ webhooks });
  } catch (error: any) {
    console.error('[Outbound Webhooks API] List error:', error);
    return jsonResponse({ error: error.message || 'Failed to list outbound webhooks' }, 500);
  }
}

/**
 * Update an outbound webhook
 * PATCH /api/outbound-webhooks/:id
 */
export async function updateOutboundWebhook(request: Request, env: Env, userId: string, webhookId: string): Promise<Response> {
  try {
    // Verify ownership
    const webhook = await env.DB.prepare(
      'SELECT user_id FROM outbound_webhooks WHERE id = ?'
    ).bind(webhookId).first() as any;

    if (!webhook) {
      return jsonResponse({ error: 'Outbound webhook not found' }, 404);
    }

    if (webhook.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const body = await request.json() as any;
    const { name, destination_url, is_active, events } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (destination_url !== undefined) {
      try {
        new URL(destination_url);
      } catch (e) {
        return jsonResponse({ error: 'Invalid destination_url' }, 400);
      }
      updates.push('destination_url = ?');
      params.push(destination_url);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (events !== undefined) {
      const validEvents = ['call.started', 'call.ended'];
      const eventList = Array.isArray(events) ? events : events.split(',').map((e: string) => e.trim());
      for (const event of eventList) {
        if (!validEvents.includes(event)) {
          return jsonResponse({ error: `Invalid event: ${event}` }, 400);
        }
      }
      updates.push('events = ?');
      params.push(eventList.join(','));
    }

    if (updates.length === 0) {
      return jsonResponse({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    params.push(now());

    params.push(webhookId);

    await env.DB.prepare(
      `UPDATE outbound_webhooks SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    return jsonResponse({ message: 'Outbound webhook updated successfully' });
  } catch (error: any) {
    console.error('[Outbound Webhooks API] Update error:', error);
    return jsonResponse({ error: error.message || 'Failed to update outbound webhook' }, 500);
  }
}

/**
 * Delete an outbound webhook
 * DELETE /api/outbound-webhooks/:id
 */
export async function deleteOutboundWebhook(env: Env, userId: string, webhookId: string): Promise<Response> {
  try {
    // Verify ownership
    const webhook = await env.DB.prepare(
      'SELECT user_id FROM outbound_webhooks WHERE id = ?'
    ).bind(webhookId).first() as any;

    if (!webhook) {
      return jsonResponse({ error: 'Outbound webhook not found' }, 404);
    }

    if (webhook.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    await env.DB.prepare(
      'DELETE FROM outbound_webhooks WHERE id = ?'
    ).bind(webhookId).run();

    return jsonResponse({ message: 'Outbound webhook deleted successfully' });
  } catch (error: any) {
    console.error('[Outbound Webhooks API] Delete error:', error);
    return jsonResponse({ error: error.message || 'Failed to delete outbound webhook' }, 500);
  }
}

/**
 * Get outbound webhook delivery logs
 * GET /api/outbound-webhooks/:id/logs
 */
export async function getOutboundWebhookLogs(env: Env, userId: string, webhookId: string): Promise<Response> {
  try {
    // Verify ownership
    const webhook = await env.DB.prepare(
      'SELECT user_id FROM outbound_webhooks WHERE id = ?'
    ).bind(webhookId).first() as any;

    if (!webhook) {
      return jsonResponse({ error: 'Outbound webhook not found' }, 404);
    }

    if (webhook.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    // Get logs
    const { results } = await env.DB.prepare(
      `SELECT id, event_type, call_id, status, http_status, response_body, error_message, retry_count, created_at
       FROM outbound_webhook_logs
       WHERE outbound_webhook_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).bind(webhookId).all();

    return jsonResponse({ logs: results || [] });
  } catch (error: any) {
    console.error('[Outbound Webhooks API] Get logs error:', error);
    return jsonResponse({ error: error.message || 'Failed to get webhook logs' }, 500);
  }
}
