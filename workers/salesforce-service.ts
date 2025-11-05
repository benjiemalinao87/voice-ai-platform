/**
 * Salesforce Integration Service
 *
 * Handles OAuth 2.0 authentication and REST API interactions with Salesforce
 * - OAuth: Authorization code flow with token refresh
 * - Search: SOSL phone number search across Leads & Contacts
 * - Sync: Create Tasks (call logs) and Events (appointments)
 */

interface D1Database {
  prepare(query: string): any;
}

interface Env {
  SALESFORCE_CLIENT_ID: string;
  SALESFORCE_CLIENT_SECRET: string;
}

// ============================================
// CONFIGURATION
// ============================================

const OAUTH_CALLBACK_URL = 'https://api.voice-config.channelautomation.com/api/salesforce/oauth/callback';

// Salesforce OAuth endpoints (use login.salesforce.com for production, test.salesforce.com for sandbox)
const SALESFORCE_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';

// ============================================
// OAUTH 2.0 FLOW
// ============================================

/**
 * Step 1: Generate OAuth authorization URL
 * User will be redirected here to approve access
 */
export function buildAuthUrl(workspaceId: string, env: Env): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.SALESFORCE_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: 'api refresh_token',
    state: workspaceId, // Pass workspace ID to identify user on callback
  });

  return `${SALESFORCE_AUTH_URL}?${params.toString()}`;
}

/**
 * Step 2: Exchange authorization code for access & refresh tokens
 * Called after user approves and Salesforce redirects back with code
 */
export async function exchangeCodeForToken(code: string, env: Env): Promise<{
  access_token: string;
  refresh_token: string;
  instance_url: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.SALESFORCE_CLIENT_ID,
    client_secret: env.SALESFORCE_CLIENT_SECRET,
    redirect_uri: OAUTH_CALLBACK_URL,
  });

  const response = await fetch(SALESFORCE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    instance_url: data.instance_url,
    expires_in: data.issued_at ? Math.floor(Date.now() / 1000) + 7200 : Math.floor(Date.now() / 1000) + 7200, // 2 hours
  };
}

/**
 * Step 3: Refresh access token when it expires
 * Access tokens expire in ~2 hours, use refresh token to get new one
 */
export async function refreshAccessToken(refreshToken: string, env: Env): Promise<{
  access_token: string;
  instance_url: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.SALESFORCE_CLIENT_ID,
    client_secret: env.SALESFORCE_CLIENT_SECRET,
  });

  const response = await fetch(SALESFORCE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    instance_url: data.instance_url,
    expires_in: Math.floor(Date.now() / 1000) + 7200, // 2 hours
  };
}

/**
 * Helper: Check if access token is expired and refresh if needed
 */
export async function ensureValidToken(
  db: D1Database,
  workspaceId: string,
  env: Env
): Promise<{ instanceUrl: string; accessToken: string }> {
  // Get current tokens from database
  const settings = await db.prepare(
    'SELECT salesforce_instance_url, salesforce_access_token, salesforce_refresh_token, salesforce_token_expires_at FROM workspace_settings WHERE workspace_id = ?'
  ).bind(workspaceId).first();

  if (!settings || !settings.salesforce_refresh_token) {
    throw new Error('Salesforce not connected for this workspace');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = settings.salesforce_token_expires_at || 0;

  // If token expires in less than 5 minutes, refresh it
  if (now >= expiresAt - 300) {
    console.log('[Salesforce] Access token expired, refreshing...');
    const newTokens = await refreshAccessToken(settings.salesforce_refresh_token, env);

    // Update database with new tokens
    await db.prepare(
      'UPDATE workspace_settings SET salesforce_access_token = ?, salesforce_instance_url = ?, salesforce_token_expires_at = ? WHERE workspace_id = ?'
    ).bind(
      newTokens.access_token,
      newTokens.instance_url,
      newTokens.expires_in,
      workspaceId
    ).run();

    return {
      instanceUrl: newTokens.instance_url,
      accessToken: newTokens.access_token,
    };
  }

  return {
    instanceUrl: settings.salesforce_instance_url,
    accessToken: settings.salesforce_access_token,
  };
}

// ============================================
// PHONE NUMBER SEARCH (SOSL)
// ============================================

/**
 * Search for Lead or Contact by phone number using SOSL
 * SOSL automatically handles different phone formats
 * Priority: Leads first (new prospects), then Contacts (existing customers)
 */
export async function searchByPhone(
  instanceUrl: string,
  accessToken: string,
  phoneNumber: string
): Promise<{ id: string; type: 'Lead' | 'Contact' } | null> {
  // Clean phone number (remove non-digits)
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  // SOSL query: Search in Phone and MobilePhone fields
  // Returns Leads first, then Contacts
  const soslQuery = `FIND {${cleanPhone}} IN PHONE FIELDS RETURNING Lead(Id, Phone, MobilePhone), Contact(Id, Phone, MobilePhone)`;

  const searchUrl = `${instanceUrl}/services/data/v59.0/search?q=${encodeURIComponent(soslQuery)}`;

  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Salesforce] Phone search failed:', error);
    throw new Error(`Salesforce phone search failed: ${error}`);
  }

  const data = await response.json();

  // Check if any Leads found (priority)
  if (data.searchRecords && data.searchRecords.length > 0) {
    const firstResult = data.searchRecords[0];

    // Determine type from attributes
    const type = firstResult.attributes?.type as 'Lead' | 'Contact';

    console.log(`[Salesforce] Found ${type}: ${firstResult.Id}`);
    return {
      id: firstResult.Id,
      type: type,
    };
  }

  console.log('[Salesforce] No Lead or Contact found for phone:', phoneNumber);
  return null;
}

// ============================================
// TASK CREATION (CALL LOGS)
// ============================================

/**
 * Create a Task (call log) on Lead or Contact record
 * Task appears in Salesforce Activity History
 */
export async function createCallLogTask(
  instanceUrl: string,
  accessToken: string,
  leadOrContactId: string,
  callData: {
    phoneNumber: string;
    duration: number; // seconds
    summary: string;
    callType: 'inbound' | 'outbound';
    callStartTime: string; // ISO 8601
  }
): Promise<string> {
  const taskPayload = {
    WhoId: leadOrContactId, // Links to Lead (00Q) or Contact (003)
    Subject: 'Inbound Call',
    Type: 'Call',
    CallType: callData.callType === 'inbound' ? 'Inbound' : 'Outbound',
    Status: 'Completed',
    ActivityDate: callData.callStartTime.split('T')[0], // Just the date part
    Description: `Call Duration: ${Math.floor(callData.duration / 60)} min ${callData.duration % 60} sec\nPhone: ${callData.phoneNumber}\n\n${callData.summary}`,
    TaskSubtype: 'Call',
    Priority: 'Normal',
  };

  const response = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Salesforce] Task creation failed:', error);
    throw new Error(`Salesforce task creation failed: ${error}`);
  }

  const result = await response.json();
  console.log('[Salesforce] Task created:', result.id);
  return result.id; // Returns Task ID (starts with 00T)
}

// ============================================
// EVENT CREATION (APPOINTMENTS)
// ============================================

/**
 * Parse appointment date and time strings into Date object
 */
function parseAppointmentDateTime(date: string, time: string): Date {
  // date format: "2025-01-15" or "January 15, 2025"
  // time format: "2:00 PM" or "14:00"

  // Try to parse date
  let dateObj: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // ISO format: "2025-01-15"
    dateObj = new Date(date);
  } else {
    // Try natural language: "January 15, 2025"
    dateObj = new Date(date);
  }

  // Parse time (handle AM/PM)
  const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${time}`);
  }

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2] || '0');
  const ampm = timeMatch[3]?.toLowerCase();

  // Convert to 24-hour format
  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }

  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
}

/**
 * Create an Event (appointment) on Lead or Contact record
 * Event appears in Salesforce Calendar and syncs to Outlook/Google Calendar
 */
export async function createAppointmentEvent(
  instanceUrl: string,
  accessToken: string,
  leadOrContactId: string,
  appointmentData: {
    date: string;           // "2025-01-15"
    time: string;           // "2:00 PM"
    type?: string;          // "Consultation"
    notes?: string;         // "Bring ID"
    duration?: number;      // 60 (minutes)
  },
  callSummary: string
): Promise<string | null> {
  try {
    // Parse date and time
    const startDateTime = parseAppointmentDateTime(
      appointmentData.date,
      appointmentData.time
    );

    // Calculate end time (default 1 hour)
    const duration = appointmentData.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    // Build Event payload
    const eventPayload = {
      WhoId: leadOrContactId,
      Subject: `${appointmentData.type || 'Appointment'} - Scheduled via Voice AI`,
      StartDateTime: startDateTime.toISOString(),
      EndDateTime: endDateTime.toISOString(),
      Description: `Appointment scheduled during call.\n\n${appointmentData.notes ? `Notes: ${appointmentData.notes}\n\n` : ''}Call Summary:\n${callSummary}`,
      IsReminderSet: true,
      ReminderDateTime: new Date(startDateTime.getTime() - 3600000).toISOString(), // 1 hour before
      Type: 'Meeting',
      ShowAs: 'Busy',
    };

    const response = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Event`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Salesforce] Event creation failed:', error);
      throw new Error(`Salesforce event creation failed: ${error}`);
    }

    const result = await response.json();
    console.log('[Salesforce] Event created:', result.id);
    return result.id; // Returns Event ID (starts with 00U)
  } catch (error: any) {
    console.error('[Salesforce] Appointment creation error:', error.message);
    return null; // Don't fail the whole sync if appointment fails
  }
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

/**
 * Main function: Sync call to Salesforce
 * 1. Search for Lead/Contact by phone
 * 2. Create Task (call log)
 * 3. Create Event (if appointment data exists)
 */
export async function syncCallToSalesforce(
  db: D1Database,
  workspaceId: string,
  callId: string,
  callData: {
    phoneNumber: string;
    duration: number;
    summary: string;
    callType: 'inbound' | 'outbound';
    callStartTime: string;
    appointmentData?: {
      date: string;
      time: string;
      type?: string;
      notes?: string;
      duration?: number;
    };
  },
  env: Env
): Promise<{
  success: boolean;
  salesforceRecordId?: string;
  salesforceTaskId?: string;
  salesforceEventId?: string;
  error?: string;
}> {
  try {
    // Step 1: Ensure we have valid access token
    const { instanceUrl, accessToken } = await ensureValidToken(db, workspaceId, env);

    // Step 2: Search for Lead/Contact by phone
    const record = await searchByPhone(instanceUrl, accessToken, callData.phoneNumber);

    if (!record) {
      // Log as "skipped" - phone number not found in Salesforce
      await db.prepare(
        'INSERT INTO salesforce_sync_logs (id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workspaceId,
        callId,
        'skipped',
        'Phone number not found in Salesforce',
        callData.phoneNumber,
        Math.floor(Date.now() / 1000)
      ).run();

      return {
        success: false,
        error: 'Phone number not found in Salesforce',
      };
    }

    // Step 3: Create Task (call log)
    const taskId = await createCallLogTask(instanceUrl, accessToken, record.id, callData);

    // Step 4: Create Event (if appointment data exists)
    let eventId: string | null = null;
    if (callData.appointmentData) {
      eventId = await createAppointmentEvent(
        instanceUrl,
        accessToken,
        record.id,
        callData.appointmentData,
        callData.summary
      );
    }

    // Step 5: Log success
    await db.prepare(
      'INSERT INTO salesforce_sync_logs (id, workspace_id, call_id, salesforce_record_id, salesforce_task_id, salesforce_event_id, appointment_created, status, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      callId,
      record.id,
      taskId,
      eventId,
      eventId ? 1 : 0,
      'success',
      callData.phoneNumber,
      Math.floor(Date.now() / 1000)
    ).run();

    console.log('[Salesforce] Sync completed successfully');
    return {
      success: true,
      salesforceRecordId: record.id,
      salesforceTaskId: taskId,
      salesforceEventId: eventId || undefined,
    };
  } catch (error: any) {
    // Log error
    await db.prepare(
      'INSERT INTO salesforce_sync_logs (id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      callId,
      'error',
      error.message,
      callData.phoneNumber,
      Math.floor(Date.now() / 1000)
    ).run();

    console.error('[Salesforce] Sync failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
