/**
 * Twilio Utilities for Warm Transfer
 * Simplified approach: Call agent with announcement, then transfer customer
 */

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  workerUrl: string;
  twilioPhoneNumber?: string;
}

export interface AgentCall {
  callSid: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy' | 'canceled';
  to: string;
  from: string;
}

/**
 * Dial agent with announcement, then automatically hang up
 * The TwiML will play the announcement and end the call
 * Our webhook will then transfer the customer to the agent
 */
export async function dialAgentWithAnnouncement(
  config: TwilioConfig,
  transferId: string,
  agentNumber: string,
  announcement?: string
): Promise<AgentCall> {
  const { accountSid, authToken, workerUrl, twilioPhoneNumber } = config;
  
  if (!twilioPhoneNumber) {
    throw new Error('Twilio phone number not configured');
  }

  // TwiML URL that plays announcement then hangs up
  // The hangup triggers 'completed' status which triggers the customer transfer
  const twimlUrl = `${workerUrl}/twiml/agent-announcement/${transferId}?announcement=${encodeURIComponent(announcement || 'You have an incoming transfer. Please wait for the caller to be connected.')}`;
  
  const statusCallbackUrl = `${workerUrl}/webhook/agent-call-status`;

  console.log('[Twilio] ========================================');
  console.log('[Twilio] DIALING AGENT WITH ANNOUNCEMENT');
  console.log('[Twilio] Transfer ID:', transferId);
  console.log('[Twilio] TwiML URL:', twimlUrl);
  console.log('[Twilio] Status Callback URL:', statusCallbackUrl);
  console.log('[Twilio] Agent Number:', agentNumber);
  console.log('[Twilio] From Number:', twilioPhoneNumber);
  console.log('[Twilio] ========================================');

  // Make outbound call to agent
  // Note: StatusCallbackEvent needs to be sent as multiple parameters
  const bodyParams = new URLSearchParams();
  bodyParams.append('To', agentNumber);
  bodyParams.append('From', twilioPhoneNumber);
  bodyParams.append('Url', twimlUrl);
  bodyParams.append('StatusCallback', statusCallbackUrl);
  bodyParams.append('StatusCallbackEvent', 'initiated');
  bodyParams.append('StatusCallbackEvent', 'ringing');
  bodyParams.append('StatusCallbackEvent', 'answered');
  bodyParams.append('StatusCallbackEvent', 'completed');
  bodyParams.append('StatusCallbackMethod', 'POST');
  bodyParams.append('Method', 'POST');

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Twilio] Failed to dial agent:', {
      status: response.status,
      error: errorText,
      agentNumber,
    });
    throw new Error(`Failed to dial agent: ${response.status} - ${errorText}`);
  }

  const call = await response.json();
  
  console.log('[Twilio] Agent call initiated:', {
    callSid: call.sid,
    to: call.to,
    from: call.from,
    status: call.status,
  });

  return {
    callSid: call.sid,
    status: 'initiated',
    to: call.to,
    from: call.from,
  };
}

/**
 * Generate TwiML for agent announcement
 * Plays the announcement, gives agent 3 seconds to prepare, then hangs up
 * The hangup triggers the actual customer transfer
 */
export function generateAgentAnnouncementTwiML(announcement: string): string {
  // Escape XML special characters
  const safeAnnouncement = announcement
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
    
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safeAnnouncement}</Say>
  <Say voice="alice">The caller will be transferred to you now. Please stay on the line.</Say>
  <Pause length="2"/>
  <Say voice="alice">Connecting...</Say>
  <Pause length="1"/>
</Response>`;
}

/**
 * Generate TwiML that redirects the agent call to a conference
 * This is used when we want to keep the agent on the line
 */
export function generateConferenceTwiML(conferenceName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference 
      startConferenceOnEnter="true" 
      endConferenceOnExit="true"
      beep="false"
      waitUrl=""
    >${conferenceName}</Conference>
  </Dial>
</Response>`;
}

/**
 * Update an existing Twilio call with new TwiML
 * Used to redirect the agent from announcement to conference
 */
export async function updateCallTwiML(
  config: TwilioConfig,
  callSid: string,
  twimlUrl: string
): Promise<void> {
  const { accountSid, authToken } = config;
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'Url': twimlUrl,
        'Method': 'POST',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Twilio] Failed to update call:', {
      status: response.status,
      error: errorText,
      callSid,
    });
    throw new Error(`Failed to update call: ${response.status} - ${errorText}`);
  }
  
  console.log('[Twilio] Call updated with new TwiML:', callSid);
}

/**
 * Hang up a Twilio call
 */
export async function hangupCall(
  config: TwilioConfig,
  callSid: string
): Promise<void> {
  const { accountSid, authToken } = config;
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'Status': 'completed',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Twilio] Failed to hang up call:', {
      status: response.status,
      error: errorText,
      callSid,
    });
    throw new Error(`Failed to hang up call: ${response.status} - ${errorText}`);
  }
  
  console.log('[Twilio] Call hung up:', callSid);
}
