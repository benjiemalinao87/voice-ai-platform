# Organization Filter - Setup Instructions

## What Was Done

I've added organization filtering to solve the issue where you're seeing assistants from multiple VAPI organizations ("CHAU Main" + "Smart Cremation").

### Changes Made:

1. ✅ **Database** - Added `selected_org_id` column to `user_settings` table
2. ✅ **Worker API** - Updated to save/load `selectedOrgId`
3. ✅ **D1 Client** - Added `selectedOrgId` to settings interface
4. ✅ **VapiContext** - Added `selectedOrgId` state and `setSelectedOrgId()` function
5. ✅ **API Layer** - Updated `agentApi.getAll()` to filter by `orgId`
6. ✅ **App.tsx** - Updated to pass `selectedOrgId` to API and reload when it changes

## How To Use (Quick Fix)

### Option 1: Set Org ID Manually in Console

1. **Get your organization IDs** - Open browser DevTools Console and run:
   ```javascript
   // After decrypting your keys
   const response = await fetch('https://api.vapi.ai/assistant', {
     headers: { 'Authorization': 'Bearer YOUR_PRIVATE_KEY' }
   });
   const assistants = await response.json();
   const orgs = [...new Set(assistants.map(a => a.orgId))];
   console.log('Your organizations:', orgs);
   ```

2. **Set the org ID you want to filter by**:
   ```javascript
   // In console, after decrypting keys
   const { setSelectedOrgId } = window.__VAPI_CONTEXT__; // We'll need to expose this
   setSelectedOrgId('YOUR_ORG_ID_HERE');
   ```

### Option 2: Add UI to Settings (Recommended)

Add an organization selector to the Settings component. Here's what it should look like:

```tsx
// After "Test Connection" succeeds and loads assistants/phone numbers:

{/* Organization Filter */}
{assistants.length > 0 && (
  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
      Filter by Organization
    </h3>

    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        VAPI Organization
      </label>
      <select
        value={selectedOrgId || ''}
        onChange={(e) => setSelectedOrgId(e.target.value || null)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      >
        <option value="">All Organizations</option>
        {uniqueOrgs.map((orgId) => (
          <option key={orgId} value={orgId}>
            {orgId}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Only show assistants from this organization
      </p>
    </div>
  </div>
)}
```

## Testing

1. **Restart worker**:
   ```bash
   cd workers
   wrangler dev
   ```

2. **Restart frontend**:
   ```bash
   npm run dev
   ```

3. **Test the filter**:
   - Login
   - Go to Settings
   - Decrypt your keys
   - After assistants load, look for your organizations
   - Select one from the dropdown (needs to be added to Settings UI)
   - Agents dropdown should now only show assistants from that org!

## Current Status

- ✅ Backend fully supports organization filtering
- ✅ Frontend API calls pass org ID correctly
- ⏳ **Settings UI needs organization selector** - This is the last piece!

## Temporary Workaround

Until the UI is added, you can set the org ID directly in the database:

```bash
# Replace with your actual user ID and org ID
wrangler d1 execute voice-ai-dashboard --remote --command \
  "UPDATE user_settings SET selected_org_id = 'YOUR_ORG_ID' WHERE user_id = 'ca106c85-4309-4557-add4-bbf75a07b020';"
```

Then refresh the app and decrypt your keys - it should filter to just that organization!

## Finding Your Org IDs

The easiest way is to look at the VAPI dashboard URL or check the assistant details in VAPI's UI. Each organization has a unique ID that looks like: `org_abc123def456`

---

**Last Updated**: 2025-10-21
**Status**: 95% Complete - Needs Settings UI for org selector
