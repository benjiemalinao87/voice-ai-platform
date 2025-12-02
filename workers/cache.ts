/**
 * KV Cache Service for Voice AI Dashboard
 * Provides intelligent caching for recordings and intent analysis data
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

export class VoiceAICache {
  private kv: KVNamespace;
  private defaultTTL: number;

  constructor(kv: KVNamespace, defaultTTL: number = 300) {
    this.kv = kv;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key for recordings page
   */
  private getRecordingsKey(userId: string, page: number = 1, limit: number = 50): string {
    return `recordings:user:${userId}:page:${page}:limit:${limit}`;
  }

  /**
   * Generate cache key for individual call details
   */
  private getCallKey(userId: string, callId: string): string {
    return `recordings:user:${userId}:call:${callId}`;
  }

  /**
   * Generate cache key for intent analysis
   */
  private getIntentKey(userId: string, callId: string): string {
    return `intent:user:${userId}:analysis:${callId}`;
  }

  /**
   * Generate cache key for intent dashboard summary
   */
  private getIntentSummaryKey(userId: string): string {
    return `intent:user:${userId}:summary`;
  }

  /**
   * Generate cache key for enhanced data
   */
  private getEnhancedDataKey(userId: string, callId: string): string {
    return `enhanced:user:${userId}:call:${callId}`;
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.kv.get(key, 'json') as CacheEntry<T> | null;
      
      if (!cached) {
        return null;
      }

      // Check if expired
      const now = Math.floor(Date.now() / 1000);
      if (cached.timestamp + cached.ttl < now) {
        // Expired, delete and return null
        await this.kv.delete(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Math.floor(Date.now() / 1000),
        ttl,
        tags: options.tags
      };

      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttl
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Invalidate cache by pattern (for user-specific data)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      // List all keys for this user
      const list = await this.kv.list({ prefix: `recordings:user:${userId}:` });
      const intentList = await this.kv.list({ prefix: `intent:user:${userId}:` });
      const enhancedList = await this.kv.list({ prefix: `enhanced:user:${userId}:` });

      // Delete all user-related cache entries
      const keysToDelete = [
        ...list.keys.map(k => k.name),
        ...intentList.keys.map(k => k.name),
        ...enhancedList.keys.map(k => k.name)
      ];

      await Promise.all(keysToDelete.map(key => this.kv.delete(key)));
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Cache recordings page data
   */
  async cacheRecordings(
    userId: string, 
    recordings: any[], 
    page: number = 1, 
    limit: number = 50,
    ttl: number = 300 // 5 minutes
  ): Promise<void> {
    const key = this.getRecordingsKey(userId, page, limit);
    await this.set(key, recordings, { ttl });
  }

  /**
   * Get cached recordings page data
   */
  async getCachedRecordings(userId: string, page: number = 1, limit: number = 50): Promise<any[] | null> {
    const key = this.getRecordingsKey(userId, page, limit);
    return await this.get<any[]>(key);
  }

  /**
   * Cache individual call details
   */
  async cacheCall(userId: string, callId: string, callData: any, ttl: number = 600): Promise<void> {
    const key = this.getCallKey(userId, callId);
    await this.set(key, callData, { ttl });
  }

  /**
   * Get cached call details
   */
  async getCachedCall(userId: string, callId: string): Promise<any | null> {
    const key = this.getCallKey(userId, callId);
    return await this.get<any>(key);
  }

  /**
   * Cache intent analysis data
   */
  async cacheIntentAnalysis(userId: string, callId: string, intentData: any, ttl: number = 600): Promise<void> {
    const key = this.getIntentKey(userId, callId);
    await this.set(key, intentData, { ttl });
  }

  /**
   * Get cached intent analysis
   */
  async getCachedIntentAnalysis(userId: string, callId: string): Promise<any | null> {
    const key = this.getIntentKey(userId, callId);
    return await this.get<any>(key);
  }

  /**
   * Cache intent dashboard summary
   */
  async cacheIntentSummary(userId: string, summaryData: any, ttl: number = 300): Promise<void> {
    const key = this.getIntentSummaryKey(userId);
    await this.set(key, summaryData, { ttl });
  }

  /**
   * Get cached intent summary
   */
  async getCachedIntentSummary(userId: string): Promise<any | null> {
    const key = this.getIntentSummaryKey(userId);
    return await this.get<any>(key);
  }

  /**
   * Cache enhanced data
   */
  async cacheEnhancedData(userId: string, callId: string, enhancedData: any, ttl: number = 1800): Promise<void> {
    const key = this.getEnhancedDataKey(userId, callId);
    await this.set(key, enhancedData, { ttl });
  }

  /**
   * Get cached enhanced data
   */
  async getCachedEnhancedData(userId: string, callId: string): Promise<any | null> {
    const key = this.getEnhancedDataKey(userId, callId);
    return await this.get<any>(key);
  }

  /**
   * Invalidate specific call cache
   */
  async invalidateCallCache(userId: string, callId: string): Promise<void> {
    await Promise.all([
      this.delete(this.getCallKey(userId, callId)),
      this.delete(this.getIntentKey(userId, callId)),
      this.delete(this.getEnhancedDataKey(userId, callId))
    ]);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    recordingsKeys: number;
    intentKeys: number;
    enhancedKeys: number;
  }> {
    try {
      const recordingsList = await this.kv.list({ prefix: 'recordings:' });
      const intentList = await this.kv.list({ prefix: 'intent:' });
      const enhancedList = await this.kv.list({ prefix: 'enhanced:' });

      return {
        totalKeys: recordingsList.keys.length + intentList.keys.length + enhancedList.keys.length,
        recordingsKeys: recordingsList.keys.length,
        intentKeys: intentList.keys.length,
        enhancedKeys: enhancedList.keys.length
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        totalKeys: 0,
        recordingsKeys: 0,
        intentKeys: 0,
        enhancedKeys: 0
      };
    }
  }
}

/**
 * Cache TTL constants
 */
export const CACHE_TTL = {
  RECORDINGS: 300,      // 5 minutes
  CALL_DETAILS: 600,    // 10 minutes
  INTENT_ANALYSIS: 600, // 10 minutes
  INTENT_SUMMARY: 300,  // 5 minutes (increased from 2 min for better cache hit rate)
  ENHANCED_DATA: 1800,  // 30 minutes
} as const;
