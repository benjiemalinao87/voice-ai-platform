# Cloudflare D1 Setup Guide

This guide will help you set up Cloudflare D1 database for the Knowledge Base feature.

## Prerequisites

- Cloudflare account (free tier works)
- Wrangler CLI installed globally: `npm install -g wrangler`
- Logged into Wrangler: `wrangler login`

## Step 1: Create D1 Database

```bash
# Create the database
wrangler d1 create voice-ai-dashboard

# Copy the database_id from the output
# It will look like: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 2: Update wrangler.toml

Edit `wrangler.toml` and add the `database_id` you just received:

```toml
[[d1_databases]]
binding = "DB"
database_name = "voice-ai-dashboard"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- Paste your ID here
```

## Step 3: Initialize Database Schema

```bash
# Run the schema migration
wrangler d1 execute voice-ai-dashboard --file=workers/schema.sql
```

## Step 4: Deploy Worker

```bash
# Deploy to Cloudflare
wrangler deploy
```

After deployment, you'll get a URL like: `https://voice-ai-dashboard-api.YOUR_SUBDOMAIN.workers.dev`

## Step 5: Configure Frontend

Create a `.env` file in the project root:

```env
# Your VAPI credentials (you should already have these)
VITE_VAPI_PRIVATE_KEY=your_vapi_private_key
VITE_VAPI_PUBLIC_KEY=your_vapi_public_key

# Cloudflare D1 API URL (from step 4)
VITE_D1_API_URL=https://voice-ai-dashboard-api.YOUR_SUBDOMAIN.workers.dev
```

## Step 6: Test It

```bash
# Start the dev server
npm run dev

# In another terminal, test the Worker locally
wrangler dev
```

## Development vs Production

### Local Development
When running `wrangler dev`, the Worker runs locally on `http://localhost:8787`

Update your `.env.local`:
```env
VITE_D1_API_URL=http://localhost:8787
```

### Production
After deploying with `wrangler deploy`, update `.env.production`:
```env
VITE_D1_API_URL=https://voice-ai-dashboard-api.YOUR_SUBDOMAIN.workers.dev
```

## API Endpoints

The Worker provides these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge-files/:agentId` | List all files for an agent |
| POST | `/api/knowledge-files` | Create a new file record |
| DELETE | `/api/knowledge-files/:id` | Delete a file record |

## Testing the API

```bash
# List files for an agent
curl https://your-worker.workers.dev/api/knowledge-files/agent_123

# Create a file record
curl -X POST https://your-worker.workers.dev/api/knowledge-files \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_123",
    "vapi_file_id": "file_abc",
    "file_name": "test.pdf",
    "file_size": 1024
  }'

# Delete a file record
curl -X DELETE https://your-worker.workers.dev/api/knowledge-files/file_id_here
```

## Troubleshooting

### Worker not responding
- Check deployment: `wrangler tail` to see logs
- Verify database binding in wrangler.toml
- Run `wrangler d1 info voice-ai-dashboard` to confirm database exists

### CORS errors
- The Worker includes CORS headers for all origins
- If issues persist, check browser console for exact error

### Database errors
- Verify schema was applied: `wrangler d1 execute voice-ai-dashboard --command="SELECT name FROM sqlite_master WHERE type='table'"`
- Should return: `agent_knowledge_files`

### Files not persisting
- Check `.env` has correct `VITE_D1_API_URL`
- Open browser DevTools > Network tab to see API calls
- Verify Worker is receiving requests in Wrangler dashboard

## Cost

Cloudflare D1 Free Tier includes:
- ✅ 5 GB storage
- ✅ 5 million reads/day
- ✅ 100,000 writes/day

More than enough for this use case! 🎉

## Next Steps

Once set up, your Knowledge Base files will:
1. ✅ Persist across page refreshes
2. ✅ Be accessible from any device/browser
3. ✅ Load automatically when you open Agent Config
4. ✅ Sync with VAPI's file storage

The files are stored in VAPI's cloud, and D1 just tracks the references/metadata.

