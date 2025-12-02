/**
 * Outbound Webhook Dispatcher
 * Handles sending real-time call events to user-configured webhook endpoints
 */

import type { Env } from './index';
import { syncCallToHubSpot } from './hubspot-service';

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
    structuredOutputs?: any;
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

  // call.ended event - formatted like HubSpot sync
  return {
    ...basePayload,
    duration_seconds: data.durationSeconds || 0,
    ended_reason: data.endedReason || 'unknown',
    call_summary: data.summary || '',
    call_details: data.structuredData || {},
    structured_outputs: data.structuredOutputs || {},
    conversation_transcript: data.conversation || [],
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
  console.log(`[DEBUG] dispatchToOutboundWebhooks called for user ${userId}, event: ${eventType}`);
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

    // For call.ended, download and save recording to R2 ONCE before processing webhooks
    let r2RecordingUrl = callData.recordingUrl;
    if (eventType === 'call.ended' && callData.recordingUrl) {
      const savedUrl = await downloadAndSaveRecording(env, callData.recordingUrl, callData.callId);
      if (savedUrl) {
        r2RecordingUrl = savedUrl;
        console.log('[R2] Using R2 recording URL for all webhooks:', r2RecordingUrl);
      }
    }

    // Sync to HubSpot AFTER recording is uploaded to R2 (once per call)
    console.log('[HubSpot] Checking sync - eventType:', eventType, 'hasRecording:', !!r2RecordingUrl, 'hasPhone:', !!callData.customerPhone, 'hasSummary:', !!callData.summary);

    // Debug: Log to database to see what's happening
    try {
      await env.DB.prepare(
        'INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        `debug_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        'debug',
        callData.callId,
        'debug',
        `Event:${eventType} RecURL:${r2RecordingUrl ? 'YES' : 'NO'} Phone:${callData.customerPhone || 'NO'} Summary:${callData.summary ? 'YES' : 'NO'}`,
        callData.customerPhone || 'none',
        Date.now()
      ).run();
    } catch (e) {
      console.error('[DEBUG] Failed to log debug info:', e);
    }

    if (eventType === 'call.ended' && r2RecordingUrl && callData.customerPhone && callData.summary) {
      try {
        // Get workspace settings
        const wsSettings = await env.DB.prepare(
          'SELECT workspace_id FROM user_settings WHERE user_id = ? LIMIT 1'
        ).bind(userId).first() as any;

        console.log('[HubSpot] Workspace settings:', wsSettings);

        // Check if HubSpot is connected (workspace-level)
        const hubspotTokens = await env.DB.prepare(
          'SELECT access_token FROM hubspot_oauth_tokens WHERE workspace_id = ? LIMIT 1'
        ).bind(wsSettings?.workspace_id).first() as any;

        console.log('[HubSpot] HubSpot tokens:', hubspotTokens ? 'Found' : 'Not found');

        if (hubspotTokens) {
          console.log('[HubSpot] Syncing call with R2 recording URL:', r2RecordingUrl);
          await syncCallToHubSpot(
            env.DB,
            userId,
            wsSettings?.workspace_id || '',
            callData.callId,
            {
              phoneNumber: callData.customerPhone,
              summary: callData.summary,
              recordingUrl: r2RecordingUrl, // Use R2 URL
            },
            env
          );
        } else {
          console.log('[HubSpot] Skipping sync - HubSpot not connected for user:', userId);
        }
      } catch (hubspotError) {
        console.error('[HubSpot] Sync error in outbound webhook:', hubspotError);
      }
    } else {
      console.log('[HubSpot] Skipping sync - missing required fields');
    }

    // Now dispatch to all webhooks with the R2 URL
    for (const webhook of webhooks.results) {
      // Check if this webhook is subscribed to this event type
      const subscribedEvents = webhook.events?.split(',') || ['call.ended'];
      if (!subscribedEvents.includes(eventType)) {
        console.log(`[Outbound Webhook] Skipping ${webhook.destination_url} - not subscribed to ${eventType}`);
        continue;
      }

      // Extract conversation and structured outputs from raw payload if available
      let conversation: Array<{ role: string; message: string }> = [];
      let structuredOutputs: any = {};

      if (eventType === 'call.ended' && callData.rawPayload) {
        const messages = callData.rawPayload?.message?.artifact?.messages || [];
        conversation = extractConversation(messages);

        // Extract structured outputs from VAPI payload
        const analysis = callData.rawPayload?.message?.analysis || {};
        const artifact = callData.rawPayload?.message?.artifact || {};
        structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || {};
      }

      // Build payload
      const payload = buildOutboundPayload(eventType, {
        ...callData,
        conversation,
        structuredOutputs,
        recordingUrl: r2RecordingUrl,
      });

      // Dispatch webhook
      await dispatchOutboundWebhook(env, webhook, payload, eventType, callData.callId);
    }
  } catch (error) {
    console.error('[Outbound Webhook] Error in dispatchToOutboundWebhooks:', error);
  }
}
