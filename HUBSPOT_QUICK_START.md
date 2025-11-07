# HubSpot Integration - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Create HubSpot App (2 minutes)

1. Go to https://developer.hubspot.com/
2. Click **"Create App"**
3. Fill in:
   - Name: `Voice AI Dashboard`
   - Description: `Sync call recordings to contacts`

### Step 2: Configure OAuth (1 minute)

1. In your HubSpot app, go to **"Auth" tab**
2. Add these **Scopes**:
   - ✅ `contacts`
   - ✅ `content`
   - ✅ `timeline`

3. Add **Redirect URL**:
   ```
   https://api.voice-config.channelautomation.com/api/hubspot/oauth/callback
   ```

4. Save and copy:
   - ✅ Client ID
   - ✅ Client Secret

### Step 3: Update Environment Variables (1 minute)

#### Frontend (.env):
```bash
VITE_HUBSPOT_CLIENT_ID=your-client-id-here
VITE_HUBSPOT_CLIENT_SECRET=your-client-secret-here
```

#### Backend (Cloudflare Workers):
```bash
wrangler secret put HUBSPOT_CLIENT_ID
# Paste your Client ID

wrangler secret put HUBSPOT_CLIENT_SECRET
# Paste your Client Secret
```

### Step 4: Deploy (1 minute)

```bash
# Deploy backend
wrangler deploy

# Restart frontend
npm run dev
```

### Step 5: Connect HubSpot

1. Open your dashboard
2. Go to **Integrations** page
3. Find **HubSpot** card
4. Click **"Connect"** button
5. Authorize in popup
6. Done! ✅

---

## 🧪 Test It

1. Make a test call to a phone number in your HubSpot
2. End the call
3. Go to HubSpot → Find contact by phone
4. Check contact **Timeline** → You'll see a new note with:
   - ✅ Call summary
   - ✅ Recording URL
   - ✅ Timestamp

---

## 📊 Monitor Syncs

Check sync logs in your browser console or API:

```bash
GET https://api.voice-config.channelautomation.com/api/hubspot/sync-logs
```

---

## 🎯 What Syncs?

After each call ends:
- ✅ Searches HubSpot for contact by phone number
- ✅ Creates a note on contact timeline
- ✅ Includes call summary
- ✅ Includes recording URL
- ✅ Logs sync result (success/error/skipped)

---

## 🔧 Troubleshooting

**Problem**: "Contact not found" in logs
- **Solution**: Make sure phone number exists in HubSpot contacts

**Problem**: OAuth popup blocked
- **Solution**: Enable popups for your domain

**Problem**: Connection status shows "Not Connected"
- **Solution**: Click Connect again, re-authorize

---

## 📝 Key Files

- **Backend Service**: `workers/hubspot-service.ts`
- **API Routes**: `workers/index.ts` (lines 1340-1581)
- **Frontend Integration**: `src/components/Integration.tsx`
- **D1 Client**: `src/lib/d1.ts` (lines 566-654)
- **Migration**: `workers/migrations/0017_create_hubspot_integration.sql`

---

**That's it!** Your HubSpot integration is ready to sync calls automatically. 🎉
