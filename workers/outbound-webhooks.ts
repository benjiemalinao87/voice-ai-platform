/**
 * Outbound Webhook Dispatcher
 * Handles sending real-time call events to user-configured webhook endpoints
 */

import type { Env } from './index';

// Helper to generate unique ID
function generateId(): string {
  return `obwh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateLogId(): string {
  return `obwhlog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Download VAPI recording and save to R2
 */
async function downloadAndSaveRecording(
  env: Env,
  recordingUrl: string,
  callId: string
): Promise<string | null> {
  if (!recordingUrl) return null;

  try {
    console.log(`[R2] Downloading recording from VAPI: ${recordingUrl}`);

    // Download recording from VAPI
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      console.error(`[R2] Failed to download recording: ${response.status}`);
      return null;
    }

    // Generate R2 key
    const r2Key = `recordings/${callId}.wav`;

    // Upload to R2
    await env.RECORDINGS.put(r2Key, response.body, {
      httpMetadata: {
        contentType: 'audio/wav',
      },
    });

    console.log(`[R2] Saved recording to R2: ${r2Key}`);

    // Return public URL using custom domain
    return `https://call-recording.channelautomation.com/${r2Key}`;
  } catch (error) {
    console.error('[R2] Error saving recording:', error);
    return null;
  }
}

/**
 * Build simplified payload for outbound webhook
 */
function buildOutboundPayload(
  eventType: 'call.started' | 'call.ended',
  data: {
    callId: string;
    customerPhone?: string | null;
    assistantName?: string;
    durationSeconds?: number | null;
    endedReason?: string;
    summary?: string;
    structuredData?: any;
    conversation?: Array<{ role: string; message: string }>;
    recordingUrl?: string | null;
  }
): any {
  const basePayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    call_id: data.callId,
    customer_phone: data.customerPhone || null,
    assistant_name: data.assistantName || 'AI Assistant',
  };

  if (eventType === 'call.started') {
    return {
      ...basePayload,
      status: 'ringing',
    };
  }

  // call.ended event
  return {
    ...basePayload,
    duration_seconds: data.durationSeconds || 0,
    ended_reason: data.endedReason || 'unknown',
    summary: data.summary || '',
    structured_data: data.structuredData || {},
    conversation: data.conversation || [],
    recording_url: data.recordingUrl || null,
  };
}

/**
 * Extract clean conversation from VAPI messages
 */
function extractConversation(messages: any[]): Array<{ role: string; message: string }> {
  if (!messages || !Array.isArray(messages)) return [];

  return messages
    .filter((msg: any) => msg.role === 'user' || msg.role === 'bot' || msg.role === 'assistant')
    .map((msg: any) => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      message: msg.message || msg.content || '',
    }));
}

/**
 * Dispatch webhook to user's endpoint
 */
async function dispatchOutboundWebhook(
  env: Env,
  outboundWebhook: any,
  payload: any,
  eventType: string,
  callId: string
): Promise<void> {
  const logId = generateLogId();
  const timestamp = now();

  try {
    console.log(`[Outbound Webhook] Dispatching ${eventType} to ${outboundWebhook.destination_url}`);

    const response = await fetch(outboundWebhook.destination_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Voice-AI-Dashboard/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseText = await response.text();

    // Log success
    await env.DB.prepare(
      `INSERT INTO outbound_webhook_logs
       (id, outbound_webhook_id, event_type, call_id, status, http_status, response_body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      outboundWebhook.id,
      eventType,
      callId,
      response.ok ? 'success' : 'failed',
      response.status,
      responseText.substring(0, 1000), // Limit response body to 1000 chars
      timestamp
    ).run();

    console.log(`[Outbound Webhook] Response ${response.status}: ${responseText.substring(0, 100)}`);
  } catch (error: any) {
    console.error(`[Outbound Webhook] Error:`, error);

    // Log failure
    await env.DB.prepare(
      `INSERT INTO outbound_webhook_logs
       (id, outbound_webhook_id, event_type, call_id, status, http_status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      outboundWebhook.id,
      eventType,
      callId,
      'failed',
      0,
      error.message || String(error),
      timestamp
    ).run();
  }
}

/**
 * Main function: Dispatch to all active outbound webhooks for a user
 */
export async function dispatchToOutboundWebhooks(
  env: Env,
  userId: string,
  eventType: 'call.started' | 'call.ended',
  callData: {
    callId: string;
    customerPhone?: string | null;
    assistantName?: string;
    durationSeconds?: number | null;
    endedReason?: string;
    summary?: string;
    structuredData?: any;
    rawPayload?: any;
    recordingUrl?: string | null;
  }
): Promise<void> {
  try {
    // Get all active outbound webhooks for this user
    const webhooks = await env.DB.prepare(
      `SELECT id, destination_url, events FROM outbound_webhooks
       WHERE user_id = ? AND is_active = 1`
    ).bind(userId).all();

    if (!webhooks.results || webhooks.results.length === 0) {
      console.log(`[Outbound Webhook] No active webhooks for user ${userId}`);
      return;
    }

    console.log(`[Outbound Webhook] Found ${webhooks.results.length} active webhook(s) for user ${userId}`);

    for (const webhook of webhooks.results) {
      // Check if this webhook is subscribed to this event type
      const subscribedEvents = webhook.events?.split(',') || ['call.ended'];
      if (!subscribedEvents.includes(eventType)) {
        console.log(`[Outbound Webhook] Skipping ${webhook.destination_url} - not subscribed to ${eventType}`);
        continue;
      }

      // For call.ended, download and save recording to R2
      let r2RecordingUrl = callData.recordingUrl;
      if (eventType === 'call.ended' && callData.recordingUrl) {
        const savedUrl = await downloadAndSaveRecording(env, callData.recordingUrl, callData.callId);
        if (savedUrl) {
          r2RecordingUrl = savedUrl;
        }
      }

      // Extract conversation from raw payload if available
      let conversation: Array<{ role: string; message: string }> = [];
      if (eventType === 'call.ended' && callData.rawPayload) {
        const messages = callData.rawPayload?.message?.artifact?.messages || [];
        conversation = extractConversation(messages);
      }

      // Build payload
      const payload = buildOutboundPayload(eventType, {
        ...callData,
        conversation,
        recordingUrl: r2RecordingUrl,
      });

      // Dispatch webhook
      await dispatchOutboundWebhook(env, webhook, payload, eventType, callData.callId);
    }
  } catch (error) {
    console.error('[Outbound Webhook] Error in dispatchToOutboundWebhooks:', error);
  }
}
