# VFX Tracker - AI Agent Instructions

## Project Overview
VFX production tracking system built with Next.js 16 (App Router), NextAuth v5, Prisma ORM, PostgreSQL (Supabase), and Zustand state management. Supports real-time collaboration, role-based access control, PWA capabilities, and automated delivery scheduling.

## Tech Stack Architecture

### Core Framework
- **Next.js 16.0.1** with App Router (not Pages Router)
- **React 19.2.0** with Server/Client Components pattern
- **TypeScript 5** with strict mode
- **Tailwind CSS v4** for styling

### Database & ORM
- **Prisma 6.19.0** with PostgreSQL (via Supabase)
- **Supabase** for real-time subscriptions and PostgreSQL hosting
- Database file: `prisma/schema.prisma` (306 lines, 14 models)
- Always run `prisma generate` after schema changes
- Migrations: `prisma migrate dev` (local) or `prisma migrate deploy` (production)

### State Management
- **Zustand** (`lib/store.ts`) - Global state for shows, shots, tasks, filters, selections
- Key pattern: `const { shows, filters, setShows } = useVFXStore()`
- Store includes optimistic updates with API fallback
- Preferences stored in DB (`UserPreferences` model) and synced to Zustand

### Authentication & Authorization
- **NextAuth v5** (beta) with Credentials provider
- Session handling: `lib/auth.ts` exports `auth()`, `signIn()`, `signOut()`
- Middleware: `middleware.ts` protects all routes except `/login` and `/api/auth/*`
- User roles: `ADMIN`, `COORDINATOR`, `MANAGER`, `PRODUCER`, `DEPARTMENT`, `VIEWER`
- Granular permissions via `UserPermission` and `ShowAccess` models
- Permission check pattern: Query `ShowAccess` for `canEdit` flag per show

## Data Model & Relationships

### Core Entities (Prisma Schema)
```
User (auth + roles)
  ├── ShowAccess (per-show permissions)
  ├── UserPermission (granular permissions)
  └── UserPreferences (saved filters/columns)

Show (projects)
  └── Shot (individual shots)
      ├── Task (department work items)
      ├── ShotNote (comments with @mentions)
      └── parentShot (self-referential for versioning)

Task (per-department work)
  ├── department (Comp, Paint, Roto, MMRA)
  ├── isInternal (boolean - differentiates Int Paint from Paint)
  ├── status (YTS, WIP, Int App, AWF, C APP, C KB, OMIT, HOLD)
  └── ETAs (internalEta, clientEta)

ActivityLog (audit trail with undo capability)
Notification (user mentions, activity alerts)
DeliverySchedule (automated email scheduling)
```

### Key Patterns
- **Departments stored as JSON string** in `Show.departments`: `'["Comp","Paint","Roto","MMRA"]'`
- **TrackerRow**: Flattened type combining Show + Shot + Tasks for table display (`lib/types.ts`)
- **Task grouping**: Internal tasks keyed as `"Int ${department}"` vs plain department name
- **Cascade deletes**: Show → Shots → Tasks (defined in Prisma schema)

## Development Workflows

### Starting the App
```powershell
npm run dev          # Development server (localhost:3000)
npx prisma studio    # Database GUI
npx prisma migrate dev --name description  # Create migration
```

### Default Credentials
- Username: `admin` (not email!)
- Password: `admin123`
- Created via: `prisma/seed.ts`

### Build & Deploy
```powershell
npm run build        # Runs prisma migrate deploy && next build
npm run start        # Production server
```

### API Route Pattern
- All routes in `app/api/**/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Auth check: `const session = await auth(); if (!session) return 401;`
- Permission check for non-admins: Query `ShowAccess` with `canEdit: true`
- Return `NextResponse.json(data)` or `NextResponse.json({ error }, { status })`

## Critical Conventions

### File Organization
- **Server Components**: `app/**/page.tsx` (default, no `'use client'`)
- **Client Components**: `components/*.tsx` (always has `'use client'` directive)
- **API Routes**: `app/api/**/route.ts`
- **Utilities**: `lib/*.ts` (pure functions, no components)

### Component Patterns
1. **Mobile-first responsive**: Use `MobileCardView` + `TrackerTable` pattern (see `components/TrackerTable.tsx`)
2. **Modals**: Separate components (e.g., `NewShotModal`, `DeleteConfirmationModal`)
3. **Toast notifications**: Import from `lib/toast.tsx` - `showSuccess()`, `showError()`, `showUndo()`
4. **Loading states**: Always show loading UI during async operations

### Data Fetching
- **Client-side**: Fetch from `/api/*` routes, update Zustand store
- **Server-side**: Direct Prisma queries in Server Components
- **Real-time**: Supabase subscriptions (see `lib/supabase.ts`, `createRealtimeChannel()`)
- **Never** fetch from components - use store or API routes

### Permission Checks
```typescript
// API route pattern
const user = session.user as any;
if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
  const hasAccess = await prisma.showAccess.findFirst({
    where: { userId: user.id, showId, canEdit: true }
  });
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Excel Import/Export
- Import: `components/ImportPreviewModal.tsx` - Uses `xlsx` library
- Export: `lib/excel.ts` - Uses `exceljs` library for styled exports
- Template: Download template from UI, column mapping in import handler

## Key Features to Understand

### Shot Ingest (Bulk Import)
- Excel template: One shot can span multiple rows (one per department task)
- Show must pre-exist
- Shot name must be unique per show
- See: `SHOT_INGEST_GUIDE.md`, `app/api/shots/ingest/route.ts`

### Activity Logging
- Auto-logged on all mutations (CREATE, UPDATE, DELETE)
- Stores old/new values as JSON
- Undo functionality: Reverse changes via `ActivityLog.fullEntityData`
- See: `app/api/activity-logs/**`

### Delivery Scheduling
- Automated email delivery lists via `DeliverySchedule` model
- Scheduled jobs: Check `scheduledTime` (IST timezone) against current time
- See: `components/DeliveryScheduler.tsx`, `DELIVERY_TRACKING_GUIDE.md`

### Shot Notes with Mentions
- `@user` and `@dept` mentions parsed from content
- Stored as JSON in `ShotNote.mentions`: `[{"type":"user","name":"John"},{"type":"dept","name":"PAINT"}]`
- Creates `Notification` records for mentioned users
- See: `components/MentionInput.tsx`, `app/api/shot-notes/**`

### PWA Configuration
- `next-pwa` package configured in `next.config.ts`
- Manifest: `public/manifest.json`
- Icons: `public/icon-192.svg`, `public/icon-512.svg`
- Disabled in development, enabled in production

## Deployment (Vercel + Supabase)

### Environment Variables Required
```
DATABASE_URL="postgresql://..."          # Supabase connection pooler
DIRECT_URL="postgresql://..."            # Supabase direct connection
NEXTAUTH_SECRET="..."                    # Generate: openssl rand -base64 32
NEXTAUTH_URL="https://your-app.vercel.app"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="app-password"
```

### First Deploy Steps
1. Push to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy (triggers `prisma migrate deploy && next build`)
5. Run seed if needed: Create admin user via `/api/setup` endpoint
6. See: `DEPLOYMENT_GUIDE.md`, `START_HERE.md`

## Common Pitfalls to Avoid

1. **Don't query Prisma in client components** - Use API routes
2. **Don't use `&&` in PowerShell commands** - Use `;` instead
3. **Don't forget `'use client'` directive** for components with hooks/events
4. **Don't modify `ShowAccess` without cascading permission checks** - Users lose access
5. **Always parse JSON fields** from DB: `JSON.parse(show.departments)`
6. **Check `isInternal` flag** when grouping tasks by department
7. **Use absolute paths** in imports: `@/lib/...`, `@/components/...`

## Useful File References

- **Main tracker table**: `components/TrackerTable.tsx` (2364 lines)
- **API routes**: `app/api/{shows,shots,tasks,deliveries}/**/route.ts`
- **Type definitions**: `lib/types.ts` (131 lines)
- **Utilities**: `lib/utils.ts` - `transformToTrackerRows()`, date formatting
- **Auth config**: `lib/auth.ts` - JWT callbacks, session handling
- **Store**: `lib/store.ts` (248 lines) - Zustand setup with persistence
- **Documentation**: `SHOT_INGEST_GUIDE.md`, `DELIVERY_TRACKING_GUIDE.md`, `GETTING_STARTED.md`

## Testing Locally

1. Ensure Prisma schema synced: `npx prisma generate`
2. Apply migrations: `npx prisma migrate dev`
3. Seed data: `npx prisma db seed`
4. Start dev server: `npm run dev`
5. Login with default admin credentials
6. Test on mobile: Use network IP (e.g., `http://192.168.1.100:3000`)

## Need Help?
- Check existing markdown guides first (`*.md` files in root)
- Review API route implementations for patterns
- Use Prisma Studio to inspect database state
- Check browser console for client errors
- Check terminal logs for server/API errors
