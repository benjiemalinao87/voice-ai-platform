# Critical Data Privacy & Security Analysis
## Voice AI Performance & Configuration Dashboard

---

## EXECUTIVE SUMMARY

**SEVERITY: CRITICAL**

The application has a **fundamental data isolation vulnerability** where users can see ALL assistants/agents from the connected VAPI account, regardless of who created them or configured them. Combined with weak user-based data filtering in the database layer, this creates a **multi-tenant data leakage issue**.

---

## VULNERABILITY 1: NO USER-BASED FILTERING IN VAPI CALLS

### Location: `/src/lib/api.ts` (Lines 87-112)

```typescript
export const agentApi = {
  async getAll(): Promise<Agent[]> {
    // Try VAPI first if configured
    if (isVapiConfigured && vapiClient) {
      try {
        const assistants = await vapiClient.listAssistants();
        return assistants.map(convertVapiAssistantToAgent);
      } catch (error) {
        console.error('VAPI API error, falling back:', error);
      }
    }
    // ...
  }
}
```

### Problem:
- **No user context is passed** to VAPI API calls
- `vapiClient.listAssistants()` returns ALL assistants from the entire VAPI account
- No filtering by `user_id`, `workspace_id`, or `team_id`
- All logged-in users see the same list of agents

### Impact:
```
User A logs in → sees ALL agents in VAPI account
User B logs in → sees ALL agents in VAPI account (SAME SET)
User B can select and configure User A's agents
User B can view User A's call history
```

---

## VULNERABILITY 2: NO USER-BASED FILTERING IN CALL QUERIES

### Location: `/src/lib/api.ts` (Lines 248-297)

```typescript
export const callsApi = {
  async getAll(agentId?: string, dateFrom?: string, dateTo?: string): Promise<Call[]> {
    if (isVapiConfigured && vapiClient) {
      try {
        const params: any = { limit: 1000 };
        if (agentId) params.assistantId = agentId;
        if (dateFrom) params.createdAtGt = dateFrom;
        if (dateTo) params.createdAtLt = dateTo;

        const vapiCalls = await vapiClient.listCalls(params);
        return vapiCalls.map(convertVapiCallToCall);
      } catch (error) {
        console.error('VAPI API error, falling back:', error);
      }
    }
    // ...
  }
}
```

### Problem:
- **No user ownership verification** before returning call data
- When User B views calls for an agent, the system doesn't verify User B owns that agent
- `listCalls()` returns all calls from VAPI account matching only `assistantId` parameter
- Falls back to Supabase queries that also lack user filtering (see Vulnerability 3)

### Impact:
```
User A creates call data through agent
User B can view ALL of User A's call metrics, transcripts, and sentiment analysis
User B can see customer phone numbers and conversation summaries
```

---

## VULNERABILITY 3: NO USER OWNERSHIP IN SUPABASE SCHEMA

### Location: `/src/lib/api.ts` (Lines 99-108)

```typescript
// Fall back to Supabase
if (!isDemo && supabase) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

### Problem:
- **No `.eq('user_id', currentUserId)` filter** on agent queries
- Agents table likely has `user_id` column but it's NOT being filtered
- Same issue in `calls` table queries (Lines 265-283)
- In `call_keywords` queries (Lines 367-375)
- In `metrics_summary` queries (Lines 401-410)

### Evidence:
Auth context provides `user.id` but it's NEVER used in data queries:

```typescript
// From AuthContext.tsx - user object exists
interface User {
  id: string;      // ← THIS FIELD EXISTS BUT IS NEVER USED
  email: string;
  name: string | null;
}

// But in api.ts, queries never filter by user_id
const { data, error } = await supabase
  .from('agents')
  .select('*')
  // ❌ MISSING: .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Impact:
- ALL users can query ALL agents in any Supabase table
- Row-level security (RLS) might not be properly configured
- Even if RLS exists, the application isn't passing user context

---

## VULNERABILITY 4: SETTINGS STORED WITHOUT USER ISOLATION

### Location: `/src/components/Settings.tsx` (Lines 69-101, 234-246)

```typescript
const loadSettings = async () => {
  if (!token) return;
  
  setLoading(true);
  try {
    const response = await fetch(`${API_URL}/api/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`,  // ← Token provided but unclear if enforced server-side
      },
    });
    // ...
  }
}

const handleSave = async () => {
  // ...
  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      encryptedPrivateKey,
      encryptedPublicKey,
      selectedAssistantId: selectedAssistantId || null,
      selectedPhoneId: selectedPhoneId || null,
    }),
  });
}
```

### Problems:
1. **Backend endpoint `/api/settings` doesn't verify user ownership** (token validation exists but unclear)
2. **Same VAPI credentials shared across users** - when saved, all users of the dashboard might use the same API key
3. **No per-user credential storage** - there's only one `encryptedPrivateKey` per settings record
4. If multiple users try to configure different VAPI accounts, the last one overwrites

### Impact:
```
User A saves their VAPI API key to /api/settings
User B overwrites it with their VAPI API key
Now User A's API key is lost, User B's key controls everything
Users can't have separate VAPI accounts - only one account per dashboard instance
```

---

## VULNERABILITY 5: VAPI CLIENT IS SINGLETON (GLOBAL)

### Location: `/src/lib/vapi.ts` (Lines 176-184)

```typescript
export const vapiClient = createVapiClient();  // ← SINGLETON - shared across all users
export const isVapiConfigured = !!vapiClient;

// And it's used globally
export const agentApi = {
  async getAll(): Promise<Agent[]> {
    if (isVapiConfigured && vapiClient) {
      try {
        const assistants = await vapiClient.listAssistants();  // ← Uses shared instance
        // ...
      }
    }
  }
}
```

### Problem:
- **One VAPI client for entire application** - not per-user
- If User A configures VAPI API key, User B also gets access through the same client
- Multiple users can't use different VAPI accounts

### Impact:
```
User A (workspace owner) configures VAPI account
User B (new team member) logs in
User B immediately sees User A's assistants, agents, and calls
User B can modify User A's configurations
User B's metrics interfere with User A's data
```

---

## VULNERABILITY 6: MISSING USER CONTEXT IN DATA LOADING

### Location: `/src/App.tsx` (Lines 62-72)

```typescript
const loadAgents = async () => {
  try {
    const data = await agentApi.getAll();  // ← NO USER ID PASSED
    setAgents(data);
    if (data.length > 0 && !selectedAgentId) {
      setSelectedAgentId(data[0].id);
    }
  } catch (error) {
    console.error('Error loading agents:', error);
  }
};
```

### Problem:
- Auth context available but never used:
  ```typescript
  const { isAuthenticated, isLoading } = useAuth();  // ← Has user object
  // But doesn't pass it to loadAgents()
  ```
- `agentApi.getAll()` should accept `userId` parameter but doesn't
- No way for API to know which user is asking for agents

### Impact:
- Backend can't validate ownership - it doesn't know who's asking
- System has no way to enforce user boundaries

---

## VULNERABILITY 7: ADMIN API ALSO VULNERABLE

### Location: `/src/lib/adminApi.ts` (Lines 13-32)

```typescript
const getAuthToken = async (): Promise<string | null> => {
  try {
    // Check localStorage for Supabase session
    const keys = Object.keys(localStorage);
    const supabaseKey = keys.find(key => key.includes('supabase.auth.token'));

    if (supabaseKey) {
      const sessionData = localStorage.getItem(supabaseKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return session.access_token || session.currentSession?.access_token || null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};
```

### Problems:
1. **Accessing Supabase auth from localStorage** - fragile, should use proper auth context
2. **No D1 backend authentication** - AdminAPI uses Supabase token but backend is D1 (Cloudflare Workers)
3. **Admin access check is purely role-based** - no scoping to user's own data
4. Backend endpoint doesn't validate which admin/workspace is asking

---

## ATTACK SCENARIO

```
Scenario: Multi-tenant SaaS with 2 users

1. User A (alice@company.com) - Sales Manager
   - Configures VAPI account with credentials
   - Creates 3 sales agents
   - Agents handle 1000+ customer calls in 1 week
   - Calls contain customer names, phone numbers, conversation transcripts

2. User B (bob@company.com) - New Team Member (different company)
   - Logs in with their own account
   
3. VULNERABILITY EXPOSURE:
   ✗ Bob sees Alice's 3 agents in the agent selector dropdown
   ✗ Bob clicks on Alice's "Sales Agent #1"
   ✗ Bob views Alice's 1000+ customer calls
   ✗ Bob sees customer names: "John Smith", "Jane Doe", etc.
   ✗ Bob sees phone numbers: "+1-555-0123", "+1-555-0124"
   ✗ Bob sees transcripts: "Called about bulk order", "Interested in enterprise plan"
   ✗ Bob exports this customer data
   ✗ Bob reads Alice's agent configuration and system prompts
   ✗ Bob modifies Alice's agent settings
   ✗ Bob's modifications affect Alice's live production agents
   ✗ Customer calls now fail or behave unexpectedly

```

---

## ROOT CAUSE ANALYSIS

| Component | Issue | Severity |
|-----------|-------|----------|
| **VAPI Client** | Singleton, shared across users | CRITICAL |
| **Agent Query** | No user_id filter in api.ts | CRITICAL |
| **Call Query** | No user_id filter in api.ts | CRITICAL |
| **Supabase Schema** | No user_id filtering at query level | CRITICAL |
| **Backend Auth** | No per-request user validation | CRITICAL |
| **Settings Endpoint** | Doesn't isolate per-user | HIGH |
| **Data Types** | No user_id in data model | HIGH |

---

## MISSING SECURITY PATTERNS

### What SHOULD be happening:

```typescript
// ✓ CORRECT APPROACH
const useAuth = () => {
  const { user, token } = useAuth();
  return user.id;  // Captured at login
};

// In api.ts
export const agentApi = {
  async getAll(userId: string): Promise<Agent[]> {  // ← User ID passed
    if (isVapiConfigured && vapiClient) {
      // Note: VAPI doesn't natively support user scoping
      // Solution: Store agents in Supabase with user_id, not in VAPI directly
    }
    
    if (!isDemo && supabase) {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', userId)  // ← USER FILTER APPLIED
        .order('created_at', { ascending: false });
      // ...
    }
  }
};

// Calls should always be filtered by owner
export const callsApi = {
  async getAll(userId: string, agentId?: string, dateFrom?: string, dateTo?: string) {
    let query = supabase
      .from('calls')
      .select('*')
      .eq('user_id', userId);  // ← ALWAYS filter by user
    
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    // ...
  }
};
```

---

## IMMEDIATE ACTIONS REQUIRED

### Phase 1: CRITICAL (Do First)
1. **Stop using shared VAPI client** - Create per-user VAPI client instances
2. **Add user_id to all data queries** - Filter agents, calls, keywords, metrics by owner
3. **Verify Supabase RLS policies** - Ensure row-level security is enforced
4. **Add user context to API calls** - Pass userId in every request
5. **Audit current data access** - Check if unauthorized access occurred

### Phase 2: HIGH (Do Immediately After)
6. **Update all API endpoints** - Add `.eq('user_id', userId)` filters
7. **Fix Settings endpoint** - Should accept per-user credentials, not global
8. **Update data schema** - Ensure user_id foreign key in all tables
9. **Add authorization middleware** - Verify user owns resource before returning

### Phase 3: MEDIUM (In next sprint)
10. **Add audit logging** - Log all data access attempts
11. **Implement request context** - Use dependency injection for user context
12. **Add integration tests** - Test user isolation across all endpoints
13. **Security review** - Have external review of implemented fixes

---

## SPECIFIC CODE LOCATIONS REQUIRING FIXES

| File | Lines | Change Required |
|------|-------|-----------------|
| `/src/lib/api.ts` | 88-112 | Add userId filter to agentApi.getAll() |
| `/src/lib/api.ts` | 248-297 | Add userId filter to callsApi.getAll() |
| `/src/lib/api.ts` | 101-107 | Add .eq('user_id', userId) to Supabase query |
| `/src/lib/api.ts` | 265-283 | Add .eq('user_id', userId) to all call queries |
| `/src/lib/api.ts` | 367-375 | Add .eq('user_id', userId) to keyword queries |
| `/src/lib/api.ts` | 401-410 | Add .eq('user_id', userId) to metrics queries |
| `/src/App.tsx` | 62-72 | Pass userId to loadAgents() |
| `/src/lib/vapi.ts` | 176-184 | Remove singleton, create per-request clients |
| `/src/components/Settings.tsx` | 69-101 | Ensure settings are per-user |
| **Backend D1 API** | `/api/settings` | Validate userId matches auth token |
| **Backend D1 API** | `/api/agents` | Add user_id check for all returns |
| **Backend D1 API** | `/api/calls` | Add user_id check for all returns |

---

## VERIFICATION CHECKLIST

After implementing fixes:

- [ ] User A can only see their own agents
- [ ] User A can only see their own calls
- [ ] User A's agent modifications don't affect User B
- [ ] User A's API key is encrypted and scoped to their account
- [ ] VAPI client is re-created per request with correct credentials
- [ ] All Supabase queries include user_id filter
- [ ] Backend validates user ownership before returning any data
- [ ] Unit tests verify data isolation
- [ ] Integration tests verify cross-user data is not accessible

---

## COMPLIANCE IMPLICATIONS

This vulnerability affects:
- **GDPR**: Users' personal data (call transcripts) exposed to unauthorized users
- **HIPAA**: If used in healthcare, patient data is exposed
- **SOC 2**: Data segregation controls are missing
- **PCI DSS**: If handling payment data, it's not isolated per user

---

## CONCLUSION

The application was likely designed as single-user or single-account initially. When scaling to multi-tenant, **critical user isolation was not implemented**, creating a serious data privacy breach.

**The fix is not complex** - it requires adding user_id filters to existing queries - but it must be implemented immediately to prevent unauthorized data access.

