// Rate limiting utilities for API routes
import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitOptions {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max number of unique tokens per interval
  maxRequestsPerInterval: number; // Max requests per token per interval
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Default rate limit configurations by endpoint type
export const rateLimitConfigs = {
  // Authentication endpoints - stricter limits
  auth: {
    interval: 15 * 60 * 1000, // 15 minutes
    uniqueTokenPerInterval: 500,
    maxRequestsPerInterval: 5, // 5 attempts per 15 min
  },
  // Mutation endpoints (POST, PUT, DELETE) - moderate limits
  mutation: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500,
    maxRequestsPerInterval: 30, // 30 requests per minute
  },
  // Read endpoints (GET) - generous limits
  read: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500,
    maxRequestsPerInterval: 100, // 100 requests per minute
  },
  // File uploads/exports - restrictive limits
  file: {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500,
    maxRequestsPerInterval: 10, // 10 files per minute
  },
};

class RateLimiter {
  private cache: LRUCache<string, number[]>;
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;
    this.cache = new LRUCache({
      max: options.uniqueTokenPerInterval,
      ttl: options.interval,
    });
  }

  check(identifier: string): RateLimitResult {
    const now = Date.now();
    const tokenKey = `${identifier}`;
    
    // Get existing request timestamps for this identifier
    let timestamps = this.cache.get(tokenKey) || [];
    
    // Filter out timestamps outside the current interval
    const windowStart = now - this.options.interval;
    timestamps = timestamps.filter((timestamp) => timestamp > windowStart);
    
    // Check if limit exceeded
    const isLimitExceeded = timestamps.length >= this.options.maxRequestsPerInterval;
    
    if (!isLimitExceeded) {
      // Add current timestamp
      timestamps.push(now);
      this.cache.set(tokenKey, timestamps);
    }
    
    const remaining = Math.max(0, this.options.maxRequestsPerInterval - timestamps.length);
    const oldestTimestamp = timestamps[0] || now;
    const reset = oldestTimestamp + this.options.interval;
    
    return {
      success: !isLimitExceeded,
      limit: this.options.maxRequestsPerInterval,
      remaining,
      reset,
    };
  }

  reset(identifier: string): void {
    this.cache.delete(`${identifier}`);
  }
}

// Create rate limiter instances
const authLimiter = new RateLimiter(rateLimitConfigs.auth);
const mutationLimiter = new RateLimiter(rateLimitConfigs.mutation);
const readLimiter = new RateLimiter(rateLimitConfigs.read);
const fileLimiter = new RateLimiter(rateLimitConfigs.file);

// Helper to get client identifier (IP or session)
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from headers (works with most proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // For authenticated requests, could also use user ID from session
  // But IP-based is more secure for preventing abuse
  return ip;
}

// Middleware function to apply rate limiting
export async function applyRateLimit(
  request: NextRequest,
  limiterType: 'auth' | 'mutation' | 'read' | 'file' = 'mutation'
): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  
  let limiter: RateLimiter;
  switch (limiterType) {
    case 'auth':
      limiter = authLimiter;
      break;
    case 'mutation':
      limiter = mutationLimiter;
      break;
    case 'read':
      limiter = readLimiter;
      break;
    case 'file':
      limiter = fileLimiter;
      break;
    default:
      limiter = mutationLimiter;
  }
  
  const result = limiter.check(identifier);
  
  // Add rate limit headers to response
  const headers = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };
  
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }
  
  // Rate limit passed - return null to indicate success
  // The calling function should add these headers to their response
  return null;
}

// Export headers to be added to successful responses
export function getRateLimitHeaders(
  request: NextRequest,
  limiterType: 'auth' | 'mutation' | 'read' | 'file' = 'mutation'
): Record<string, string> {
  const identifier = getClientIdentifier(request);
  
  let limiter: RateLimiter;
  switch (limiterType) {
    case 'auth':
      limiter = authLimiter;
      break;
    case 'mutation':
      limiter = mutationLimiter;
      break;
    case 'read':
      limiter = readLimiter;
      break;
    case 'file':
      limiter = fileLimiter;
      break;
    default:
      limiter = mutationLimiter;
  }
  
  const result = limiter.check(identifier);
  
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining - 1).toString(), // -1 for current request
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };
}

// Export limiter instances for manual control if needed
export { authLimiter, mutationLimiter, readLimiter, fileLimiter };
