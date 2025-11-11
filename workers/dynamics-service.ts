/**
 * Microsoft Dynamics 365 Integration Service
 *
 * Handles OAuth 2.0 authentication and REST API interactions with Dynamics 365
 * - OAuth: Authorization code flow with token refresh
 * - Search: Phone number search across Leads & Contacts
 * - Sync: Create Phone Call activities (call logs) and Appointments
 */

interface D1Database {
  prepare(query: string): any;
}

interface Env {
  DYNAMICS_CLIENT_ID: string;
  DYNAMICS_CLIENT_SECRET: string;
  DYNAMICS_TENANT_ID: string;
}

// ============================================
// CONFIGURATION
// ============================================

const OAUTH_CALLBACK_URL = 'https://api.voice-config.channelautomation.com/api/dynamics/oauth/callback';

// Microsoft Dynamics 365 OAuth endpoints
const DYNAMICS_AUTH_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize';
const DYNAMICS_TOKEN_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';

// ============================================
// OAUTH 2.0 FLOW
// ============================================

/**
 * Step 1: Generate OAuth authorization URL
 * User will be redirected here to approve access
 */
export function buildAuthUrl(workspaceId: string, env: Env, instanceUrl: string): string {
  const authUrl = DYNAMICS_AUTH_URL.replace('{tenant}', env.DYNAMICS_TENANT_ID);

  const params = new URLSearchParams({
    client_id: env.DYNAMICS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: OAUTH_CALLBACK_URL,
    response_mode: 'query',
    scope: `${instanceUrl}/user_impersonation offline_access`,
    state: `${workspaceId}|${instanceUrl}`, // Pass workspace ID and instance URL
  });

  return `${authUrl}?${params.toString()}`;
}

/**
 * Step 2: Exchange authorization code for access & refresh tokens
 * Called after user approves and Microsoft redirects back with code
 */
export async function exchangeCodeForToken(
  code: string,
  env: Env,
  instanceUrl: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const tokenUrl = DYNAMICS_TOKEN_URL.replace('{tenant}', env.DYNAMICS_TENANT_ID);

  const params = new URLSearchParams({
    client_id: env.DYNAMICS_CLIENT_ID,
    client_secret: env.DYNAMICS_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: `${instanceUrl}/user_impersonation offline_access`,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dynamics 365 OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
}

/**
 * Step 3: Refresh access token when it expires
 * Access tokens expire in ~1 hour, use refresh token to get new one
 */
export async function refreshAccessToken(
  refreshToken: string,
  env: Env,
  instanceUrl: string
): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const tokenUrl = DYNAMICS_TOKEN_URL.replace('{tenant}', env.DYNAMICS_TENANT_ID);

  const params = new URLSearchParams({
    client_id: env.DYNAMICS_CLIENT_ID,
    client_secret: env.DYNAMICS_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: `${instanceUrl}/user_impersonation offline_access`,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dynamics 365 token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
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
    'SELECT dynamics_instance_url, dynamics_access_token, dynamics_refresh_token, dynamics_token_expires_at FROM workspace_settings WHERE workspace_id = ?'
  ).bind(workspaceId).first();

  if (!settings || !settings.dynamics_refresh_token) {
    throw new Error('Dynamics 365 not connected for this workspace');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = settings.dynamics_token_expires_at || 0;

  // If token expires in less than 5 minutes, refresh it
  if (now >= expiresAt - 300) {
    console.log('[Dynamics 365] Access token expired, refreshing...');
    const newTokens = await refreshAccessToken(
      settings.dynamics_refresh_token,
      env,
      settings.dynamics_instance_url
    );

    // Update database with new tokens
    await db.prepare(
      'UPDATE workspace_settings SET dynamics_access_token = ?, dynamics_token_expires_at = ? WHERE workspace_id = ?'
    ).bind(
      newTokens.access_token,
      newTokens.expires_in,
      workspaceId
    ).run();

    return {
      instanceUrl: settings.dynamics_instance_url,
      accessToken: newTokens.access_token,
    };
  }

  return {
    instanceUrl: settings.dynamics_instance_url,
    accessToken: settings.dynamics_access_token,
  };
}

// ============================================
// PHONE NUMBER SEARCH
// ============================================

/**
 * Search for Lead or Contact by phone number
 * Searches in telephone1, mobilephone, and telephone2 fields
 * Priority: Leads first (new prospects), then Contacts (existing customers)
 */
export async function searchByPhone(
  instanceUrl: string,
  accessToken: string,
  phoneNumber: string
): Promise<{ id: string; type: 'lead' | 'contact' } | null> {
  // Clean phone number (remove non-digits)
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  // Try searching Leads first
  const leadFilter = `$filter=contains(telephone1,'${cleanPhone}') or contains(mobilephone,'${cleanPhone}') or contains(telephone2,'${cleanPhone}')&$select=leadid,fullname,telephone1,mobilephone`;

  const leadResponse = await fetch(
    `${instanceUrl}/api/data/v9.2/leads?${leadFilter}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    }
  );

  if (leadResponse.ok) {
    const leadData = await leadResponse.json();
    if (leadData.value && leadData.value.length > 0) {
      console.log(`[Dynamics 365] Found Lead: ${leadData.value[0].leadid}`);
      return {
        id: leadData.value[0].leadid,
        type: 'lead',
      };
    }
  }

  // If no lead found, search Contacts
  const contactFilter = `$filter=contains(telephone1,'${cleanPhone}') or contains(mobilephone,'${cleanPhone}') or contains(telephone2,'${cleanPhone}')&$select=contactid,fullname,telephone1,mobilephone`;

  const contactResponse = await fetch(
    `${instanceUrl}/api/data/v9.2/contacts?${contactFilter}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    }
  );

  if (contactResponse.ok) {
    const contactData = await contactResponse.json();
    if (contactData.value && contactData.value.length > 0) {
      console.log(`[Dynamics 365] Found Contact: ${contactData.value[0].contactid}`);
      return {
        id: contactData.value[0].contactid,
        type: 'contact',
      };
    }
  }

  console.log('[Dynamics 365] No Lead or Contact found for phone:', phoneNumber);
  return null;
}

// ============================================
// CREATE NEW LEAD
// ============================================

/**
 * Create a new Lead in Dynamics 365 when no existing contact is found
 */
export async function createNewLead(
  instanceUrl: string,
  accessToken: string,
  leadData: {
    phoneNumber: string;
    fullName?: string;
    companyName?: string;
    subject?: string;
  }
): Promise<string> {
  // Generate a subject/description for the lead
  const subject = leadData.subject || `Voice AI Call - ${leadData.phoneNumber}`;

  const payload: any = {
    telephone1: leadData.phoneNumber,
    subject: subject,
    leadsourcecode: 3, // Phone (valid values: 1-10, 3 typically = Phone)
    description: `Lead created from voice AI call on ${new Date().toLocaleString()}`,
  };

  // Add full name if provided (split into first/last name)
  if (leadData.fullName) {
    const nameParts = leadData.fullName.trim().split(' ');
    if (nameParts.length === 1) {
      payload.lastname = nameParts[0];
    } else {
      payload.firstname = nameParts.slice(0, -1).join(' ');
      payload.lastname = nameParts[nameParts.length - 1];
    }
  } else {
    // If no name provided, use phone number as last name
    payload.lastname = leadData.phoneNumber;
  }

  // Add company name if provided
  if (leadData.companyName) {
    payload.companyname = leadData.companyName;
  }

  console.log('[Dynamics 365] Creating new Lead:', payload);

  const response = await fetch(`${instanceUrl}/api/data/v9.2/leads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Lead: ${response.status} ${errorText}`);
  }

  const newLead = await response.json();
  const leadId = newLead.leadid;

  console.log(`[Dynamics 365] Successfully created Lead: ${leadId}`);
  return leadId;
}

// ============================================
// PHONE CALL ACTIVITY CREATION (CALL LOGS)
// ============================================

/**
 * Create a Phone Call activity on Lead or Contact record
 * Phone Call appears in Dynamics 365 Activity History
 */
export async function createCallLogActivity(
  instanceUrl: string,
  accessToken: string,
  recordId: string,
  recordType: 'lead' | 'contact',
  callData: {
    phoneNumber: string;
    duration: number; // seconds
    summary: string;
    callType: 'inbound' | 'outbound';
    callStartTime: string; // ISO 8601
  }
): Promise<string> {
  const durationMinutes = Math.floor(callData.duration / 60);

  // Determine the regarding field based on record type
  const regardingField = recordType === 'lead'
    ? 'regardingobjectid_lead_phonecall@odata.bind'
    : 'regardingobjectid_contact_phonecall@odata.bind';

  const regardingValue = recordType === 'lead'
    ? `/leads(${recordId})`
    : `/contacts(${recordId})`;

  const activityPayload = {
    subject: 'Inbound Call',
    [regardingField]: regardingValue,
    phonenumber: callData.phoneNumber,
    actualdurationminutes: durationMinutes,
    actualstart: callData.callStartTime,
    actualend: new Date(new Date(callData.callStartTime).getTime() + callData.duration * 1000).toISOString(),
    description: `Call Duration: ${durationMinutes} min ${callData.duration % 60} sec\nPhone: ${callData.phoneNumber}\n\n${callData.summary}`,
    directioncode: callData.callType === 'inbound',
    statecode: 1, // Completed
    statuscode: 4, // Received (valid status for completed state)
  };

  const response = await fetch(`${instanceUrl}/api/data/v9.2/phonecalls`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
    body: JSON.stringify(activityPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Dynamics 365] Phone Call creation failed:', error);
    throw new Error(`Dynamics 365 phone call creation failed: ${error}`);
  }

  const activityId = response.headers.get('OData-EntityId')?.match(/\(([^)]+)\)/)?.[1] || '';
  console.log('[Dynamics 365] Phone Call created:', activityId);
  return activityId;
}

// ============================================
// APPOINTMENT CREATION
// ============================================

/**
 * Parse appointment date and time strings into Date object
 */
function parseAppointmentDateTime(date: string, time: string): Date {
  let dateObj: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    dateObj = new Date(date);
  } else {
    dateObj = new Date(date);
  }

  const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${time}`);
  }

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2] || '0');
  const ampm = timeMatch[3]?.toLowerCase();

  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }

  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
}

/**
 * Create an Appointment activity on Lead or Contact record
 * Appointment appears in Dynamics 365 Calendar
 */
export async function createAppointmentActivity(
  instanceUrl: string,
  accessToken: string,
  recordId: string,
  recordType: 'lead' | 'contact',
  appointmentData: {
    date: string;
    time: string;
    type?: string;
    notes?: string;
    duration?: number;
  },
  callSummary: string
): Promise<string | null> {
  try {
    const startDateTime = parseAppointmentDateTime(
      appointmentData.date,
      appointmentData.time
    );

    const duration = appointmentData.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const regardingField = recordType === 'lead'
      ? 'regardingobjectid_lead_appointment@odata.bind'
      : 'regardingobjectid_contact_appointment@odata.bind';

    const regardingValue = recordType === 'lead'
      ? `/leads(${recordId})`
      : `/contacts(${recordId})`;

    const appointmentPayload = {
      subject: `${appointmentData.type || 'Appointment'} - Scheduled via Voice AI`,
      [regardingField]: regardingValue,
      scheduledstart: startDateTime.toISOString(),
      scheduledend: endDateTime.toISOString(),
      description: `Appointment scheduled during call.\n\n${appointmentData.notes ? `Notes: ${appointmentData.notes}\n\n` : ''}Call Summary:\n${callSummary}`,
      statecode: 0, // Open
      statuscode: 1, // Free
    };

    const response = await fetch(`${instanceUrl}/api/data/v9.2/appointments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
      body: JSON.stringify(appointmentPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Dynamics 365] Appointment creation failed:', error);
      throw new Error(`Dynamics 365 appointment creation failed: ${error}`);
    }

    const activityId = response.headers.get('OData-EntityId')?.match(/\(([^)]+)\)/)?.[1] || '';
    console.log('[Dynamics 365] Appointment created:', activityId);
    return activityId;
  } catch (error: any) {
    console.error('[Dynamics 365] Appointment creation error:', error.message);
    return null;
  }
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

/**
 * Main function: Sync call to Dynamics 365
 * 1. Search for Lead/Contact by phone
 * 2. Create Phone Call activity (call log)
 * 3. Create Appointment (if appointment data exists)
 */
export async function syncCallToDynamics(
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
  dynamicsRecordId?: string;
  dynamicsActivityId?: string;
  dynamicsAppointmentId?: string;
  error?: string;
}> {
  try {
    // Step 1: Ensure we have valid access token
    const { instanceUrl, accessToken } = await ensureValidToken(db, workspaceId, env);

    // Step 2: Search for Lead/Contact by phone
    let record = await searchByPhone(instanceUrl, accessToken, callData.phoneNumber);
    let leadCreated = false;

    if (!record) {
      // No existing Lead/Contact found - create a new Lead
      console.log('[Dynamics 365] No contact found, creating new Lead for:', callData.phoneNumber);

      try {
        const newLeadId = await createNewLead(instanceUrl, accessToken, {
          phoneNumber: callData.phoneNumber,
          subject: `Voice AI Call - ${callData.phoneNumber}`,
        });

        record = {
          id: newLeadId,
          type: 'lead',
        };
        leadCreated = true;

        console.log('[Dynamics 365] Created new Lead:', newLeadId);
      } catch (createError: any) {
        console.error('[Dynamics 365] Failed to create new Lead:', createError.message);

        // Log as "error" - failed to create Lead
        await db.prepare(
          'INSERT INTO dynamics_sync_logs (id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workspaceId,
          callId,
          'error',
          `Failed to create Lead: ${createError.message}`,
          callData.phoneNumber,
          Math.floor(Date.now() / 1000)
        ).run();

        return {
          success: false,
          error: `Failed to create Lead: ${createError.message}`,
        };
      }
    }

    // Step 3: Create Phone Call activity (call log)
    const activityId = await createCallLogActivity(
      instanceUrl,
      accessToken,
      record.id,
      record.type,
      callData
    );

    // Step 4: Create Appointment (if appointment data exists)
    let appointmentId: string | null = null;
    if (callData.appointmentData) {
      appointmentId = await createAppointmentActivity(
        instanceUrl,
        accessToken,
        record.id,
        record.type,
        callData.appointmentData,
        callData.summary
      );
    }

    // Step 5: Log success
    await db.prepare(
      'INSERT INTO dynamics_sync_logs (id, workspace_id, call_id, dynamics_record_id, dynamics_activity_id, dynamics_appointment_id, appointment_created, lead_created, status, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      callId,
      record.id,
      activityId,
      appointmentId,
      appointmentId ? 1 : 0,
      leadCreated ? 1 : 0,
      'success',
      callData.phoneNumber,
      Math.floor(Date.now() / 1000)
    ).run();

    console.log('[Dynamics 365] Sync completed successfully');
    return {
      success: true,
      dynamicsRecordId: record.id,
      dynamicsActivityId: activityId,
      dynamicsAppointmentId: appointmentId || undefined,
    };
  } catch (error: any) {
    // Log error
    await db.prepare(
      'INSERT INTO dynamics_sync_logs (id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      callId,
      'error',
      error.message,
      callData.phoneNumber,
      Math.floor(Date.now() / 1000)
    ).run();

    console.error('[Dynamics 365] Sync failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
