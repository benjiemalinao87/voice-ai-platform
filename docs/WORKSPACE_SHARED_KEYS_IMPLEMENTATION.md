# Workspace-Level API Keys Implementation Plan

## Current Situation

**Problem:** Benjie (team member) cannot see Voice Assistants because:
- API keys are stored per-user in `user_settings` table
- Each user needs their own VAPI/Twilio keys
- Team members don't have keys → can't see workspace data

## Solution: Workspace-Level API Keys

Store API keys at workspace level so all members share the same credentials.

---

## Database Changes

### ✅ COMPLETED: Created `workspace_settings` table
```sql
CREATE TABLE workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT,      -- VAPI Private Key
  encrypted_public_key TEXT,       -- VAPI Public Key
  encrypted_openai_key TEXT,       -- OpenAI API Key
  encrypted_twilio_sid TEXT,       -- Twilio SID
  encrypted_twilio_token TEXT,     -- Twilio Token
  transfer_phone_number TEXT,
  encryption_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Migration applied:** `0010_add_workspace_settings.sql` ✅

---

## Backend Changes Needed

### Current Issues in `/api/settings` endpoints:

1. **Column name mismatch:**
   - Code uses: `private_key`, `public_key`
   - Table has: `encrypted_private_key`, `encrypted_public_key`

2. **Missing encryption/decryption:**
   - Keys need to be encrypted before storage
   - Keys need to be decrypted when retrieved

### Required Updates:

#### 1. GET `/api/settings` (Line 867-932)
**Current:** Tries to read `wsSettings.private_key`
**Should:** Read `encrypted_private_key` and decrypt it

#### 2. PUT `/api/settings` (Line 935-1015)
**Current:** Stores plaintext keys
**Should:** Encrypt keys before storing

#### 3. Add Permission Checks:
- **Owner/Admin:** Can view and edit all keys
- **Member:** Can view keys (decrypted for use) but cannot edit

---

## Frontend Changes Needed

Currently working - frontend already calls `/api/settings` which will return workspace keys once backend is fixed.

No frontend changes needed if we fix the backend properly.

---

## Implementation Steps

### Step 1: Fix Backend Settings Endpoints ⏳

**GET /api/settings:**
```typescript
// Get workspace settings with decryption
const wsSettings = await env.DB.prepare(
  'SELECT encrypted_private_key, encrypted_public_key, encrypted_openai_key,
          encrypted_twilio_sid, encrypted_twilio_token, transfer_phone_number,
          encryption_salt
   FROM workspace_settings
   WHERE workspace_id = ?'
).bind(workspaceId).first();

// Decrypt keys before returning
return jsonResponse({
  privateKey: wsSettings?.encrypted_private_key
    ? await decrypt(wsSettings.encrypted_private_key, userId, wsSettings.encryption_salt)
    : null,
  publicKey: wsSettings?.encrypted_public_key
    ? await decrypt(wsSettings.encrypted_public_key, userId, wsSettings.encryption_salt)
    : null,
  // ... etc
});
```

**PUT /api/settings:**
```typescript
// Verify user is owner or admin
const isOwner = workspace.owner_user_id === userId;
const membership = await env.DB.prepare(
  'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
).bind(selectedWorkspaceId, userId).first();

const canEdit = isOwner || membership?.role === 'admin';

if (!canEdit) {
  return jsonResponse({ error: 'Only owner/admin can update credentials' }, 403);
}

// Encrypt keys before storing
const encryptedPrivateKey = privateKey
  ? await encrypt(privateKey, userId, encryptionSalt)
  : null;

// Store encrypted keys
await env.DB.prepare(
  'UPDATE workspace_settings
   SET encrypted_private_key = ?, encrypted_public_key = ?, ...
   WHERE workspace_id = ?'
).bind(encryptedPrivateKey, encryptedPublicKey, ...).run();
```

###Step 2: Test Flow

1. **Vic (owner) logs in:**
   - Goes to Settings
   - Enters VAPI keys
   - Keys encrypted and stored in `workspace_settings`

2. **Benjie (member) logs in:**
   - API loads workspace settings
   - Keys decrypted and returned
   - Frontend uses keys to load Voice Assistants
   - Benjie sees all assistants!

3. **Permission test:**
   - Benjie tries to edit keys → Should see read-only or get error
   - Only Vic (owner) or admins can edit

---

## Alternative: Simpler Immediate Fix

If encryption is complex, we can do a **simpler version first**:

### Quick Fix (No Encryption Yet):
1. Change column names to match: Use `private_key` instead of `encrypted_private_key`
2. Store keys as plaintext temporarily
3. Add encryption layer later

**Trade-off:** Less secure, but gets team sharing working immediately.

---

## Decision Point

**Option A: Full Implementation (Recommended)**
- Properly encrypt/decrypt keys
- Secure and production-ready
- Takes more time (~1-2 hours)

**Option B: Quick Fix**
- Store plaintext keys in workspace_settings
- Get it working in 15 minutes
- Add encryption later

**Which would you like?**

---

## Current Status

✅ Database table created
✅ Migration applied
⏳ Backend endpoints need encryption logic
⏳ Testing with Benjie's account

**Next:** Choose Option A or B, then implement

---

**Created:** 2025-11-03
**Status:** Planning Complete, Implementation Pending
