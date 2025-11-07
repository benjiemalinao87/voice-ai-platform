/**
 * HubSpot Integration Service
 *
 * Handles OAuth 2.0 authentication and REST API interactions with HubSpot
 * - OAuth: Authorization code flow with token refresh
 * - Search: Phone number search for Contacts
 * - Sync: Create Engagements (notes) with call summary and recording URL
 */

interface D1Database {
  prepare(query: string): any;
}

interface Env {
  HUBSPOT_CLIENT_ID: string;
  HUBSPOT_CLIENT_SECRET: string;
}

// ============================================
// CONFIGURATION
// ============================================

const OAUTH_CALLBACK_URL = 'https://api.voice-config.channelautomation.com/api/hubspot/oauth/callback';

// HubSpot OAuth endpoints
const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

// ============================================
// OAUTH 2.0 FLOW
// ============================================

/**
 * Step 1: Generate OAuth authorization URL
 * User will be redirected here to approve access
 */
export function buildAuthUrl(workspaceId: string, env: Env): string {
  const scopes = [
    'crm.objects.contacts.read',   // Search and read contact data
    'crm.objects.contacts.write',  // Update contact data
    'crm.objects.custom.write',    // Required by HubSpot app configuration
    'oauth',                       // OAuth scope
  ];

  const params = new URLSearchParams({
    client_id: env.HUBSPOT_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: scopes.join(' '),
    state: workspaceId, // Pass workspace ID to identify user on callback
  });

  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

/**
 * Step 2: Exchange authorization code for access & refresh tokens
 * Called after user approves and HubSpot redirects back with code
 */
export async function exchangeCodeForToken(code: string, env: Env): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.HUBSPOT_CLIENT_ID,
    client_secret: env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: OAUTH_CALLBACK_URL,
  });

  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

/**
 * Step 3: Refresh access token when it expires
 * Access tokens expire in ~6 hours, use refresh token to get new one
 */
export async function refreshAccessToken(refreshToken: string, env: Env): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.HUBSPOT_CLIENT_ID,
    client_secret: env.HUBSPOT_CLIENT_SECRET,
  });

  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

/**
 * Helper: Check if access token is expired and refresh if needed
 */
export async function ensureValidToken(
  db: D1Database,
  userId: string,
  workspaceId: string,
  env: Env
): Promise<string> {
  // Get current tokens from database
  const token = await db.prepare(
    'SELECT access_token, refresh_token, expires_at FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?'
  ).bind(userId, workspaceId).first();

  if (!token || !token.refresh_token) {
    throw new Error('HubSpot not connected for this user');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = token.expires_at || 0;

  // If token expires in less than 5 minutes, refresh it
  if (now >= expiresAt - 300) {
    console.log('[HubSpot] Access token expired, refreshing...');
    const newTokens = await refreshAccessToken(token.refresh_token, env);

    // Update database with new tokens
    await db.prepare(
      'UPDATE hubspot_oauth_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ? AND workspace_id = ?'
    ).bind(
      newTokens.access_token,
      newTokens.expires_in,
      Date.now(),
      userId,
      workspaceId
    ).run();

    return newTokens.access_token;
  }

  return token.access_token;
}

// ============================================
// PHONE NUMBER SEARCH
// ============================================

/**
 * Search for Contact by phone number using HubSpot Search API
 * Searches in phone and mobilephone properties with multiple fallback strategies
 */
export async function searchContactByPhone(
  accessToken: string,
  phoneNumber: string
): Promise<{ vid: number; phone?: string } | null> {
  // Clean phone number (remove non-digits)
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

  console.log('[HubSpot] Searching for phone:', phoneNumber, '| All digits:', digitsOnly, '| Last 10:', last10);

  // Generate possible phone format variations for EQ operator
  const phoneFormats = [];
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US number with country code
    const areaCode = last10.slice(0, 3);
    const prefix = last10.slice(3, 6);
    const line = last10.slice(6, 10);
    phoneFormats.push(
      `+1 (${areaCode}) ${prefix}-${line}`,  // +1 (626) 313-3690
      `+1${areaCode}${prefix}${line}`,       // +16263133690
      `1${areaCode}${prefix}${line}`,        // 16263133690
      `${areaCode}${prefix}${line}`,         // 6263133690
      `(${areaCode}) ${prefix}-${line}`,     // (626) 313-3690
      `${areaCode}-${prefix}-${line}`        // 626-313-3690
    );
  } else if (digitsOnly.length === 10) {
    // US number without country code
    const areaCode = digitsOnly.slice(0, 3);
    const prefix = digitsOnly.slice(3, 6);
    const line = digitsOnly.slice(6, 10);
    phoneFormats.push(
      `+1 (${areaCode}) ${prefix}-${line}`,
      `(${areaCode}) ${prefix}-${line}`,
      `${areaCode}-${prefix}-${line}`,
      `${areaCode}${prefix}${line}`
    );
  }

  // Strategy 1: Use area code + prefix (first 6 digits of last 10) for broad search
  const searchDigits = last10.substring(0, 6); // e.g., "626313" for (626) 313-3690
  console.log('[HubSpot] Strategy 1: Searching with first 6 digits:', searchDigits);

  let searchPayload = {
    query: searchDigits,
    filterGroups: [],
    properties: ['phone', 'mobilephone', 'firstname', 'lastname', 'email'],
    limit: 100, // Get more results to filter through
  };

  let response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchPayload),
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`[HubSpot] Query search found ${data.results?.length || 0} results`);

    if (data.results && data.results.length > 0) {
      // Filter through results to find exact match
      for (const contact of data.results) {
        const contactPhone = contact.properties.phone || '';
        const contactMobile = contact.properties.mobilephone || '';
        const cleanContactPhone = contactPhone.replace(/\D/g, '');
        const cleanContactMobile = contactMobile.replace(/\D/g, '');

        console.log('[HubSpot] Checking contact:', contact.id, '| Phone:', contactPhone, '| Mobile:', contactMobile);

        // Match if last 10 digits are the same
        if (cleanContactPhone.slice(-10) === last10 || cleanContactMobile.slice(-10) === last10) {
          console.log(`[HubSpot] Found match via query search:`, contact.id);
          return {
            vid: parseInt(contact.id),
            phone: contactPhone || contactMobile
          };
        }
      }
    }
  }

  // Strategy 2: CONTAINS_TOKEN with last 10 digits
  console.log('[HubSpot] Strategy 2: Trying CONTAINS_TOKEN with last 10 digits:', last10);

  searchPayload = {
    filterGroups: [
      {
        filters: [{ propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: last10 }]
      },
      {
        filters: [{ propertyName: 'mobilephone', operator: 'CONTAINS_TOKEN', value: last10 }]
      }
    ],
    properties: ['phone', 'mobilephone', 'firstname', 'lastname', 'email'],
    limit: 10,
  };

  response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[HubSpot] Contact search failed:', error);
    throw new Error(`HubSpot contact search failed: ${error}`);
  }

  let data2 = await response.json();
  console.log(`[HubSpot] CONTAINS_TOKEN search response:`, JSON.stringify(data2));

  // Check results and find best match
  if (data2.results && data2.results.length > 0) {
    console.log(`[HubSpot] Found ${data2.results.length} potential matches with CONTAINS_TOKEN`);

    for (const contact of data2.results) {
      const contactPhone = contact.properties.phone || '';
      const contactMobile = contact.properties.mobilephone || '';
      const cleanContactPhone = contactPhone.replace(/\D/g, '');
      const cleanContactMobile = contactMobile.replace(/\D/g, '');

      console.log('[HubSpot] Checking:', contact.id, '| Phone:', contactPhone, '| Mobile:', contactMobile);
      console.log('[HubSpot] Clean digits - Contact Phone:', cleanContactPhone, '| Contact Mobile:', cleanContactMobile, '| Looking for last10:', last10);

      // Match if last 10 digits are the same
      const contactLast10Phone = cleanContactPhone.slice(-10);
      const contactLast10Mobile = cleanContactMobile.slice(-10);

      console.log('[HubSpot] Last 10 comparison - Contact Phone:', contactLast10Phone, '| Contact Mobile:', contactLast10Mobile, '| Target:', last10);

      if (contactLast10Phone === last10 || contactLast10Mobile === last10) {
        console.log(`[HubSpot] Found matching contact: ${contact.id}`);
        return {
          vid: parseInt(contact.id),
          phone: contactPhone || contactMobile
        };
      }
    }
  }

  console.log('[HubSpot] No contact found for phone:', phoneNumber);
  return null;
}

// ============================================
// ENGAGEMENT CREATION (NOTES)
// ============================================

/**
 * Create an Engagement (Note) with call summary, structured data, and recording URL
 * Note appears in contact's timeline
 */
export async function createEngagement(
  accessToken: string,
  contactId: number,
  summary: string,
  recordingUrl: string,
  structuredData?: Record<string, any>
): Promise<{ id: number }> {
  let noteBody = `**Call Summary:**\n\n${summary}`;

  // Add structured data if available
  if (structuredData && Object.keys(structuredData).length > 0) {
    noteBody += '\n\n**Call Details:**\n';

    for (const [key, value] of Object.entries(structuredData)) {
      if (value !== null && value !== undefined && value !== '') {
        // Convert camelCase or snake_case to Title Case
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
          .trim();

        // Format the value
        let formattedValue = value;
        if (typeof value === 'object') {
          formattedValue = JSON.stringify(value, null, 2);
        }

        noteBody += `\n- **${formattedKey}:** ${formattedValue}`;
      }
    }
  }

  noteBody += `\n\n**Recording:** [Listen to Recording](${recordingUrl})`;

  const engagementPayload = {
    engagement: {
      active: true,
      type: 'NOTE',
      timestamp: Date.now(),
    },
    associations: {
      contactIds: [contactId],
    },
    metadata: {
      body: noteBody,
    },
  };

  const response = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(engagementPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[HubSpot] Engagement creation failed:', error);
    throw new Error(`HubSpot engagement creation failed: ${error}`);
  }

  const result = await response.json();
  console.log('[HubSpot] Engagement created:', result.engagement.id);
  return { id: result.engagement.id };
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

/**
 * Main function: Sync call to HubSpot
 * 1. Search for Contact by phone
 * 2. Create Engagement (note) with call summary, structured data, and recording URL
 */
export async function syncCallToHubSpot(
  db: D1Database,
  userId: string,
  workspaceId: string,
  callId: string,
  callData: {
    phoneNumber: string;
    summary: string;
    recordingUrl: string;
    structuredData?: Record<string, any>;
  },
  env: Env
): Promise<{
  success: boolean;
  contactId?: number;
  engagementId?: number;
  error?: string;
}> {
  try {
    // Step 1: Ensure we have valid access token
    const accessToken = await ensureValidToken(db, userId, workspaceId, env);

    // Step 2: Search for Contact by phone
    const contact = await searchContactByPhone(accessToken, callData.phoneNumber);

    if (!contact) {
      // Log as "skipped" - phone number not found in HubSpot
      await db.prepare(
        'INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        `hs_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        workspaceId,
        callId,
        'skipped',
        'Phone number not found in HubSpot',
        callData.phoneNumber,
        Date.now()
      ).run();

      return {
        success: false,
        error: 'Phone number not found in HubSpot',
      };
    }

    // Step 3: Create Engagement (note)
    const engagement = await createEngagement(
      accessToken,
      contact.vid,
      callData.summary,
      callData.recordingUrl,
      callData.structuredData
    );

    // Step 4: Log success
    await db.prepare(
      'INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, contact_id, engagement_id, status, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `hs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      workspaceId,
      callId,
      contact.vid.toString(),
      engagement.id.toString(),
      'success',
      callData.phoneNumber,
      Date.now()
    ).run();

    console.log('[HubSpot] Sync completed successfully');
    return {
      success: true,
      contactId: contact.vid,
      engagementId: engagement.id,
    };
  } catch (error: any) {
    // Log error
    await db.prepare(
      'INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `hs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      workspaceId,
      callId,
      'error',
      error.message,
      callData.phoneNumber,
      Date.now()
    ).run();

    console.error('[HubSpot] Sync failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
