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
      const now2 = Math.floor(Date.now() / 1e3);
      if (cached.timestamp + cached.ttl < now2) {
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

// workers/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function now() {
  return Math.floor(Date.now() / 1e3);
}
__name(now, "now");
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
          now()
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
          now()
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
        "SELECT private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
      ).bind(ownedWorkspace.id).first();
      return wsSettings2 || null;
    }
    return null;
  }
  const workspaceId = userSettings.selected_workspace_id;
  let wsSettings = await env.DB.prepare(
    "SELECT private_key, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
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
        now()
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
          return jsonResponse({ error: "Email and password required" }, 400);
        }
        const existing = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ?"
        ).bind(email).first();
        if (existing) {
          return jsonResponse({ error: "Email already registered" }, 409);
        }
        const userId = generateId();
        const passwordHash = await hashPassword(password);
        const timestamp = now();
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
        return jsonResponse({
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
          return jsonResponse({ error: "Email and password required" }, 400);
        }
        const user = await env.DB.prepare(
          "SELECT id, email, password_hash, name FROM users WHERE email = ?"
        ).bind(email).first();
        if (!user) {
          return jsonResponse({ error: "Invalid credentials" }, 401);
        }
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          return jsonResponse({ error: "Invalid credentials" }, 401);
        }
        await env.DB.prepare(
          "UPDATE users SET last_login_at = ? WHERE id = ?"
        ).bind(now(), user.id).run();
        const secret = env.JWT_SECRET || "default-secret-change-me";
        const token = await generateToken(user.id, secret);
        const sessionId = generateId();
        const tokenHash = await hashPassword(token);
        const timestamp = now();
        const expiresAt = timestamp + 7 * 24 * 60 * 60;
        await env.DB.prepare(
          "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
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
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        await env.DB.prepare(
          "DELETE FROM sessions WHERE user_id = ?"
        ).bind(userId).run();
        return jsonResponse({ message: "Logged out successfully" });
      }
      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const user = await env.DB.prepare(
          "SELECT id, email, name, created_at FROM users WHERE id = ?"
        ).bind(userId).first();
        if (!user) {
          return jsonResponse({ error: "User not found" }, 404);
        }
        return jsonResponse({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        });
      }
      if (url.pathname === "/api/settings" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({
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
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status, role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const isOwnerOrAdmin = isOwner || membership && membership.role === "admin";
        const wsSettings = await env.DB.prepare(
          "SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, salesforce_access_token, salesforce_refresh_token, salesforce_instance_url, salesforce_user_id, salesforce_email, salesforce_connected_at FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        let finalSettings = wsSettings;
        if (!wsSettings || !wsSettings.private_key) {
          const ownerSettings = await env.DB.prepare(
            "SELECT private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number FROM user_settings WHERE user_id = ?"
          ).bind(workspace.owner_user_id).first();
          if (ownerSettings && ownerSettings.private_key) {
            finalSettings = ownerSettings;
            if (isOwnerOrAdmin) {
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
        return jsonResponse({
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
          salesforceAccessToken: finalSettings?.salesforce_access_token || null,
          salesforceRefreshToken: finalSettings?.salesforce_refresh_token || null,
          salesforceInstanceUrl: finalSettings?.salesforce_instance_url || null,
          salesforceUserId: finalSettings?.salesforce_user_id || null,
          salesforceEmail: finalSettings?.salesforce_email || null,
          salesforceConnectedAt: finalSettings?.salesforce_connected_at || null,
          isWorkspaceOwner: isOwnerOrAdmin
        });
      }
      if (url.pathname === "/api/settings" && request.method === "PUT") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
          transferPhoneNumber,
          salesforceAccessToken,
          salesforceRefreshToken,
          salesforceInstanceUrl,
          salesforceUserId,
          salesforceEmail,
          salesforceConnectedAt
        } = await request.json();
        if (!selectedWorkspaceId) {
          return jsonResponse({ error: "Workspace selection is required" }, 400);
        }
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(selectedWorkspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        if (workspace.owner_user_id !== userId) {
          return jsonResponse({ error: "Only workspace owner can update API credentials" }, 403);
        }
        const timestamp = now();
        const existing = await env.DB.prepare(
          "SELECT id FROM workspace_settings WHERE workspace_id = ?"
        ).bind(selectedWorkspaceId).first();
        if (existing) {
          await env.DB.prepare(
            "UPDATE workspace_settings SET private_key = ?, public_key = ?, selected_assistant_id = ?, selected_phone_id = ?, selected_org_id = ?, openai_api_key = ?, twilio_account_sid = ?, twilio_auth_token = ?, transfer_phone_number = ?, salesforce_access_token = ?, salesforce_refresh_token = ?, salesforce_instance_url = ?, salesforce_user_id = ?, salesforce_email = ?, salesforce_connected_at = ?, updated_at = ? WHERE workspace_id = ?"
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
            salesforceAccessToken || null,
            salesforceRefreshToken || null,
            salesforceInstanceUrl || null,
            salesforceUserId || null,
            salesforceEmail || null,
            salesforceConnectedAt || null,
            timestamp,
            selectedWorkspaceId
          ).run();
        } else {
          const settingsId = generateId();
          await env.DB.prepare(
            "INSERT INTO workspace_settings (id, workspace_id, private_key, public_key, selected_assistant_id, selected_phone_id, selected_org_id, openai_api_key, twilio_account_sid, twilio_auth_token, transfer_phone_number, salesforce_access_token, salesforce_refresh_token, salesforce_instance_url, salesforce_user_id, salesforce_email, salesforce_connected_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
            salesforceAccessToken || null,
            salesforceRefreshToken || null,
            salesforceInstanceUrl || null,
            salesforceUserId || null,
            salesforceEmail || null,
            salesforceConnectedAt || null,
            timestamp,
            timestamp
          ).run();
        }
        await env.DB.prepare(
          "UPDATE user_settings SET selected_workspace_id = ?, updated_at = ? WHERE user_id = ?"
        ).bind(selectedWorkspaceId, timestamp, userId).run();
        return jsonResponse({ message: "Settings updated successfully" });
      }
      if (url.pathname === "/api/workspaces" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        return jsonResponse({ workspaces: results || [] });
      }
      if (url.pathname === "/api/workspaces" && request.method === "POST") {
        return jsonResponse({ error: "Workspace creation is not allowed. Each user automatically gets one workspace on registration." }, 403);
      }
      if (url.pathname.startsWith("/api/workspaces/") && url.pathname.endsWith("/invite") && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const { email, role } = await request.json();
        if (!email) {
          return jsonResponse({ error: "Email is required" }, 400);
        }
        const ws = await env.DB.prepare("SELECT owner_user_id FROM workspaces WHERE id = ?").bind(workspaceId).first();
        if (!ws) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        if (ws.owner_user_id !== userId) {
          const membership = await env.DB.prepare(
            'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
          ).bind(workspaceId, userId).first();
          if (!membership || membership.role !== "admin" && membership.role !== "owner") {
            return jsonResponse({ error: "Forbidden" }, 403);
          }
        }
        const timestamp = now();
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
          return jsonResponse({ success: true, message: "User added to workspace" });
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
          return jsonResponse({
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
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id, name FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          "SELECT status, role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
        ).bind(workspaceId, userId).first();
        if (!isOwner && (!membership || membership.status !== "active")) {
          return jsonResponse({ error: "Access denied" }, 403);
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
        return jsonResponse({
          workspace: { id: workspaceId, name: workspace.name },
          members: membersList
        });
      }
      if (url.pathname.includes("/api/workspaces/") && url.pathname.includes("/members/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const memberId = parts[5];
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && (!membership || membership.role !== "admin")) {
          return jsonResponse({ error: "Only owners and admins can remove members" }, 403);
        }
        if (memberId === workspace.owner_user_id) {
          return jsonResponse({ error: "Cannot remove workspace owner" }, 400);
        }
        const member = await env.DB.prepare(
          "SELECT user_id FROM workspace_members WHERE id = ? AND workspace_id = ?"
        ).bind(memberId, workspaceId).first();
        if (!member) {
          return jsonResponse({ error: "Member not found" }, 404);
        }
        await env.DB.prepare(
          "DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?"
        ).bind(memberId, workspaceId).run();
        return jsonResponse({ success: true, message: "Member removed successfully" });
      }
      if (url.pathname.includes("/api/workspaces/") && url.pathname.includes("/members/") && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const parts = url.pathname.split("/");
        const workspaceId = parts[3];
        const memberId = parts[5];
        const { role } = await request.json();
        if (!role || !["member", "admin"].includes(role)) {
          return jsonResponse({ error: 'Invalid role. Must be "member" or "admin"' }, 400);
        }
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        if (workspace.owner_user_id !== userId) {
          return jsonResponse({ error: "Only workspace owner can change roles" }, 403);
        }
        const member = await env.DB.prepare(
          "SELECT user_id FROM workspace_members WHERE id = ? AND workspace_id = ?"
        ).bind(memberId, workspaceId).first();
        if (!member) {
          return jsonResponse({ error: "Member not found" }, 404);
        }
        const timestamp = now();
        await env.DB.prepare(
          "UPDATE workspace_members SET role = ?, updated_at = ? WHERE id = ? AND workspace_id = ?"
        ).bind(role, timestamp, memberId, workspaceId).run();
        return jsonResponse({ success: true, message: "Member role updated successfully" });
      }
      if (url.pathname === "/api/twilio/phone-numbers" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT twilio_account_sid, twilio_auth_token FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.twilio_account_sid || !settings.twilio_auth_token) {
          return jsonResponse({ error: "Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration." }, 400);
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
            return jsonResponse({ error: `Twilio API error: ${twilioResponse.status} - ${errorText}` }, 400);
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
          return jsonResponse(voiceNumbers);
        } catch (error) {
          console.error("Error fetching Twilio numbers:", error);
          return jsonResponse({ error: `Failed to fetch Twilio numbers: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/vapi/import-twilio" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { sid, phoneNumber, name } = await request.json();
        if (!sid && !phoneNumber) {
          return jsonResponse({ error: "Either sid or phoneNumber is required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key, twilio_account_sid, twilio_auth_token FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse({ error: "CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration." }, 400);
        }
        if (!settings.twilio_account_sid || !settings.twilio_auth_token) {
          return jsonResponse({ error: "Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration." }, 400);
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
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const vapiData = await vapiResponse.json();
          return jsonResponse({
            id: vapiData.id,
            number: vapiData.number || vapiData.phoneNumber,
            name: vapiData.name || name
          });
        } catch (error) {
          console.error("Error importing Twilio number:", error);
          return jsonResponse({ error: `Failed to import Twilio number: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/vapi/phone-number" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { areaCode, name } = await request.json();
        if (!areaCode || !/^\d{3}$/.test(areaCode)) {
          return jsonResponse({ error: "Valid 3-digit area code is required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key, transfer_phone_number FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse({ error: "CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration." }, 400);
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
            return jsonResponse({ error: errorText }, 400);
          }
          const vapiData = await vapiResponse.json();
          return jsonResponse({
            id: vapiData.id,
            number: vapiData.number || vapiData.phoneNumber,
            name: vapiData.name || name
          });
        } catch (error) {
          console.error("Error creating CHAU Voice Engine phone number:", error);
          return jsonResponse({ error: `Failed to create phone number: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/vapi/phone-number/") && url.pathname.endsWith("/assistant") && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const pathParts = url.pathname.split("/").filter(Boolean);
        const phoneNumberId = pathParts.length >= 4 ? pathParts[3] : null;
        const { assistantId } = await request.json();
        if (!phoneNumberId) {
          return jsonResponse({ error: "Phone number ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
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
          return jsonResponse({ error: "CHAU Voice Engine API key not configured. Please add your CHAU Voice Engine Private API Key in API Configuration." }, 400);
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
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const vapiData = await vapiResponse.json();
          return jsonResponse({
            success: true,
            phoneNumber: {
              id: vapiData.id,
              number: vapiData.number || vapiData.phoneNumber,
              assistantId: vapiData.assistantId || null
            }
          });
        } catch (error) {
          console.error("Error updating phone number assistant:", error);
          return jsonResponse({ error: `Failed to update phone number: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/assistants" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const settings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!settings) {
          return jsonResponse({ error: "User settings not found" }, 404);
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
                return jsonResponse({ assistants: [] });
              }
            } else {
              return jsonResponse({ error: "Access denied to workspace" }, 403);
            }
          } else {
            return jsonResponse({ assistants: [] });
          }
        } else {
          return jsonResponse({ assistants: [] });
        }
        if (!privateKey) {
          return jsonResponse({ assistants: [] });
        }
        try {
          const cacheAgeLimit = now() - 5 * 60;
          const cached = await env.DB.prepare(
            "SELECT id, vapi_data, cached_at, updated_at FROM assistants_cache WHERE user_id = ? AND cached_at > ? ORDER BY cached_at DESC"
          ).bind(effectiveUserId, cacheAgeLimit).all();
          if (cached && cached.results && cached.results.length > 0) {
            const assistants2 = cached.results.map((row) => JSON.parse(row.vapi_data));
            return jsonResponse({ assistants: assistants2, cached: true });
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
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const assistants = await vapiResponse.json();
          const timestamp = now();
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
          return jsonResponse({ assistants, cached: false });
        } catch (error) {
          console.error("Error fetching assistants:", error);
          return jsonResponse({ error: `Failed to fetch assistants: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/assistants/") && url.pathname !== "/api/assistants" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const assistantId = url.pathname.split("/").pop();
        if (!assistantId) {
          return jsonResponse({ error: "Assistant ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse({ error: "CHAU Voice Engine API key not configured" }, 400);
        }
        const effectiveUserId = workspace.owner_user_id;
        try {
          const cached = await env.DB.prepare(
            "SELECT vapi_data, cached_at FROM assistants_cache WHERE id = ? AND user_id = ?"
          ).bind(assistantId, effectiveUserId).first();
          if (cached) {
            const cacheAge = now() - cached.cached_at;
            if (cacheAge < 5 * 60) {
              return jsonResponse({ assistant: JSON.parse(cached.vapi_data), cached: true });
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
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const assistant = await vapiResponse.json();
          const timestamp = now();
          await env.DB.prepare(
            "INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            assistant.id,
            effectiveUserId,
            JSON.stringify(assistant),
            timestamp,
            new Date(assistant.updatedAt || assistant.createdAt).getTime() / 1e3 || timestamp
          ).run();
          return jsonResponse({ assistant, cached: false });
        } catch (error) {
          console.error("Error fetching assistant:", error);
          return jsonResponse({ error: `Failed to fetch assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/assistants/") && url.pathname !== "/api/assistants" && request.method === "PATCH") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const assistantId = url.pathname.split("/").pop();
        const updates = await request.json();
        if (!assistantId) {
          return jsonResponse({ error: "Assistant ID required" }, 400);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse({ error: "CHAU Voice Engine API key not configured" }, 400);
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
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          const updatedAssistant = await vapiResponse.json();
          const timestamp = now();
          await env.DB.prepare(
            "INSERT OR REPLACE INTO assistants_cache (id, user_id, vapi_data, cached_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            updatedAssistant.id,
            userId,
            JSON.stringify(updatedAssistant),
            timestamp,
            new Date(updatedAssistant.updatedAt || updatedAssistant.createdAt).getTime() / 1e3 || timestamp
          ).run();
          return jsonResponse({ assistant: updatedAssistant });
        } catch (error) {
          console.error("Error updating assistant:", error);
          return jsonResponse({ error: `Failed to update assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/assistants" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const assistantData = await request.json();
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected. Please select a workspace first." }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse({ error: "CHAU Voice Engine API key not configured. Please configure workspace API keys in Settings." }, 400);
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
            return jsonResponse({ error: errorText }, 400);
          }
          const newAssistant = await vapiResponse.json();
          const timestamp = now();
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
          return jsonResponse({ assistant: newAssistant });
        } catch (error) {
          console.error("Error creating assistant:", error);
          return jsonResponse({ error: `Failed to create assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname.startsWith("/api/assistants/") && url.pathname !== "/api/assistants" && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const assistantId = url.pathname.split("/").pop();
        if (!assistantId) {
          return jsonResponse({ error: "Assistant ID required" }, 400);
        }
        const userSettings = await env.DB.prepare(
          "SELECT selected_workspace_id FROM user_settings WHERE user_id = ?"
        ).bind(userId).first();
        if (!userSettings || !userSettings.selected_workspace_id) {
          return jsonResponse({ error: "No workspace selected" }, 400);
        }
        const workspaceId = userSettings.selected_workspace_id;
        const workspace = await env.DB.prepare(
          "SELECT owner_user_id FROM workspaces WHERE id = ?"
        ).bind(workspaceId).first();
        if (!workspace) {
          return jsonResponse({ error: "Workspace not found" }, 404);
        }
        const isOwner = workspace.owner_user_id === userId;
        const membership = await env.DB.prepare(
          'SELECT status FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = "active"'
        ).bind(workspaceId, userId).first();
        if (!isOwner && !membership) {
          return jsonResponse({ error: "Access denied to workspace" }, 403);
        }
        const settings = await env.DB.prepare(
          "SELECT private_key FROM workspace_settings WHERE workspace_id = ?"
        ).bind(workspaceId).first();
        if (!settings || !settings.private_key) {
          return jsonResponse({ error: "CHAU Voice Engine API key not configured" }, 400);
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
            return jsonResponse({ error: `CHAU Voice Engine API error: ${vapiResponse.status} - ${errorText}` }, 400);
          }
          await env.DB.prepare(
            "DELETE FROM assistants_cache WHERE id = ? AND user_id = ?"
          ).bind(assistantId, effectiveUserId).run();
          return jsonResponse({ success: true });
        } catch (error) {
          console.error("Error deleting assistant:", error);
          return jsonResponse({ error: `Failed to delete assistant: ${error.message}` }, 500);
        }
      }
      if (url.pathname === "/api/addons" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { results } = await env.DB.prepare(
          "SELECT addon_type, is_enabled, settings FROM user_addons WHERE user_id = ?"
        ).bind(userId).all();
        return jsonResponse({ addons: results || [] });
      }
      if (url.pathname === "/api/addons/toggle" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { addonType, enabled } = await request.json();
        if (!addonType) {
          return jsonResponse({ error: "addon_type required" }, 400);
        }
        const timestamp = now();
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
        return jsonResponse({ message: "Addon updated successfully", enabled });
      }
      if (url.pathname.startsWith("/api/addon-results/") && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const callId = url.pathname.split("/").pop();
        const { results } = await env.DB.prepare(
          "SELECT addon_type, status, result_data, error_message, execution_time_ms, created_at FROM addon_results WHERE call_id = ? AND user_id = ?"
        ).bind(callId, userId).all();
        return jsonResponse({ results: results || [] });
      }
      if (url.pathname === "/api/scheduling-triggers" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { results } = await env.DB.prepare(
          "SELECT * FROM scheduling_triggers WHERE user_id = ? ORDER BY created_at DESC"
        ).bind(userId).all();
        return jsonResponse(results || []);
      }
      if (url.pathname === "/api/scheduling-triggers" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { name, destination_url, send_enhanced_data } = await request.json();
        if (!name || !destination_url) {
          return jsonResponse({ error: "Name and destination URL are required" }, 400);
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
          1,
          // active by default
          timestamp,
          timestamp
        ).run();
        return jsonResponse({ id: triggerId, message: "Scheduling trigger created successfully" });
      }
      if (url.pathname.startsWith("/api/scheduling-triggers/") && request.method === "PUT") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
          now(),
          triggerId,
          userId
        ).run();
        return jsonResponse({ message: "Scheduling trigger updated successfully" });
      }
      if (url.pathname.startsWith("/api/scheduling-triggers/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const triggerId = url.pathname.split("/").pop();
        await env.DB.prepare(
          "DELETE FROM scheduling_triggers WHERE id = ? AND user_id = ?"
        ).bind(triggerId, userId).run();
        return jsonResponse({ message: "Scheduling trigger deleted successfully" });
      }
      if (url.pathname === "/api/scheduling-trigger-logs" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        return jsonResponse(results || []);
      }
      if (url.pathname.startsWith("/api/knowledge-files/") && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const agentId = url.pathname.split("/").pop();
        const { results } = await env.DB.prepare(
          "SELECT * FROM agent_knowledge_files WHERE agent_id = ? ORDER BY created_at DESC"
        ).bind(agentId).all();
        return jsonResponse(results || []);
      }
      if (url.pathname === "/api/knowledge-files" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { agent_id, vapi_file_id, file_name, file_size, status } = await request.json();
        if (!agent_id || !vapi_file_id || !file_name) {
          return jsonResponse({ error: "Missing required fields" }, 400);
        }
        const id = generateId();
        const timestamp = now();
        await env.DB.prepare(
          "INSERT INTO agent_knowledge_files (id, agent_id, vapi_file_id, file_name, file_size, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, agent_id, vapi_file_id, file_name, file_size || 0, status || "ready", timestamp, timestamp).run();
        return jsonResponse({
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
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const id = url.pathname.split("/").pop();
        await env.DB.prepare(
          "DELETE FROM agent_knowledge_files WHERE id = ?"
        ).bind(id).run();
        return jsonResponse({ message: "File deleted successfully" });
      }
      if (url.pathname === "/api/webhooks" && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { name } = await request.json();
        if (!name) {
          return jsonResponse({ error: "Webhook name required" }, 400);
        }
        const webhookId = "wh_" + generateId();
        const webhookUrl = `https://api.voice-config.channelautomation.com/webhook/${webhookId}`;
        const timestamp = now();
        await env.DB.prepare(
          "INSERT INTO webhooks (id, user_id, webhook_url, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(webhookId, userId, webhookUrl, name, 1, timestamp, timestamp).run();
        return jsonResponse({
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
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        return jsonResponse(results || []);
      }
      if (url.pathname.startsWith("/api/webhooks/") && request.method === "DELETE") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const webhookId = url.pathname.split("/").pop();
        const webhook = await env.DB.prepare(
          "SELECT user_id FROM webhooks WHERE id = ?"
        ).bind(webhookId).first();
        if (!webhook) {
          return jsonResponse({ error: "Webhook not found" }, 404);
        }
        if (webhook.user_id !== userId) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }
        await env.DB.prepare(
          "DELETE FROM webhooks WHERE id = ?"
        ).bind(webhookId).run();
        return jsonResponse({ message: "Webhook deleted successfully" });
      }
      if (url.pathname === "/api/webhook-calls" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
            return jsonResponse(cached);
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
        return jsonResponse(parsedResults);
      }
      if (url.pathname === "/api/active-calls" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        return jsonResponse(results);
      }
      if (url.pathname === "/api/concurrent-calls" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        return jsonResponse({
          current: currentConcurrent,
          peak: peakConcurrent
        });
      }
      if (url.pathname === "/api/concurrent-calls/timeseries" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const granularity = url.searchParams.get("granularity") || "minute";
        const limit = parseInt(url.searchParams.get("limit") || "1000");
        const { results } = await env.DB.prepare(
          `SELECT raw_payload, created_at
          FROM webhook_calls
          WHERE user_id = ?
          AND raw_payload IS NOT NULL
          ORDER BY created_at DESC
          LIMIT ?`
        ).bind(effectiveUserId, limit).all();
        if (!results || results.length === 0) {
          return jsonResponse({ data: [], labels: [] });
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
          return jsonResponse({ data: [], labels: [] });
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
        return jsonResponse({ data, labels });
      }
      if (url.pathname === "/api/call-ended-reasons" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        AND created_at IS NOT NULL`;
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
          return jsonResponse({ dates: [], reasons: {}, colors: {} });
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
        return jsonResponse({
          dates,
          reasons: reasonData,
          colors: reasonColors
        });
      }
      if (url.pathname === "/api/dashboard-metrics" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const { effectiveUserId } = await getEffectiveUserId(env, userId);
        const granularity = url.searchParams.get("granularity") || "minute";
        const limit = parseInt(url.searchParams.get("limit") || "1000");
        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");
        const [
          webhookCallsResult,
          keywordsResult,
          concurrentCallsResult,
          callEndedReasonsResult
        ] = await Promise.all([
          // 1. Fetch webhook calls with enhanced data
          env.DB.prepare(
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
            ORDER BY CASE
              WHEN wc.created_at > 1000000000000 THEN wc.created_at / 1000
              ELSE wc.created_at
            END DESC
            LIMIT ?`
          ).bind(effectiveUserId, limit).all(),
          // 2. Fetch top keywords
          env.DB.prepare(
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
          ).bind(effectiveUserId).all(),
          // 3. Fetch active calls for concurrent count
          env.DB.prepare(
            `SELECT COUNT(*) as count FROM active_calls WHERE user_id = ?`
          ).bind(effectiveUserId).first(),
          // 4. Fetch call ended reasons
          (async () => {
            let queryStr = `SELECT
              ended_reason,
              DATE(datetime(created_at, 'unixepoch')) as call_date,
              COUNT(*) as count
            FROM webhook_calls
            WHERE user_id = ?
            AND ended_reason IS NOT NULL
            AND created_at IS NOT NULL`;
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
            return env.DB.prepare(queryStr).bind(...params).all();
          })()
        ]);
        const webhookCalls = (webhookCallsResult.results || []).map((row) => ({
          ...row,
          structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
          raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
          enhanced_data: row.enhanced_data ? JSON.parse(row.enhanced_data) : null
        }));
        const totalCalls = webhookCalls.length;
        const answeredCalls = webhookCalls.filter((c) => c.recording_url).length;
        const unansweredCalls = totalCalls - answeredCalls;
        const answerRate = totalCalls > 0 ? answeredCalls / totalCalls * 100 : 0;
        const qualifiedLeadsCount = webhookCalls.filter((c) => c.outcome === "Successful").length;
        const qualificationRate = answeredCalls > 0 ? qualifiedLeadsCount / answeredCalls * 100 : 0;
        const appointmentsDetected = webhookCalls.filter((c) => c.intent === "Scheduling").length;
        const appointmentDetectionRate = answeredCalls > 0 ? appointmentsDetected / answeredCalls * 100 : 0;
        const callsWithDuration = webhookCalls.filter((c) => c.recording_url && c.duration_seconds);
        const avgHandlingTime = callsWithDuration.length > 0 ? callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callsWithDuration.length : 0;
        const totalCallMinutes = Math.floor(
          webhookCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60
        );
        const callsWithSummary = webhookCalls.filter((c) => c.summary && c.summary.length > 0);
        const avgSummaryLength = callsWithSummary.length > 0 ? callsWithSummary.reduce((sum, c) => sum + c.summary.length, 0) / callsWithSummary.length : 0;
        const positiveCalls = webhookCalls.filter((c) => c.sentiment === "Positive").length;
        const negativeCalls = webhookCalls.filter((c) => c.sentiment === "Negative").length;
        const neutralCalls = totalCalls - positiveCalls - negativeCalls;
        const sentimentData = [
          { label: "Positive", value: positiveCalls, color: "#10b981" },
          { label: "Neutral", value: neutralCalls, color: "#3b82f6" },
          { label: "Negative", value: negativeCalls, color: "#ef4444" }
        ];
        const currentConcurrent = concurrentCallsResult?.count || 0;
        let peakConcurrent = 0;
        const callRanges = [];
        for (const call of webhookCalls) {
          try {
            const payload = call.raw_payload;
            const startedAt = payload?.message?.call?.startedAt || payload?.message?.startedAt;
            const endedAt = payload?.message?.call?.endedAt || payload?.message?.endedAt;
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
        let concurrentTimeSeries = { data: [], labels: [] };
        if (callRanges.length > 0) {
          const allTimes = callRanges.flatMap((r) => [r.start, r.end]);
          const minTime = Math.min(...allTimes);
          const maxTime = Math.max(...allTimes);
          let bucketSize;
          let dateFormatter;
          if (granularity === "day") {
            bucketSize = 24 * 60 * 60 * 1e3;
            dateFormatter = /* @__PURE__ */ __name((date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), "dateFormatter");
          } else if (granularity === "hour") {
            bucketSize = 60 * 60 * 1e3;
            dateFormatter = /* @__PURE__ */ __name((date) => date.toLocaleTimeString("en-US", { month: "short", day: "numeric", hour: "numeric" }), "dateFormatter");
          } else {
            bucketSize = 60 * 1e3;
            dateFormatter = /* @__PURE__ */ __name((date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), "dateFormatter");
          }
          const buckets = /* @__PURE__ */ new Map();
          const bucketStart = Math.floor(minTime / bucketSize) * bucketSize;
          const bucketEnd = Math.ceil(maxTime / bucketSize) * bucketSize;
          for (let bucket = bucketStart; bucket <= bucketEnd; bucket += bucketSize) {
            const bucketMidpoint = bucket + bucketSize / 2;
            const concurrentAtBucket = callRanges.filter(
              (range) => range.start <= bucketMidpoint && range.end > bucketMidpoint
            ).length;
            buckets.set(bucket, concurrentAtBucket);
          }
          const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
          concurrentTimeSeries = {
            data: sortedBuckets.map(([_, count]) => count),
            labels: sortedBuckets.map(([time, _]) => dateFormatter(new Date(time)))
          };
        }
        const callEndedResults = callEndedReasonsResult.results || [];
        let callEndedReasons = { dates: [], reasons: {}, colors: {} };
        if (callEndedResults.length > 0) {
          const dateSet = /* @__PURE__ */ new Set();
          const reasonsSet = /* @__PURE__ */ new Set();
          const dataMap = /* @__PURE__ */ new Map();
          for (const row of callEndedResults) {
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
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#06b6d4",
            "#ec4899",
            "#6366f1"
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
          callEndedReasons = { dates, reasons: reasonData, colors: reasonColors };
        }
        return jsonResponse({
          metrics: {
            totalCalls,
            answeredCalls,
            unansweredCalls,
            answerRate,
            spanishCallsPercent: 0,
            englishCallsPercent: 100,
            avgSummaryLength,
            qualifiedLeadsCount,
            qualificationRate,
            appointmentDetectionRate,
            crmSuccessRate: totalCallMinutes,
            avgSentiment: 0,
            avgHandlingTime,
            automationRate: answerRate
          },
          calls: webhookCalls,
          keywords: keywordsResult.results || [],
          sentimentData,
          concurrent: {
            current: currentConcurrent,
            peak: peakConcurrent
          },
          concurrentTimeSeries,
          callEndedReasons
        });
      }
      if (url.pathname === "/api/keywords" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
        return jsonResponse(results);
      }
      if (url.pathname.startsWith("/api/calls/") && url.pathname.endsWith("/end") && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const callId = url.pathname.split("/")[3];
        console.log("[Call Control] End call request received:", {
          callId,
          userId
        });
        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          console.log("[Call Control] VAPI credentials not configured for user:", userId);
          return jsonResponse({ error: "VAPI credentials not configured" }, 400);
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
            return jsonResponse({ error: "Failed to get call details" }, getCallResponse.status);
          }
          const callDetails = await getCallResponse.json();
          const controlUrl = callDetails.monitor?.controlUrl;
          console.log("[Call Control] Call details retrieved:", {
            callId,
            hasControlUrl: !!controlUrl
          });
          if (!controlUrl) {
            console.error("[Call Control] No controlUrl found in call details");
            return jsonResponse({ error: "Call control URL not available" }, 400);
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
            return jsonResponse({ error: "Failed to end call" }, endCallResponse.status);
          }
          console.log("[Call Control] Call ended successfully:", callId);
          return jsonResponse({ success: true, message: "Call ended successfully" });
        } catch (error) {
          console.error("[Call Control] Error ending call:", {
            callId,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse({ error: "Failed to end call" }, 500);
        }
      }
      if (url.pathname.startsWith("/api/calls/") && url.pathname.endsWith("/transfer") && request.method === "POST") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
          return jsonResponse({ error: "Transfer phone number required" }, 400);
        }
        const settings = await getWorkspaceSettingsForUser(env, userId);
        if (!settings?.private_key) {
          console.log("[Call Control] VAPI credentials not configured for user:", userId);
          return jsonResponse({ error: "VAPI credentials not configured" }, 400);
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
            return jsonResponse({ error: "Failed to get call details" }, getCallResponse.status);
          }
          const callDetails = await getCallResponse.json();
          const controlUrl = callDetails.monitor?.controlUrl;
          console.log("[Call Control] Call details retrieved:", {
            callId,
            hasControlUrl: !!controlUrl
          });
          if (!controlUrl) {
            console.error("[Call Control] No controlUrl found in call details");
            return jsonResponse({ error: "Call control URL not available" }, 400);
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
            return jsonResponse({ error: "Failed to transfer call" }, transferResponse.status);
          }
          console.log("[Call Control] Call transferred successfully:", {
            callId,
            transferNumber
          });
          return jsonResponse({ success: true, message: "Call transferred successfully" });
        } catch (error) {
          console.error("[Call Control] Error transferring call:", {
            callId,
            transferNumber,
            error: error instanceof Error ? error.message : String(error)
          });
          return jsonResponse({ error: "Failed to transfer call" }, 500);
        }
      }
      if (url.pathname === "/api/intent-analysis" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
            return jsonResponse(cached);
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
          WHERE wc.user_id = ? AND wc.analysis_completed = 1
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
          return {
            ...row,
            structured_data: row.structured_data ? JSON.parse(row.structured_data) : null,
            raw_payload: row.raw_payload ? JSON.parse(row.raw_payload) : null,
            enhanced_data: enhancedData
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
        return jsonResponse(summaryData);
      }
      if (url.pathname === "/api/generate-demo-data" && request.method === "POST") {
        const currentUserId = await getUserFromToken(request, env);
        if (!currentUserId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const vicUser = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ?"
        ).bind("vic@channelautomation.com").first();
        if (!vicUser) {
          return jsonResponse({ error: "Demo account not found" }, 404);
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
        return jsonResponse({
          success: true,
          message: `Created ${demoCalls.length} demo calls for vic@channelautomation.com`,
          callsCreated: demoCalls.length
        });
      }
      if (url.pathname === "/api/cache/stats" && request.method === "GET") {
        const userId = await getUserFromToken(request, env);
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401);
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
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
          return jsonResponse({ error: "Admin access required" }, 403);
        }
        const totalUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
        const totalCalls = await env.DB.prepare("SELECT COUNT(*) as count FROM webhook_calls").first();
        const totalWebhooks = await env.DB.prepare("SELECT COUNT(*) as count FROM webhooks").first();
        const activeCalls = await env.DB.prepare("SELECT COUNT(*) as count FROM active_calls").first();
        const recentUsers = await env.DB.prepare(
          "SELECT id, email, name, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 10"
        ).all();
        return jsonResponse({
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
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const isAdmin = await checkAdminAccess(userId);
        if (!isAdmin) {
          return jsonResponse({ error: "Admin access required" }, 403);
        }
        const users = await env.DB.prepare(
          "SELECT id, email, name, created_at, last_login_at FROM users ORDER BY created_at DESC"
        ).all();
        return jsonResponse({
          success: true,
          data: users.results || []
        });
      }
      if (url.pathname.startsWith("/webhook/") && request.method === "POST") {
        const webhookId = url.pathname.split("/").pop();
        const webhook = await env.DB.prepare(
          "SELECT id, user_id FROM webhooks WHERE id = ? AND is_active = 1"
        ).bind(webhookId).first();
        if (!webhook) {
          return jsonResponse({ error: "Webhook not found or inactive" }, 404);
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
            now()
          ).run();
          return jsonResponse({ error: "Invalid JSON payload" }, 400);
        }
        const message = payload.message || {};
        const messageType = message.type || "end-of-call-report";
        const call = message.call || {};
        const customer = call.customer || {};
        const phoneNumber = call.phoneNumber || {};
        const artifact = message.artifact || {};
        const analysis = message.analysis || {};
        const timestamp = now();
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
            return jsonResponse({ success: true, message: "Call status updated" });
          } else if (callStatus === "ended") {
            await env.DB.prepare(
              "DELETE FROM active_calls WHERE vapi_call_id = ? AND user_id = ?"
            ).bind(vapiCallId, webhook.user_id).run();
            const cache = new VoiceAICache(env.CACHE);
            await cache.invalidateUserCache(webhook.user_id);
            return jsonResponse({ success: true, message: "Call ended, removed from active calls" });
          }
          return jsonResponse({ success: true, message: "Status update received" });
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
                      now(),
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
                    now(),
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
              } catch (error) {
                console.error("Background processing error:", error);
              }
            })()
          );
          return jsonResponse({
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
          return jsonResponse({ error: "Failed to store call data" }, 500);
        }
      }
      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse({ error: error.message || "Internal server error" }, 500);
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

// .wrangler/tmp/bundle-B2uX3S/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-B2uX3S/middleware-loader.entry.ts
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
