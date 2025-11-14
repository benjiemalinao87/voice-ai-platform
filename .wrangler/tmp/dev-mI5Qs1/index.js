var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers/auth.ts
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
__name(verifyPassword, "verifyPassword");
async function generateToken(userId, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
    // 7 days
  };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${encodedSignature}`;
}
__name(generateToken, "generateToken");
async function verifyToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signature = Uint8Array.from(atob(encodedSignature), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(data)
    );
    if (!valid) return null;
    const payload = JSON.parse(atob(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return { userId: payload.userId };
  } catch (error) {
    return null;
  }
}
__name(verifyToken, "verifyToken");
function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateSalt, "generateSalt");
function generateTemporaryPassword() {
  const words = [
    "Cloud",
    "Secure",
    "Voice",
    "Team",
    "Digital",
    "Smart",
    "Quick",
    "Bright",
    "Swift",
    "Prime",
    "Elite",
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Omega",
    "Nexus",
    "Quantum",
    "Stellar",
    "Cosmic",
    "Cyber",
    "Pixel",
    "Matrix",
    "Vertex"
  ];
  const specialChars = "!@#$%^&*";
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const word3 = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  const special = specialChars[Math.floor(Math.random() * specialChars.length)];
  return `${word1}-${word2}-${word3}-${digits}${special}`;
}
__name(generateTemporaryPassword, "generateTemporaryPassword");

// workers/cache.ts
var VoiceAICache = class {
  static {
    __name(this, "VoiceAICache");
  }
  kv;
  defaultTTL;
  constructor(kv, defaultTTL = 300) {
    this.kv = kv;
    this.defaultTTL = defaultTTL;
  }
  /**
   * Generate cache key for recordings page
   */
  getRecordingsKey(userId, page = 1, limit = 50) {
    return `recordings:user:${userId}:page:${page}:limit:${limit}`;
  }
  /**
   * Generate cache key for individual call details
   */
  getCallKey(userId, callId) {
    return `recordings:user:${userId}:call:${callId}`;
  }
  /**
   * Generate cache key for intent analysis
   */
  getIntentKey(userId, callId) {
    return `intent:user:${userId}:analysis:${callId}`;
  }
  /**
   * Generate cache key for intent dashboard summary
   */
  getIntentSummaryKey(userId) {
    return `intent:user:${userId}:summary`;
  }
  /**
   * Generate cache key for enhanced data
   */
  getEnhancedDataKey(userId, callId) {
    return `enhanced:user:${userId}:call:${callId}`;
  }
  /**
   * Get data from cache
   */
  async get(key) {
    try {
      const cached = await this.kv.get(key, "json");
      if (!cached) {
        return null;
      }
      const now4 = Math.floor(Date.now() / 1e3);
      if (cached.timestamp + cached.ttl < now4) {
        await this.kv.delete(key);
        return null;
      }
      return cached.data;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }
  /**
   * Set data in cache
   */
  async set(key, data, options = {}) {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const entry = {
        data,
        timestamp: Math.floor(Date.now() / 1e3),
        ttl,
        tags: options.tags
      };
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttl
      });
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }
  /**
   * Delete data from cache
   */
  async delete(key) {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }
  /**
   * Invalidate cache by pattern (for user-specific data)
   */
  async invalidateUserCache(userId) {
    try {
      const list = await this.kv.list({ prefix: `recordings:user:${userId}:` });
      const intentList = await this.kv.list({ prefix: `intent:user:${userId}:` });
      const enhancedList = await this.kv.list({ prefix: `enhanced:user:${userId}:` });
      const keysToDelete = [
        ...list.keys.map((k) => k.name),
        ...intentList.keys.map((k) => k.name),
        ...enhancedList.keys.map((k) => k.name)
      ];
      await Promise.all(keysToDelete.map((key) => this.kv.delete(key)));
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }
  /**
   * Cache recordings page data
   */
  async cacheRecordings(userId, recordings, page = 1, limit = 50, ttl = 300) {
    const key = this.getRecordingsKey(userId, page, limit);
    await this.set(key, recordings, { ttl });
  }
  /**
   * Get cached recordings page data
   */
  async getCachedRecordings(userId, page = 1, limit = 50) {
    const key = this.getRecordingsKey(userId, page, limit);
    return await this.get(key);
  }
  /**
   * Cache individual call details
   */
  async cacheCall(userId, callId, callData, ttl = 600) {
    const key = this.getCallKey(userId, callId);
    await this.set(key, callData, { ttl });
  }
  /**
   * Get cached call details
   */
  async getCachedCall(userId, callId) {
    const key = this.getCallKey(userId, callId);
    return await this.get(key);
  }
  /**
   * Cache intent analysis data
   */
  async cacheIntentAnalysis(userId, callId, intentData, ttl = 600) {
    const key = this.getIntentKey(userId, callId);
    await this.set(key, intentData, { ttl });
  }
  /**
   * Get cached intent analysis
   */
  async getCachedIntentAnalysis(userId, callId) {
    const key = this.getIntentKey(userId, callId);
    return await this.get(key);
  }
  /**
   * Cache intent dashboard summary
   */
  async cacheIntentSummary(userId, summaryData, ttl = 120) {
    const key = this.getIntentSummaryKey(userId);
    await this.set(key, summaryData, { ttl });
  }
  /**
   * Get cached intent summary
   */
  async getCachedIntentSummary(userId) {
    const key = this.getIntentSummaryKey(userId);
    return await this.get(key);
  }
  /**
   * Cache enhanced data
   */
  async cacheEnhancedData(userId, callId, enhancedData, ttl = 1800) {
    const key = this.getEnhancedDataKey(userId, callId);
    await this.set(key, enhancedData, { ttl });
  }
  /**
   * Get cached enhanced data
   */
  async getCachedEnhancedData(userId, callId) {
    const key = this.getEnhancedDataKey(userId, callId);
    return await this.get(key);
  }
  /**
   * Invalidate specific call cache
   */
  async invalidateCallCache(userId, callId) {
    await Promise.all([
      this.delete(this.getCallKey(userId, callId)),
      this.delete(this.getIntentKey(userId, callId)),
      this.delete(this.getEnhancedDataKey(userId, callId))
    ]);
  }
  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const recordingsList = await this.kv.list({ prefix: "recordings:" });
      const intentList = await this.kv.list({ prefix: "intent:" });
      const enhancedList = await this.kv.list({ prefix: "enhanced:" });
      return {
        totalKeys: recordingsList.keys.length + intentList.keys.length + enhancedList.keys.length,
        recordingsKeys: recordingsList.keys.length,
        intentKeys: intentList.keys.length,
        enhancedKeys: enhancedList.keys.length
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        totalKeys: 0,
        recordingsKeys: 0,
        intentKeys: 0,
        enhancedKeys: 0
      };
    }
  }
};
var CACHE_TTL = {
  RECORDINGS: 300,
  // 5 minutes
  CALL_DETAILS: 600,
  // 10 minutes
  INTENT_ANALYSIS: 600,
  // 10 minutes
  INTENT_SUMMARY: 120,
  // 2 minutes
  ENHANCED_DATA: 1800
  // 30 minutes
};

// workers/hubspot-service.ts
var OAUTH_CALLBACK_URL = "https://api.voice-config.channelautomation.com/api/hubspot/oauth/callback";
var HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
var HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
function buildAuthUrl(workspaceId, env) {
  const scopes = [
    "crm.objects.contacts.read",
    // Search and read contact data
    "crm.objects.contacts.write",
    // Update contact data
    "crm.objects.custom.write",
    // Required by HubSpot app configuration
    "oauth"
    // OAuth scope
  ];
  const params = new URLSearchParams({
    client_id: env.HUBSPOT_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: scopes.join(" "),
    state: workspaceId
    // Pass workspace ID to identify user on callback
  });
  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}
__name(buildAuthUrl, "buildAuthUrl");
async function exchangeCodeForToken(code, env) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.HUBSPOT_CLIENT_ID,
    client_secret: env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: OAUTH_CALLBACK_URL
  });
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot OAuth token exchange failed: ${error}`);
  }
  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: Math.floor(Date.now() / 1e3) + data.expires_in
  };
}
__name(exchangeCodeForToken, "exchangeCodeForToken");
async function refreshAccessToken(refreshToken, env) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.HUBSPOT_CLIENT_ID,
    client_secret: env.HUBSPOT_CLIENT_SECRET
  });
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot token refresh failed: ${error}`);
  }
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: Math.floor(Date.now() / 1e3) + data.expires_in
  };
}
__name(refreshAccessToken, "refreshAccessToken");
async function ensureValidToken(db, userId, workspaceId, env) {
  const token = await db.prepare(
    "SELECT access_token, refresh_token, expires_at FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?"
  ).bind(userId, workspaceId).first();
  if (!token || !token.refresh_token) {
    throw new Error("HubSpot not connected for this user");
  }
  const now4 = Math.floor(Date.now() / 1e3);
  const expiresAt = token.expires_at || 0;
  if (now4 >= expiresAt - 300) {
    console.log("[HubSpot] Access token expired, refreshing...");
    const newTokens = await refreshAccessToken(token.refresh_token, env);
    await db.prepare(
      "UPDATE hubspot_oauth_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ? AND workspace_id = ?"
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
__name(ensureValidToken, "ensureValidToken");
async function searchContactByPhone(accessToken, phoneNumber) {
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
  console.log("[HubSpot] Searching for phone:", phoneNumber, "| All digits:", digitsOnly, "| Last 10:", last10);
  const phoneFormats = [];
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    const areaCode = last10.slice(0, 3);
    const prefix = last10.slice(3, 6);
    const line = last10.slice(6, 10);
    phoneFormats.push(
      `+1 (${areaCode}) ${prefix}-${line}`,
      // +1 (626) 313-3690
      `+1${areaCode}${prefix}${line}`,
      // +16263133690
      `1${areaCode}${prefix}${line}`,
      // 16263133690
      `${areaCode}${prefix}${line}`,
      // 6263133690
      `(${areaCode}) ${prefix}-${line}`,
      // (626) 313-3690
      `${areaCode}-${prefix}-${line}`
      // 626-313-3690
    );
  } else if (digitsOnly.length === 10) {
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
  const searchDigits = last10.substring(0, 6);
  console.log("[HubSpot] Strategy 1: Searching with first 6 digits:", searchDigits);
  let searchPayload = {
    query: searchDigits,
    filterGroups: [],
    properties: ["phone", "mobilephone", "firstname", "lastname", "email"],
    limit: 100
    // Get more results to filter through
  };
  let response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(searchPayload)
  });
  if (response.ok) {
    const data = await response.json();
    console.log(`[HubSpot] Query search found ${data.results?.length || 0} results`);
    if (data.results && data.results.length > 0) {
      for (const contact of data.results) {
        const contactPhone = contact.properties.phone || "";
        const contactMobile = contact.properties.mobilephone || "";
        const cleanContactPhone = contactPhone.replace(/\D/g, "");
        const cleanContactMobile = contactMobile.replace(/\D/g, "");
        console.log("[HubSpot] Checking contact:", contact.id, "| Phone:", contactPhone, "| Mobile:", contactMobile);
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
  console.log("[HubSpot] Strategy 2: Trying CONTAINS_TOKEN with last 10 digits:", last10);
  searchPayload = {
    filterGroups: [
      {
        filters: [{ propertyName: "phone", operator: "CONTAINS_TOKEN", value: last10 }]
      },
      {
        filters: [{ propertyName: "mobilephone", operator: "CONTAINS_TOKEN", value: last10 }]
      }
    ],
    properties: ["phone", "mobilephone", "firstname", "lastname", "email"],
    limit: 10
  };
  response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(searchPayload)
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("[HubSpot] Contact search failed:", error);
    throw new Error(`HubSpot contact search failed: ${error}`);
  }
  let data2 = await response.json();
  console.log(`[HubSpot] CONTAINS_TOKEN search response:`, JSON.stringify(data2));
  if (data2.results && data2.results.length > 0) {
    console.log(`[HubSpot] Found ${data2.results.length} potential matches with CONTAINS_TOKEN`);
    for (const contact of data2.results) {
      const contactPhone = contact.properties.phone || "";
      const contactMobile = contact.properties.mobilephone || "";
      const cleanContactPhone = contactPhone.replace(/\D/g, "");
      const cleanContactMobile = contactMobile.replace(/\D/g, "");
      console.log("[HubSpot] Checking:", contact.id, "| Phone:", contactPhone, "| Mobile:", contactMobile);
      console.log("[HubSpot] Clean digits - Contact Phone:", cleanContactPhone, "| Contact Mobile:", cleanContactMobile, "| Looking for last10:", last10);
      const contactLast10Phone = cleanContactPhone.slice(-10);
      const contactLast10Mobile = cleanContactMobile.slice(-10);
      console.log("[HubSpot] Last 10 comparison - Contact Phone:", contactLast10Phone, "| Contact Mobile:", contactLast10Mobile, "| Target:", last10);
      if (contactLast10Phone === last10 || contactLast10Mobile === last10) {
        console.log(`[HubSpot] Found matching contact: ${contact.id}`);
        return {
          vid: parseInt(contact.id),
          phone: contactPhone || contactMobile
        };
      }
    }
  }
  console.log("[HubSpot] No contact found for phone:", phoneNumber);
  return null;
}
__name(searchContactByPhone, "searchContactByPhone");
async function createEngagement(accessToken, contactId, summary, structuredData, conversation, structuredOutputs) {
  let noteBody = `**Call Summary:**

${summary}`;
  if (structuredData && Object.keys(structuredData).length > 0) {
    noteBody += "\n\n**Call Details:**\n";
    for (const [key, value] of Object.entries(structuredData)) {
      if (value !== null && value !== void 0 && value !== "") {
        const formattedKey = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()).trim();
        let formattedValue = value;
        if (typeof value === "object") {
          formattedValue = JSON.stringify(value, null, 2);
        }
        noteBody += `
- **${formattedKey}:** ${formattedValue}`;
      }
    }
  }
  if (structuredOutputs && Object.keys(structuredOutputs).length > 0) {
    noteBody += "\n\n**Structured Outputs:**\n";
    for (const [key, value] of Object.entries(structuredOutputs)) {
      if (value !== null && value !== void 0) {
        let fieldName = key;
        let fieldValue = value;
        if (typeof value === "object" && value !== null) {
          if ("name" in value && "result" in value) {
            fieldName = value.name;
            fieldValue = value.result;
          } else {
            fieldValue = JSON.stringify(value, null, 2);
          }
        }
        let displayValue = fieldValue;
        if (typeof fieldValue === "boolean") {
          displayValue = fieldValue ? "Yes" : "No";
        } else if (typeof fieldValue === "string") {
          displayValue = fieldValue;
        } else if (typeof fieldValue === "number") {
          displayValue = fieldValue.toString();
        } else {
          displayValue = JSON.stringify(fieldValue);
        }
        noteBody += `
- **${fieldName}:** ${displayValue}`;
      }
    }
  }
  if (conversation && conversation.length > 0) {
    noteBody += "\n\n**Conversation Transcript:**\n";
    for (const turn of conversation) {
      const speaker = turn.role === "assistant" ? "AI Assistant" : "Customer";
      noteBody += `
**${speaker}:** ${turn.message}
`;
    }
  }
  const engagementPayload = {
    engagement: {
      active: true,
      type: "NOTE",
      timestamp: Date.now()
    },
    associations: {
      contactIds: [contactId]
    },
    metadata: {
      body: noteBody
    }
  };
  const response = await fetch("https://api.hubapi.com/engagements/v1/engagements", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(engagementPayload)
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("[HubSpot] Engagement creation failed:", error);
    throw new Error(`HubSpot engagement creation failed: ${error}`);
  }
  const result = await response.json();
  console.log("[HubSpot] Engagement created:", result.engagement.id);
  return { id: result.engagement.id };
}
__name(createEngagement, "createEngagement");
async function syncCallToHubSpot(db, userId, workspaceId, callId, callData, env) {
  try {
    const accessToken = await ensureValidToken(db, userId, workspaceId, env);
    const contact = await searchContactByPhone(accessToken, callData.phoneNumber);
    if (!contact) {
      await db.prepare(
        "INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        `hs_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        workspaceId,
        callId,
        "skipped",
        "Phone number not found in HubSpot",
        callData.phoneNumber,
        Date.now()
      ).run();
      return {
        success: false,
        error: "Phone number not found in HubSpot"
      };
    }
    const engagement = await createEngagement(
      accessToken,
      contact.vid,
      callData.summary,
      callData.structuredData,
      callData.conversation,
      callData.structuredOutputs
    );
    await db.prepare(
      "INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, contact_id, engagement_id, status, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      `hs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      workspaceId,
      callId,
      contact.vid.toString(),
      engagement.id.toString(),
      "success",
      callData.phoneNumber,
      Date.now()
    ).run();
    console.log("[HubSpot] Sync completed successfully");
    return {
      success: true,
      contactId: contact.vid,
      engagementId: engagement.id
    };
  } catch (error) {
    await db.prepare(
      "INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      `hs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      workspaceId,
      callId,
      "error",
      error.message,
      callData.phoneNumber,
      Date.now()
    ).run();
    console.error("[HubSpot] Sync failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
__name(syncCallToHubSpot, "syncCallToHubSpot");

// workers/outbound-webhooks.ts
function generateLogId() {
  return `obwhlog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
__name(generateLogId, "generateLogId");
function now() {
  return Math.floor(Date.now() / 1e3);
}
__name(now, "now");
async function downloadAndSaveRecording(env, recordingUrl, callId) {
  if (!recordingUrl) return null;
  try {
    console.log(`[R2] Downloading recording from VAPI: ${recordingUrl}`);
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      console.error(`[R2] Failed to download recording: ${response.status}`);
      return null;
    }
    const r2Key = `recordings/${callId}.wav`;
    await env.RECORDINGS.put(r2Key, response.body, {
      httpMetadata: {
        contentType: "audio/wav"
      }
    });
    console.log(`[R2] Saved recording to R2: ${r2Key}`);
    return `https://call-recording.channelautomation.com/${r2Key}`;
  } catch (error) {
    console.error("[R2] Error saving recording:", error);
    return null;
  }
}
__name(downloadAndSaveRecording, "downloadAndSaveRecording");
function buildOutboundPayload(eventType, data) {
  const basePayload = {
    event: eventType,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    call_id: data.callId,
    customer_phone: data.customerPhone || null,
    assistant_name: data.assistantName || "AI Assistant"
  };
  if (eventType === "call.started") {
    return {
      ...basePayload,
      status: "ringing"
    };
  }
  return {
    ...basePayload,
    duration_seconds: data.durationSeconds || 0,
    ended_reason: data.endedReason || "unknown",
    call_summary: data.summary || "",
    call_details: data.structuredData || {},
    structured_outputs: data.structuredOutputs || {},
    conversation_transcript: data.conversation || [],
    recording_url: data.recordingUrl || null
  };
}
__name(buildOutboundPayload, "buildOutboundPayload");
function extractConversation(messages) {
  if (!messages || !Array.isArray(messages)) return [];
  return messages.filter((msg) => msg.role === "user" || msg.role === "bot" || msg.role === "assistant").map((msg) => ({
    role: msg.role === "bot" ? "assistant" : msg.role,
    message: msg.message || msg.content || ""
  }));
}
__name(extractConversation, "extractConversation");
async function dispatchOutboundWebhook(env, outboundWebhook, payload, eventType, callId) {
  const logId = generateLogId();
  const timestamp = now();
  try {
    console.log(`[Outbound Webhook] Dispatching ${eventType} to ${outboundWebhook.destination_url}`);
    const response = await fetch(outboundWebhook.destination_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Voice-AI-Dashboard/1.0"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1e4)
      // 10 second timeout
    });
    const responseText = await response.text();
    await env.DB.prepare(
      `INSERT INTO outbound_webhook_logs
       (id, outbound_webhook_id, event_type, call_id, status, http_status, response_body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      outboundWebhook.id,
      eventType,
      callId,
      response.ok ? "success" : "failed",
      response.status,
      responseText.substring(0, 1e3),
      // Limit response body to 1000 chars
      timestamp
    ).run();
    console.log(`[Outbound Webhook] Response ${response.status}: ${responseText.substring(0, 100)}`);
  } catch (error) {
    console.error(`[Outbound Webhook] Error:`, error);
    await env.DB.prepare(
      `INSERT INTO outbound_webhook_logs
       (id, outbound_webhook_id, event_type, call_id, status, http_status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      outboundWebhook.id,
      eventType,
      callId,
      "failed",
      0,
      error.message || String(error),
      timestamp
    ).run();
  }
}
__name(dispatchOutboundWebhook, "dispatchOutboundWebhook");
async function dispatchToOutboundWebhooks(env, userId, eventType, callData) {
  console.log(`[DEBUG] dispatchToOutboundWebhooks called for user ${userId}, event: ${eventType}`);
  try {
    const webhooks = await env.DB.prepare(
      `SELECT id, destination_url, events FROM outbound_webhooks
       WHERE user_id = ? AND is_active = 1`
    ).bind(userId).all();
    if (!webhooks.results || webhooks.results.length === 0) {
      console.log(`[Outbound Webhook] No active webhooks for user ${userId}`);
      return;
    }
    console.log(`[Outbound Webhook] Found ${webhooks.results.length} active webhook(s) for user ${userId}`);
    let r2RecordingUrl = callData.recordingUrl;
    if (eventType === "call.ended" && callData.recordingUrl) {
      const savedUrl = await downloadAndSaveRecording(env, callData.recordingUrl, callData.callId);
      if (savedUrl) {
        r2RecordingUrl = savedUrl;
        console.log("[R2] Using R2 recording URL for all webhooks:", r2RecordingUrl);
      }
    }
    console.log("[HubSpot] Checking sync - eventType:", eventType, "hasRecording:", !!r2RecordingUrl, "hasPhone:", !!callData.customerPhone, "hasSummary:", !!callData.summary);
    try {
      await env.DB.prepare(
        "INSERT INTO hubspot_sync_logs (id, user_id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        `debug_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        "debug",
        callData.callId,
        "debug",
        `Event:${eventType} RecURL:${r2RecordingUrl ? "YES" : "NO"} Phone:${callData.customerPhone || "NO"} Summary:${callData.summary ? "YES" : "NO"}`,
        callData.customerPhone || "none",
        Date.now()
      ).run();
    } catch (e) {
      console.error("[DEBUG] Failed to log debug info:", e);
    }
    if (eventType === "call.ended" && r2RecordingUrl && callData.customerPhone && callData.summary) {
      try {
        const wsSettings = await env.DB.prepare(
          "SELECT workspace_id FROM user_settings WHERE user_id = ? LIMIT 1"
        ).bind(userId).first();
        console.log("[HubSpot] Workspace settings:", wsSettings);
        const hubspotTokens = await env.DB.prepare(
          "SELECT access_token FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?"
        ).bind(userId, wsSettings?.workspace_id).first();
        console.log("[HubSpot] HubSpot tokens:", hubspotTokens ? "Found" : "Not found");
        if (hubspotTokens) {
          console.log("[HubSpot] Syncing call with R2 recording URL:", r2RecordingUrl);
          await syncCallToHubSpot(
            env.DB,
            userId,
            wsSettings?.workspace_id || "",
            callData.callId,
            {
              phoneNumber: callData.customerPhone,
              summary: callData.summary,
              recordingUrl: r2RecordingUrl
              // Use R2 URL
            },
            env
          );
        } else {
          console.log("[HubSpot] Skipping sync - HubSpot not connected for user:", userId);
        }
      } catch (hubspotError) {
        console.error("[HubSpot] Sync error in outbound webhook:", hubspotError);
      }
    } else {
      console.log("[HubSpot] Skipping sync - missing required fields");
    }
    for (const webhook of webhooks.results) {
      const subscribedEvents = webhook.events?.split(",") || ["call.ended"];
      if (!subscribedEvents.includes(eventType)) {
        console.log(`[Outbound Webhook] Skipping ${webhook.destination_url} - not subscribed to ${eventType}`);
        continue;
      }
      let conversation = [];
      let structuredOutputs = {};
      if (eventType === "call.ended" && callData.rawPayload) {
        const messages = callData.rawPayload?.message?.artifact?.messages || [];
        conversation = extractConversation(messages);
        const analysis = callData.rawPayload?.message?.analysis || {};
        const artifact = callData.rawPayload?.message?.artifact || {};
        structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || {};
      }
      const payload = buildOutboundPayload(eventType, {
        ...callData,
        conversation,
        structuredOutputs,
        recordingUrl: r2RecordingUrl
      });
      await dispatchOutboundWebhook(env, webhook, payload, eventType, callData.callId);
    }
  } catch (error) {
    console.error("[Outbound Webhook] Error in dispatchToOutboundWebhooks:", error);
  }
}
__name(dispatchToOutboundWebhooks, "dispatchToOutboundWebhooks");

// workers/outbound-webhooks-api.ts
function generateId2() {
  return `obwh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
__name(generateId2, "generateId");
function now2() {
  return Math.floor(Date.now() / 1e3);
}
__name(now2, "now");
function jsonResponse(data, status = 200) {
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders2
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function createOutboundWebhook(request, env, userId) {
  try {
    const body = await request.json();
    const { name, destination_url, events } = body;
    if (!name || !destination_url) {
      return jsonResponse({ error: "Missing required fields: name, destination_url" }, 400);
    }
    try {
      new URL(destination_url);
    } catch (e) {
      return jsonResponse({ error: "Invalid destination_url" }, 400);
    }
    const validEvents = ["call.started", "call.ended"];
    const eventList = events ? events.split(",").map((e) => e.trim()) : ["call.ended"];
    for (const event of eventList) {
      if (!validEvents.includes(event)) {
        return jsonResponse({ error: `Invalid event: ${event}. Valid events: ${validEvents.join(", ")}` }, 400);
      }
    }
    const webhookId = generateId2();
    const timestamp = now2();
    await env.DB.prepare(
      `INSERT INTO outbound_webhooks
       (id, user_id, name, destination_url, is_active, events, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      webhookId,
      userId,
      name,
      destination_url,
      1,
      // active by default
      eventList.join(","),
      timestamp,
      timestamp
    ).run();
    return jsonResponse({
      id: webhookId,
      name,
      destination_url,
      is_active: true,
      events: eventList,
      created_at: timestamp
    }, 201);
  } catch (error) {
    console.error("[Outbound Webhooks API] Create error:", error);
    return jsonResponse({ error: error.message || "Failed to create outbound webhook" }, 500);
  }
}
__name(createOutboundWebhook, "createOutboundWebhook");
async function listOutboundWebhooks(env, userId) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, destination_url, is_active, events, created_at, updated_at
       FROM outbound_webhooks
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(userId).all();
    const webhooks = (results || []).map((webhook) => ({
      ...webhook,
      events: webhook.events ? webhook.events.split(",") : ["call.ended"],
      is_active: Boolean(webhook.is_active)
    }));
    return jsonResponse({ webhooks });
  } catch (error) {
    console.error("[Outbound Webhooks API] List error:", error);
    return jsonResponse({ error: error.message || "Failed to list outbound webhooks" }, 500);
  }
}
__name(listOutboundWebhooks, "listOutboundWebhooks");
async function updateOutboundWebhook(request, env, userId, webhookId) {
  try {
    const webhook = await env.DB.prepare(
      "SELECT user_id FROM outbound_webhooks WHERE id = ?"
    ).bind(webhookId).first();
    if (!webhook) {
      return jsonResponse({ error: "Outbound webhook not found" }, 404);
    }
    if (webhook.user_id !== userId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    const body = await request.json();
    const { name, destination_url, is_active, events } = body;
    const updates = [];
    const params = [];
    if (name !== void 0) {
      updates.push("name = ?");
      params.push(name);
    }
    if (destination_url !== void 0) {
      try {
        new URL(destination_url);
      } catch (e) {
        return jsonResponse({ error: "Invalid destination_url" }, 400);
      }
      updates.push("destination_url = ?");
      params.push(destination_url);
    }
    if (is_active !== void 0) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }
    if (events !== void 0) {
      const validEvents = ["call.started", "call.ended"];
      const eventList = Array.isArray(events) ? events : events.split(",").map((e) => e.trim());
      for (const event of eventList) {
        if (!validEvents.includes(event)) {
          return jsonResponse({ error: `Invalid event: ${event}` }, 400);
        }
      }
      updates.push("events = ?");
      params.push(eventList.join(","));
    }
    if (updates.length === 0) {
      return jsonResponse({ error: "No fields to update" }, 400);
    }
    updates.push("updated_at = ?");
    params.push(now2());
    params.push(webhookId);
    await env.DB.prepare(
      `UPDATE outbound_webhooks SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...params).run();
    return jsonResponse({ message: "Outbound webhook updated successfully" });
  } catch (error) {
    console.error("[Outbound Webhooks API] Update error:", error);
    return jsonResponse({ error: error.message || "Failed to update outbound webhook" }, 500);
  }
}
__name(updateOutboundWebhook, "updateOutboundWebhook");
async function deleteOutboundWebhook(env, userId, webhookId) {
  try {
    const webhook = await env.DB.prepare(
      "SELECT user_id FROM outbound_webhooks WHERE id = ?"
    ).bind(webhookId).first();
    if (!webhook) {
      return jsonResponse({ error: "Outbound webhook not found" }, 404);
    }
    if (webhook.user_id !== userId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    await env.DB.prepare(
      "DELETE FROM outbound_webhooks WHERE id = ?"
    ).bind(webhookId).run();
    return jsonResponse({ message: "Outbound webhook deleted successfully" });
  } catch (error) {
    console.error("[Outbound Webhooks API] Delete error:", error);
    return jsonResponse({ error: error.message || "Failed to delete outbound webhook" }, 500);
  }
}
__name(deleteOutboundWebhook, "deleteOutboundWebhook");
async function getOutboundWebhookLogs(env, userId, webhookId) {
  try {
    const webhook = await env.DB.prepare(
      "SELECT user_id FROM outbound_webhooks WHERE id = ?"
    ).bind(webhookId).first();
    if (!webhook) {
      return jsonResponse({ error: "Outbound webhook not found" }, 404);
    }
    if (webhook.user_id !== userId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    const { results } = await env.DB.prepare(
      `SELECT id, event_type, call_id, status, http_status, response_body, error_message, retry_count, created_at
       FROM outbound_webhook_logs
       WHERE outbound_webhook_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).bind(webhookId).all();
    return jsonResponse({ logs: results || [] });
  } catch (error) {
    console.error("[Outbound Webhooks API] Get logs error:", error);
    return jsonResponse({ error: error.message || "Failed to get webhook logs" }, 500);
  }
}
__name(getOutboundWebhookLogs, "getOutboundWebhookLogs");

// workers/salesforce-service.ts
var OAUTH_CALLBACK_URL2 = "https://api.voice-config.channelautomation.com/api/salesforce/oauth/callback";
var SALESFORCE_AUTH_URL = "https://login.salesforce.com/services/oauth2/authorize";
var SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
function buildAuthUrl2(workspaceId, env) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SALESFORCE_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL2,
    scope: "api refresh_token",
    state: workspaceId
    // Pass workspace ID to identify user on callback
  });
  return `${SALESFORCE_AUTH_URL}?${params.toString()}`;
}
__name(buildAuthUrl2, "buildAuthUrl");
async function exchangeCodeForToken2(code, env) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.SALESFORCE_CLIENT_ID,
    client_secret: env.SALESFORCE_CLIENT_SECRET,
    redirect_uri: OAUTH_CALLBACK_URL2
  });
  const response = await fetch(SALESFORCE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
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
    expires_in: data.issued_at ? Math.floor(Date.now() / 1e3) + 7200 : Math.floor(Date.now() / 1e3) + 7200
    // 2 hours
  };
}
__name(exchangeCodeForToken2, "exchangeCodeForToken");

// workers/dynamics-service.ts
var OAUTH_CALLBACK_URL3 = "https://api.voice-config.channelautomation.com/api/dynamics/oauth/callback";
var DYNAMICS_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize";
var DYNAMICS_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";
function buildAuthUrl3(workspaceId, env, instanceUrl) {
  const authUrl = DYNAMICS_AUTH_URL.replace("{tenant}", env.DYNAMICS_TENANT_ID);
  const params = new URLSearchParams({
    client_id: env.DYNAMICS_CLIENT_ID,
    response_type: "code",
    redirect_uri: OAUTH_CALLBACK_URL3,
    response_mode: "query",
    scope: `${instanceUrl}/user_impersonation offline_access`,
    state: `${workspaceId}|${instanceUrl}`
    // Pass workspace ID and instance URL
  });
  return `${authUrl}?${params.toString()}`;
}
__name(buildAuthUrl3, "buildAuthUrl");
async function exchangeCodeForToken3(code, env, instanceUrl) {
  const tokenUrl = DYNAMICS_TOKEN_URL.replace("{tenant}", env.DYNAMICS_TENANT_ID);
  const params = new URLSearchParams({
    client_id: env.DYNAMICS_CLIENT_ID,
    client_secret: env.DYNAMICS_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: OAUTH_CALLBACK_URL3,
    scope: `${instanceUrl}/user_impersonation offline_access`
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dynamics 365 OAuth token exchange failed: ${error}`);
  }
  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: Math.floor(Date.now() / 1e3) + (data.expires_in || 3600)
  };
}
__name(exchangeCodeForToken3, "exchangeCodeForToken");
async function refreshAccessToken2(refreshToken, env, instanceUrl) {
  const tokenUrl = DYNAMICS_TOKEN_URL.replace("{tenant}", env.DYNAMICS_TENANT_ID);
  const params = new URLSearchParams({
    client_id: env.DYNAMICS_CLIENT_ID,
    client_secret: env.DYNAMICS_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: `${instanceUrl}/user_impersonation offline_access`
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dynamics 365 token refresh failed: ${error}`);
  }
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: Math.floor(Date.now() / 1e3) + (data.expires_in || 3600)
  };
}
__name(refreshAccessToken2, "refreshAccessToken");
async function ensureValidToken2(db, workspaceId, env) {
  const settings = await db.prepare(
    "SELECT dynamics_instance_url, dynamics_access_token, dynamics_refresh_token, dynamics_token_expires_at FROM workspace_settings WHERE workspace_id = ?"
  ).bind(workspaceId).first();
  if (!settings || !settings.dynamics_refresh_token) {
    throw new Error("Dynamics 365 not connected for this workspace");
  }
  const now4 = Math.floor(Date.now() / 1e3);
  const expiresAt = settings.dynamics_token_expires_at || 0;
  if (now4 >= expiresAt - 300) {
    console.log("[Dynamics 365] Access token expired, refreshing...");
    const newTokens = await refreshAccessToken2(
      settings.dynamics_refresh_token,
      env,
      settings.dynamics_instance_url
    );
    await db.prepare(
      "UPDATE workspace_settings SET dynamics_access_token = ?, dynamics_token_expires_at = ? WHERE workspace_id = ?"
    ).bind(
      newTokens.access_token,
      newTokens.expires_in,
      workspaceId
    ).run();
    return {
      instanceUrl: settings.dynamics_instance_url,
      accessToken: newTokens.access_token
    };
  }
  return {
    instanceUrl: settings.dynamics_instance_url,
    accessToken: settings.dynamics_access_token
  };
}
__name(ensureValidToken2, "ensureValidToken");
async function searchByPhone(instanceUrl, accessToken, phoneNumber) {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const leadFilter = `$filter=contains(telephone1,'${cleanPhone}') or contains(mobilephone,'${cleanPhone}') or contains(telephone2,'${cleanPhone}')&$select=leadid,fullname,telephone1,mobilephone`;
  const leadResponse = await fetch(
    `${instanceUrl}/api/data/v9.2/leads?${leadFilter}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    }
  );
  if (leadResponse.ok) {
    const leadData = await leadResponse.json();
    if (leadData.value && leadData.value.length > 0) {
      console.log(`[Dynamics 365] Found Lead: ${leadData.value[0].leadid}`);
      return {
        id: leadData.value[0].leadid,
        type: "lead"
      };
    }
  }
  const contactFilter = `$filter=contains(telephone1,'${cleanPhone}') or contains(mobilephone,'${cleanPhone}') or contains(telephone2,'${cleanPhone}')&$select=contactid,fullname,telephone1,mobilephone`;
  const contactResponse = await fetch(
    `${instanceUrl}/api/data/v9.2/contacts?${contactFilter}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    }
  );
  if (contactResponse.ok) {
    const contactData = await contactResponse.json();
    if (contactData.value && contactData.value.length > 0) {
      console.log(`[Dynamics 365] Found Contact: ${contactData.value[0].contactid}`);
      return {
        id: contactData.value[0].contactid,
        type: "contact"
      };
    }
  }
  console.log("[Dynamics 365] No Lead or Contact found for phone:", phoneNumber);
  return null;
}
__name(searchByPhone, "searchByPhone");
async function createNewLead(instanceUrl, accessToken, leadData) {
  const subject = leadData.subject || `Voice AI Call - ${leadData.phoneNumber}`;
  const payload = {
    telephone1: leadData.phoneNumber,
    subject,
    leadsourcecode: 3,
    // Phone (valid values: 1-10, 3 typically = Phone)
    description: `Lead created from voice AI call on ${(/* @__PURE__ */ new Date()).toLocaleString()}`
  };
  if (leadData.fullName) {
    const nameParts = leadData.fullName.trim().split(" ");
    if (nameParts.length === 1) {
      payload.lastname = nameParts[0];
    } else {
      payload.firstname = nameParts.slice(0, -1).join(" ");
      payload.lastname = nameParts[nameParts.length - 1];
    }
  } else {
    payload.lastname = leadData.phoneNumber;
  }
  if (leadData.companyName) {
    payload.companyname = leadData.companyName;
  }
  console.log("[Dynamics 365] Creating new Lead:", payload);
  const response = await fetch(`${instanceUrl}/api/data/v9.2/leads`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(payload)
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
__name(createNewLead, "createNewLead");
async function createCallLogActivity(instanceUrl, accessToken, recordId, recordType, callData) {
  const durationMinutes = Math.floor(callData.duration / 60);
  const regardingField = recordType === "lead" ? "regardingobjectid_lead_phonecall@odata.bind" : "regardingobjectid_contact_phonecall@odata.bind";
  const regardingValue = recordType === "lead" ? `/leads(${recordId})` : `/contacts(${recordId})`;
  const activityPayload = {
    subject: "Inbound Call",
    [regardingField]: regardingValue,
    phonenumber: callData.phoneNumber,
    actualdurationminutes: durationMinutes,
    actualstart: callData.callStartTime,
    actualend: new Date(new Date(callData.callStartTime).getTime() + callData.duration * 1e3).toISOString(),
    description: `Call Duration: ${durationMinutes} min ${callData.duration % 60} sec
Phone: ${callData.phoneNumber}

${callData.summary}`,
    directioncode: callData.callType === "inbound",
    statecode: 1,
    // Completed
    statuscode: 4
    // Received (valid status for completed state)
  };
  const response = await fetch(`${instanceUrl}/api/data/v9.2/phonecalls`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0"
    },
    body: JSON.stringify(activityPayload)
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("[Dynamics 365] Phone Call creation failed:", error);
    throw new Error(`Dynamics 365 phone call creation failed: ${error}`);
  }
  const activityId = response.headers.get("OData-EntityId")?.match(/\(([^)]+)\)/)?.[1] || "";
  console.log("[Dynamics 365] Phone Call created:", activityId);
  return activityId;
}
__name(createCallLogActivity, "createCallLogActivity");
function parseAppointmentDateTime(date, time) {
  let dateObj;
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
  const minutes = parseInt(timeMatch[2] || "0");
  const ampm = timeMatch[3]?.toLowerCase();
  if (ampm === "pm" && hours !== 12) {
    hours += 12;
  } else if (ampm === "am" && hours === 12) {
    hours = 0;
  }
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
}
__name(parseAppointmentDateTime, "parseAppointmentDateTime");
async function createAppointmentActivity(instanceUrl, accessToken, recordId, recordType, appointmentData, callSummary) {
  try {
    const startDateTime = parseAppointmentDateTime(
      appointmentData.date,
      appointmentData.time
    );
    const duration = appointmentData.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 6e4);
    const regardingField = recordType === "lead" ? "regardingobjectid_lead_appointment@odata.bind" : "regardingobjectid_contact_appointment@odata.bind";
    const regardingValue = recordType === "lead" ? `/leads(${recordId})` : `/contacts(${recordId})`;
    const appointmentPayload = {
      subject: `${appointmentData.type || "Appointment"} - Scheduled via Voice AI`,
      [regardingField]: regardingValue,
      scheduledstart: startDateTime.toISOString(),
      scheduledend: endDateTime.toISOString(),
      description: `Appointment scheduled during call.

${appointmentData.notes ? `Notes: ${appointmentData.notes}

` : ""}Call Summary:
${callSummary}`,
      statecode: 0,
      // Open
      statuscode: 1
      // Free
    };
    const response = await fetch(`${instanceUrl}/api/data/v9.2/appointments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
      body: JSON.stringify(appointmentPayload)
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("[Dynamics 365] Appointment creation failed:", error);
      throw new Error(`Dynamics 365 appointment creation failed: ${error}`);
    }
    const activityId = response.headers.get("OData-EntityId")?.match(/\(([^)]+)\)/)?.[1] || "";
    console.log("[Dynamics 365] Appointment created:", activityId);
    return activityId;
  } catch (error) {
    console.error("[Dynamics 365] Appointment creation error:", error.message);
    return null;
  }
}
__name(createAppointmentActivity, "createAppointmentActivity");
async function syncCallToDynamics(db, workspaceId, callId, callData, env) {
  try {
    const { instanceUrl, accessToken } = await ensureValidToken2(db, workspaceId, env);
    let record = await searchByPhone(instanceUrl, accessToken, callData.phoneNumber);
    let leadCreated = false;
    if (!record) {
      console.log("[Dynamics 365] No contact found, creating new Lead for:", callData.phoneNumber);
      try {
        const newLeadId = await createNewLead(instanceUrl, accessToken, {
          phoneNumber: callData.phoneNumber,
          subject: `Voice AI Call - ${callData.phoneNumber}`
        });
        record = {
          id: newLeadId,
          type: "lead"
        };
        leadCreated = true;
        console.log("[Dynamics 365] Created new Lead:", newLeadId);
      } catch (createError) {
        console.error("[Dynamics 365] Failed to create new Lead:", createError.message);
        await db.prepare(
          "INSERT INTO dynamics_sync_logs (id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workspaceId,
          callId,
          "error",
          `Failed to create Lead: ${createError.message}`,
          callData.phoneNumber,
          Math.floor(Date.now() / 1e3)
        ).run();
        return {
          success: false,
          error: `Failed to create Lead: ${createError.message}`
        };
      }
    }
    const activityId = await createCallLogActivity(
      instanceUrl,
      accessToken,
      record.id,
      record.type,
      callData
    );
    let appointmentId = null;
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
    await db.prepare(
      "INSERT INTO dynamics_sync_logs (id, workspace_id, call_id, dynamics_record_id, dynamics_activity_id, dynamics_appointment_id, appointment_created, lead_created, status, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      callId,
      record.id,
      activityId,
      appointmentId,
      appointmentId ? 1 : 0,
      leadCreated ? 1 : 0,
      "success",
      callData.phoneNumber,
      Math.floor(Date.now() / 1e3)
    ).run();
    console.log("[Dynamics 365] Sync completed successfully");
    return {
      success: true,
      dynamicsRecordId: record.id,
      dynamicsActivityId: activityId,
      dynamicsAppointmentId: appointmentId || void 0
    };
  } catch (error) {
    await db.prepare(
      "INSERT INTO dynamics_sync_logs (id, workspace_id, call_id, status, error_message, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      callId,
      "error",
      error.message,
      callData.phoneNumber,
      Math.floor(Date.now() / 1e3)
    ).run();
    console.error("[Dynamics 365] Sync failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
__name(syncCallToDynamics, "syncCallToDynamics");

// workers/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse2(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(jsonResponse2, "jsonResponse");
function now3() {
  return Math.floor(Date.now() / 1e3);
}
__name(now3, "now");
async function analyzeCallWithOpenAI(summary, transcript, openaiApiKey) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
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
            role: "user",
            content: `Call Summary: ${summary}

Full Transcript:
${transcript}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });
    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return null;
    }
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return {
      intent: result.intent || "Unknown",
      sentiment: result.sentiment || "Neutral",
      outcome: result.outcome || "Unknown",
      customer_name: result.customer_name || null,
      customer_email: result.customer_email || null,
      appointment_date: result.appointment_date || null,
      appointment_time: result.appointment_time || null,
      appointment_type: result.appointment_type || null,
      appointment_notes: result.appointment_notes || null
    };
  } catch (error) {
    console.error("Error analyzing call with OpenAI:", error);
    return null;
  }
}
__name(analyzeCallWithOpenAI, "analyzeCallWithOpenAI");
function extractKeywords(transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return [];
  }
  const stopWords = /* @__PURE__ */ new Set([
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "ourselves",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
    "he",
    "him",
    "his",
    "himself",
    "she",
    "her",
    "hers",
    "herself",
    "it",
    "its",
    "itself",
    "they",
    "them",
    "their",
    "theirs",
    "themselves",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "having",
    "do",
    "does",
    "did",
    "doing",
    "a",
    "an",
    "the",
    "and",
    "but",
    "if",
    "or",
    "because",
    "as",
    "until",
    "while",
    "of",
    "at",
    "by",
    "for",
    "with",
    "about",
    "against",
    "between",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "to",
    "from",
    "up",
    "down",
    "in",
    "out",
    "on",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "s",
    "t",
    "can",
    "will",
    "just",
    "don",
    "should",
    "now",
    "yeah",
    "yes",
    "okay",
    "ok",
    "um",
    "uh",
    "like",
    "know",
    "think",
    "get",
    "got",
    "would",
    "could",
    "want",
    "need",
    "see",
    "go",
    "going",
    "come",
    "let",
    "one",
    "two",
    "make"
  ]);
  const words = transcript.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(
    (word) => word.length > 3 && // At least 4 characters
    !stopWords.has(word) && !/^\d+$/.test(word)
    // Not just numbers
  );
  const wordCount = /* @__PURE__ */ new Map();
  words.forEach((word) => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  const keywords = Array.from(wordCount.entries()).filter(([_, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word]) => word);
  return keywords;
}
__name(extractKeywords, "extractKeywords");
async function storeKeywords(keywords, userId, sentiment, db) {
  if (keywords.length === 0) return;
  const timestamp = Date.now();
  let sentimentScore = 0;
  if (sentiment === "Positive") sentimentScore = 1;
  else if (sentiment === "Negative") sentimentScore = -1;
  for (const keyword of keywords) {
    try {
      const existing = await db.prepare(
        `SELECT id, count, positive_count, neutral_count, negative_count, avg_sentiment
         FROM call_keywords WHERE user_id = ? AND keyword = ?`
      ).bind(userId, keyword).first();
      if (existing) {
        const newPositiveCount = existing.positive_count + (sentiment === "Positive" ? 1 : 0);
        const newNeutralCount = existing.neutral_count + (sentiment === "Neutral" ? 1 : 0);
        const newNegativeCount = existing.negative_count + (sentiment === "Negative" ? 1 : 0);
        const newTotalCount = existing.count + 1;
        const newAvgSentiment = (existing.avg_sentiment * existing.count + sentimentScore) / newTotalCount;
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
        const initialPositiveCount = sentiment === "Positive" ? 1 : 0;
        const initialNeutralCount = sentiment === "Neutral" ? 1 : 0;
        const initialNegativeCount = sentiment === "Negative" ? 1 : 0;
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
      console.error("Error storing keyword:", keyword, error);
    }
  }
}
__name(storeKeywords, "storeKeywords");
async function lookupCallerWithTwilio(phoneNumber, twilioAccountSid, twilioAuthToken) {
  try {
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    const response = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(cleanNumber)}?Fields=caller_name,line_type_intelligence`,
      {
        method: "GET",
        headers: {
          "Authorization": "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
        }
      }
    );
    if (!response.ok) {
      console.error("Twilio API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return {
      callerName: data.caller_name?.caller_name || null,
      callerType: data.caller_name?.caller_type || null,
      carrierName: data.line_type_intelligence?.carrier_name || null,
      lineType: data.line_type_intelligence?.type || null
    };
  } catch (error) {
    console.error("Error looking up caller with Twilio:", error);
    return null;
  }
}
__name(lookupCallerWithTwilio, "lookupCallerWithTwilio");
async function triggerSchedulingWebhook(env, userId, callId) {
  try {
    const triggers = await env.DB.prepare(
      "SELECT * FROM scheduling_triggers WHERE user_id = ? AND is_active = 1"
    ).bind(userId).all();
    if (!triggers.results || triggers.results.length === 0) {
      console.log("No active scheduling triggers found for user:", userId);
      return;
    }
    const call = await env.DB.prepare(`
      SELECT
        wc.*,
        ar.result_data as enhanced_data
      FROM webhook_calls wc
      LEFT JOIN addon_results ar ON ar.call_id = wc.id AND ar.addon_type = 'enhanced_data'
      WHERE wc.id = ?
    `).bind(callId).first();
    if (!call) {
      console.error("Call not found:", callId);
      return;
    }
    const payload = {
      name: call.customer_name || "Unknown",
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
    for (const trigger of triggers.results) {
      const triggerData = trigger;
      if (triggerData.send_enhanced_data && call.enhanced_data) {
        try {
          payload.enhanced_data = JSON.parse(call.enhanced_data);
        } catch (e) {
          console.error("Error parsing enhanced data:", e);
        }
      }
      try {
        const response = await fetch(triggerData.destination_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Trigger-Type": "appointment-scheduled",
            "X-Call-ID": callId
          },
          body: JSON.stringify(payload)
        });
        const responseBody = await response.text();
        const logId = generateId();
        await env.DB.prepare(
          `INSERT INTO scheduling_trigger_logs
           (id, trigger_id, call_id, status, http_status, response_body, error_message, payload_sent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          logId,
          triggerData.id,
          callId,
          response.ok ? "success" : "error",
          response.status,
          responseBody.substring(0, 1e3),
          // Limit response body size
          response.ok ? null : `HTTP ${response.status}: ${responseBody}`,
          JSON.stringify(payload),
          now3()
        ).run();
        console.log(`Scheduling webhook sent to ${triggerData.destination_url}: ${response.status}`);
      } catch (error) {
        const logId = generateId();
        await env.DB.prepare(
          `INSERT INTO scheduling_trigger_logs
           (id, trigger_id, call_id, status, http_status, response_body, error_message, payload_sent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          logId,
          triggerData.id,
          callId,
          "error",
          null,
          null,
          error.message || "Unknown error",
          JSON.stringify(payload),
          now3()
        ).run();
        console.error("Error sending scheduling webhook:", error);
      }
    }
  } catch (error) {
    console.error("Error in triggerSchedulingWebhook:", error);
  }
}
__name(triggerSchedulingWebhook, "triggerSchedulingWebhook");
async function getUserFromToken(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const secret = env.JWT_SECRET || "default-secret-change-me";
  const decoded = await verifyToken(token, secret);
  if (!decoded) {
    return null;
  }
  return decoded.userId;
}
__name(getUserFromToken, "getUserFromToken");
async function getEffectiveUserId(env, userId) {
  const settings = await env.DB.prepare(
    "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
  ).bind(userId).first();
  if (!settings || !settings.selected_workspace_id) {
    return { effectiveUserId: userId, isWorkspaceContext: false };
  }
  const workspace = await env.DB.prepare(
    "SELECT owner_user_id FROM workspaces WHERE id = ?"
  ).bind(settings.selected_workspace_id).first();
  if (!workspace) {
    return { effectiveUserId: userId, isWorkspaceContext: false };
  }
  const isOwner = workspace.owner_user_id === userId;
  const membership = await env.DB.prepare(
    'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
  ).bind(settings.selected_workspace_id, userId).first();
  if (isOwner || membership) {
    return { effectiveUserId: workspace.owner_user_id, isWorkspaceContext: true };
  }
  return { effectiveUserId: userId, isWorkspaceContext: false };
}
__name(getEffectiveUserId, "getEffectiveUserId");
async function getWorkspaceSettingsForUser(env, userId) {
  const userSettings = await env.DB.prepare(
    "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
  ).bind(userId).first();
  if (!userSettings || !userSettings.selected_workspace_id) {
    const ownedWorkspace = await env.DB.prepare(
      "SELECT id FROM workspaces WHERE owner_user_id = ?"
    ).bind(userId).first();
    if (ownedWorkspace) {
      const wsSettings2 = await env.DB.prepare(
        "SELECT workspace_id, private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
      ).bind(ownedWorkspace.id).first();
      return wsSettings2 || null;
    }
    return null;
  }
  const workspaceId = userSettings.selected_workspace_id;
  let wsSettings = await env.DB.prepare(
    "SELECT workspace_id, private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
  ).bind(workspaceId).first();
  if (!wsSettings || !wsSettings.private_key) {
    const workspace = await env.DB.prepare(
      "SELECT owner_user_id FROM workspaces WHERE id = ?"
    ).bind(workspaceId).first();
    if (workspace) {
      const ownerSettings = await env.DB.prepare(
        "SELECT private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM user_settings WHERE user_id = ?"
      ).bind(workspace.owner_user_id).first();
      if (ownerSettings && ownerSettings.private_key) {
        wsSettings = ownerSettings;
      }
    }
  }
  return wsSettings || null;
}
__name(getWorkspaceSettingsForUser, "getWorkspaceSettingsForUser");
async function executeEnhancedDataAddon(phoneNumber) {
  try {
    const response = await fetch(
      `https://enhance-data-production.up.railway.app/phone?phone=${encodeURIComponent(phoneNumber)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Enhanced Data addon error:", error);
    return null;
  }
}
__name(executeEnhancedDataAddon, "executeEnhancedDataAddon");
async function processAddonsForCall(env, userId, callId, customerPhone) {
  if (!customerPhone) {
    return;
  }
  try {
    const cache = new VoiceAICache(env.CACHE);
    const enabledAddons = await env.DB.prepare(
      "SELECT addon_type, settings FROM user_addons WHERE user_id = ? AND is_enabled = 1"
    ).bind(userId).all();
    if (!enabledAddons.results || enabledAddons.results.length === 0) {
      return;
    }
    for (const addon of enabledAddons.results) {
      const startTime = Date.now();
      let status = "failed";
      let resultData = null;
      let errorMessage = null;
      try {
        if (addon.addon_type === "enhanced_data") {
          const cachedData = await cache.getCachedEnhancedData(userId, callId);
          if (cachedData) {
            console.log(`Cache HIT for enhanced data: callId=${callId}`);
            resultData = cachedData;
            status = "success";
          } else {
            console.log(`Cache MISS for enhanced data: callId=${callId}`);
            resultData = await executeEnhancedDataAddon(customerPhone);
            status = resultData ? "success" : "failed";
            if (!resultData) {
              errorMessage = "Failed to fetch enhanced data";
            } else {
              await cache.cacheEnhancedData(userId, callId, resultData, CACHE_TTL.ENHANCED_DATA);
            }
          }
        }
      } catch (error) {
        errorMessage = error.message || "Unknown error";
      }
      const executionTime = Date.now() - startTime;
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
        now3()
      ).run();
    }
  } catch (error) {
    console.error("Error processing addons:", error);
  }
}
__name(processAddonsForCall, "processAddonsForCall");
var workers_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        const { email, password, name } = await request.json();
        if (!email || !password) {
          return jsonResponse2({ error: "Email and password required" }, 400);
        }
        const existing = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ?"
        ).bind(email).first();
        if (existing) {
          return jsonResponse2({ error: "Email already registered" }, 409);
        }
        const userId = generateId();
        const passwordHash = await hashPassword(password);
        const timestamp = now3();
        await env.DB.prepare(
          "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(userId, email, passwordHash, name || null, timestamp, timestamp).run();
        const secret = env.JWT_SECRET || "default-secret-change-me";
        const token = await generateToken(userId, secret);
        const sessionId = generateId();
        const tokenHash = await hashPassword(token);
        const expiresAt = timestamp + 7 * 24 * 60 * 60;
        await env.DB.prepare(
          "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(sessionId, userId, tokenHash, expiresAt, timestamp).run();
        const pendingInvitations = await env.DB.prepare(
          'SELECT id, workspace_id, role, token, expires_at FROM workspace_invitations WHERE email = ? AND status = "pending" AND expires_at > ?'
        ).bind(email, timestamp).all();
        let defaultWorkspaceId = null;
        if (pendingInvitations.results && pendingInvitations.results.length > 0) {
          for (const invitation of pendingInvitations.results) {
            const membershipId = generateId();
            await env.DB.prepare(
              'INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_user_id, invited_at, joined_at, created_at, updated_at) VALUES (?, ?, ?, ?, "active", ?, ?, ?, ?, ?)'
            ).bind(
              membershipId,
              invitation.workspace_id,
              userId,
              invitation.role,
              null,
              // We don't have invited_by stored yet in old invitations
              timestamp,
              timestamp,
              timestamp,
              timestamp
            ).run();
            await env.DB.prepare(
              'UPDATE workspace_invitations SET status = "accepted", accepted_at = ? WHERE id = ?'
            ).bind(timestamp, invitation.id).run();
            if (!defaultWorkspaceId) {
              defaultWorkspaceId = invitation.workspace_id;
            }
          }
        }
        if (!defaultWorkspaceId) {
          const workspaceId = "ws_" + generateId();
          const workspaceName = name?.trim() || email.split("@")[0] || "My Workspace";
          await env.DB.prepare(
            "INSERT INTO workspaces (id, name, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(workspaceId, workspaceName, userId, timestamp, timestamp).run();
          defaultWorkspaceId = workspaceId;
        }
        const settingsId = generateId();
        const encryptionSalt = generateSalt();
        await env.DB.prepare(
          "INSERT INTO user_settings (id, user_id, encryption_salt, selected_workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(settingsId, userId, encryptionSalt, defaultWorkspaceId, timestamp, timestamp).run();
        return jsonResponse2({
          token,
          user: {
            id: userId,
            email,
            name: name || null
          }
        });
      }
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const { email, password } = await request.json();
        if (!email || !password) {
          return jsonResponse2({ error: "Email and password required" }, 400);
        }
        const user = await env.DB.prepare(
          "SELECT id, email, password_hash, name FROM users WHERE email = ?"
        ).bind(email).first();
        if (!user) {
          return jsonResponse2({ error: "Invalid credentials" }, 401);
        }
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          return jsonResponse2({ error: "Invalid credentials" }, 401);
        }
        await env.DB.prepare(
          "UPDATE users SET last_login_at = ? WHERE id = ?"
        ).bind(now3(), user.id).run();
        const secret = env.JWT_SECRET || "default-secret-change-me";
        const token = await generateToken(user.id, secret);
        const sessionId = generateId();
        const tokenHash = await hashPassword(token);
        const timestamp = now3();
        const expiresAt = timestamp + 7 * 24 * 60 * 60;
        await env.DB.prepare(
          "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(sessionId, user.id, tokenHash, expiresAt, timestamp).run();
        return jsonResponse2({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        await env.DB.prepare(
          "DELETE FROM sessions WHERE user_id = ?"
        ).bind(userId).run();
        return jsonResponse2({ message: "Logged out successfully" });
      }
      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const user = await env.DB.prepare(
          "SELECT id, email, name, created_at FROM users WHERE id = ?"
        ).bind(userId).first();
        if (!user) {
          return jsonResponse2({ error: "User not found" }, 404);
        }
        return jsonResponse2({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        });
      }
      if (url.pathname === "/api/settings" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({
            privateKey: null,
            publicKey: null,
            selectedAssistantId: null,
            selectedPhoneId: null,
            selectedOrgId: null,
            selectedWorkspaceId: null,
            openaiApiKey: null,
            twilioAccountSid: null,
            twilioAuthToken: null,
            transferPhoneNumber: null
          });
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const wsSettings = await env.DB.prepare(
          "SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        let finalSettings = wsSettings;
        if (!wsSettings || !wsSettings.private_key) {
          const ownerSettings = await env.DB.prepare(
            "SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM user_settings WHERE user_id = ?"
          ).bind(workspace.owner_user_id).first();
          if (ownerSettings && ownerSettings.private_key) {
            finalSettings = ownerSettings;
            if (isOwner) {
              const timestamp = Date.now();
              const wsSettingsId = generateId();
              await env.DB.prepare(
                `INSERT OR REPLACE INTO workspace_settings (
                  id, workspace_id, private_key, public_key, openai_api_key,
                  twilio_account_sid, twilio_auth_token, transfer_phone_number,
                  selected_assistant_id, selected_phone_id, selected_org_id,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                wsSettingsId,
                workspaceId,
                ownerSettings.private_key,
                ownerSettings.public_key,
                ownerSettings.openai_api_key,
                ownerSettings.twilio_account_sid,
                ownerSettings.twilio_auth_token,
                ownerSettings.transfer_phone_number,
                ownerSettings.selected_assistant_id,
                ownerSettings.selected_phone_id,
                ownerSettings.selected_org_id,
                timestamp,
                timestamp
              ).run();
              console.log(`Auto-migrated settings for workspace ${workspaceId}`);
            }
          }
        }
        return jsonResponse2({
          privateKey: finalSettings?.private_key || null,
          publicKey: finalSettings?.public_key || null,
          selectedAssistantId: finalSettings?.selected_assistant_id || null,
          selectedPhoneId: finalSettings?.selected_phone_id || null,
          selectedOrgId: finalSettings?.selected_org_id || null,
          selectedWorkspaceId: workspaceId,
          openaiApiKey: finalSettings?.openai_api_key || null,
          twilioAccountSid: finalSettings?.twilio_account_sid || null,
          twilioAuthToken: finalSettings?.twilio_auth_token || null,
          transferPhoneNumber: finalSettings?.transfer_phone_number || null,
          isWorkspaceOwner: isOwner
        });
      }
      if (url.pathname === "/api/settings" && request.method === "PUT") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const {
          privateKey,
          publicKey,
          selectedAssistantId,
          selectedPhoneId,
          selectedOrgId,
          selectedWorkspaceId,
          openaiApiKey,
          twilioAccountSid,
          twilioAuthToken,
          transferPhoneNumber
        } = await request.json();
        if (!selectedWorkspaceId) {
          return jsonResponse2({ error: "Workspace selection is required" }, 400);
        }
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(selectedWorkspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        if (workspace.owner_user_id !== userId) {
          return jsonResponse2({ error: "Only workspace owner can update API credentials" }, 403);
        }
        const timestamp = now3();
        const existing = await env.DB.prepare(
          "SELECT id FROM workspace_settings WHERE workspace_id = ?"
        ).bind(selectedWorkspaceId).first();
        if (existing) {
          await env.DB.prepare(
            "UPDATE workspace_settings SET private_key = ?, public_key = ?, selected_assistant_id = ?, selected_phone_id = ?, selected_org_id = ?, openai_api_key = ?, twilio_account_sid = ?, twilio_auth_token = ?, transfer_phone_number = ?, updated_at = ? WHERE workspace_id = ?"
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
            selectedWorkspaceId
          ).run();
        } else {
          const settingsId = generateId();
          await env.DB.prepare(
            "INSERT INTO workspace_settings (id, workspace_id, private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            settingsId,
            selectedWorkspaceId,
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
            timestamp
          ).run();
        }
        await env.DB.prepare(
          "UPDATE user_settings SET selected_workspace_id = ?, updated_at = ? WHERE user_id = ?"
        ).bind(selectedWorkspaceId, timestamp, userId).run();
        return jsonResponse2({ message: "Settings updated successfully" });
      }
      if (url.pathname === "/api/translate" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { text, targetLanguage } = await request.json();
        if (!text || !targetLanguage) {
          return jsonResponse2({ error: "Missing required fields: text, targetLanguage" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceSettings = await env.DB.prepare(
          "SELECT openai_api_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(userSettings.selected_workspace_id).first();
        if (!workspaceSettings || !workspaceSettings.openai_api_key) {
          return jsonResponse2({
            success: false,
            error: "OpenAI API key not configured. Please add it in Settings."
          });
        }
        try {
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${workspaceSettings.openai_api_key}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are a professional translator. Translate the following English text to ${targetLanguage}, maintaining the same tone and meaning.`
                },
                {
                  role: "user",
                  content: text
                }
              ],
              temperature: 0.3
            })
          });
          if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`);
          }
          const data = await openaiResponse.json();
          const translatedText = data.choices[0].message.content;
          return jsonResponse2({
            success: true,
            translatedText
          });
        } catch (error) {
          console.error("[Translation] Error:", error);
          return jsonResponse2({
            success: false,
            error: error.message || "Translation failed"
          });
        }
      }
      if (url.pathname === "/api/salesforce/oauth/initiate" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const authUrl = buildAuthUrl2(workspaceId, env);
        return jsonResponse2({
          success: true,
          authUrl
        });
      }
      if (url.pathname === "/api/salesforce/oauth/callback" && request.method === "GET") {
        try {
          const code = url.searchParams.get("code");
          const workspaceId = url.searchParams.get("state");
          if (!code || !workspaceId) {
            return new Response("Missing code or state parameter", { status: 400 });
          }
          const tokens = await exchangeCodeForToken2(code, env);
          const timestamp = now3();
          await env.DB.prepare(
            `UPDATE workspace_settings
             SET salesforce_instance_url = ?,
                 salesforce_access_token = ?,
                 salesforce_refresh_token = ?,
                 salesforce_token_expires_at = ?,
                 updated_at = ?
             WHERE workspace_id = ?`
          ).bind(
            tokens.instance_url,
            tokens.access_token,
            tokens.refresh_token,
            tokens.expires_in,
            timestamp,
            workspaceId
          ).run();
          return new Response(null, {
            status: 302,
            headers: {
              "Location": "https://voice-config.channelautomation.com/integrations?salesforce=connected"
            }
          });
        } catch (error) {
          console.error("[Salesforce OAuth] Error:", error);
          return new Response(null, {
            status: 302,
            headers: {
              "Location": `https://voice-config.channelautomation.com/integrations?salesforce=error&message=${encodeURIComponent(error.message)}`
            }
          });
        }
      }
      if (url.pathname === "/api/salesforce/status" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const settings = await env.DB.prepare(
          `SELECT salesforce_instance_url, salesforce_access_token,
                  salesforce_refresh_token, salesforce_token_expires_at
           FROM workspace_settings
           WHERE workspace_id = ?`
        ).bind(workspaceId).first();
        const connected = !!(settings && settings.salesforce_refresh_token);
        const tokenExpiresAt = settings?.salesforce_token_expires_at || null;
        return jsonResponse2({
          success: true,
          connected,
          instanceUrl: connected ? settings.salesforce_instance_url : null,
          tokenExpiresAt
        });
      }
      if (url.pathname === "/api/salesforce/disconnect" && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const timestamp = now3();
        await env.DB.prepare(
          `UPDATE workspace_settings
           SET salesforce_instance_url = NULL,
               salesforce_access_token = NULL,
               salesforce_refresh_token = NULL,
               salesforce_token_expires_at = NULL,
               updated_at = ?
           WHERE workspace_id = ?`
        ).bind(timestamp, workspaceId).run();
        return jsonResponse2({
          success: true,
          message: "Salesforce disconnected successfully"
        });
      }
      if (url.pathname === "/api/salesforce/sync-logs" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");
        let query = `
          SELECT id, call_id, salesforce_record_id, salesforce_task_id,
                 salesforce_event_id, appointment_created, status,
                 error_message, phone_number, created_at
          FROM salesforce_sync_logs
          WHERE workspace_id = ?
        `;
        const params = [workspaceId];
        if (status) {
          query += " AND status = ?";
          params.push(status);
        }
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);
        const logs = await env.DB.prepare(query).bind(...params).all();
        let countQuery = "SELECT COUNT(*) as count FROM salesforce_sync_logs WHERE workspace_id = ?";
        const countParams = [workspaceId];
        if (status) {
          countQuery += " AND status = ?";
          countParams.push(status);
        }
        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
        return jsonResponse2({
          success: true,
          logs: logs.results || [],
          total: countResult?.count || 0,
          limit,
          offset
        });
      }
      if (url.pathname === "/api/hubspot/oauth/initiate" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const authUrl = buildAuthUrl(workspaceId, env);
        return jsonResponse2({
          success: true,
          authUrl
        });
      }
      if (url.pathname === "/api/hubspot/oauth/callback" && request.method === "GET") {
        try {
          const code = url.searchParams.get("code");
          const workspaceId = url.searchParams.get("state");
          if (!code || !workspaceId) {
            return new Response("Missing code or state parameter", { status: 400 });
          }
          const tokens = await exchangeCodeForToken(code, env);
          const workspace = await env.DB.prepare(
            "SELECT owner_user_id FROM workspaces WHERE id = ?"
          ).bind(workspaceId).first();
          if (!workspace) {
            return new Response("Workspace not found", { status: 404 });
          }
          const userId = workspace.owner_user_id;
          const existing = await env.DB.prepare(
            "SELECT id FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?"
          ).bind(userId, workspaceId).first();
          const timestamp = now3();
          const tokenId = generateId();
          if (existing) {
            await env.DB.prepare(
              `UPDATE hubspot_oauth_tokens
               SET access_token = ?,
                   refresh_token = ?,
                   expires_at = ?,
                   updated_at = ?
               WHERE user_id = ? AND workspace_id = ?`
            ).bind(
              tokens.access_token,
              tokens.refresh_token,
              tokens.expires_in,
              timestamp,
              userId,
              workspaceId
            ).run();
          } else {
            await env.DB.prepare(
              `INSERT INTO hubspot_oauth_tokens (
                id, user_id, workspace_id, access_token, refresh_token,
                expires_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              tokenId,
              userId,
              workspaceId,
              tokens.access_token,
              tokens.refresh_token,
              tokens.expires_in,
              timestamp,
              timestamp
            ).run();
          }
          return new Response(null, {
            status: 302,
            headers: {
              "Location": "https://voice-config.channelautomation.com/?hubspot=connected",
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error("[HubSpot OAuth Error]:", error);
          return new Response(null, {
            status: 302,
            headers: {
              "Location": `https://voice-config.channelautomation.com/?hubspot=error&message=${encodeURIComponent(error.message)}`,
              ...corsHeaders
            }
          });
        }
      }
      if (url.pathname === "/api/hubspot/status" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const tokens = await env.DB.prepare(
          "SELECT access_token, refresh_token, expires_at FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?"
        ).bind(userId, workspaceId).first();
        const connected = !!(tokens && tokens.refresh_token);
        const tokenExpiresAt = tokens?.expires_at || null;
        return jsonResponse2({
          success: true,
          connected,
          tokenExpiresAt
        });
      }
      if (url.pathname === "/api/hubspot/disconnect" && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        await env.DB.prepare(
          "DELETE FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?"
        ).bind(userId, workspaceId).run();
        return jsonResponse2({
          success: true,
          message: "HubSpot disconnected successfully"
        });
      }
      if (url.pathname === "/api/hubspot/sync-logs" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");
        let query = `
          SELECT id, call_id, contact_id, engagement_id, status,
                 error_message, phone_number, created_at
          FROM hubspot_sync_logs
          WHERE user_id = ? AND workspace_id = ?
        `;
        const params = [userId, workspaceId];
        if (status) {
          query += " AND status = ?";
          params.push(status);
        }
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);
        const logs = await env.DB.prepare(query).bind(...params).all();
        let countQuery = "SELECT COUNT(*) as count FROM hubspot_sync_logs WHERE user_id = ? AND workspace_id = ?";
        const countParams = [userId, workspaceId];
        if (status) {
          countQuery += " AND status = ?";
          countParams.push(status);
        }
        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
        return jsonResponse2({
          success: true,
          logs: logs.results || [],
          total: countResult?.count || 0,
          limit,
          offset
        });
      }
      if (url.pathname === "/api/dynamics/oauth/initiate" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const instanceUrl = url.searchParams.get("instanceUrl");
        if (!instanceUrl) {
          return jsonResponse2({ error: "Instance URL is required" }, 400);
        }
        const authUrl = buildAuthUrl3(workspaceId, env, instanceUrl);
        return jsonResponse2({
          success: true,
          authUrl
        });
      }
      if (url.pathname === "/api/dynamics/oauth/callback" && request.method === "GET") {
        try {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          if (!code || !state) {
            return new Response("Missing code or state parameter", { status: 400 });
          }
          const [workspaceId, instanceUrl] = state.split("|");
          const tokens = await exchangeCodeForToken3(code, env, instanceUrl);
          const timestamp = now3();
          await env.DB.prepare(
            `UPDATE workspace_settings
             SET dynamics_instance_url = ?,
                 dynamics_access_token = ?,
                 dynamics_refresh_token = ?,
                 dynamics_token_expires_at = ?,
                 updated_at = ?
             WHERE workspace_id = ?`
          ).bind(
            instanceUrl,
            tokens.access_token,
            tokens.refresh_token,
            tokens.expires_in,
            timestamp,
            workspaceId
          ).run();
          return new Response(null, {
            status: 302,
            headers: {
              "Location": "https://voice-config.channelautomation.com/integrations?dynamics=connected"
            }
          });
        } catch (error) {
          console.error("[Dynamics 365 OAuth] Error:", error);
          return new Response(null, {
            status: 302,
            headers: {
              "Location": `https://voice-config.channelautomation.com/integrations?dynamics=error&message=${encodeURIComponent(error.message)}`
            }
          });
        }
      }
      if (url.pathname === "/api/dynamics/status" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const settings = await env.DB.prepare(
          `SELECT dynamics_instance_url, dynamics_access_token,
                  dynamics_refresh_token, dynamics_token_expires_at
           FROM workspace_settings
           WHERE workspace_id = ?`
        ).bind(workspaceId).first();
        const connected = !!(settings && settings.dynamics_refresh_token);
        const tokenExpiresAt = settings?.dynamics_token_expires_at || null;
        return jsonResponse2({
          success: true,
          connected,
          instanceUrl: connected ? settings.dynamics_instance_url : null,
          tokenExpiresAt
        });
      }
      if (url.pathname === "/api/dynamics/disconnect" && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const timestamp = now3();
        await env.DB.prepare(
          `UPDATE workspace_settings
           SET dynamics_instance_url = NULL,
               dynamics_access_token = NULL,
               dynamics_refresh_token = NULL,
               dynamics_token_expires_at = NULL,
               updated_at = ?
           WHERE workspace_id = ?`
        ).bind(timestamp, workspaceId).run();
        return jsonResponse2({
          success: true,
          message: "Dynamics 365 disconnected successfully"
        });
      }
      if (url.pathname === "/api/dynamics/sync-logs" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const status = url.searchParams.get("status");
        let query = `
          SELECT id, call_id, dynamics_record_id, dynamics_activity_id,
                 dynamics_appointment_id, appointment_created, status,
                 error_message, phone_number, created_at
          FROM dynamics_sync_logs
          WHERE workspace_id = ?
        `;
        const params = [workspaceId];
        if (status) {
          query += " AND status = ?";
          params.push(status);
        }
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);
        const logs = await env.DB.prepare(query).bind(...params).all();
        let countQuery = "SELECT COUNT(*) as count FROM dynamics_sync_logs WHERE workspace_id = ?";
        const countParams = [workspaceId];
        if (status) {
          countQuery += " AND status = ?";
          countParams.push(status);
        }
        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
        return jsonResponse2({
          success: true,
          logs: logs.results || [],
          total: countResult?.count || 0,
          limit,
          offset
        });
      }
      if (url.pathname === "/api/workspaces" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const query = `
          SELECT DISTINCT w.id, w.name, w.owner_user_id, w.created_at, w.updated_at,
            CASE WHEN w.owner_user_id = ? THEN 'owner' ELSE wm.role END AS role,
            CASE WHEN w.owner_user_id = ? THEN 'active' ELSE wm.status END AS status
          FROM workspaces w
          LEFT JOIN workspace_members wm
            ON wm.workspace_id = w.id AND wm.user_id = ?
          WHERE w.owner_user_id = ? OR wm.user_id = ?
          ORDER BY w.created_at DESC`;
        const { results } = await env.DB.prepare(query).bind(userId, userId, userId, userId, userId).all();
        return jsonResponse2({ workspaces: results || [] });
      }
      if (url.pathname === "/api/workspaces" && request.method === "POST") {
        return jsonResponse2({ error: "Workspace creation is not allowed. Each user automatically gets one workspace on registration." }, 403);
      }
      if (url.pathname.startsWith("/api/workspaces/") && url.pathname.endsWith("/invite") && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const { email, role } = await request.json();
        if (!email) {
          return jsonResponse2({ error: "Email is required" }, 400);
        }
        const ws = await env.DB.prepare("SELECT owner_user_id FROM workspaces WHERE id = ?").bind(workspaceId).first();
        if (!ws) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        if (ws.owner_user_id !== userId) {
          const membership = await env.DB.prepare(
            'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
          ).bind(workspaceId, userId).first();
          if (!membership || membership.role !== "admin" && membership.role !== "owner") {
            return jsonResponse2({ error: "Forbidden" }, 403);
          }
        }
        const timestamp = now3();
        const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (user) {
          const membershipId = generateId();
          try {
            await env.DB.prepare(
              'INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_user_id, invited_at, joined_at, created_at, updated_at) VALUES (?, ?, ?, ?, "active", ?, ?, ?, ?, ?)'
            ).bind(membershipId, workspaceId, user.id, role || "member", userId, timestamp, timestamp, timestamp, timestamp).run();
          } catch (e) {
            await env.DB.prepare(
              'UPDATE workspace_members SET role = ?, status = "active", invited_by_user_id = ?, invited_at = ?, joined_at = ?, updated_at = ? WHERE workspace_id = ? AND user_id = ?'
            ).bind(role || "member", userId, timestamp, timestamp, timestamp, workspaceId, user.id).run();
          }
          return jsonResponse2({ success: true, message: "User added to workspace" });
        } else {
          const temporaryPassword = generateTemporaryPassword();
          const passwordHash = await hashPassword(temporaryPassword);
          const newUserId = generateId();
          await env.DB.prepare(
            "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(newUserId, email, passwordHash, null, timestamp, timestamp).run();
          const newUserWorkspaceId = "ws_" + generateId();
          const workspaceName = email.split("@")[0] || "My Workspace";
          await env.DB.prepare(
            "INSERT INTO workspaces (id, name, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(newUserWorkspaceId, workspaceName, newUserId, timestamp, timestamp).run();
          const settingsId = generateId();
          const encryptionSalt = generateSalt();
          await env.DB.prepare(
            "INSERT INTO user_settings (id, user_id, encryption_salt, selected_workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(settingsId, newUserId, encryptionSalt, workspaceId, timestamp, timestamp).run();
          const membershipId = generateId();
          await env.DB.prepare(
            'INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_by_user_id, invited_at, joined_at, created_at, updated_at) VALUES (?, ?, ?, ?, "active", ?, ?, ?, ?, ?)'
          ).bind(membershipId, workspaceId, newUserId, role || "member", userId, timestamp, timestamp, timestamp, timestamp).run();
          await env.DB.prepare(
            'UPDATE workspace_invitations SET status = "accepted", accepted_at = ? WHERE email = ? AND workspace_id = ? AND status = "pending"'
          ).bind(timestamp, email, workspaceId).run();
          return jsonResponse2({
            success: true,
            message: "User account created and added to workspace",
            credentials: {
              email,
              temporaryPassword
            }
          });
        }
      }
      if (url.pathname.startsWith("/api/workspaces/") && url.pathname.endsWith("/members") && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id, name FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          "SELECT status, role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
        ).bind(workspaceId, userId).first();
        if (!isOwner && (!membership || membership.status !== "active")) {
          return jsonResponse2({ error: "Access denied" }, 403);
        }
        const owner = await env.DB.prepare(
          "SELECT id, email, name FROM users WHERE id = ?"
        ).bind(workspace.owner_user_id).first();
        const members = await env.DB.prepare(`
          SELECT wm.id, wm.role, wm.status, wm.joined_at, wm.invited_at,
                 u.id as user_id, u.email, u.name
          FROM workspace_members wm
          JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = ? AND wm.status = 'active'
          ORDER BY wm.joined_at DESC
        `).bind(workspaceId).all();
        const membersList = (members.results || []).map((m) => ({
          id: m.user_id,
          email: m.email,
          name: m.name,
          role: m.role,
          status: m.status,
          joinedAt: m.joined_at
        }));
        const ownerInList = membersList.find((m) => m.id === owner.id);
        if (!ownerInList) {
          membersList.unshift({
            id: owner.id,
            email: owner.email,
            name: owner.name,
            role: "owner",
            status: "active",
            joinedAt: null
          });
        }
        return jsonResponse2({
          workspace: { id: workspaceId, name: workspace.name },
          members: membersList
        });
      }
      if (url.pathname.includes("/api/workspaces/") && url.pathname.includes("/members/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const memberId = parts[5];
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && (!membership || membership.role !== "admin")) {
          return jsonResponse2({ error: "Only owners and admins can remove members" }, 403);
        }
        if (memberId === workspace.owner_user_id) {
          return jsonResponse2({ error: "Cannot remove workspace owner" }, 400);
        }
        const member = await env.DB.prepare(
          "SELECT user_id FROM workspace_members WHERE id = ? AND workspace_id = ?"
        ).bind(memberId, workspaceId).first();
        if (!member) {
          return jsonResponse2({ error: "Member not found" }, 404);
        }
        await env.DB.prepare(
          "DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?"
        ).bind(memberId, workspaceId).run();
        return jsonResponse2({ success: true, message: "Member removed successfully" });
      }
      if (url.pathname.includes("/api/workspaces/") && url.pathname.includes("/members/") && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const memberId = parts[5];
        const { role } = await request.json();
        if (!role || !["member", "admin"].includes(role)) {
          return jsonResponse2({ error: 'Invalid role. Must be "member" or "admin"' }, 400);
        }
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        if (workspace.owner_user_id !== userId) {
          return jsonResponse2({ error: "Only workspace owner can change roles" }, 403);
        }
        const member = await env.DB.prepare(
          "SELECT user_id FROM workspace_members WHERE id = ? AND workspace_id = ?"
        ).bind(memberId, workspaceId).first();
        if (!member) {
          return jsonResponse2({ error: "Member not found" }, 404);
        }
        const timestamp = now3();
        await env.DB.prepare(
          "UPDATE workspace_members SET role = ?, updated_at = ? WHERE id = ? AND workspace_id = ?"
        ).bind(role, timestamp, memberId, workspaceId).run();
        return jsonResponse2({ success: true, message: "Member role updated successfully" });
      }
      if (url.pathname === "/api/twilio/phone-numbers" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT twilio_account_sid, twilio_auth_token FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.twilio_account_sid || !settings.twilio_auth_token) {
          return jsonResponse2({ error: "Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration." }, 400);
        }
        try {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/IncomingPhoneNumbers.json`;
          const twilioAuth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);
          const twilioResponse = await fetch(twilioUrl, {
            headers: {
              "Authorization": `Basic ${twilioAuth}`
            }
          });
          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            return jsonResponse2({ error: `Twilio API error: ${twilioResponse.status} - ${errorText}` }, 400);
          }
          const twilioData = await twilioResponse.json();
          const voiceNumbers = (twilioData.incoming_phone_numbers || []).filter(
            (num) => num.capabilities?.voice === true
          ).map((num) => ({
            sid: num.sid,
            phoneNumber: num.phone_number,
            friendlyName: num.friendly_name,
            capabilities: {
              voice: num.capabilities?.voice || false,
              sms: num.capabilities?.sms || false
            }
          }));
          return jsonResponse2(voiceNumbers);
        } catch (error) {
          console.error("Error fetching Twilio numbers:", error);
          return jsonResponse2({ error: `Failed to fetch Twilio numbers: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/vapi/import-twilio" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { sid, phoneNumber, name } = await request.json();
        if (!sid && !phoneNumber) {
          return jsonResponse2({ error: "Either sid or phoneNumber is required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key, twilio_account_sid, twilio_auth_token FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration." }, 400);
        }
        if (!settings.twilio_account_sid || !settings.twilio_auth_token) {
          return jsonResponse2({ error: "Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration." }, 400);
        }
        try {
          const vapiUrl = "https://api.vapi.ai/phone-number";
          const payload = {
            provider: "twilio",
            twilioAccountSid: settings.twilio_account_sid,
            twilioAuthToken: settings.twilio_auth_token
          };
          if (sid) {
            payload.twilioPhoneNumberSid = sid;
          } else if (phoneNumber) {
            payload.number = phoneNumber;
          }
          if (name) {
            payload.name = name;
          }
          payload.smsEnabled = false;
          const vapiResponse = await fetch(vapiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            return jsonResponse2({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const vapiData = await vapiResponse.json();
          return jsonResponse2({
            id: vapiData.id,
            number: vapiData.number || vapiData.phoneNumber,
            name: vapiData.name || name
          });
        } catch (error) {
          console.error("Error importing Twilio number:", error);
          return jsonResponse2({ error: `Failed to import Twilio number: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/vapi/phone-number" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { areaCode, name } = await request.json();
        if (!areaCode || !/^\d{3}$/.test(areaCode)) {
          return jsonResponse2({ error: "Valid 3-digit area code is required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration." }, 400);
        }
        try {
          const vapiUrl = "https://api.vapi.ai/phone-number";
          const payload = {
            provider: "vapi",
            numberDesiredAreaCode: areaCode
            // Correct field name from Vapi dashboard
          };
          if (name) {
            payload.name = name;
          }
          if (settings.transfer_phone_number) {
            payload.fallbackDestination = {
              type: "number",
              number: settings.transfer_phone_number
            };
          }
          const vapiResponse = await fetch(vapiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) {
                errorText = errorJson.message;
              } else if (errorJson.error) {
                errorText = errorJson.error;
              }
            } catch {
            }
            return jsonResponse2({ error: errorText }, 400);
          }
          const vapiData = await vapiResponse.json();
          return jsonResponse2({
            id: vapiData.id,
            number: vapiData.number || vapiData.phoneNumber,
            name: vapiData.name || name
          });
        } catch (error) {
          console.error("Error creating CHAU Voice Engine phone number:", error);
          return jsonResponse2({ error: `Failed to create phone number: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/vapi/phone-number/") && url.pathname.endsWith("/assistant") && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const pathParts = url.pathname.split("/").filter(Boolean);
        const phoneNumberId = pathParts.length >= 4 ? pathParts[3] : null;
        const { assistantId } = await request.json();
        if (!phoneNumberId) {
          return jsonResponse2({ error: "Phone number ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        let settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          const ownerSettings = await env.DB.prepare(
            "SELECT private_key FROM user_settings WHERE user_id = ?"
          ).bind(workspace.owner_user_id).first();
          if (ownerSettings && ownerSettings.private_key) {
            settings = ownerSettings;
          }
        }
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration." }, 400);
        }
        try {
          const vapiUrl = `https://api.vapi.ai/phone-number/${phoneNumberId}`;
          const payload = {};
          if (assistantId === null || assistantId === void 0 || assistantId === "") {
            payload.assistantId = null;
          } else {
            payload.assistantId = assistantId;
          }
          const vapiResponse = await fetch(vapiUrl, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            return jsonResponse2({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const vapiData = await vapiResponse.json();
          return jsonResponse2({
            success: true,
            phoneNumber: {
              id: vapiData.id,
              number: vapiData.number || vapiData.phoneNumber,
              assistantId: vapiData.assistantId || null
            }
          });
        } catch (error) {
          console.error("Error updating phone number assistant:", error);
          return jsonResponse2({ error: `Failed to update phone number: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/assistants" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const settings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!settings) {
          return jsonResponse2({ error: "User settings not found" }, 404);
        }
        let effectiveUserId = userId;
        let privateKey = null;
        if (settings.selected_workspace_id) {
          const workspace = await env.DB.prepare(
            "SELECT owner_user_id FROM workspaces WHERE id = ?"
          ).bind(settings.selected_workspace_id).first();
          if (workspace) {
            const isOwner = workspace.owner_user_id === userId;
            const membership = await env.DB.prepare(
              'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
            ).bind(settings.selected_workspace_id, userId).first();
            if (isOwner || membership) {
              const wsSettings = await env.DB.prepare(
                "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
              ).bind(settings.selected_workspace_id).first();
              if (wsSettings && wsSettings.private_key) {
                privateKey = wsSettings.private_key;
                effectiveUserId = workspace.owner_user_id;
              } else {
                return jsonResponse2({ assistants: [] });
              }
            } else {
              return jsonResponse2({ error: "Access denied to workspace" }, 403);
            }
          } else {
            return jsonResponse2({ assistants: [] });
          }
        } else {
          return jsonResponse2({ assistants: [] });
        }
        if (!privateKey) {
          return jsonResponse2({ assistants: [] });
        }
        try {
          const allCached = await env.DB.prepare(
            "SELECT id, vapi_data, cached_at, updated_at FROM assistants_cache WHERE user_id = ? ORDER BY cached_at DESC"
          ).bind(effectiveUserId).all();
          if (allCached && allCached.results && allCached.results.length > 0) {
            const cacheAgeLimit = now3() - 5 * 60;
            const mostRecentCache = allCached.results[0];
            if (mostRecentCache.cached_at > cacheAgeLimit) {
              const assistants2 = allCached.results.map((row) => JSON.parse(row.vapi_data));
              return jsonResponse2({ assistants: assistants2, cached: true });
            }
          }
          const vapiUrl = "https://api.vapi.ai/assistant";
          const vapiResponse = await fetch(vapiUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${privateKey}`,
              "Content-Type": "application/json"
            }
          });
          if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            return jsonResponse2({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const assistants = await vapiResponse.json();
          const timestamp = now3();
          for (const assistant of assistants) {
            await env.DB.prepare(
              "INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(
              assistant.id,
              effectiveUserId,
              JSON.stringify(assistant),
              timestamp,
              new Date(assistant.updatedAt || assistant.createdAt).getTime() / 1e3 || timestamp
            ).run();
          }
          return jsonResponse2({ assistants, cached: false });
        } catch (error) {
          console.error("Error fetching assistants:", error);
          return jsonResponse2({ error: `Failed to fetch assistants: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/assistants/") && url.pathname !== "/api/assistants" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const assistantId = url.pathname.split("/").pop();
        if (!assistantId) {
          return jsonResponse2({ error: "Assistant ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured" }, 400);
        }
        const effectiveUserId = workspace.owner_user_id;
        try {
          const cached = await env.DB.prepare(
            "SELECT vapi_data, cached_at FROM assistants_cache WHERE id = ? AND user_id = ?"
          ).bind(assistantId, effectiveUserId).first();
          if (cached) {
            const cacheAge = now3() - cached.cached_at;
            if (cacheAge < 5 * 60) {
              return jsonResponse2({ assistant: JSON.parse(cached.vapi_data), cached: true });
            }
          }
          const vapiUrl = `https://api.vapi.ai/assistant/${assistantId}`;
          const vapiResponse = await fetch(vapiUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            }
          });
          if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            return jsonResponse2({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const assistant = await vapiResponse.json();
          const timestamp = now3();
          await env.DB.prepare(
            "INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            assistant.id,
            effectiveUserId,
            JSON.stringify(assistant),
            timestamp,
            new Date(assistant.updatedAt || assistant.createdAt).getTime() / 1e3 || timestamp
          ).run();
          return jsonResponse2({ assistant, cached: false });
        } catch (error) {
          console.error("Error fetching assistant:", error);
          return jsonResponse2({ error: `Failed to fetch assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/assistants/") && url.pathname !== "/api/assistants" && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const assistantId = url.pathname.split("/").pop();
        const updates = await request.json();
        if (!assistantId) {
          return jsonResponse2({ error: "Assistant ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        let settings;
        if (userSettings?.selected_workspace_id) {
          const workspaceId = userSettings.selected_workspace_id;
          const workspace = await env.DB.prepare(
            "SELECT owner_user_id FROM workspaces WHERE id = ?"
          ).bind(workspaceId).first();
          if (!workspace) {
            return jsonResponse2({ error: "Workspace not found" }, 404);
          }
          const isOwner = workspace.owner_user_id === userId;
          const membership = await env.DB.prepare(
            'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
          ).bind(workspaceId, userId).first();
          if (!isOwner && !membership) {
            return jsonResponse2({ error: "Access denied to workspace" }, 403);
          }
          settings = await env.DB.prepare(
            "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
          ).bind(workspaceId).first();
          if (!settings || !settings.private_key) {
            const ownerSettings = await env.DB.prepare(
              "SELECT private_key FROM user_settings WHERE user_id = ?"
            ).bind(workspace.owner_user_id).first();
            if (ownerSettings && ownerSettings.private_key) {
              settings = ownerSettings;
            }
          }
        } else {
          settings = await env.DB.prepare(
            "SELECT private_key FROM user_settings WHERE user_id = ?"
          ).bind(userId).first();
        }
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured" }, 400);
        }
        try {
          const vapiUrl = `https://api.vapi.ai/assistant/${assistantId}`;
          const vapiResponse = await fetch(vapiUrl, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(updates)
          });
          if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            return jsonResponse2({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const updatedAssistant = await vapiResponse.json();
          const timestamp = now3();
          await env.DB.prepare(
            "INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            updatedAssistant.id,
            userId,
            JSON.stringify(updatedAssistant),
            timestamp,
            new Date(updatedAssistant.updatedAt || updatedAssistant.createdAt).getTime() / 1e3 || timestamp
          ).run();
          return jsonResponse2({ assistant: updatedAssistant });
        } catch (error) {
          console.error("Error updating assistant:", error);
          return jsonResponse2({ error: `Failed to update assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/assistants" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const assistantData = await request.json();
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured. Please configure workspace API keys in Settings." }, 400);
        }
        try {
          const vapiUrl = "https://api.vapi.ai/assistant";
          const vapiResponse = await fetch(vapiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(assistantData)
          });
          if (!vapiResponse.ok) {
            let errorText = await vapiResponse.text();
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) {
                errorText = errorJson.message;
              } else if (errorJson.error) {
                errorText = errorJson.error;
              }
            } catch {
            }
            return jsonResponse2({ error: errorText }, 400);
          }
          const newAssistant = await vapiResponse.json();
          const timestamp = now3();
          const effectiveUserId = workspace.owner_user_id;
          await env.DB.prepare(
            "INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            newAssistant.id,
            effectiveUserId,
            JSON.stringify(newAssistant),
            timestamp,
            new Date(newAssistant.updatedAt || newAssistant.createdAt).getTime() / 1e3 || timestamp
          ).run();
          return jsonResponse2({ assistant: newAssistant });
        } catch (error) {
          console.error("Error creating assistant:", error);
          return jsonResponse2({ error: `Failed to create assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/assistants/") && url.pathname !== "/api/assistants" && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const assistantId = url.pathname.split("/").pop();
        if (!assistantId) {
          return jsonResponse2({ error: "Assistant ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse2({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse2({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse2({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse2({ error: "CHAU Voice Engine API key not configured" }, 400);
        }
        const effectiveUserId = workspace.owner_user_id;
        try {
          const vapiUrl = `https://api.vapi.ai/assistant/${assistantId}`;
          const vapiResponse = await fetch(vapiUrl, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`,
              "Content-Type": "application/json"
            }
          });
          if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            return jsonResponse2({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          await env.DB.prepare(
            "DELETE FROM assistants_cache WHERE id = ? AND user_id = ?"
          ).bind(assistantId, effectiveUserId).run();
          return jsonResponse2({ success: true });
        } catch (error) {
          console.error("Error deleting assistant:", error);
          return jsonResponse2({ error: `Failed to delete assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/addons" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { results } = await env.DB.prepare(
          "SELECT addon_type, is_enabled, settings FROM user_addons WHERE user_id = ?"
        ).bind(userId).all();
        return jsonResponse2({ addons: results || [] });
      }
      if (url.pathname === "/api/addons/toggle" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { addonType, enabled } = await request.json();
        if (!addonType) {
          return jsonResponse2({ error: "addon_type required" }, 400);
        }
        const timestamp = now3();
        const existing = await env.DB.prepare(
          "SELECT id FROM user_addons WHERE user_id = ? AND addon_type = ?"
        ).bind(userId, addonType).first();
        if (existing) {
          await env.DB.prepare(
            "UPDATE user_addons SET is_enabled = ?, updated_at = ? WHERE user_id = ? AND addon_type = ?"
          ).bind(enabled ? 1 : 0, timestamp, userId, addonType).run();
        } else {
          await env.DB.prepare(
            "INSERT INTO user_addons (id, user_id, addon_type, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(generateId(), userId, addonType, enabled ? 1 : 0, timestamp, timestamp).run();
        }
        return jsonResponse2({ message: "Addon updated successfully", enabled });
      }
      if (url.pathname.startsWith("/api/addon-results/") && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const callId = url.pathname.split("/").pop();
        const { results } = await env.DB.prepare(
          "SELECT addon_type, status, result_data, error_message, execution_time_ms, created_at FROM addon_results WHERE call_id = ? AND user_id = ?"
        ).bind(callId, userId).all();
        return jsonResponse2({ results: results || [] });
      }
      if (url.pathname === "/api/scheduling-triggers" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { results } = await env.DB.prepare(
          "SELECT * FROM scheduling_triggers WHERE user_id = ? ORDER BY created_at DESC"
        ).bind(userId).all();
        return jsonResponse2(results || []);
      }
      if (url.pathname === "/api/scheduling-triggers" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { name, destination_url, send_enhanced_data } = await request.json();
        if (!name || !destination_url) {
          return jsonResponse2({ error: "Name and destination URL are required" }, 400);
        }
        const triggerId = generateId();
        const timestamp = now3();
        await env.DB.prepare(
          `INSERT INTO scheduling_triggers (id, user_id, name, destination_url, send_enhanced_data, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          triggerId,
          userId,
          name,
          destination_url,
          send_enhanced_data ? 1 : 0,
          1,
          // active by default
          timestamp,
          timestamp
        ).run();
        return jsonResponse2({ id: triggerId, message: "Scheduling trigger created successfully" });
      }
      if (url.pathname.startsWith("/api/scheduling-triggers/") && request.method === "PUT") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const triggerId = url.pathname.split("/").pop();
        const { name, destination_url, send_enhanced_data, is_active } = await request.json();
        await env.DB.prepare(
          `UPDATE scheduling_triggers
           SET name = ?, destination_url = ?, send_enhanced_data = ?, is_active = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        ).bind(
          name,
          destination_url,
          send_enhanced_data ? 1 : 0,
          is_active ? 1 : 0,
          now3(),
          triggerId,
          userId
        ).run();
        return jsonResponse2({ message: "Scheduling trigger updated successfully" });
      }
      if (url.pathname.startsWith("/api/scheduling-triggers/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const triggerId = url.pathname.split("/").pop();
        await env.DB.prepare(
          "DELETE FROM scheduling_triggers WHERE id = ? AND user_id = ?"
        ).bind(triggerId, userId).run();
        return jsonResponse2({ message: "Scheduling trigger deleted successfully" });
      }
      if (url.pathname === "/api/scheduling-trigger-logs" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const triggerId = url.searchParams.get("trigger_id");
        let query = `
          SELECT stl.*, st.name as trigger_name, wc.customer_name, wc.appointment_date, wc.appointment_time
          FROM scheduling_trigger_logs stl
          JOIN scheduling_triggers st ON st.id = stl.trigger_id
          JOIN webhook_calls wc ON wc.id = stl.call_id
          WHERE st.user_id = ?
        `;
        const params = [userId];
        if (triggerId) {
          query += " AND stl.trigger_id = ?";
          params.push(triggerId);
        }
        query += " ORDER BY stl.created_at DESC LIMIT 100";
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return jsonResponse2(results || []);
      }
      if (url.pathname.startsWith("/api/knowledge-files/") && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const agentId = url.pathname.split("/").pop();
        const { results } = await env.DB.prepare(
          "SELECT * FROM agent_knowledge_files WHERE agent_id = ? ORDER BY created_at DESC"
        ).bind(agentId).all();
        return jsonResponse2(results || []);
      }
      if (url.pathname === "/api/knowledge-files" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { agent_id, vapi_file_id, file_name, file_size, status } = await request.json();
        if (!agent_id || !vapi_file_id || !file_name) {
          return jsonResponse2({ error: "Missing required fields" }, 400);
        }
        const id = generateId();
        const timestamp = now3();
        await env.DB.prepare(
          "INSERT INTO agent_knowledge_files (id, agent_id, vapi_file_id, file_name, file_size, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, agent_id, vapi_file_id, file_name, file_size || 0, status || "ready", timestamp, timestamp).run();
        return jsonResponse2({
          id,
          agent_id,
          vapi_file_id,
          file_name,
          file_size: file_size || 0,
          status: status || "ready",
          created_at: timestamp,
          updated_at: timestamp
        }, 201);
      }
      if (url.pathname.startsWith("/api/knowledge-files/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const id = url.pathname.split("/").pop();
        await env.DB.prepare(
          "DELETE FROM agent_knowledge_files WHERE id = ?"
        ).bind(id).run();
        return jsonResponse2({ message: "File deleted successfully" });
      }
      if (url.pathname === "/api/webhooks" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { name } = await request.json();
        if (!name) {
          return jsonResponse2({ error: "Webhook name required" }, 400);
        }
        const webhookId = "wh_" + generateId();
        const webhookUrl = `https://api.voice-config.channelautomation.com/webhook/${webhookId}`;
        const timestamp = now3();
        await env.DB.prepare(
          "INSERT INTO webhooks (id, user_id, webhook_url, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(webhookId, userId, webhookUrl, name, 1, timestamp, timestamp).run();
        return jsonResponse2({
          id: webhookId,
          url: webhookUrl,
          name,
          is_active: true,
          created_at: timestamp
        }, 201);
      }
      if (url.pathname === "/api/webhooks" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
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
        ).bind(effectiveUserId).all();
        return jsonResponse2(results || []);
      }
      if (url.pathname.startsWith("/api/webhooks/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const webhookId = url.pathname.split("/").pop();
        const webhook = await env.DB.prepare(
          "SELECT user_id FROM webhooks WHERE id = ?"
        ).bind(webhookId).first();
        if (!webhook) {
          return jsonResponse2({ error: "Webhook not found" }, 404);
        }
        if (webhook.user_id !== userId) {
          return jsonResponse2({ error: "Forbidden" }, 403);
        }
        await env.DB.prepare(
          "DELETE FROM webhooks WHERE id = ?"
        ).bind(webhookId).run();
        return jsonResponse2({ message: "Webhook deleted successfully" });
      }
      if (url.pathname === "/api/outbound-webhooks" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        return await createOutboundWebhook(request, env, userId);
      }
      if (url.pathname === "/api/outbound-webhooks" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        return await listOutboundWebhooks(env, userId);
      }
      if (url.pathname.startsWith("/api/outbound-webhooks/") && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const webhookId = url.pathname.split("/").pop();
        return await updateOutboundWebhook(request, env, userId, webhookId);
      }
      if (url.pathname.startsWith("/api/outbound-webhooks/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const webhookId = url.pathname.split("/").pop();
        return await deleteOutboundWebhook(env, userId, webhookId);
      }
      if (url.pathname.match(/^\/api\/outbound-webhooks\/[^/]+\/logs$/) && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const webhookId = url.pathname.split("/")[3];
        return await getOutboundWebhookLogs(env, userId, webhookId);
      }
      if (url.pathname === "/api/webhook-calls" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const webhookId = url.searchParams.get("webhook_id");
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const page = Math.floor(offset / limit) + 1;
        const cache = new VoiceAICache(env.CACHE);
        const cacheBust = url.searchParams.get("_t");
        if (!webhookId && limit <= 100 && !cacheBust) {
          const cached = await cache.getCachedRecordings(effectiveUserId, page, limit);
          if (cached) {
            console.log(`Cache HIT for recordings: user=${effectiveUserId}, page=${page}, limit=${limit}`);
            return jsonResponse2(cached);
          }
        }
        console.log(`Cache MISS for recordings: user=${effectiveUserId}, page=${page}, limit=${limit}${cacheBust ? " (cache-bust requested)" : ""}`);
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
          AND wc.customer_number IS NOT NULL
          ${webhookId ? "AND wc.webhook_id = ?" : ""}
          ORDER BY CASE
            WHEN wc.created_at > 1000000000000 THEN wc.created_at / 1000
            ELSE wc.created_at
          END DESC
          LIMIT ? OFFSET ?`
        );
        const params = webhookId ? [effectiveUserId, webhookId, limit, offset] : [effectiveUserId, limit, offset];
        const { results } = await query.bind(...params).all();
        const parsedResults = (results || []).map((row) => ({
          ...row,
          structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
          raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
          enhanced_data: row.enhanced_data ? JSON.parse(row.enhanced_data) : null
        }));
        if (!webhookId && limit <= 100) {
          await cache.cacheRecordings(effectiveUserId, parsedResults, page, limit, CACHE_TTL.RECORDINGS);
        }
        return jsonResponse2(parsedResults);
      }
      if (url.pathname === "/api/active-calls" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
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
        ).bind(effectiveUserId).all();
        return jsonResponse2(results);
      }
      if (url.pathname === "/api/active-calls/cleanup" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const twoHoursAgo = Math.floor(Date.now() / 1e3) - 2 * 60 * 60;
        const result = await env.DB.prepare(
          `DELETE FROM active_calls WHERE user_id = ? AND updated_at < ?`
        ).bind(effectiveUserId, twoHoursAgo).run();
        console.log("[Manual Cleanup] Stale calls removed:", {
          userId: effectiveUserId,
          deletedCalls: result.meta.changes,
          threshold: new Date(twoHoursAgo * 1e3).toISOString()
        });
        return jsonResponse2({
          success: true,
          deletedCalls: result.meta.changes,
          message: `Removed ${result.meta.changes} stale call(s)`
        });
      }
      if (url.pathname === "/api/concurrent-calls" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const activeCallsResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM active_calls WHERE user_id = ?`
        ).bind(effectiveUserId).first();
        const currentConcurrent = activeCallsResult?.count || 0;
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          AND customer_number IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1000`
        ).bind(effectiveUserId).all();
        let peakConcurrent = 0;
        if (results && results.length > 0) {
          const callRanges = [];
          for (const row of results) {
            try {
              const payload = typeof row.raw_payload === "string" ? JSON.parse(row.raw_payload) : row.raw_payload;
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
          if (callRanges.length > 0) {
            const timePoints = /* @__PURE__ */ new Set();
            callRanges.forEach((range) => {
              timePoints.add(range.start);
              timePoints.add(range.end);
            });
            const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
            for (const timePoint of sortedTimePoints) {
              const concurrent = callRanges.filter(
                (range) => range.start <= timePoint && range.end > timePoint
              ).length;
              if (concurrent > peakConcurrent) {
                peakConcurrent = concurrent;
              }
            }
          }
        }
        return jsonResponse2({
          current: currentConcurrent,
          peak: peakConcurrent
        });
      }
      if (url.pathname === "/api/concurrent-calls/timeseries" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const granularity = url.searchParams.get("granularity") || "minute";
        const limit = parseInt(url.searchParams.get("limit") || "1000");
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          AND customer_number IS NOT NULL
          ORDER BY created_at DESC
          LIMIT ?`
        ).bind(effectiveUserId, limit).all();
        if (!results || results.length === 0) {
          return jsonResponse2({ data: [], labels: [] });
        }
        const callRanges = [];
        for (const row of results) {
          try {
            const payload = typeof row.raw_payload === "string" ? JSON.parse(row.raw_payload) : row.raw_payload;
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
          return jsonResponse2({ data: [], labels: [] });
        }
        const allTimes = callRanges.flatMap((r) => [r.start, r.end]);
        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);
        let bucketSize;
        let dateFormatter;
        if (granularity === "minute") {
          bucketSize = 60 * 1e3;
          dateFormatter = /* @__PURE__ */ __name((d) => d.toISOString().slice(0, 16).replace("T", " "), "dateFormatter");
        } else if (granularity === "hour") {
          bucketSize = 60 * 60 * 1e3;
          dateFormatter = /* @__PURE__ */ __name((d) => d.toISOString().slice(0, 13) + ":00", "dateFormatter");
        } else {
          bucketSize = 24 * 60 * 60 * 1e3;
          dateFormatter = /* @__PURE__ */ __name((d) => d.toISOString().split("T")[0], "dateFormatter");
        }
        const buckets = /* @__PURE__ */ new Map();
        const bucketCount = Math.ceil((maxTime - minTime) / bucketSize);
        for (let i = 0; i <= bucketCount; i++) {
          const bucketTime = minTime + i * bucketSize;
          const bucketKey = dateFormatter(new Date(bucketTime));
          buckets.set(bucketKey, 0);
        }
        for (let i = 0; i <= bucketCount; i++) {
          const bucketTime = minTime + i * bucketSize;
          const midpoint = bucketTime + bucketSize / 2;
          const concurrent = callRanges.filter(
            (range) => range.start <= midpoint && range.end > midpoint
          ).length;
          const bucketKey = dateFormatter(new Date(bucketTime));
          buckets.set(bucketKey, concurrent);
        }
        const labels = Array.from(buckets.keys());
        const data = Array.from(buckets.values());
        return jsonResponse2({ data, labels });
      }
      if (url.pathname === "/api/dashboard-summary" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const result = await env.DB.prepare(
          `SELECT
            COUNT(*) as total_calls,
            COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as answered_calls,
            COUNT(*) - COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as unanswered_calls,
            ROUND(CAST(COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100, 2) as answer_rate,
            ROUND(AVG(CASE WHEN recording_url IS NOT NULL THEN duration_seconds END), 2) as avg_handling_time,
            ROUND(AVG(LENGTH(summary)), 2) as avg_summary_length,
            COUNT(CASE WHEN outcome = 'Successful' THEN 1 END) as qualified_leads_count,
            COUNT(CASE WHEN intent = 'Scheduling' THEN 1 END) as appointments_detected,
            ROUND(SUM(COALESCE(duration_seconds, 0)) / 60.0, 2) as total_call_minutes,
            COUNT(CASE WHEN sentiment = 'Positive' THEN 1 END) as positive_calls,
            COUNT(CASE WHEN sentiment = 'Negative' THEN 1 END) as negative_calls,
            COUNT(*) - COUNT(CASE WHEN sentiment = 'Positive' THEN 1 END) - COUNT(CASE WHEN sentiment = 'Negative' THEN 1 END) as neutral_calls
          FROM webhook_calls
          WHERE user_id = ? AND customer_number IS NOT NULL`
        ).bind(effectiveUserId).first();
        if (!result) {
          return jsonResponse2({
            totalCalls: 0,
            answeredCalls: 0,
            unansweredCalls: 0,
            answerRate: 0,
            avgHandlingTime: 0,
            avgSummaryLength: 0,
            qualifiedLeadsCount: 0,
            appointmentsDetected: 0,
            totalCallMinutes: 0,
            positiveCalls: 0,
            negativeCalls: 0,
            neutralCalls: 0
          });
        }
        return jsonResponse2({
          totalCalls: result.total_calls || 0,
          answeredCalls: result.answered_calls || 0,
          unansweredCalls: result.unanswered_calls || 0,
          answerRate: result.answer_rate || 0,
          avgHandlingTime: result.avg_handling_time || 0,
          avgSummaryLength: result.avg_summary_length || 0,
          qualifiedLeadsCount: result.qualified_leads_count || 0,
          appointmentsDetected: result.appointments_detected || 0,
          totalCallMinutes: result.total_call_minutes || 0,
          positiveCalls: result.positive_calls || 0,
          negativeCalls: result.negative_calls || 0,
          neutralCalls: result.neutral_calls || 0
        });
      }
      if (url.pathname === "/api/agent-distribution" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const { results } = await env.DB.prepare(
          `SELECT
            json_extract(ac.vapi_data, '$.name') as assistant_name,
            COUNT(*) as call_count
          FROM webhook_calls wc
          JOIN assistants_cache ac ON json_extract(wc.raw_payload, '$.message.call.assistantId') = ac.id
          WHERE wc.user_id = ?
            AND wc.raw_payload IS NOT NULL
            AND wc.customer_number IS NOT NULL
          GROUP BY assistant_name
          ORDER BY call_count DESC`
        ).bind(effectiveUserId).all();
        return jsonResponse2(results || []);
      }
      if (url.pathname === "/api/call-ended-reasons" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");
        let queryStr = `SELECT
          ended_reason,
          DATE(datetime(created_at, 'unixepoch')) as call_date,
          COUNT(*) as count
        FROM webhook_calls
        WHERE user_id = ?
        AND ended_reason IS NOT NULL
        AND created_at IS NOT NULL
        AND customer_number IS NOT NULL`;
        const params = [effectiveUserId];
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
          return jsonResponse2({ dates: [], reasons: {}, colors: {} });
        }
        const dateSet = /* @__PURE__ */ new Set();
        const reasonsSet = /* @__PURE__ */ new Set();
        const dataMap = /* @__PURE__ */ new Map();
        for (const row of results) {
          const date = row.call_date;
          const reason = row.ended_reason || "unknown";
          const count = row.count || 0;
          dateSet.add(date);
          reasonsSet.add(reason);
          if (!dataMap.has(date)) {
            dataMap.set(date, /* @__PURE__ */ new Map());
          }
          dataMap.get(date).set(reason, count);
        }
        const dates = Array.from(dateSet).sort();
        const reasons = Array.from(reasonsSet);
        const reasonColors = {};
        const colorPalette = [
          "#8b5cf6",
          // purple
          "#3b82f6",
          // blue
          "#10b981",
          // green
          "#f59e0b",
          // amber
          "#ef4444",
          // red
          "#06b6d4",
          // cyan
          "#ec4899",
          // pink
          "#6366f1"
          // indigo
        ];
        reasons.forEach((reason, idx) => {
          reasonColors[reason] = colorPalette[idx % colorPalette.length];
        });
        const reasonData = {};
        reasons.forEach((reason) => {
          reasonData[reason] = dates.map((date) => {
            const dateData = dataMap.get(date);
            return dateData?.get(reason) || 0;
          });
        });
        return jsonResponse2({
          dates,
          reasons: reasonData,
          colors: reasonColors
        });
      }
      if (url.pathname === "/api/keywords" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
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
        ).bind(effectiveUserId).all();
        return jsonResponse2(results);
      }
      if (url.pathname.startsWith("/api/calls/") && url.pathname.endsWith("/listen") && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const callId = url.pathname.split("/")[3];
        console.log("[Call Streaming] Get listen URL request:", {
          callId,
          userId
        });
        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          console.log("[Call Streaming] VAPI credentials not configured for user:", userId);
          return jsonResponse2({ error: "VAPI credentials not configured" }, 400);
        }
        try {
          console.log("[Call Streaming] Fetching call details from VAPI:", callId);
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`
            }
          });
          if (!getCallResponse.ok) {
            const error = await getCallResponse.text();
            console.error("[Call Streaming] Failed to get call details:", {
              callId,
              status: getCallResponse.status,
              error
            });
            return jsonResponse2({ error: "Failed to get call details" }, getCallResponse.status);
          }
          const callDetails = await getCallResponse.json();
          const listenUrl = callDetails.monitor?.listenUrl;
          console.log("[Call Streaming] Call details retrieved:", {
            callId,
            hasListenUrl: !!listenUrl
          });
          if (!listenUrl) {
            console.error("[Call Streaming] No listenUrl found in call details");
            return jsonResponse2({ error: "Listen URL not available for this call" }, 400);
          }
          return jsonResponse2({
            success: true,
            listenUrl,
            callId
          });
        } catch (error) {
          console.error("[Call Streaming] Error getting listen URL:", {
            callId,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse2({ error: "Failed to get listen URL" }, 500);
        }
      }
      if (url.pathname.startsWith("/api/calls/") && url.pathname.endsWith("/end") && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const callId = url.pathname.split("/")[3];
        console.log("[Call Control] End call request received:", {
          callId,
          userId
        });
        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          console.log("[Call Control] VAPI credentials not configured for user:", userId);
          return jsonResponse2({ error: "VAPI credentials not configured" }, 400);
        }
        try {
          console.log("[Call Control] Fetching call details for controlUrl:", callId);
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`
            }
          });
          if (!getCallResponse.ok) {
            const error = await getCallResponse.text();
            console.error("[Call Control] Failed to get call details:", {
              callId,
              status: getCallResponse.status,
              error
            });
            return jsonResponse2({ error: "Failed to get call details" }, getCallResponse.status);
          }
          const callDetails = await getCallResponse.json();
          const controlUrl = callDetails.monitor?.controlUrl;
          console.log("[Call Control] Call details retrieved:", {
            callId,
            hasControlUrl: !!controlUrl
          });
          if (!controlUrl) {
            console.error("[Call Control] No controlUrl found in call details");
            return jsonResponse2({ error: "Call control URL not available" }, 400);
          }
          const endCallPayload = {
            type: "end-call"
          };
          console.log("[Call Control] Sending end-call command to controlUrl:", {
            callId,
            payload: endCallPayload
          });
          const endCallResponse = await fetch(controlUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(endCallPayload)
          });
          if (!endCallResponse.ok) {
            const error = await endCallResponse.text();
            console.error("[Call Control] End-call command failed:", {
              callId,
              status: endCallResponse.status,
              error
            });
            return jsonResponse2({ error: "Failed to end call" }, endCallResponse.status);
          }
          console.log("[Call Control] Call ended successfully:", callId);
          return jsonResponse2({ success: true, message: "Call ended successfully" });
        } catch (error) {
          console.error("[Call Control] Error ending call:", {
            callId,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse2({ error: "Failed to end call" }, 500);
        }
      }
      if (url.pathname.startsWith("/api/calls/") && url.pathname.endsWith("/transfer") && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const callId = url.pathname.split("/")[3];
        const body = await request.json();
        const transferNumber = body.phoneNumber;
        console.log("[Call Control] Transfer call request received:", {
          callId,
          userId,
          transferNumber
        });
        if (!transferNumber) {
          console.log("[Call Control] Transfer number missing");
          return jsonResponse2({ error: "Transfer phone number required" }, 400);
        }
        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          console.log("[Call Control] VAPI credentials not configured for user:", userId);
          return jsonResponse2({ error: "VAPI credentials not configured" }, 400);
        }
        try {
          console.log("[Call Control] Fetching call details for controlUrl:", callId);
          const getCallResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${settings.private_key}`
            }
          });
          if (!getCallResponse.ok) {
            const error = await getCallResponse.text();
            console.error("[Call Control] Failed to get call details:", {
              callId,
              status: getCallResponse.status,
              error
            });
            return jsonResponse2({ error: "Failed to get call details" }, getCallResponse.status);
          }
          const callDetails = await getCallResponse.json();
          const controlUrl = callDetails.monitor?.controlUrl;
          console.log("[Call Control] Call details retrieved:", {
            callId,
            hasControlUrl: !!controlUrl
          });
          if (!controlUrl) {
            console.error("[Call Control] No controlUrl found in call details");
            return jsonResponse2({ error: "Call control URL not available" }, 400);
          }
          const transferPayload = {
            type: "transfer",
            destination: {
              type: "number",
              number: transferNumber
            }
          };
          console.log("[Call Control] Sending transfer command to controlUrl:", {
            callId,
            transferNumber,
            payload: transferPayload
          });
          const transferResponse = await fetch(controlUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(transferPayload)
          });
          if (!transferResponse.ok) {
            const error = await transferResponse.text();
            console.error("[Call Control] Transfer command failed:", {
              callId,
              transferNumber,
              status: transferResponse.status,
              error
            });
            return jsonResponse2({ error: "Failed to transfer call" }, transferResponse.status);
          }
          console.log("[Call Control] Call transferred successfully:", {
            callId,
            transferNumber
          });
          return jsonResponse2({ success: true, message: "Call transferred successfully" });
        } catch (error) {
          console.error("[Call Control] Error transferring call:", {
            callId,
            transferNumber,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse2({ error: "Failed to transfer call" }, 500);
        }
      }
      if (url.pathname === "/api/intent-analysis" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const page = Math.floor(offset / limit) + 1;
        const cache = new VoiceAICache(env.CACHE);
        if (limit <= 100) {
          const cached = await cache.getCachedIntentSummary(effectiveUserId);
          if (cached) {
            console.log(`Cache HIT for intent analysis: user=${effectiveUserId}`);
            return jsonResponse2(cached);
          }
        }
        console.log(`Cache MISS for intent analysis: user=${effectiveUserId}`);
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
          WHERE wc.user_id = ? AND wc.analysis_completed = 1 AND wc.customer_number IS NOT NULL
          ORDER BY wc.created_at DESC
          LIMIT ? OFFSET ?`
        ).bind(effectiveUserId, limit, offset).all();
        const userEmail = await env.DB.prepare(
          "SELECT email FROM users WHERE id = ?"
        ).bind(userId).first();
        const generateMockEnhancedData = /* @__PURE__ */ __name((index) => {
          const mockProfiles = [
            {
              firstName: "Sarah",
              lastName: "Johnson",
              address: "4532 Maple Avenue",
              city: "San Francisco",
              state: "CA",
              zip: "94102",
              countyName: "San Francisco",
              gender: "F",
              age: 42,
              phones: [{
                phone: 4155551234,
                carrier: "AT&T Mobility",
                phoneType: 1,
                workPhone: false,
                activityStatus: "Active",
                contactabilityScore: "High"
              }],
              data: {
                addressType: "Single Family",
                incomeLevel: "$75K-$100K",
                creditRange: "720-780",
                householdIncome: "$85,000-$95,000",
                homeOwnership: "Owner",
                homePrice: 875e3,
                homeValue: 92e4,
                age: 42
              },
              properties: [{
                propertyType: "Single Family Residence",
                value: 92e4,
                estimatedValue: 92e4,
                yearBuilt: 1998,
                bedrooms: "3",
                rooms: "7",
                saleDate: "2019-05-15",
                saleAmount: 785e3
              }]
            },
            {
              firstName: "Michael",
              lastName: "Rodriguez",
              address: "1847 Oak Street",
              city: "Portland",
              state: "OR",
              zip: "97201",
              countyName: "Multnomah",
              gender: "M",
              age: 35,
              phones: [{
                phone: 5035559876,
                carrier: "Verizon",
                phoneType: 1,
                workPhone: false,
                activityStatus: "Active",
                contactabilityScore: "Medium"
              }],
              data: {
                addressType: "Condominium",
                incomeLevel: "$100K-$150K",
                creditRange: "680-720",
                householdIncome: "$110,000-$125,000",
                homeOwnership: "Owner",
                homePrice: 425e3,
                homeValue: 465e3,
                age: 35
              },
              properties: [{
                propertyType: "Condominium",
                value: 465e3,
                estimatedValue: 465e3,
                yearBuilt: 2015,
                bedrooms: "2",
                rooms: "5",
                saleDate: "2021-03-22",
                saleAmount: 41e4
              }]
            },
            {
              firstName: "Jennifer",
              lastName: "Chen",
              address: "2315 Pine Ridge Drive",
              city: "Seattle",
              state: "WA",
              zip: "98101",
              countyName: "King",
              gender: "F",
              age: 52,
              phones: [{
                phone: 2065557890,
                carrier: "T-Mobile",
                phoneType: 1,
                workPhone: false,
                activityStatus: "Active",
                contactabilityScore: "Very High"
              }],
              data: {
                addressType: "Single Family",
                incomeLevel: "$150K+",
                creditRange: "780-850",
                householdIncome: "$175,000+",
                homeOwnership: "Owner",
                homePrice: 12e5,
                homeValue: 135e4,
                age: 52
              },
              properties: [{
                propertyType: "Single Family Residence",
                value: 135e4,
                estimatedValue: 135e4,
                yearBuilt: 2005,
                bedrooms: "4",
                rooms: "9",
                saleDate: "2018-11-08",
                saleAmount: 105e4
              }]
            }
          ];
          return {
            identities: [mockProfiles[index % mockProfiles.length]]
          };
        }, "generateMockEnhancedData");
        const parsedResults = (results || []).map((row, index) => {
          let enhancedData = row.enhanced_data ? JSON.parse(row.enhanced_data) : null;
          if (userEmail?.email === "vic@channelautomation.com" && !enhancedData) {
            enhancedData = generateMockEnhancedData(index);
          }
          let structuredOutputs = {};
          if (row.raw_payload) {
            const rawPayload = JSON.parse(row.raw_payload);
            const analysis = rawPayload?.message?.analysis || {};
            const artifact = rawPayload?.message?.artifact || {};
            structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || {};
          }
          return {
            ...row,
            structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
            raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
            enhanced_data: enhancedData,
            structured_outputs: structuredOutputs
          };
        });
        const totalCalls = parsedResults.length;
        const answeredCalls = parsedResults.filter((call) => call.recording_url).length;
        const avgConfidence = totalCalls > 0 ? parsedResults.reduce((sum, call) => sum + 85, 0) / totalCalls : 0;
        const intentDistribution = parsedResults.reduce((acc, call) => {
          acc[call.intent] = (acc[call.intent] || 0) + 1;
          return acc;
        }, {});
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
        if (limit <= 100) {
          await cache.cacheIntentSummary(effectiveUserId, summaryData, CACHE_TTL.INTENT_SUMMARY);
        }
        return jsonResponse2(summaryData);
      }
      if (url.pathname === "/api/appointments" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const { results } = await env.DB.prepare(
          `SELECT
            wc.id,
            wc.vapi_call_id,
            wc.phone_number,
            wc.customer_number,
            wc.customer_name,
            wc.raw_payload,
            wc.structured_data,
            wc.created_at
          FROM webhook_calls wc
          WHERE wc.user_id = ?
            AND wc.raw_payload IS NOT NULL
            AND wc.customer_number IS NOT NULL
          ORDER BY wc.created_at DESC
          LIMIT 100`
        ).bind(effectiveUserId).all();
        const appointments = (results || []).map((row) => {
          try {
            const rawPayload = row.raw_payload ? JSON.parse(row.raw_payload) : null;
            const structuredOutputs = rawPayload?.message?.analysis?.structuredOutputs || rawPayload?.message?.artifact?.structuredOutputs || {};
            let appointmentDate = null;
            let appointmentTime = null;
            let qualityScore = null;
            let issueType = null;
            let customerFrustrated = null;
            let escalationRequired = null;
            let callSummary = null;
            let product = null;
            Object.entries(structuredOutputs).forEach(([key, value]) => {
              if (typeof value === "object" && value !== null && "name" in value && "result" in value) {
                const name = value.name.toLowerCase();
                const result = value.result;
                if (name.includes("appointment date") || name.includes("appointmentdate")) {
                  appointmentDate = result;
                } else if (name.includes("appointment time") || name.includes("appointmenttime")) {
                  appointmentTime = result;
                } else if (name.includes("quality score") || name.includes("qualityscore")) {
                  qualityScore = typeof result === "number" ? result : parseInt(result);
                } else if (name.includes("issue type") || name.includes("issuetype")) {
                  issueType = result;
                } else if (name.includes("customer frustrated") || name.includes("customerfrustrated")) {
                  customerFrustrated = typeof result === "boolean" ? result : result === "true";
                } else if (name.includes("escalation required") || name.includes("escalationrequired")) {
                  escalationRequired = typeof result === "boolean" ? result : result === "true";
                } else if (name.includes("call summary") || name.includes("callsummary") || name.includes("summary")) {
                  callSummary = result;
                } else if (name.includes("product")) {
                  product = result;
                }
              }
            });
            if (row.structured_data) {
              try {
                const structuredData = JSON.parse(row.structured_data);
                if (!product) {
                  product = structuredData?.product || null;
                }
                if (!appointmentTime) {
                  appointmentTime = structuredData?.["appointment time"] || structuredData?.["Appointment time"] || structuredData?.["appointmentTime"] || null;
                }
              } catch (e) {
              }
            }
            const phoneNumber = row.customer_number || row.phone_number || null;
            return {
              id: row.id,
              vapi_call_id: row.vapi_call_id,
              phone_number: phoneNumber,
              customer_name: row.customer_name,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime,
              quality_score: qualityScore,
              issue_type: issueType,
              customer_frustrated: customerFrustrated,
              escalation_required: escalationRequired,
              call_summary: callSummary,
              product,
              created_at: row.created_at
            };
          } catch (error) {
            console.error("Error parsing appointment data:", error);
            return null;
          }
        }).filter((apt) => {
          if (!apt) return false;
          if (!apt.appointment_date && !apt.call_summary) return false;
          if (apt.appointment_date) {
            try {
              const appointmentDate = new Date(apt.appointment_date);
              const today = /* @__PURE__ */ new Date();
              today.setHours(0, 0, 0, 0);
              if (appointmentDate < today) {
                return false;
              }
            } catch (e) {
            }
          }
          return true;
        });
        return jsonResponse2(appointments);
      }
      if (url.pathname === "/api/generate-demo-data" && request.method === "POST") {
        const currentUserId = await getUserFromToken(request, env);
        if (!currentUserId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const vicUser = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ?"
        ).bind("vic@channelautomation.com").first();
        if (!vicUser) {
          return jsonResponse2({ error: "Demo account not found" }, 404);
        }
        const userId = vicUser.id;
        let webhook = await env.DB.prepare(
          "SELECT id FROM webhooks WHERE user_id = ? LIMIT 1"
        ).bind(userId).first();
        if (!webhook) {
          const webhookId = generateId();
          await env.DB.prepare(
            "INSERT INTO webhooks (id, user_id, webhook_url, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
          ).bind(webhookId, userId, `https://api.voice-config.channelautomation.com/webhooks/${webhookId}`, "Demo Webhook", Date.now(), Date.now()).run();
          webhook = { id: webhookId };
        }
        const timestamp = Date.now();
        const demoCalls = [
          {
            id: "demo_001_" + timestamp,
            name: "Sarah Johnson",
            phone: "+14155551234",
            intent: "Scheduling",
            sentiment: "Positive",
            outcome: "Successful",
            summary: "Customer called to schedule a window replacement consultation. Showed strong interest in energy-efficient options.",
            transcript: "AI: Thank you for calling EcoView Windows and Doors. This is James. Customer: Hi, this is Sarah Johnson. I am interested in getting some windows replaced. AI: Great! Are you looking for a consultation? Customer: Yes, I am particularly interested in energy-efficient windows. AI: Perfect! Let me schedule that for you.",
            appointmentDate: new Date(Date.now() + 5 * 864e5).toISOString().split("T")[0],
            appointmentTime: "2:00 PM",
            days_ago: 1
          },
          {
            id: "demo_002_" + timestamp,
            name: "Michael Rodriguez",
            phone: "+15035559876",
            intent: "Information",
            sentiment: "Neutral",
            outcome: "Follow-up Required",
            summary: "Customer inquired about pricing for sliding glass doors. Asked about installation timeline and warranty.",
            transcript: "AI: Thank you for calling EcoView. This is Alex. Customer: Hi, I am interested in learning about sliding glass doors. Can you tell me about pricing? AI: Our doors range from $2,500 to $8,000. Customer: How long does installation take? AI: Usually one full day. Customer: I need to think about it.",
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 2
          },
          {
            id: "demo_003_" + timestamp,
            name: "Jennifer Chen",
            phone: "+12065557890",
            intent: "Scheduling",
            sentiment: "Positive",
            outcome: "Successful",
            summary: "Existing customer scheduling installation of bay window. Very satisfied with previous service.",
            transcript: "AI: Thank you for calling EcoView. This is Maria. Customer: Hi Maria, this is Jennifer Chen. I ordered a bay window last month and want to schedule installation. AI: Of course! When works for you? Customer: Thursday morning around 10 AM. AI: Perfect! You are all set.",
            appointmentDate: new Date(Date.now() + 3 * 864e5).toISOString().split("T")[0],
            appointmentTime: "10:00 AM",
            days_ago: 3
          },
          {
            id: "demo_004_" + timestamp,
            name: "Robert Martinez",
            phone: "+13105554321",
            intent: "Support",
            sentiment: "Negative",
            outcome: "Follow-up Required",
            summary: "Customer reported condensation between window panes. Escalated to warranty department.",
            transcript: "AI: EcoView support. This is Tom. Customer: I have condensation between my window panes. AI: That indicates a seal failure. When were they installed? Customer: About 3 years ago. Is this covered? AI: Yes, fully covered. We will replace at no cost.",
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 4
          },
          {
            id: "demo_005_" + timestamp,
            name: "Amanda Foster",
            phone: "+14085556789",
            intent: "Information",
            sentiment: "Positive",
            outcome: "Successful",
            summary: "Customer asking about French doors. Requested free estimate.",
            transcript: "AI: Good afternoon! This is Jessica. Customer: Hi! I am looking to replace my patio door with French doors. AI: Yes we offer those! Are you looking for inswing or outswing? Customer: What do you recommend? AI: For patios, outswing is better. Customer: How do I get an estimate? AI: We can schedule a free consultation.",
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 5
          },
          {
            id: "demo_006_" + timestamp,
            name: "David Thompson",
            phone: "+16195553456",
            intent: "Scheduling",
            sentiment: "Neutral",
            outcome: "Successful",
            summary: "Customer rescheduling consultation due to work conflict.",
            transcript: "AI: Scheduling department. This is Rachel. Customer: I need to reschedule my Wednesday appointment. AI: No problem! When works better? Customer: Friday afternoon around 3:30? AI: Perfect! You are all set for Friday at 3:30.",
            appointmentDate: new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0],
            appointmentTime: "3:30 PM",
            days_ago: 6
          },
          {
            id: "demo_007_" + timestamp,
            name: "Lisa Anderson",
            phone: "+14155557777",
            intent: "Purchase",
            sentiment: "Positive",
            outcome: "Successful",
            summary: "Customer ready for full house window replacement. Placing deposit.",
            transcript: "AI: Good morning! This is Brandon. Customer: I received my quote last week and I am ready to move forward! AI: Fantastic! Let me process your deposit. Customer: Can I pay with credit card? AI: Absolutely. You are making a great investment!",
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 7
          },
          {
            id: "demo_008_" + timestamp,
            name: "James Wilson",
            phone: "+15035558888",
            intent: "Information",
            sentiment: "Neutral",
            outcome: "Follow-up Required",
            summary: "Customer comparing window brands and prices.",
            transcript: "AI: Thank you for calling EcoView. This is Sarah. Customer: I am getting quotes from several companies. What brands do you carry? AI: We install Milgard and Pella. Customer: How do your prices compare? AI: We are very competitive. Customer: I am still getting other quotes.",
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 8
          },
          {
            id: "demo_009_" + timestamp,
            name: "Patricia Lee",
            phone: "+14085559999",
            intent: "Support",
            sentiment: "Positive",
            outcome: "Successful",
            summary: "Customer asking about window maintenance. Provided care instructions.",
            transcript: "AI: Support team. This is Kevin. Customer: I just had windows installed and want to know how to care for them. AI: For glass, use regular cleaner quarterly. For frames, warm soapy water. Customer: What about tracks? AI: Vacuum monthly. Customer: Perfect, thank you!",
            appointmentDate: null,
            appointmentTime: null,
            days_ago: 9
          },
          {
            id: "demo_010_" + timestamp,
            name: "Christopher Brown",
            phone: "+16195551111",
            intent: "Scheduling",
            sentiment: "Positive",
            outcome: "Successful",
            summary: "New customer wants consultation for windows and doors. Motivated buyer.",
            transcript: "AI: Thank you for calling EcoView! This is Michelle. Customer: I just bought a house and want to replace all windows and the front door. AI: Congratulations! How many windows? Customer: About 15 windows and a nice entry door. AI: Perfect! Thursday at 11 AM work? Customer: Perfect!",
            appointmentDate: new Date(Date.now() + 2 * 864e5).toISOString().split("T")[0],
            appointmentTime: "11:00 AM",
            days_ago: 10
          }
        ];
        for (const call of demoCalls) {
          const callTimestamp = timestamp - call.days_ago * 864e5;
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
            "+18005551234",
            call.phone,
            null,
            // No recording URL for demo data - use actual recording URLs from real calls
            "customer-ended-call",
            call.summary,
            call.intent,
            call.sentiment,
            call.outcome,
            1,
            Math.floor(callTimestamp / 1e3),
            call.name,
            null,
            call.appointmentDate,
            call.appointmentTime,
            call.appointmentDate ? "Consultation" : null,
            "{}",
            rawPayload,
            Math.floor(callTimestamp / 1e3)
          ).run();
        }
        const cache = new VoiceAICache(env.CACHE);
        await cache.invalidateUserCache(userId);
        return jsonResponse2({
          success: true,
          message: `Created ${demoCalls.length} demo calls for vic@channelautomation.com`,
          callsCreated: demoCalls.length
        });
      }
      if (url.pathname === "/api/cache/stats" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const cache = new VoiceAICache(env.CACHE);
        const stats = await cache.getCacheStats();
        return jsonResponse2({
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
      const checkAdminAccess = /* @__PURE__ */ __name(async (userId) => {
        if (!userId) return false;
        const user = await env.DB.prepare(
          "SELECT email FROM users WHERE id = ?"
        ).bind(userId).first();
        if (!user || !user.email) return false;
        const adminEmails = "vic@channelautomation.com".split(",").map((e) => e.trim());
        return adminEmails.some(
          (adminEmail) => user.email.toLowerCase() === adminEmail.toLowerCase() || user.email.toLowerCase().includes(adminEmail.toLowerCase())
        );
      }, "checkAdminAccess");
      if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
          return jsonResponse2({ error: "Admin access required" }, 403);
        }
        const totalUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
        const totalCalls = await env.DB.prepare("SELECT COUNT(*) as count FROM webhook_calls").first();
        const totalWebhooks = await env.DB.prepare("SELECT COUNT(*) as count FROM webhooks").first();
        const activeCalls = await env.DB.prepare("SELECT COUNT(*) as count FROM active_calls").first();
        const recentUsers = await env.DB.prepare(
          "SELECT id, email, name, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 10"
        ).all();
        return jsonResponse2({
          success: true,
          data: {
            overview: {
              totalUsers: totalUsers?.count || 0,
              totalCalls: totalCalls?.count || 0,
              totalWebhooks: totalWebhooks?.count || 0,
              activeCalls: activeCalls?.count || 0
            },
            recentUsers: (recentUsers.results || []).map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              created_at: u.created_at,
              last_login_at: u.last_login_at
            }))
          }
        });
      }
      if (url.pathname === "/api/admin/users" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse2({ error: "Unauthorized" }, 401);
        }
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
          return jsonResponse2({ error: "Admin access required" }, 403);
        }
        const users = await env.DB.prepare(
          "SELECT id, email, name, created_at, last_login_at FROM users ORDER BY created_at DESC"
        ).all();
        return jsonResponse2({
          success: true,
          data: users.results || []
        });
      }
      if (url.pathname === "/docs/salesforce-integration" && request.method === "GET") {
        const markdown = `# Salesforce Integration Guide

## \u{1F3AF} What This Integration Does

When you connect Salesforce to your Voice AI Dashboard, every incoming call is automatically logged in Salesforce. Here's what happens:

1. **Search by Phone Number** - We find the existing Lead or Contact in Salesforce using the caller's phone number
2. **Create Call Log** - We create a Task (call log) on that Lead/Contact record with the full call details
3. **Schedule Appointments** - If your Voice AI schedules an appointment during the call, we create an Event (appointment) in Salesforce automatically

**Best Part**: Zero programming required on your Salesforce side - just a simple OAuth connection!

---

## \u{1F4CB} How It Works

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                         SALESFORCE INTEGRATION                            \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

   One-Time Setup                      Automatic (Every Call)
   ==============                      ======================

   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
   \u2502   You Click  \u2502                   \u2502  Customer Calls      \u2502
   \u2502  "Connect    \u2502                   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   \u2502 Salesforce"  \u2502                              \u2502
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                              \u2502
          \u2502                                      \u25BC
          \u2502                          \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
          \u25BC                          \u2502 1. Search Salesforce        \u2502
   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                 \u2502    by Phone Number          \u2502
   \u2502  Salesforce  \u2502                 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   \u2502  Login Page  \u2502                               \u2502
   \u2502  Opens       \u2502                               \u2502
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
          \u2502                            \u2502 Lead/Contact Found? \u2502
          \u2502                            \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
          \u25BC                                       \u2502
   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                              YES
   \u2502  Click       \u2502                               \u2502
   \u2502  "Allow"     \u2502                               \u25BC
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
          \u2502                           \u2502 2. Create Task (Call Log)   \u2502
          \u2502                           \u2502    on that record           \u2502
          \u25BC                           \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                               \u2502
   \u2502  \u2705 Connected\u2502                               \u2502
   \u2502  Done!       \u2502                    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                    \u2502 Appointment booked? \u2502
                                       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                                                  \u2502
                                         \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                                         \u2502                 \u2502
                                        YES               NO
                                         \u2502                 \u2502
                                         \u25BC                 \u25BC
                              \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                              \u2502 3. Create Event  \u2502  \u2502  Done \u2713  \u2502
                              \u2502    (Appointment) \u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                              \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

                                  \u2705 All Done!
                          Call log + Appointment in Salesforce

\`\`\`

---

## \u{1F510} Simple OAuth Connection

### Why This Is Easy

No manual API key copying, no developer console needed. Just click and authorize!

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                         OAUTH SETUP FLOW                                     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

 Your Dashboard              Salesforce               Result
 ==============              ==========               ======

      \u2502                         \u2502                       \u2502
      \u2502  1. Click "Connect      \u2502                       \u2502
      \u2502     Salesforce"         \u2502                       \u2502
      \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502  2. Popup Opens         \u2502                       \u2502
      \u2502     Login to Salesforce \u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502  3. See Permission      \u2502                       \u2502
      \u2502     Request:            \u2502                       \u2502
      \u2502     "Allow Voice AI     \u2502                       \u2502
      \u2502      to access your     \u2502                       \u2502
      \u2502      data?"             \u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502  4. Click "Allow"       \u2502                       \u2502
      \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502                         \u2502  5. Authorization     \u2502
      \u2502                         \u2502     Granted           \u2502
      \u2502                         \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502
      \u2502                         \u2502                       \u2502
      \u2502  6. Connected! \u2705       \u2502                       \u2502  \u2705 All calls now
      \u2502     Popup Closes        \u2502                       \u2502    auto-log to
      \u2502                         \u2502                       \u2502    Salesforce!
      \u2502\u25C4\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
      \u2502                         \u2502                       \u2502

\`\`\`

---

## \u{1F50D} How Phone Number Search Works

We use Salesforce's powerful search to find your Leads and Contacts, even with different phone formats!

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   PHONE NUMBER SEARCH                            \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Incoming Call: +1 (555) 123-4567

Step 1: Clean Phone Number
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Remove: +, (, ), -, spaces
  Result: "15551234567"

Step 2: Search Salesforce
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Search ALL phone fields in:
  \u2192 Leads (Phone, Mobile)
  \u2192 Contacts (Phone, Mobile)

  Salesforce automatically matches:
  \u2022 "+1 (555) 123-4567"  \u2713
  \u2022 "555-123-4567"        \u2713
  \u2022 "5551234567"          \u2713
  \u2022 "+15551234567"        \u2713
  \u2022 "(555) 123-4567"      \u2713

Step 3: Priority
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  1. Check Leads first (new prospects)
  2. Then check Contacts (existing customers)
  3. Use first match found

Step 4: Create Call Log
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Task created on the Lead/Contact
  \u2705 Appears in Activity Timeline!

\`\`\`

---

## \u{1F4DE} Call Logging

Every call creates a Task in Salesforce with complete details:

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502              WHAT GETS LOGGED IN SALESFORCE                      \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Lead/Contact: John Smith
Phone: (555) 123-4567

Activity Timeline:
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u260E\uFE0F  Task: Inbound Call                                     \u2502
\u2502                                                              \u2502
\u2502      Subject:          Inbound Call                          \u2502
\u2502      Status:           Completed                             \u2502
\u2502      Type:             Call                                  \u2502
\u2502      Call Type:        Inbound                               \u2502
\u2502      Date/Time:        Today at 10:45 AM                     \u2502
\u2502      Duration:         3 min 42 sec                          \u2502
\u2502                                                              \u2502
\u2502      Description:      [Full call summary from Voice AI]    \u2502
\u2502                       Customer inquired about premium        \u2502
\u2502                       service. Interested in pricing.        \u2502
\u2502                       Follow-up needed.                      \u2502
\u2502                                                              \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\`\`\`

---

## \u{1F4C5} Appointment Scheduling

When your Voice AI schedules an appointment during a call, we automatically create both a call log AND a calendar event!

### How It Works

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                    APPOINTMENT BOOKING FLOW                                  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

  During Call                   After Call Ends           In Salesforce
  ===========                   ===============           =============

      \u2502                              \u2502                         \u2502
      \u2502 Customer:                    \u2502                         \u2502
      \u2502 "I'd like to schedule        \u2502                         \u2502
      \u2502  an appointment for          \u2502                         \u2502
      \u2502  next Monday at 2pm"         \u2502                         \u2502
      \u2502                              \u2502                         \u2502
      \u2502 AI:                          \u2502                         \u2502
      \u2502 "Great! I've booked you      \u2502                         \u2502
      \u2502  for January 15th at         \u2502                         \u2502
      \u2502  2:00 PM"                    \u2502                         \u2502
      \u2502                              \u2502                         \u2502
      \u2502 [Call Ends]                  \u2502                         \u2502
      \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502                         \u2502
      \u2502                              \u2502                         \u2502
      \u2502                              \u2502 1. Find Lead/Contact    \u2502
      \u2502                              \u2502    by phone             \u2502
      \u2502                              \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502
      \u2502                              \u2502                         \u2502
      \u2502                              \u2502 2. Create Task          \u2502
      \u2502                              \u2502    (Call Log) \u2713         \u2502
      \u2502                              \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502
      \u2502                              \u2502                         \u2502
      \u2502                              \u2502 3. Create Event         \u2502
      \u2502                              \u2502    (Appointment) \u2713      \u2502
      \u2502                              \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502
      \u2502                              \u2502                         \u2502

  Result in Salesforce:
  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  Lead: Sarah Johnson
  \u2514\u2500\u2500 Activity Timeline
      \u251C\u2500\u2500 \u2705 Task: "Inbound Call - Scheduled Appointment"
      \u2502   Today at 10:30 AM
      \u2502   Duration: 3 min 45 sec
      \u2502
      \u2514\u2500\u2500 \u{1F4C5} Event: "Consultation Appointment"
          Monday, Jan 15 at 2:00 PM - 3:00 PM
          \u{1F514} Reminder: 1 hour before
          Shows in Salesforce Calendar!

\`\`\`

### Task vs Event: What's The Difference?

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                  TASK VS EVENT IN SALESFORCE                     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Task (Call Log)                    Event (Appointment)
===============                    ===================

\u260E\uFE0F  Phone Icon                     \u{1F4C5} Calendar Icon

Purpose:                           Purpose:
  Record past activity               Schedule future activity

Status:                            Status:
  Completed \u2713                        Scheduled/Planned

Time:                              Time:
  When call happened                 When appointment is

Shows In:                          Shows In:
  \u2022 Activity History                 \u2022 Activity History
  \u2022 Task List                        \u2022 Salesforce Calendar
                                     \u2022 Outlook/Google Calendar sync

Example:                           Example:
  "Customer called today             "Consultation scheduled for
   about pricing"                     Jan 15 at 2:00 PM"

\`\`\`

### What Gets Captured

When an appointment is booked during a call, we capture:

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502              APPOINTMENT EVENT IN SALESFORCE                     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Event Details:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Subject:       "Consultation Appointment"
  Date:          January 15, 2025
  Start Time:    2:00 PM
  End Time:      3:00 PM (1 hour duration)
  Type:          Meeting
  Status:        Scheduled

  Description:   Appointment scheduled during call.

                 Notes: Bring ID and insurance card

                 Call Summary:
                 Customer called to schedule consultation.
                 Interested in premium service package.

  Reminder:      Set for 1 hour before (1:00 PM)

Visibility:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Shows in Salesforce Activity Timeline
  \u2713 Shows in Salesforce Calendar
  \u2713 Syncs to Outlook/Google Calendar (if enabled)
  \u2713 Rep receives reminder notification

\`\`\`

---

## \u{1F3AF} What You See in Salesforce

### Activity Timeline View

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Lead: Michael Rodriguez                                     \u2502
\u2502  Phone: (555) 987-6543                                       \u2502
\u2502  Company: Tech Solutions Inc.                                \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Activity Timeline                           [Filter] [Sort] \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502                                                               \u2502
\u2502  \u{1F4C5} Upcoming                                                 \u2502
\u2502  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500                                                   \u2502
\u2502                                                               \u2502
\u2502  Monday, Jan 15 at 2:00 PM                                   \u2502
\u2502  \u{1F4C5}  Consultation Appointment - Scheduled via Voice AI       \u2502
\u2502      Duration: 1 hour (2:00 PM - 3:00 PM)                    \u2502
\u2502      \u{1F514} Reminder set for 1:00 PM                             \u2502
\u2502      [View Details] [Reschedule] [Cancel]                    \u2502
\u2502                                                               \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502                                                               \u2502
\u2502  \u2705 Past Activity                                            \u2502
\u2502  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500                                              \u2502
\u2502                                                               \u2502
\u2502  Today at 10:30 AM                                           \u2502
\u2502  \u260E\uFE0F  Inbound Call - Scheduled Appointment                    \u2502
\u2502      Status: Completed                                       \u2502
\u2502      Duration: 3 min 45 sec                                  \u2502
\u2502      Call Type: Inbound                                      \u2502
\u2502                                                               \u2502
\u2502      Description:                                            \u2502
\u2502      Customer called to schedule consultation. Discussed     \u2502
\u2502      premium service options. Very interested. Appointment   \u2502
\u2502      created for next week. Requested reminder to bring ID.  \u2502
\u2502                                                               \u2502
\u2502      [View Full Details]                                     \u2502
\u2502                                                               \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502                                                               \u2502
\u2502  Jan 10 at 3:15 PM                                           \u2502
\u2502  \u260E\uFE0F  Inbound Call - Information Request                      \u2502
\u2502      Status: Completed                                       \u2502
\u2502      Duration: 2 min 18 sec                                  \u2502
\u2502      ...                                                     \u2502
\u2502                                                               \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

\`\`\`

### Calendar View

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Salesforce Calendar                          January 2025   \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502                                                               \u2502
\u2502  Mon 13   Tue 14   Wed 15   Thu 16   Fri 17                 \u2502
\u2502  \u2500\u2500\u2500\u2500\u2500\u2500\u2500  \u2500\u2500\u2500\u2500\u2500\u2500\u2500  \u2500\u2500\u2500\u2500\u2500\u2500\u2500  \u2500\u2500\u2500\u2500\u2500\u2500\u2500  \u2500\u2500\u2500\u2500\u2500\u2500\u2500                \u2502
\u2502                                                               \u2502
\u2502                     \u{1F4C5} 2:00 PM                                \u2502
\u2502                     Consultation                              \u2502
\u2502                     with Michael R.                           \u2502
\u2502                     (Voice AI)                                \u2502
\u2502                                                               \u2502
\u2502                                                               \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Click event to see:
  \u2022 Full appointment details
  \u2022 Related Lead/Contact
  \u2022 Call notes from booking
  \u2022 Reschedule/Cancel options

\`\`\`

---

## \u2705 Benefits

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   WHAT YOU GET                                   \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

For Sales Reps:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Complete call history on every Lead/Contact
  \u2713 No manual data entry after calls
  \u2713 Automatic appointment scheduling
  \u2713 Calendar reminders for appointments
  \u2713 Full call transcripts and summaries
  \u2713 All data in one place (Salesforce)

For Managers:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Track all inbound calls automatically
  \u2713 See which Leads are being contacted
  \u2713 Monitor appointment booking rate
  \u2713 Complete activity history
  \u2713 No missed follow-ups

For Everyone:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Zero manual work
  \u2713 No training needed
  \u2713 Works automatically 24/7
  \u2713 Sync happens in real-time
  \u2713 Nothing to configure after initial setup

\`\`\`

---

## \u{1F512} Security & Privacy

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   YOUR DATA IS SAFE                              \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Secure OAuth Connection:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Industry-standard OAuth 2.0
  \u2713 No API keys to copy/paste
  \u2713 You control permissions
  \u2713 Can disconnect anytime

What We Access:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Read Leads (to find by phone)
  \u2713 Read Contacts (to find by phone)
  \u2713 Create Tasks (to log calls)
  \u2713 Create Events (to schedule appointments)

What We DON'T Access:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2717 Cannot delete records
  \u2717 Cannot modify existing data
  \u2717 No access to other objects
  \u2717 No admin permissions
  \u2717 Cannot see other users' data

Workspace Isolation:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Each workspace has separate connection
  \u2713 No cross-workspace data sharing
  \u2713 Tokens stored securely server-side
  \u2713 Auto-refresh for uninterrupted service

\`\`\`

---

## \u{1F680} Setup Requirements

### What You Need

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   SETUP REQUIREMENTS                             \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Salesforce Account:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 Any Salesforce edition (including Professional)
  \u2022 User must have:
    \u2192 Read access to Leads
    \u2192 Read access to Contacts
    \u2192 Create access to Tasks
    \u2192 Create access to Events
  \u2022 NO System Administrator required!
  \u2022 NO Developer Console access needed!
  \u2022 NO Apex programming required!

Typical User Profiles That Work:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2713 Standard User
  \u2713 Sales User
  \u2713 Service User
  \u2713 Salesforce Platform
  \u2713 Any custom profile with object permissions above

Time Required:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 Initial admin setup: 10 minutes (one-time)
  \u2022 User connection: 30 seconds (per user)
  \u2022 Zero ongoing maintenance!

\`\`\`

---

## \u{1F393} Setup Process Overview

### For Salesforce Admins (One-Time Setup)

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502              ADMIN SETUP (10 MINUTES, ONE-TIME)                  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Step 1: Create Connected App in Salesforce
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Navigate: Setup \u2192 Apps \u2192 App Manager \u2192 New Connected App

  Fill in:
    \u2022 App Name: "Voice AI Dashboard"
    \u2022 Contact Email: your@email.com
    \u2022 Enable OAuth Settings: \u2713
    \u2022 Callback URL: (provided by us)
    \u2022 OAuth Scopes:
      - Access and manage your data (api)
      - Perform requests at any time (refresh_token)

Step 2: Get Credentials
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Copy:
    \u2022 Consumer Key (Client ID)
    \u2022 Consumer Secret (Client Secret)

  Provide these to us for configuration

Step 3: Done!
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  All workspace members can now connect their accounts

\`\`\`

### For Users (30 Seconds)

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                USER CONNECTION (30 SECONDS)                      \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Step 1: Go to Integrations
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Dashboard \u2192 Integrations \u2192 Salesforce

Step 2: Click "Connect"
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Popup window opens to Salesforce

Step 3: Login & Allow
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 Login to your Salesforce account
  \u2022 Review permissions
  \u2022 Click "Allow"

Step 4: Done! \u2705
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Connected! All calls now auto-log to Salesforce.

\`\`\`

---

## \u{1F504} How Auto-Refresh Works

You never have to reconnect! Our system automatically maintains your connection.

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502              AUTOMATIC CONNECTION MAINTENANCE                    \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Initial Connection:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  You: Click "Connect" \u2192 Login \u2192 Allow
  Result: \u2705 Connected

Behind The Scenes:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 We receive access token (expires in 2 hours)
  \u2022 We receive refresh token (never expires)
  \u2022 We store both securely

Every Time A Call Comes In:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  1. Check if access token is still valid
  2. If expired, automatically refresh it
  3. Use new token to create Task/Event
  4. You never notice any interruption!

You Never Need To:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2717 Re-login
  \u2717 Re-authorize
  \u2717 Manually refresh
  \u2717 Enter credentials again

The connection works until:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 You click "Disconnect" in our dashboard
  \u2022 You revoke access in Salesforce
  \u2022 Admin disables the Connected App

Otherwise: Always connected, always working! \u2705

\`\`\`

---

## \u2753 Frequently Asked Questions

### General Questions

**Q: Do I need to be a Salesforce Admin?**
A: No! Regular users can connect their own accounts. An admin only needs to do the one-time Connected App setup.

**Q: Will this work with Leads and Contacts?**
A: Yes! We search both Leads and Contacts by phone number and create call logs on whichever one we find.

**Q: What if the phone number isn't in Salesforce?**
A: We'll log a warning but won't create a Task. The call data is still saved in your Voice AI Dashboard.

**Q: Can I disconnect anytime?**
A: Yes! Click "Disconnect" in the Integrations page anytime. Your existing call logs in Salesforce won't be deleted.

### Phone Number Questions

**Q: Do phone formats need to match exactly?**
A: No! Salesforce's search handles different formats automatically:
- \`+1 (555) 123-4567\`
- \`555-123-4567\`
- \`5551234567\`
- All of these will match!

**Q: What if a Lead has multiple phone numbers?**
A: We search Phone AND Mobile Phone fields. If the incoming call matches either, we'll find it.

**Q: Can I test with a specific phone number?**
A: Yes! Use the "Test Sync" button in the integration settings to manually test any phone number.

### Appointment Questions

**Q: How does appointment scheduling work?**
A: If your Voice AI detects and confirms an appointment during the call, we automatically create both:
1. A Task (call log)
2. An Event (appointment on the calendar)

**Q: Can I customize the appointment duration?**
A: Yes! The default is 1 hour, but your Voice AI can specify different durations (30 min, 2 hours, etc.)

**Q: Will the sales rep get reminded?**
A: Yes! We set a reminder for 1 hour before the appointment. Reps will get Salesforce notifications.

**Q: What if the appointment needs to be rescheduled?**
A: The rep can reschedule directly in Salesforce. The Event is a normal Salesforce Event with all standard features.

### Technical Questions

**Q: Does this require Apex code?**
A: No! This is pure OAuth + REST API integration. Zero coding required.

**Q: Will this slow down my calls?**
A: No! The Salesforce sync happens after the call ends, so there's no impact on call quality or speed.

**Q: What Salesforce edition do I need?**
A: Professional Edition or higher. The integration uses standard Salesforce objects (Leads, Contacts, Tasks, Events).

**Q: How long does it take for calls to appear?**
A: Usually within 30 seconds of the call ending. It's near real-time!

---

## \u{1F4CA} Success Metrics

After connecting Salesforce, you'll see:

\`\`\`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   MEASURABLE RESULTS                             \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

Data Quality:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 100% of calls automatically logged
  \u2022 Zero manual data entry
  \u2022 Complete call transcripts saved
  \u2022 No missed follow-ups

Time Savings:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 ~5 minutes saved per call (no manual logging)
  \u2022 ~10 calls/day = 50 minutes saved daily
  \u2022 ~250 calls/month = 20+ hours saved monthly!

Sales Performance:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 Complete Lead activity history
  \u2022 Never miss a scheduled appointment
  \u2022 Better follow-up rates
  \u2022 Improved customer experience

Visibility:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  \u2022 Real-time call tracking
  \u2022 Appointment booking metrics
  \u2022 Lead engagement scores
  \u2022 Full audit trail

\`\`\`

---

## \u{1F389} Get Started

Ready to connect Salesforce?

1. **Ask your Salesforce Admin** to set up the Connected App (takes 10 minutes)
2. **Go to Integrations** in your Voice AI Dashboard
3. **Click "Connect Salesforce"**
4. **Login and Allow**
5. **Done!** Calls start auto-logging immediately

Need help? Contact our support team anytime!

---

*Last Updated: January 2025*
*Voice AI Dashboard - Salesforce Integration*`;
        return new Response(markdown, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            ...corsHeaders
          }
        });
      }
      if (url.pathname === "/docs/salesforce-integration/html" && request.method === "GET") {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salesforce Integration Guide - Voice AI Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: #111827;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 0.5rem;
    }

    h2 {
      font-size: 1.875rem;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    h3 {
      font-size: 1.5rem;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      color: #374151;
    }

    p {
      margin-bottom: 1rem;
      color: #4b5563;
    }

    pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    code {
      background: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #e11d48;
    }

    pre code {
      background: transparent;
      padding: 0;
      color: #e5e7eb;
    }

    ul, ol {
      margin: 1rem 0 1rem 2rem;
    }

    li {
      margin-bottom: 0.5rem;
      color: #4b5563;
    }

    strong {
      color: #111827;
      font-weight: 600;
    }

    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2.5rem 0;
    }

    .info-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }

    .success-box {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }

    .warning-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }

    a {
      color: #3b82f6;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .faq-question {
      font-weight: 600;
      color: #111827;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .faq-answer {
      color: #4b5563;
      margin-bottom: 1rem;
      padding-left: 1rem;
    }

    @media (max-width: 768px) {
      .container {
        padding: 20px;
      }

      h1 {
        font-size: 2rem;
      }

      h2 {
        font-size: 1.5rem;
      }

      pre {
        padding: 1rem;
        font-size: 0.75rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Salesforce Integration Guide</h1>

    <h2>\u{1F3AF} What This Integration Does</h2>
    <p>When you connect Salesforce to your Voice AI Dashboard, every incoming call is automatically logged in Salesforce. Here's what happens:</p>
    <ol>
      <li><strong>Search by Phone Number</strong> - We find the existing Lead or Contact in Salesforce using the caller's phone number</li>
      <li><strong>Create Call Log</strong> - We create a Task (call log) on that Lead/Contact record with the full call details</li>
      <li><strong>Schedule Appointments</strong> - If your Voice AI schedules an appointment during the call, we create an Event (appointment) in Salesforce automatically</li>
    </ol>

    <div class="success-box">
      <strong>Best Part:</strong> Zero programming required on your Salesforce side - just a simple OAuth connection!
    </div>

    <hr>

    <h2>\u{1F4CB} How It Works</h2>
    <pre>
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                         SALESFORCE INTEGRATION                            \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

   One-Time Setup                      Automatic (Every Call)
   ==============                      ======================

   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
   \u2502   You Click  \u2502                   \u2502  Customer Calls      \u2502
   \u2502  "Connect    \u2502                   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   \u2502 Salesforce"  \u2502                              \u2502
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                              \u2502
          \u2502                                      \u25BC
          \u2502                          \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
          \u25BC                          \u2502 1. Search Salesforce        \u2502
   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                 \u2502    by Phone Number          \u2502
   \u2502  Salesforce  \u2502                 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   \u2502  Login Page  \u2502                               \u2502
   \u2502  Opens       \u2502                               \u2502
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
          \u2502                            \u2502 Lead/Contact Found? \u2502
          \u2502                            \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
          \u25BC                                       \u2502
   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                              YES
   \u2502  Click       \u2502                               \u2502
   \u2502  "Allow"     \u2502                               \u25BC
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
          \u2502                           \u2502 2. Create Task (Call Log)   \u2502
          \u2502                           \u2502    on that record           \u2502
          \u25BC                           \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510                               \u2502
   \u2502  \u2705 Connected\u2502                               \u2502
   \u2502  Done!       \u2502                    \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518                    \u2502 Appointment booked? \u2502
                                       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                                                  \u2502
                                         \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                                         \u2502                 \u2502
                                        YES               NO
                                         \u2502                 \u2502
                                         \u25BC                 \u25BC
                              \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
                              \u2502 3. Create Event  \u2502  \u2502  Done \u2713  \u2502
                              \u2502    (Appointment) \u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                              \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

                                  \u2705 All Done!
                          Call log + Appointment in Salesforce
    </pre>

    <hr>

    <h2>\u{1F510} Simple OAuth Connection</h2>
    <h3>Why This Is Easy</h3>
    <p>No manual API key copying, no developer console needed. Just click and authorize!</p>
    <pre>
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                         OAUTH SETUP FLOW                                     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

 Your Dashboard              Salesforce               Result
 ==============              ==========               ======

      \u2502                         \u2502                       \u2502
      \u2502  1. Click "Connect      \u2502                       \u2502
      \u2502     Salesforce"         \u2502                       \u2502
      \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502  2. Popup Opens         \u2502                       \u2502
      \u2502     Login to Salesforce \u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502  3. See Permission      \u2502                       \u2502
      \u2502     Request:            \u2502                       \u2502
      \u2502     "Allow Voice AI     \u2502                       \u2502
      \u2502      to access your     \u2502                       \u2502
      \u2502      data?"             \u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502  4. Click "Allow"       \u2502                       \u2502
      \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502                       \u2502
      \u2502                         \u2502                       \u2502
      \u2502                         \u2502  5. Authorization     \u2502
      \u2502                         \u2502     Granted           \u2502
      \u2502                         \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BA\u2502
      \u2502                         \u2502                       \u2502
      \u2502  6. Connected! \u2705       \u2502                       \u2502  \u2705 All calls now
      \u2502     Popup Closes        \u2502                       \u2502    auto-log to
      \u2502                         \u2502                       \u2502    Salesforce!
      \u2502\u25C4\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
      \u2502                         \u2502                       \u2502
    </pre>

    <hr>

    <h2>\u2705 Benefits</h2>
    <h3>For Sales Reps:</h3>
    <ul>
      <li>Complete call history on every Lead/Contact</li>
      <li>No manual data entry after calls</li>
      <li>Automatic appointment scheduling</li>
      <li>Calendar reminders for appointments</li>
      <li>Full call transcripts and summaries</li>
      <li>All data in one place (Salesforce)</li>
    </ul>

    <h3>For Managers:</h3>
    <ul>
      <li>Track all inbound calls automatically</li>
      <li>See which Leads are being contacted</li>
      <li>Monitor appointment booking rate</li>
      <li>Complete activity history</li>
      <li>No missed follow-ups</li>
    </ul>

    <h3>For Everyone:</h3>
    <ul>
      <li>Zero manual work</li>
      <li>No training needed</li>
      <li>Works automatically 24/7</li>
      <li>Sync happens in real-time</li>
      <li>Nothing to configure after initial setup</li>
    </ul>

    <hr>

    <h2>\u{1F512} Security & Privacy</h2>

    <div class="info-box">
      <h3>Secure OAuth Connection:</h3>
      <ul>
        <li>Industry-standard OAuth 2.0</li>
        <li>No API keys to copy/paste</li>
        <li>You control permissions</li>
        <li>Can disconnect anytime</li>
      </ul>
    </div>

    <h3>What We Access:</h3>
    <ul>
      <li>Read Leads (to find by phone)</li>
      <li>Read Contacts (to find by phone)</li>
      <li>Create Tasks (to log calls)</li>
      <li>Create Events (to schedule appointments)</li>
    </ul>

    <h3>What We DON'T Access:</h3>
    <ul>
      <li>Cannot delete records</li>
      <li>Cannot modify existing data</li>
      <li>No access to other objects</li>
      <li>No admin permissions</li>
      <li>Cannot see other users' data</li>
    </ul>

    <hr>

    <h2>\u2753 Frequently Asked Questions</h2>

    <h3>General Questions</h3>

    <div class="faq-question">Q: Do I need to be a Salesforce Admin?</div>
    <div class="faq-answer">A: No! Regular users can connect their own accounts. An admin only needs to do the one-time Connected App setup.</div>

    <div class="faq-question">Q: Will this work with Leads and Contacts?</div>
    <div class="faq-answer">A: Yes! We search both Leads and Contacts by phone number and create call logs on whichever one we find.</div>

    <div class="faq-question">Q: What if the phone number isn't in Salesforce?</div>
    <div class="faq-answer">A: We'll log a warning but won't create a Task. The call data is still saved in your Voice AI Dashboard.</div>

    <div class="faq-question">Q: Can I disconnect anytime?</div>
    <div class="faq-answer">A: Yes! Click "Disconnect" in the Integrations page anytime. Your existing call logs in Salesforce won't be deleted.</div>

    <h3>Phone Number Questions</h3>

    <div class="faq-question">Q: Do phone formats need to match exactly?</div>
    <div class="faq-answer">A: No! Salesforce's search handles different formats automatically (e.g., +1 (555) 123-4567, 555-123-4567, 5551234567 - all will match!)</div>

    <div class="faq-question">Q: What if a Lead has multiple phone numbers?</div>
    <div class="faq-answer">A: We search Phone AND Mobile Phone fields. If the incoming call matches either, we'll find it.</div>

    <h3>Appointment Questions</h3>

    <div class="faq-question">Q: How does appointment scheduling work?</div>
    <div class="faq-answer">A: If your Voice AI detects and confirms an appointment during the call, we automatically create both: 1. A Task (call log) 2. An Event (appointment on the calendar)</div>

    <div class="faq-question">Q: Can I customize the appointment duration?</div>
    <div class="faq-answer">A: Yes! The default is 1 hour, but your Voice AI can specify different durations (30 min, 2 hours, etc.)</div>

    <div class="faq-question">Q: Will the sales rep get reminded?</div>
    <div class="faq-answer">A: Yes! We set a reminder for 1 hour before the appointment. Reps will get Salesforce notifications.</div>

    <h3>Technical Questions</h3>

    <div class="faq-question">Q: Does this require Apex code?</div>
    <div class="faq-answer">A: No! This is pure OAuth + REST API integration. Zero coding required.</div>

    <div class="faq-question">Q: Will this slow down my calls?</div>
    <div class="faq-answer">A: No! The Salesforce sync happens after the call ends, so there's no impact on call quality or speed.</div>

    <div class="faq-question">Q: What Salesforce edition do I need?</div>
    <div class="faq-answer">A: Professional Edition or higher. The integration uses standard Salesforce objects (Leads, Contacts, Tasks, Events).</div>

    <div class="faq-question">Q: How long does it take for calls to appear?</div>
    <div class="faq-answer">A: Usually within 30 seconds of the call ending. It's near real-time!</div>

    <hr>

    <h2>\u{1F389} Get Started</h2>
    <p>Ready to connect Salesforce?</p>
    <ol>
      <li><strong>Ask your Salesforce Admin</strong> to set up the Connected App (takes 10 minutes)</li>
      <li><strong>Go to Integrations</strong> in your Voice AI Dashboard</li>
      <li><strong>Click "Connect Salesforce"</strong></li>
      <li><strong>Login and Allow</strong></li>
      <li><strong>Done!</strong> Calls start auto-logging immediately</li>
    </ol>

    <div class="success-box">
      <p><strong>Need help?</strong> Contact our support team anytime!</p>
    </div>

    <hr>

    <p style="text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 3rem;">
      <em>Last Updated: January 2025</em><br>
      <em>Voice AI Dashboard - Salesforce Integration</em>
    </p>
  </div>
</body>
</html>`;
        return new Response(htmlContent, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...corsHeaders
          }
        });
      }
      if (url.pathname.startsWith("/webhook/") && request.method === "POST") {
        const webhookId = url.pathname.split("/").pop();
        const webhook = await env.DB.prepare(
          "SELECT id, user_id FROM webhooks WHERE id = ? AND is_active = 1"
        ).bind(webhookId).first();
        if (!webhook) {
          return jsonResponse2({ error: "Webhook not found or inactive" }, 404);
        }
        let payload;
        try {
          payload = await request.json();
        } catch (error) {
          await env.DB.prepare(
            "INSERT INTO webhook_logs (id, webhook_id, status, http_status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(
            generateId(),
            webhookId,
            "error",
            400,
            "Invalid JSON payload",
            now3()
          ).run();
          return jsonResponse2({ error: "Invalid JSON payload" }, 400);
        }
        const message = payload.message || {};
        const messageType = message.type || "end-of-call-report";
        const call = message.call || {};
        const customer = call.customer || {};
        const phoneNumber = call.phoneNumber || {};
        const artifact = message.artifact || {};
        const analysis = message.analysis || {};
        const timestamp = now3();
        console.log("[Webhook Debug] Message Type:", messageType);
        console.log("[Webhook Debug] Call ID:", call.id);
        console.log("[Webhook Debug] Status:", message.status);
        if (messageType === "status-update") {
          const callStatus = message.status;
          const vapiCallId = call.id;
          const customerNumber2 = customer.number || null;
          if (callStatus === "ringing" || callStatus === "in-progress" || callStatus === "forwarding") {
            let twilioData2 = null;
            if (customerNumber2) {
              try {
                const wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);
                if (wsSettings?.twilio_account_sid && wsSettings?.twilio_auth_token) {
                  twilioData2 = await lookupCallerWithTwilio(
                    customerNumber2,
                    wsSettings.twilio_account_sid,
                    wsSettings.twilio_auth_token
                  );
                }
              } catch (error) {
                console.error("Error enriching caller data:", error);
              }
            }
            await env.DB.prepare(
              `INSERT OR REPLACE INTO active_calls
              (id, user_id, vapi_call_id, customer_number, caller_name, carrier_name, line_type, status, started_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              vapiCallId,
              webhook.user_id,
              vapiCallId,
              customerNumber2,
              twilioData2?.callerName || null,
              twilioData2?.carrierName || null,
              twilioData2?.lineType || null,
              callStatus,
              timestamp,
              timestamp
            ).run();
            console.log("[Webhook Debug] Active call inserted/updated:", vapiCallId, "Status:", callStatus, "Caller:", twilioData2?.callerName || "Unknown");
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);
            if (callStatus === "ringing") {
              ctx.waitUntil(
                dispatchToOutboundWebhooks(env, webhook.user_id, "call.started", {
                  callId: vapiCallId,
                  customerPhone: customerNumber2,
                  assistantName: call.assistant?.name || "AI Assistant"
                })
              );
            }
            return jsonResponse2({ success: true, message: "Call status updated" });
          } else if (callStatus === "ended") {
            await env.DB.prepare(
              "DELETE FROM active_calls WHERE vapi_call_id = ? AND user_id = ?"
            ).bind(vapiCallId, webhook.user_id).run();
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);
            return jsonResponse2({ success: true, message: "Call ended, removed from active calls" });
          }
          return jsonResponse2({ success: true, message: "Status update received" });
        }
        const callId = generateId();
        let twilioData = null;
        const customerNumber = customer.number || null;
        if (customerNumber) {
          try {
            const wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);
            if (wsSettings?.twilio_account_sid && wsSettings?.twilio_auth_token) {
              twilioData = await lookupCallerWithTwilio(
                customerNumber,
                wsSettings.twilio_account_sid,
                wsSettings.twilio_auth_token
              );
            }
          } catch (error) {
            console.error("Error enriching caller data with Twilio:", error);
          }
        }
        if (!customerNumber) {
          console.log("[Webhook] Skipping test call - no customer number present");
          return jsonResponse2({ success: true, message: "Test call ignored (no customer number)" });
        }
        let durationSeconds = null;
        if (message.durationSeconds) {
          durationSeconds = Math.floor(message.durationSeconds);
        } else if (message.startedAt && message.endedAt) {
          try {
            const startTime = new Date(message.startedAt).getTime();
            const endTime = new Date(message.endedAt).getTime();
            durationSeconds = Math.floor((endTime - startTime) / 1e3);
          } catch (error) {
            console.error("Error calculating call duration from message timestamps:", error);
          }
        } else if (call.startedAt && call.endedAt) {
          try {
            const startTime = new Date(call.startedAt).getTime();
            const endTime = new Date(call.endedAt).getTime();
            durationSeconds = Math.floor((endTime - startTime) / 1e3);
          } catch (error) {
            console.error("Error calculating call duration from call timestamps:", error);
          }
        }
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
            phoneNumber.number || null,
            // AI agent's phone number
            customer.number || null,
            // Customer's phone number
            message.recordingUrl || artifact.recordingUrl || null,
            message.endedReason || call.endedReason || "unknown",
            analysis.summary || message.summary || "",
            JSON.stringify(analysis.structuredData || {}),
            JSON.stringify(payload),
            timestamp,
            twilioData?.callerName || null,
            twilioData?.callerType || null,
            twilioData?.carrierName || null,
            twilioData?.lineType || null,
            durationSeconds
          ).run();
          await env.DB.prepare(
            "INSERT INTO webhook_logs (id, webhook_id, status, http_status, payload_size, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(
            generateId(),
            webhookId,
            "success",
            200,
            JSON.stringify(payload).length,
            timestamp
          ).run();
          const cache = new VoiceAICache(env.CACHE);
          await cache.invalidateUserCache(webhook.user_id);
          ctx.waitUntil(
            dispatchToOutboundWebhooks(env, webhook.user_id, "call.ended", {
              callId: call.id || callId,
              customerPhone: customer.number,
              assistantName: message.assistant?.name || call.assistant?.name || "AI Assistant",
              durationSeconds,
              endedReason: message.endedReason || call.endedReason || "unknown",
              summary: analysis.summary || message.summary || "",
              structuredData: analysis.structuredData || {},
              rawPayload: payload,
              recordingUrl: message.recordingUrl || artifact.recordingUrl || null
            })
          );
          ctx.waitUntil(
            (async () => {
              try {
                const structuredData = analysis.structuredData || {};
                let vapiAppointmentDate = structuredData.appointmentDate || structuredData.appointment_date || null;
                let vapiAppointmentTime = structuredData.appointmentTime || structuredData.appointment_time || null;
                let vapiAppointmentType = structuredData.appointmentType || structuredData.appointment_type || null;
                let vapiCustomerName = structuredData.customerName || structuredData.customer_name || null;
                let vapiCustomerEmail = structuredData.customerEmail || structuredData.customer_email || null;
                const wsSettings = await getWorkspaceSettingsForUser(env, webhook.user_id);
                if (wsSettings?.openai_api_key) {
                  const transcript = artifact.transcript || "";
                  const summary = analysis.summary || message.summary || "";
                  const analysisResult = await analyzeCallWithOpenAI(
                    summary,
                    transcript,
                    wsSettings.openai_api_key
                  );
                  if (analysisResult) {
                    if (transcript) {
                      const keywords = extractKeywords(transcript);
                      await storeKeywords(keywords, webhook.user_id, analysisResult.sentiment, env.DB);
                    }
                    const finalAppointmentDate = vapiAppointmentDate || analysisResult.appointment_date;
                    const finalAppointmentTime = vapiAppointmentTime || analysisResult.appointment_time;
                    const finalAppointmentType = vapiAppointmentType || analysisResult.appointment_type;
                    const finalCustomerName = vapiCustomerName || analysisResult.customer_name;
                    const finalCustomerEmail = vapiCustomerEmail || analysisResult.customer_email;
                    let appointmentDatetime = null;
                    if (finalAppointmentDate && finalAppointmentTime) {
                      try {
                        const dateTimeStr = `${finalAppointmentDate} ${finalAppointmentTime}`;
                        appointmentDatetime = Math.floor(new Date(dateTimeStr).getTime() / 1e3);
                      } catch (e) {
                        console.error("Error parsing appointment datetime:", e);
                      }
                    }
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
                      now3(),
                      callId
                    ).run();
                    const cache2 = new VoiceAICache(env.CACHE);
                    await cache2.invalidateCallCache(webhook.user_id, callId);
                    if (analysisResult.intent === "Scheduling" && finalAppointmentDate && finalAppointmentTime) {
                      await triggerSchedulingWebhook(env, webhook.user_id, callId);
                    }
                  }
                } else if (vapiAppointmentDate && vapiAppointmentTime) {
                  let appointmentDatetime = null;
                  try {
                    const dateTimeStr = `${vapiAppointmentDate} ${vapiAppointmentTime}`;
                    appointmentDatetime = Math.floor(new Date(dateTimeStr).getTime() / 1e3);
                  } catch (e) {
                    console.error("Error parsing appointment datetime:", e);
                  }
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
                    now3(),
                    callId
                  ).run();
                  const cache2 = new VoiceAICache(env.CACHE);
                  await cache2.invalidateCallCache(webhook.user_id, callId);
                  await triggerSchedulingWebhook(env, webhook.user_id, callId);
                }
                await processAddonsForCall(
                  env,
                  webhook.user_id,
                  callId,
                  customer.number
                );
                const hasSummary = analysis?.summary || message.summary;
                try {
                  const hubspotTokens = await env.DB.prepare(
                    "SELECT access_token FROM hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?"
                  ).bind(webhook.user_id, wsSettings?.workspace_id).first();
                  if (hubspotTokens && customer.number && hasSummary) {
                    console.log("[HubSpot] Syncing call to HubSpot...");
                    const messages = artifact?.messages || [];
                    const conversation = messages.filter((msg) => msg.role === "user" || msg.role === "bot" || msg.role === "assistant").map((msg) => ({
                      role: msg.role === "bot" ? "assistant" : msg.role,
                      message: msg.message || msg.content || ""
                    }));
                    const structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || null;
                    await syncCallToHubSpot(
                      env.DB,
                      webhook.user_id,
                      wsSettings?.workspace_id || "",
                      callId,
                      {
                        phoneNumber: customer.number,
                        summary: analysis?.summary || message.summary || "",
                        structuredData: analysis?.structuredData || {},
                        conversation,
                        structuredOutputs
                      },
                      env
                    );
                  } else {
                    console.log("[HubSpot] Skipping sync - missing required data:", {
                      hasTokens: !!hubspotTokens,
                      hasPhone: !!customer.number,
                      hasSummary
                    });
                  }
                } catch (hubspotError) {
                  console.error("[HubSpot] Sync error:", hubspotError);
                }
                try {
                  console.log("[Dynamics 365] Starting sync check...", {
                    workspaceId: wsSettings?.workspace_id,
                    customerNumber: customer.number,
                    hasSummary
                  });
                  const dynamicsSettings = await env.DB.prepare(
                    "SELECT dynamics_access_token, dynamics_refresh_token, dynamics_token_expires_at, dynamics_instance_url FROM workspace_settings WHERE workspace_id = ?"
                  ).bind(wsSettings?.workspace_id || "").first();
                  console.log("[Dynamics 365] Settings check:", {
                    hasSettings: !!dynamicsSettings,
                    hasAccessToken: !!(dynamicsSettings && dynamicsSettings.dynamics_access_token),
                    hasRefreshToken: !!(dynamicsSettings && dynamicsSettings.dynamics_refresh_token)
                  });
                  const hasDynamicsTokens = dynamicsSettings && dynamicsSettings.dynamics_access_token && dynamicsSettings.dynamics_refresh_token;
                  if (hasDynamicsTokens && customer.number && hasSummary) {
                    console.log("[Dynamics 365] All checks passed, syncing call to Dynamics 365...");
                    let appointmentData = null;
                    const structuredOutputs = analysis?.structuredOutputs || artifact?.structuredOutputs || null;
                    if (structuredOutputs && typeof structuredOutputs === "object") {
                      const appointment = structuredOutputs.appointment || structuredOutputs.scheduled_appointment || structuredOutputs.appointmentDetails;
                      if (appointment && appointment.date && appointment.time) {
                        appointmentData = {
                          date: appointment.date,
                          time: appointment.time,
                          type: appointment.type || appointment.appointmentType || "Call",
                          notes: appointment.notes || appointment.description || "",
                          duration: appointment.duration || 60
                          // Default 60 minutes
                        };
                      }
                    }
                    await syncCallToDynamics(
                      env.DB,
                      wsSettings?.workspace_id || "",
                      callId,
                      {
                        phoneNumber: customer.number,
                        duration: Math.floor(call.duration || 0),
                        summary: analysis?.summary || message.summary || "",
                        callType: call.type === "outboundPhoneCall" ? "outbound" : "inbound",
                        callStartTime: call.startedAt || (/* @__PURE__ */ new Date()).toISOString(),
                        appointmentData
                      },
                      env
                    );
                  } else {
                    console.log("[Dynamics 365] Skipping sync - missing required data:", {
                      hasTokens: !!hasDynamicsTokens,
                      hasPhone: !!customer.number,
                      hasSummary
                    });
                  }
                } catch (dynamicsError) {
                  console.error("[Dynamics 365] Sync error:", dynamicsError);
                }
              } catch (error) {
                console.error("Background processing error:", error);
              }
            })()
          );
          return jsonResponse2({
            received: true,
            call_id: callId
          });
        } catch (error) {
          await env.DB.prepare(
            "INSERT INTO webhook_logs (id, webhook_id, status, http_status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(
            generateId(),
            webhookId,
            "error",
            500,
            error.message || "Database error",
            timestamp
          ).run();
          return jsonResponse2({ error: "Failed to store call data" }, 500);
        }
      }
      return jsonResponse2({ error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse2({ error: error.message || "Internal server error" }, 500);
    }
  },
  /**
   * Scheduled handler for cleanup jobs
   * Runs every 6 hours to clean up stale active calls
   */
  async scheduled(event, env, ctx) {
    console.log("[Scheduled] Running cleanup job at:", new Date(event.scheduledTime).toISOString());
    try {
      const twentyFourHoursAgo = Math.floor(Date.now() / 1e3) - 24 * 60 * 60;
      const result = await env.DB.prepare(
        `DELETE FROM active_calls WHERE updated_at < ?`
      ).bind(twentyFourHoursAgo).run();
      console.log("[Scheduled] Cleanup complete:", {
        deletedCalls: result.meta.changes,
        threshold: new Date(twentyFourHoursAgo * 1e3).toISOString()
      });
    } catch (error) {
      console.error("[Scheduled] Cleanup job failed:", error);
    }
  }
};

// ../../../.nvm/versions/node/v22.12.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.nvm/versions/node/v22.12.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0Xm69E/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = workers_default;

// ../../../.nvm/versions/node/v22.12.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0Xm69E/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
