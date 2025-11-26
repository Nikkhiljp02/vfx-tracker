// Advanced caching utilities for VFX Tracker

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  staleWhileRevalidate?: number; // Additional time to serve stale data
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTimestamp?: number;
}

export class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

  constructor(defaultTTL?: number) {
    if (defaultTTL) this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, config?: CacheConfig): void {
    const ttl = config?.ttl || this.defaultTTL;
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp: now,
      staleTimestamp: config?.staleWhileRevalidate 
        ? now + ttl + config.staleWhileRevalidate 
        : undefined,
    });
  }

  get<T>(key: string): { data: T | null; isStale: boolean } {
    const entry = this.cache.get(key);
    if (!entry) return { data: null, isStale: false };

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if completely expired
    if (entry.staleTimestamp && now > entry.staleTimestamp) {
      this.cache.delete(key);
      return { data: null, isStale: false };
    }

    // Check if stale but still servable
    if (entry.staleTimestamp) {
      const ttl = entry.staleTimestamp - entry.timestamp;
      const isStale = age > ttl;
      return { data: entry.data as T, isStale };
    }

    return { data: entry.data as T, isStale: false };
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern) 
      : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const memoryCache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  shows: () => 'shows:all',
  show: (id: string) => `show:${id}`,
  shots: (showId?: string, page?: number, limit?: number) => 
    `shots:${showId || 'all'}:${page || 0}:${limit || 0}`,
  shot: (id: string) => `shot:${id}`,
  tasks: (shotId?: string) => `tasks:${shotId || 'all'}`,
  task: (id: string) => `task:${id}`,
  shotNotes: (shotId: string, page?: number) => 
    `shot-notes:${shotId}:${page || 0}`,
  activityLogs: (entityType?: string, entityId?: string, page?: number) =>
    `activity-logs:${entityType || 'all'}:${entityId || 'all'}:${page || 0}`,
  deliveries: (params: string) => `deliveries:${params}`,
  statusOptions: () => 'status-options:all',
  departments: () => 'departments:all',
  userPermissions: (userId: string) => `user:${userId}:permissions`,
};

// Stale-while-revalidate fetcher
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config?: CacheConfig & { forceRefresh?: boolean }
): Promise<T> {
  // Force refresh bypasses cache
  if (config?.forceRefresh) {
    const data = await fetcher();
    memoryCache.set(key, data, config);
    return data;
  }

  // Try cache first
  const cached = memoryCache.get<T>(key);
  
  if (cached.data && !cached.isStale) {
    // Fresh cache hit
    return cached.data;
  }

  if (cached.data && cached.isStale) {
    // Stale cache - return stale data and revalidate in background
    fetcher()
      .then(freshData => {
        memoryCache.set(key, freshData, config);
      })
      .catch(err => {
        console.error('Background revalidation failed:', err);
      });
    
    return cached.data;
  }

  // Cache miss - fetch fresh data
  const data = await fetcher();
  memoryCache.set(key, data, config);
  return data;
}

// Invalidation helpers
export function invalidateEntityCache(entityType: 'show' | 'shot' | 'task', entityId?: string) {
  if (entityId) {
    memoryCache.invalidate(cacheKeys[entityType](entityId));
  }
  
  // Invalidate lists
  switch (entityType) {
    case 'show':
      memoryCache.invalidate(cacheKeys.shows());
      memoryCache.invalidatePattern(/^shots:/);
      break;
    case 'shot':
      memoryCache.invalidatePattern(/^shots:/);
      if (entityId) {
        memoryCache.invalidatePattern(new RegExp(`^tasks:${entityId}`));
        memoryCache.invalidatePattern(new RegExp(`^shot-notes:${entityId}`));
      }
      break;
    case 'task':
      memoryCache.invalidatePattern(/^tasks:/);
      memoryCache.invalidatePattern(/^shots:/);
      break;
  }
}

// Clear ALL caches - use after bulk operations like Google Sheets import
export function clearAllCaches() {
  memoryCache.clear();
  console.log('[Cache] All caches cleared');
}

// Cache configuration presets
export const cacheConfigs = {
  // Quick-changing data
  realtime: {
    ttl: 30 * 1000, // 30 seconds
    staleWhileRevalidate: 10 * 1000, // 10 seconds stale
  },
  // Moderate update frequency
  standard: {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: 2 * 60 * 1000, // 2 minutes stale
  },
  // Rarely changes
  longLived: {
    ttl: 30 * 60 * 1000, // 30 minutes
    staleWhileRevalidate: 10 * 60 * 1000, // 10 minutes stale
  },
};
