# 🚀 VFX Tracker Performance Optimization Plan

## 📊 Current Analysis

**Technology Stack:**
- ✅ Next.js 16.0.1 (App Router)
- ✅ React 19.2.0
- ✅ Prisma 6.19.0
- ✅ Supabase (PostgreSQL in production)
- ✅ SQLite (local development)
- ✅ Zustand (state management)
- ✅ React Query/TanStack Query
- ✅ Supabase Realtime (Broadcast method)

**Current Performance Issues:**
1. ❌ **Slow on Production (Vercel)** - Fast locally
2. ❌ **No Real-time Updates Active** - Supabase Realtime setup exists but not fully implemented
3. ❌ **Heavy Database Queries** - Loading all shows with nested shots and tasks
4. ❌ **No API Response Caching** - Every request hits the database
5. ❌ **No Database Indexes** - Queries scanning full tables
6. ❌ **No Server-Side Pagination** - Loading all data at once

---

## 🎯 PHASE 1: IMMEDIATE WINS (1-2 Hours)

### 1.1 Enable Supabase Realtime Broadcasts ⚡

**Problem:** You have Supabase Realtime library installed but broadcasts are NOT being sent from API routes.

**Solution:** Add broadcast calls to all mutation API routes.

**Implementation:**

```typescript
// app/api/tasks/[id]/route.ts - After updating a task
import { supabase } from '@/lib/supabase';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // ... existing update logic ...
  
  const updatedTask = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
  });

  // 🚀 ADD THIS: Broadcast the update to all connected clients
  await supabase.channel('db-changes').send({
    type: 'broadcast',
    event: 'task-update',
    payload: { taskId: updatedTask.id, showId: updatedTask.shot?.showId }
  });

  return NextResponse.json(updatedTask);
}
```

**Files to Update:**
1. `app/api/tasks/[id]/route.ts` - PATCH, DELETE
2. `app/api/tasks/bulk-update/route.ts` - POST
3. `app/api/shots/[id]/route.ts` - PATCH, DELETE
4. `app/api/feedbacks/route.ts` - POST
5. `app/api/feedbacks/[id]/route.ts` - PATCH, DELETE
6. `app/api/shows/[id]/route.ts` - PATCH, DELETE

**Client-Side Subscription:**

```typescript
// lib/store.ts or app/page.tsx
import { supabase } from '@/lib/supabase';

useEffect(() => {
  const channel = supabase.channel('db-changes')
    .on('broadcast', { event: 'task-update' }, (payload) => {
      console.log('Task updated:', payload);
      fetchTasks(); // Refresh tasks
    })
    .on('broadcast', { event: 'feedback-update' }, (payload) => {
      fetchAllData(); // Refresh all data
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

**Expected Result:** 
- Updates appear in < 1 second on all connected clients
- No more 10-second polling needed
- Instant status changes across all users

---

### 1.2 Add Database Indexes 🗄️

**Problem:** Prisma queries are slow because there are no indexes on frequently queried fields.

**Current Slow Queries:**
```sql
-- This scans ENTIRE tasks table
SELECT * FROM tasks WHERE status = 'WIP';

-- This scans ENTIRE shots table
SELECT * FROM shots WHERE showId = '...';
```

**Solution:** Add indexes to your schema:

```prisma
// prisma/schema.prisma

model Task {
  // ... existing fields ...
  
  @@index([shotId])           // 🚀 Fast shot lookups
  @@index([status])           // 🚀 Fast status filtering
  @@index([department])       // 🚀 Fast department filtering
  @@index([bidDate])          // 🚀 Fast date range queries
  @@index([deliveredDate])    // 🚀 Fast delivery queries
  @@index([leadName])         // 🚀 Fast lead filtering
  @@map("tasks")
}

model Shot {
  // ... existing fields ...
  
  @@index([showId])           // 🚀 Fast show lookups
  @@index([shotTag])          // 🚀 Fast tag filtering
  @@index([episode])          // 🚀 Fast episode filtering
  @@index([sequence])         // 🚀 Fast sequence filtering
  @@map("shots")
}

model ActivityLog {
  // ... existing fields ...
  
  @@index([entityType, entityId])  // 🚀 Fast entity lookups
  @@index([timestamp])             // 🚀 Fast time-based queries
  @@index([userId])                // 🚀 Fast user activity
  @@map("activity_logs")
}

model Feedback {
  // ... existing fields ...
  
  @@index([taskId])           // 🚀 Fast task lookups
  @@index([status])           // 🚀 Fast status filtering
  @@index([showName])         // 🚀 Fast show filtering
  @@map("feedbacks")
}
```

**Run Migration:**
```bash
npx prisma migrate dev --name add_performance_indexes
npx prisma generate
git add prisma/
git commit -m "perf: Add database indexes for faster queries"
git push
```

**Expected Result:**
- 10-100x faster queries on production
- Queries go from 500ms → 5ms

---

### 1.3 Optimize API Routes with Selective Loading 📦

**Problem:** Loading ALL data with deep nesting kills performance.

**Current Code (SLOW):**
```typescript
// app/api/shows/route.ts
const shows = await prisma.show.findMany({
  include: {
    shots: {
      include: {
        tasks: {
          include: {
            shot: {
              include: { show: true } // 🐌 Nested hell
            }
          }
        }
      }
    }
  }
});
```

**Optimized Code (FAST):**
```typescript
// app/api/shows/route.ts
const shows = await prisma.show.findMany({
  select: {
    id: true,
    showName: true,
    vfxSupervisor: true,
    vfxProducer: true,
    client: true,
    isActive: true,
    createdDate: true,
    _count: { select: { shots: true } } // Just the count, not the data
  },
  where: { isActive: true }, // Only active shows
  orderBy: { createdDate: 'desc' },
});
```

**Load shots separately when needed:**
```typescript
// app/api/shots/route.ts?showId=xxx&page=1&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const showId = searchParams.get('showId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;

  const [shots, total] = await prisma.$transaction([
    prisma.shot.findMany({
      where: showId ? { showId } : {},
      select: {
        id: true,
        shotName: true,
        shotTag: true,
        episode: true,
        sequence: true,
        turnover: true,
        _count: { select: { tasks: true } }
        // Don't include tasks here - load separately
      },
      skip,
      take: limit,
      orderBy: { createdDate: 'desc' },
    }),
    prisma.shot.count({ where: showId ? { showId } : {} })
  ]);

  return NextResponse.json({ shots, total, page, limit });
}
```

**Expected Result:**
- API responses go from 5MB → 50KB
- Response time from 3000ms → 100ms

---

### 1.4 Add API Route Caching 💾

**Add to ALL GET routes:**

```typescript
// app/api/shows/route.ts
export const revalidate = 30; // Cache for 30 seconds

export async function GET() {
  // ... existing code ...
  
  return NextResponse.json(shows, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
```

**For frequently accessed endpoints:**
- `/api/shows` → Cache 60 seconds
- `/api/shots` → Cache 30 seconds
- `/api/tasks` → Cache 10 seconds (more dynamic)
- `/api/status-options` → Cache 300 seconds (rarely changes)
- `/api/departments` → Cache 300 seconds

**Expected Result:**
- Repeated requests served instantly from cache
- Reduced database load by 80%

---

## 🎯 PHASE 2: REACT QUERY OPTIMIZATION (2-3 Hours)

### 2.1 Replace Zustand Fetches with React Query

**Why React Query?**
- ✅ Automatic caching
- ✅ Background refetching
- ✅ Stale-while-revalidate
- ✅ Request deduplication
- ✅ Optimistic updates

**Setup Provider:**

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // Data fresh for 30 seconds
        gcTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Use in Components:**

```typescript
// components/TrackerTable.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function TrackerTable() {
  const queryClient = useQueryClient();

  // Fetch shows with automatic caching
  const { data: shows, isLoading } = useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      const res = await fetch('/api/shows');
      return res.json();
    },
    staleTime: 60 * 1000, // Fresh for 1 minute
  });

  // Update task with optimistic update
  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onMutate: async (newTask) => {
      // Optimistic update - UI updates immediately
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData(['tasks']);
      
      queryClient.setQueryData(['tasks'], (old: any) => {
        // Update task in cache immediately
        return old.map((task: any) => 
          task.id === newTask.id ? { ...task, status: newTask.status } : task
        );
      });
      
      return { previous };
    },
    onError: (err, newTask, context) => {
      // Rollback on error
      queryClient.setQueryData(['tasks'], context?.previous);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    // ... UI code ...
  );
}
```

**Expected Result:**
- Zero loading states on cached data
- Instant UI updates with optimistic rendering
- Automatic background sync

---

## 🎯 PHASE 3: ADVANCED OPTIMIZATIONS (4-6 Hours)

### 3.1 Implement Virtual Scrolling

**Problem:** Rendering 1000+ shots/tasks causes lag.

**Solution:** Use `@tanstack/react-virtual` (already installed!)

```typescript
// components/TrackerTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function TrackerTable({ shots }: { shots: Shot[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: shots.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Row height in pixels
    overscan: 10, // Render 10 extra rows for smooth scrolling
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const shot = shots[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Render shot row */}
              <ShotRow shot={shot} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Expected Result:**
- Render 10,000 rows without lag
- 60fps scrolling
- Memory usage reduced by 90%

---

### 3.2 Implement Server-Side Filtering

**Move filtering to database instead of client:**

```typescript
// app/api/shots/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const where: any = {};
  
  // Apply filters on server
  if (searchParams.get('showId')) {
    where.showId = searchParams.get('showId');
  }
  if (searchParams.get('shotTag')) {
    where.shotTag = searchParams.get('shotTag');
  }
  if (searchParams.get('episode')) {
    where.episode = searchParams.get('episode');
  }
  if (searchParams.get('status')) {
    where.tasks = {
      some: { status: searchParams.get('status') }
    };
  }

  const shots = await prisma.shot.findMany({
    where,
    take: 100, // Limit results
  });

  return NextResponse.json(shots);
}
```

**Expected Result:**
- Client receives only filtered data
- 100 rows instead of 10,000
- 50x faster

---

### 3.3 Implement Incremental Static Regeneration (ISR)

**For static data like status options, departments:**

```typescript
// app/api/status-options/route.ts
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const statusOptions = await prisma.statusOption.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json(statusOptions, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
```

**Expected Result:**
- Instant loading of static data
- No database hits for repeated requests

---

### 3.4 Add Redis Caching (Optional - Production Only)

**For Vercel with Upstash Redis:**

```bash
npm install @upstash/redis
```

```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// app/api/shows/route.ts
import { redis } from '@/lib/redis';

export async function GET() {
  // Try cache first
  const cached = await redis.get('shows:all');
  if (cached) {
    return NextResponse.json(cached);
  }

  // Cache miss - fetch from DB
  const shows = await prisma.show.findMany({ /* ... */ });
  
  // Cache for 60 seconds
  await redis.setex('shows:all', 60, JSON.stringify(shows));
  
  return NextResponse.json(shows);
}
```

**Expected Result:**
- 1ms response time (from Redis)
- Shared cache across all serverless functions

---

## 🎯 PHASE 4: DEPLOYMENT OPTIMIZATIONS (1 Hour)

### 4.1 Vercel Configuration

**Update `vercel.json`:**

```json
{
  "buildCommand": "prisma generate && next build",
  "framework": "nextjs",
  "regions": ["sin1"],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 10,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, s-maxage=30, stale-while-revalidate=60"
        }
      ]
    }
  ]
}
```

### 4.2 Database Connection Pooling

**Update Prisma for Supabase:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Pooler URL
  directUrl = env("DIRECT_URL")  // Direct connection
}
```

**Add to `.env.production`:**
```
DATABASE_URL="postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://...@db....supabase.co:5432/postgres"
```

---

## 📊 PERFORMANCE TARGETS

### Current (Slow):
- ⏱️ Initial page load: 3-5 seconds
- ⏱️ Status update: 2-3 seconds
- ⏱️ Filter change: 1-2 seconds
- 🔄 Real-time updates: None (manual refresh)

### After Phase 1 (2 hours):
- ⏱️ Initial page load: 1-2 seconds ✅
- ⏱️ Status update: 500ms ✅
- ⏱️ Filter change: 500ms ✅
- 🔄 Real-time updates: < 1 second ✅

### After Phase 2 (4 hours):
- ⏱️ Initial page load: 500ms ✅
- ⏱️ Status update: Instant (optimistic) ✅
- ⏱️ Filter change: Instant (cached) ✅
- 🔄 Real-time updates: < 200ms ✅

### After Phase 3 (10 hours):
- ⏱️ Initial page load: 200ms ✅
- ⏱️ Status update: Instant ✅
- ⏱️ Filter change: Instant ✅
- 🔄 Real-time updates: < 100ms ✅
- 🚀 10,000 rows: Smooth 60fps ✅

---

## 🚀 QUICK START - DO THIS NOW

**30-Minute Quick Wins:**

1. **Add Database Indexes** (10 min)
   ```bash
   # Add indexes to prisma/schema.prisma as shown above
   npx prisma migrate dev --name add_indexes
   git push
   ```

2. **Add API Caching** (10 min)
   ```typescript
   // Add to all GET routes
   export const revalidate = 30;
   ```

3. **Enable Supabase Realtime** (10 min)
   ```typescript
   // Add broadcast calls to mutation routes
   await supabase.channel('db-changes').send({
     type: 'broadcast',
     event: 'data-update',
     payload: { id }
   });
   ```

**Deploy and test - you'll see 3-5x speed improvement immediately!**

---

## 📈 MONITORING

**Add performance monitoring:**

```typescript
// lib/performance.ts
export function measurePerformance(name: string) {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
      
      // Send to analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'timing_complete', {
          name,
          value: Math.round(duration),
        });
      }
    }
  };
}

// Usage
const perf = measurePerformance('fetch-shows');
const shows = await fetch('/api/shows');
perf.end();
```

---

## 🎯 PRIORITY ORDER

1. **CRITICAL (Do Today):**
   - Add database indexes
   - Add API response caching
   - Enable Supabase broadcasts

2. **HIGH (This Week):**
   - Optimize API queries (selective loading)
   - Implement React Query
   - Add server-side filtering

3. **MEDIUM (Next Week):**
   - Virtual scrolling
   - ISR for static data
   - Connection pooling

4. **NICE TO HAVE:**
   - Redis caching
   - CDN for assets
   - Service worker caching

---

## 🔧 TESTING CHECKLIST

After each phase, test:
- [ ] Initial page load time
- [ ] Status update speed
- [ ] Filter application speed
- [ ] Real-time update latency
- [ ] Memory usage (Chrome DevTools)
- [ ] Network waterfall (Chrome DevTools)
- [ ] Lighthouse score (should be 90+)
- [ ] Multiple users simultaneously

---

## 📚 RESOURCES

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Prisma Query Optimization](https://www.prisma.io/docs/guides/performance-and-optimization)
- [React Query Performance](https://tanstack.com/query/latest/docs/react/guides/performance)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Vercel Edge Caching](https://vercel.com/docs/edge-network/caching)

---

**Want me to implement any of these optimizations right now? I can start with the database indexes and Supabase broadcasts for instant results! 🚀**
