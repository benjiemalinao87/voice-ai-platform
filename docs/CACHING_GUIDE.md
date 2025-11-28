# Caching Implementation Guide

## Overview

The Voice AI Dashboard uses Cloudflare KV for caching to improve performance and reduce database queries. The caching system is implemented in `workers/cache.ts` and integrated throughout the worker.

## What's Cached

1. **Recordings** - Paginated recording lists (5 min TTL)
2. **Intent Analysis** - Intent dashboard summary data (2 min TTL)
3. **Enhanced Data** - Phone number enrichment results (30 min TTL)
4. **Call Details** - Individual call information (10 min TTL)

## Cache Architecture

### Cache Keys
- `recordings:user:{userId}:page:{page}:limit:{limit}`
- `intent:user:{userId}:summary`
- `intent:user:{userId}:analysis:{callId}`
- `enhanced:user:{userId}:call:{callId}`

### TTL Configuration
```typescript
CACHE_TTL = {
  RECORDINGS: 300,      // 5 minutes
  CALL_DETAILS: 600,    // 10 minutes
  INTENT_ANALYSIS: 600, // 10 minutes
  INTENT_SUMMARY: 120,  // 2 minutes
  ENHANCED_DATA: 1800,  // 30 minutes
}
```

## Cache Invalidation

### Automatic Invalidation

1. **On New Webhook**: All user cache is invalidated when a new call arrives
   ```typescript
   await cache.invalidateUserCache(webhook.user_id);
   ```

2. **On Analysis Complete**: Specific call cache is invalidated after OpenAI analysis
   ```typescript
   await cache.invalidateCallCache(webhook.user_id, callId);
   ```

## Testing Cache Performance

### 1. Check Cache Stats API

```bash
curl https://voice-ai-dashboard-api.curly-king-877d.workers.dev/api/cache/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "totalKeys": 45,
  "recordingsKeys": 15,
  "intentKeys": 20,
  "enhancedKeys": 10,
  "ttl": {
    "recordings": 300,
    "callDetails": 600,
    "intentAnalysis": 600,
    "intentSummary": 120,
    "enhancedData": 1800
  }
}
```

### 2. Monitor Worker Logs

```bash
wrangler tail --format pretty
```

Look for these messages:
- `Cache HIT for recordings: user=...` - Data served from cache
- `Cache MISS for recordings: user=...` - Data fetched from database
- `Cache HIT for enhanced data: callId=...` - Enhanced data served from cache
- `Cache MISS for enhanced data: callId=...` - Enhanced data fetched from API

### 3. Check Cloudflare KV Dashboard

1. Go to Cloudflare Dashboard → Workers & Pages → KV
2. Click on your `CACHE` namespace (ID: 1957b2d9d695460ebba474ba4be11def)
3. You should see keys with prefixes:
   - `recordings:user:...`
   - `intent:user:...`
   - `enhanced:user:...`

### 4. Measure Response Times

**Without Cache (First Request):**
- Expected: ~200-500ms (database query + processing)

**With Cache (Second Request):**
- Expected: ~50-100ms (KV read only)

**Example Test:**
```bash
# First request (cache miss)
time curl https://voice-ai-dashboard-api.curly-king-877d.workers.dev/api/recordings?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Second request (cache hit - should be faster)
time curl https://voice-ai-dashboard-api.curly-king-877d.workers.dev/api/recordings?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Cache Behavior

### When Cache is Used

✅ Cache is used for:
- Recordings API with no webhook filter and limit ≤ 100
- Intent analysis with limit ≤ 100
- Enhanced Data addon results
- Call details lookups

### When Cache is Bypassed

❌ Cache is NOT used for:
- Recordings API with webhook filter (filtered results)
- Large page sizes (limit > 100)
- First-time requests (cache miss)
- After cache invalidation (new webhooks)

## Performance Benefits

### Enhanced Data Caching

**Before:** Every call triggers an API request to the phone enrichment service
- ~500-1000ms per API call
- Rate limiting concerns
- External service dependency

**After:** Cached for 30 minutes
- ~50ms cache read
- Reduced API costs
- Better reliability

### Recordings Caching

**Before:** Database query on every page load
- ~200-300ms per query
- D1 read unit consumption

**After:** Cached for 5 minutes
- ~50ms cache read
- 90% reduction in database reads

### Intent Analysis Caching

**Before:** Complex aggregation queries on every dashboard load
- ~300-500ms per query
- CPU-intensive calculations

**After:** Cached for 2 minutes
- ~50ms cache read
- Pre-computed statistics

## Monitoring Cache Health

### Key Metrics to Track

1. **Cache Hit Ratio**: Monitor logs for HIT vs MISS ratio
   - Target: >70% hit rate for recordings
   - Target: >80% hit rate for enhanced data

2. **Total Keys**: Check `/api/cache/stats` regularly
   - Should grow with active users
   - Should not exceed KV limits

3. **Response Times**: Compare cached vs uncached requests
   - Cached: <100ms
   - Uncached: 200-500ms

## Troubleshooting

### Cache Not Working?

1. **Check KV Binding**: Verify CACHE namespace is bound in wrangler.toml
2. **Check Logs**: Look for cache HIT/MISS messages
3. **Check TTL**: Ensure cache hasn't expired (use /api/cache/stats)
4. **Check Invalidation**: New webhooks invalidate cache immediately

### Too Many Cache Misses?

1. **Short TTL**: Consider increasing TTL for stable data
2. **Frequent Invalidation**: New webhooks clear all cache
3. **Large Requests**: Requests with limit >100 bypass cache

### KV Storage Growing Too Large?

1. **Check Total Keys**: Use `/api/cache/stats`
2. **Verify Expiration**: All cached data has automatic expiration
3. **Manual Cleanup**: KV automatically removes expired keys

## Future Improvements

### Potential Enhancements

1. **Selective Invalidation**: Only invalidate affected pages, not entire cache
2. **Cache Warming**: Pre-populate cache for common queries
3. **Cache Versioning**: Allow multiple cache versions to coexist
4. **Per-User Cache Limits**: Prevent single user from consuming all cache
5. **Cache Analytics**: Track hit rates, miss reasons, and performance gains

---

**Last Updated**: 2025-10-24
**Cache Version**: 1.0
