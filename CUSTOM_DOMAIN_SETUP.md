# Custom Domain Setup Complete

## Summary

Successfully configured custom domains for the Voice AI Dashboard:
- **Frontend (Pages)**: `voice-config.channelautomation.com`
- **API (Worker)**: `api.voice-config.channelautomation.com`

## What Was Done

### 1. Created `.env` File
Created `.env` file in the project root with:
```
VITE_D1_API_URL=https://api.voice-config.channelautomation.com
```

This configures the frontend to call the correct API endpoint during local development.

### 2. Updated `wrangler.toml`
Added `pages_build_output_dir = "dist"` to configure Pages deployment.

The worker already had the correct custom domain configuration:
```toml
routes = [
  { pattern = "api.voice-config.channelautomation.com", custom_domain = true }
]
```

### 3. Deployed Worker
Successfully deployed the worker with the custom domain:
```bash
npx wrangler deploy
```

Output confirmed:
- ✅ Worker deployed to: `api.voice-config.channelautomation.com`
- ✅ Custom domain active

### 4. Built and Deployed Frontend
Built the frontend with the new environment variable:
```bash
npm run build
npx wrangler pages deploy dist --project-name=voice-ai-platform
```

## IMPORTANT: Final Step Required

### Set Environment Variable in Cloudflare Pages

For **production**, you need to set the environment variable in the Cloudflare dashboard:

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select **`voice-ai-platform`** project
3. Go to **Settings** → **Environment variables**
4. Add a new variable:
   - **Variable name**: `VITE_D1_API_URL`
   - **Value**: `https://api.voice-config.channelautomation.com`
   - **Environment**: Select both `Production` and `Preview`
5. Click **Save**
6. Go to **Deployments** tab
7. Click **Retry deployment** on the latest deployment (or trigger a new deployment)

### Alternative: Set via Command Line

You can also set it using this command:
```bash
wrangler pages project create voice-ai-platform --production-branch=main
```

But the dashboard method is more straightforward.

## Testing

After setting the environment variable and redeploying:

1. Visit `https://voice-config.channelautomation.com`
2. Open browser DevTools → Console
3. Try to log in
4. The CORS errors should be gone
5. Check the Network tab - all API calls should go to `api.voice-config.channelautomation.com`

## Files Modified

- ✅ `.env` (created) - Local development configuration
- ✅ `wrangler.toml` (updated) - Added Pages build output directory
- ✅ Worker deployed with custom domain
- ✅ Frontend built and deployed

## Current Status

- ✅ Worker API: `api.voice-config.channelautomation.com` - **ACTIVE**
- ⚠️ Frontend: `voice-config.channelautomation.com` - **Needs environment variable**

Once you set the environment variable in the Cloudflare dashboard and redeploy, everything will work correctly!

## Configuration Files

### `.env` (Local Development)
```env
VITE_D1_API_URL=https://api.voice-config.channelautomation.com
```

### `wrangler.toml`
```toml
name = "voice-ai-dashboard-api"
main = "workers/index.ts"
compatibility_date = "2024-10-16"
account_id = "208f128290b10d58d5de18909148acc0"

# Custom domain
routes = [
  { pattern = "api.voice-config.channelautomation.com", custom_domain = true }
]

# Pages configuration
pages_build_output_dir = "dist"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "voice-ai-dashboard"
database_id = "68edb24b-9705-4b29-b5c5-d702dc78a6fb"

# KV namespace for caching
[[kv_namespaces]]
binding = "CACHE"
id = "1957b2d9d695460ebba474ba4be11def"

# Environment variables
[vars]
JWT_SECRET = "change-this-to-a-secure-random-string-in-production"
```

## Troubleshooting

If you still see CORS errors after setting the environment variable:

1. **Check the Network tab** in DevTools to see what URL the frontend is calling
2. **Hard refresh** the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. **Clear browser cache** completely
4. **Check Cloudflare Pages build logs** to ensure the environment variable was picked up
5. **Verify the deployment** is using the main branch with the environment variable

## Next Steps

1. Set `VITE_D1_API_URL` in Cloudflare Pages dashboard (see instructions above)
2. Redeploy the Pages project
3. Test the login functionality
4. Verify all API calls are working correctly

---

**Note**: The `.env` file is in `.gitignore` and will not be committed to git. This is intentional for security reasons.

