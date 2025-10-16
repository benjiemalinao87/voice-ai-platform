# Environment Variables Setup

## ✅ D1 Database & Worker Deployed!

Your Cloudflare Worker is now live at:
**https://voice-ai-dashboard-api.curly-king-877d.workers.dev**

## Create `.env` File

Create a `.env` file in the project root with the following content:

```env
# VAPI Configuration (you should already have these)
VITE_VAPI_PRIVATE_KEY=your_vapi_private_key_here
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key_here

# Cloudflare D1 API (Worker URL)
VITE_D1_API_URL=https://voice-ai-dashboard-api.curly-king-877d.workers.dev
```

## Quick Setup Commands

```bash
# 1. Create .env file
cat > .env << 'EOF'
VITE_VAPI_PRIVATE_KEY=your_vapi_private_key_here
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key_here
VITE_D1_API_URL=https://voice-ai-dashboard-api.curly-king-877d.workers.dev
EOF

# 2. Replace with your actual VAPI keys
# Edit the .env file and add your real VAPI keys

# 3. Restart the dev server
npm run dev
```

## Test the Worker

```bash
# Test if the Worker is responding
curl https://voice-ai-dashboard-api.curly-king-877d.workers.dev/api/knowledge-files/test-agent-123

# Should return: []
```

## What Happens Now

Once you add the `.env` file and restart your dev server:

1. ✅ Files uploaded to Knowledge Base will be saved to D1
2. ✅ Files will persist across page refreshes
3. ✅ Files will load automatically when you open Agent Config
4. ✅ You can access them from any device/browser

## Database Info

- **Database Name**: voice-ai-dashboard
- **Database ID**: 68edb24b-9705-4b29-b5c5-d702dc78a6fb
- **Region**: OC (Oceania)
- **Account**: Vic@1leg.co's Account

## Next Steps

1. Create the `.env` file with your VAPI keys
2. Restart `npm run dev`
3. Go to Agent Config → Knowledge Base
4. Upload a test file
5. Refresh the page - the file should still be there! 🎉

