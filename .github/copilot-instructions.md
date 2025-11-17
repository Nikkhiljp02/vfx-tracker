# VFX Tracker - AI Agent Instructions

## Project Overview
Enterprise-grade VFX production tracking system built with Next.js 16 (App Router), NextAuth v5, Prisma ORM, PostgreSQL (Supabase), and Zustand state management. Supports real-time collaboration, role-based access control (RBAC), PWA capabilities, automated delivery scheduling, activity logging with undo, and advanced caching strategies.

**Last Updated:** November 14, 2025
**Version:** 0.1.0

## Tech Stack Architecture

### Core Framework
- **Next.js 16.0.1** with App Router (not Pages Router)
- **React 19.2.0** with Server/Client Components pattern
- **TypeScript 5** with strict mode enabled
- **Tailwind CSS v4** for styling (using PostCSS)
- **PowerShell v5.1** as default shell (Windows environment)

### Database & ORM
- **Prisma 6.19.0** with PostgreSQL (via Supabase)
- **Supabase** for real-time subscriptions and PostgreSQL hosting
- Database file: `prisma/schema.prisma` (306 lines, 14 models)
- Connection pooling via `DATABASE_URL` and direct connection via `DIRECT_URL`
- Always run `npx prisma generate` after schema changes
- Migrations: `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (production)

### State Management
- **Zustand 5.0.8** (`lib/store.ts` - 324 lines) - Global state for shows, shots, tasks, filters, selections, pagination
- Key pattern: `const { shows, filters, setShows } = useVFXStore()`
- Store includes optimistic updates with API fallback
- Preferences stored in DB (`UserPreferences` model) and synced to Zustand
- Selection state for bulk operations (multi-shot selection)

### Authentication & Authorization
- **NextAuth v5.0.0-beta.30** with Credentials provider
- Session handling: `lib/auth.ts` (103 lines) - exports `auth()`, `signIn()`, `signOut()`
- Middleware: `middleware.ts` (42 lines) - protects all routes except `/login` and `/api/auth/*`
- User roles: `ADMIN`, `COORDINATOR`, `PRODUCTION COORDINATOR`, `MANAGER`, `PRODUCER`, `DEPARTMENT`, `VIEWER`
- Granular permissions via `UserPermission` and `ShowAccess` models
- Permission check pattern: Query `ShowAccess` for `canEdit` flag per show
- JWT-based sessions with custom callbacks for role/user data

### Caching & Performance
- **Custom Memory Cache** (`lib/cache.ts` - 189 lines) - Client-side caching with TTL and stale-while-revalidate
- **Pagination Utilities** (`lib/pagination.ts` - 74 lines) - Offset-based and cursor-based pagination
- Cache invalidation patterns for entity updates (show, shot, task)
- API route caching with configurable TTL values
- Optimized Prisma queries with selective includes

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
- **Client-side**: Fetch from `/api/*` routes, update Zustand store with error handling
- **Server-side**: Direct Prisma queries in Server Components (no API routes)
- **Real-time**: Supabase subscriptions (see `lib/supabase.ts`, `createRealtimeChannel()`)
- **Caching**: Use `fetchWithCache()` from `lib/cache.ts` for cached API calls
- **Never** fetch from components - use store or API routes
- Pagination support: Both offset-based (page numbers) and cursor-based (infinite scroll)

### Permission Checks (CRITICAL)
```typescript
// API route pattern - ALWAYS implement this
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const user = session.user as any;
// Check for admin or coordinator roles (full access)
const isAdminOrCoordinator = user.role === 'ADMIN' || 
                              user.role === 'COORDINATOR' || 
                              user.role === 'PRODUCTION COORDINATOR' ||
                              user.role?.toUpperCase().includes('COORDINATOR');

if (!isAdminOrCoordinator) {
  // For non-admins, check ShowAccess for canEdit permission
  const hasAccess = await prisma.showAccess.findFirst({
    where: { userId: user.id, showId, canEdit: true }
  });
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

### Excel Import/Export
- Import: `components/ImportPreviewModal.tsx` - Uses `xlsx` library (v0.18.5)
- Export: `lib/excel.ts` - Uses `exceljs` library (v4.4.0) for styled exports
- Template: Download template from UI, column mapping in import handler
- Email delivery: `nodemailer` for sending delivery lists as Excel attachments

## Key Features to Understand

### Shot Ingest (Bulk Import)
- Excel template: One shot can span multiple rows (one per department task)
- Show must pre-exist in database
- Shot name must be unique per show
- Supports: Episode, Sequence, Turnover, Frames, Shot Tag, Scope of Work
- See: `SHOT_INGEST_GUIDE.md`, `app/api/shots/ingest/route.ts`

### Activity Logging with Undo
- Auto-logged on all mutations (CREATE, UPDATE, DELETE)
- Stores old/new values as JSON strings
- Full entity data backup for DELETE operations
- Undo functionality: Reverse changes via `ActivityLog.fullEntityData`
- Paginated activity logs with filtering by entity type/ID
- See: `app/api/activity-logs/**`, `components/ActivityLogModal.tsx`, `components/PaginatedActivityLogs.tsx`

### Delivery Scheduling (Automated)
- Automated email delivery lists via `DeliverySchedule` model
- Schedule types: ONE_TIME or DAILY
- Date options: today, upcoming, specific date, custom range
- Scheduled jobs: Check `scheduledTime` (IST timezone) against current time
- Execution tracking via `ScheduleExecutionLog` model
- Send directly or save as draft
- See: `components/DeliveryScheduler.tsx`, `DELIVERY_TRACKING_GUIDE.md`, `app/api/deliveries/**`

### Shot Notes with Mentions & Notifications
- `@user` and `@dept` mentions parsed from content
- Stored as JSON in `ShotNote.mentions`: `[{"type":"user","name":"John"},{"type":"dept","name":"PAINT"}]`
- Creates `Notification` records for mentioned users
- Real-time notification bell with unread count
- Attachment support (stored as JSON array)
- See: `components/MentionInput.tsx`, `components/ShotChatPanel.tsx`, `components/NotificationBell.tsx`, `app/api/shot-notes/**`

### PWA Configuration (Progressive Web App)
- `next-pwa` package (v5.6.0) configured in `next.config.ts`
- Manifest: `public/manifest.json`
- Icons: `public/icon-192.png`, `public/icon-512.png`, SVG variants
- Service worker: Auto-generated, disabled in development
- Mobile-first responsive design with dedicated mobile views
- Install prompt support for iOS/Android
- Offline capability (coming soon)

### Bulk Operations
- Multi-shot selection mode in tracker table
- Bulk delete with confirmation modal
- Bulk task updates across multiple shots
- Selection state managed in Zustand store
- See: `components/BulkActionsBar.tsx`, `components/DeleteConfirmationModal.tsx`, `app/api/shots/bulk-delete/route.ts`, `app/api/tasks/bulk-update/route.ts`

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

1. **Don't query Prisma in client components** - Use API routes instead
2. **Don't use `&&` in PowerShell commands** - Use `;` instead (Windows shell)
3. **Don't forget `'use client'` directive** - Required for components with hooks/events/interactivity
4. **Don't modify `ShowAccess` without cascading permission checks** - Users may lose access unexpectedly
5. **Always parse JSON fields** from DB: `JSON.parse(show.departments)` before using
6. **Check `isInternal` flag** when grouping tasks by department (Int Paint vs Paint)
7. **Use absolute paths** in imports: `@/lib/...`, `@/components/...` (configured in tsconfig.json)
8. **Always await `auth()`** in API routes before accessing session data
9. **Don't forget to invalidate cache** after mutations - Use `invalidateEntityCache()` from `lib/cache.ts`
10. **Always include error handling** in API routes with appropriate status codes
11. **Check role variations** - Include 'PRODUCTION COORDINATOR' and case-insensitive role checks
12. **Validate input** before database operations - Prevent SQL injection and data corruption
13. **Use transactions** for multi-step database operations - Ensure data consistency
14. **Always return NextResponse** from API route handlers - Don't use plain Response objects
15. **Test permission checks** thoroughly - Security-critical for multi-tenant access control

## Critical Security Considerations

### Authentication
- Sessions are JWT-based with server-side validation
- Passwords hashed with bcryptjs (salt rounds: 10)
- No password reset flow implemented yet (TODO)
- Session tokens stored in HTTP-only cookies

### Authorization
- Role-based access control (RBAC) with 7 roles
- Show-level access control via `ShowAccess` table
- Permission granularity via `UserPermission` model
- Always check `canEdit` flag for non-admin users
- API routes must verify permissions before mutations

### Data Validation
- Input validation on all API routes
- TypeScript type safety throughout
- Prisma schema constraints (unique, required fields)
- XSS prevention via React's built-in escaping

### API Security
- All routes protected by middleware (except `/login`, `/api/auth/*`, `/api/setup`)
- CORS not configured (same-origin only)
- Rate limiting not implemented (TODO for production)
- SQL injection prevented by Prisma ORM

## Useful File References

### Core Application Files
- **Main tracker table**: `components/TrackerTable.tsx` (2364 lines) - Primary UI component
- **Mobile view**: `components/MobileCardView.tsx` - Responsive mobile layout
- **Type definitions**: `lib/types.ts` (131 lines) - TypeScript interfaces
- **Utilities**: `lib/utils.ts` (167 lines) - `transformToTrackerRows()`, date formatting, unique value extraction
- **Auth config**: `lib/auth.ts` (103 lines) - JWT callbacks, session handling, bcrypt password verification
- **Store**: `lib/store.ts` (324 lines) - Zustand setup with persistence and cache integration
- **Prisma client**: `lib/prisma.ts` (24 lines) - Singleton instance with connection pooling

### API Routes (34 total)
- **Shows**: `app/api/shows/route.ts`, `app/api/shows/[id]/route.ts`
- **Shots**: `app/api/shots/route.ts`, `app/api/shots/[id]/route.ts`, `app/api/shots/bulk-delete/route.ts`, `app/api/shots/ingest/route.ts`
- **Tasks**: `app/api/tasks/route.ts`, `app/api/tasks/[id]/route.ts`, `app/api/tasks/bulk-update/route.ts`
- **Activity Logs**: `app/api/activity-logs/route.ts`, `app/api/activity-logs/paginated/route.ts`, `app/api/activity-logs/[id]/undo/route.ts`
- **Deliveries**: `app/api/deliveries/export/route.ts`, `app/api/deliveries/schedule/**`
- **Users**: `app/api/users/route.ts`, `app/api/users/[id]/route.ts`
- **Shot Notes**: `app/api/shot-notes/route.ts`, `app/api/shot-notes/[id]/route.ts`
- **Notifications**: `app/api/notifications/route.ts`
- **Preferences**: `app/api/preferences/route.ts`
- **Permissions**: `app/api/permissions/route.ts`, `app/api/seed-permissions/route.ts`
- **Status/Departments**: `app/api/status-options/**`, `app/api/departments/**`
- **Setup/Migration**: `app/api/setup/route.ts`, `app/api/migrate/route.ts`

### Components (27 total)
- **Modals**: `NewShotModal.tsx`, `NewShowModal.tsx`, `DeleteConfirmationModal.tsx`, `StatusManagementModal.tsx`, `ImportPreviewModal.tsx`, `SendDeliveryListModal.tsx`, `ActivityLogModal.tsx`
- **UI Elements**: `Header.tsx`, `FilterPanel.tsx`, `TaskCell.tsx`, `BulkActionsBar.tsx`, `NotificationBell.tsx`, `UpcomingDeliveriesWidget.tsx`
- **Mobile**: `MobileCardView.tsx`, `MobileFilterDrawer.tsx`, `MobileNav.tsx`
- **Views**: `DashboardView.tsx`, `DeliveryView.tsx`, `DepartmentView.tsx`
- **Advanced**: `VirtualTrackerTable.tsx` (virtualization), `PaginatedActivityLogs.tsx`, `DeliveryScheduler.tsx`, `ShotChatPanel.tsx`, `LazyShotNotes.tsx`, `MentionInput.tsx`
- **Utilities**: `ErrorBoundary.tsx`, `SessionProvider.tsx`

### Documentation Files
- **Getting Started**: `START_HERE.md`, `GETTING_STARTED.md`, `README.md`
- **Feature Guides**: `SHOT_INGEST_GUIDE.md`, `DELIVERY_TRACKING_GUIDE.md`, `SHOT_NOTES_FEATURE.md`, `USER_MENTIONS_NOTIFICATIONS.md`, `PWA_MOBILE_GUIDE.md`, `PRODUCTIVITY_FEATURES.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`, `DEPLOYMENT.md`, `DEPLOY_NOW.md`, `DEPLOYMENT_FAQ.md`, `SETUP_REQUIREMENTS.md`
- **Technical**: `ACTIVITY_LOG_ADVANCED.md`, `ACTIVITY_LOG_SETUP.md`, `SUPABASE_REALTIME_SETUP.md`, `PERFORMANCE_OPTIMIZATION.md`, `OPTIMIZATION_README.md`
- **Completion Reports**: `PHASE4_COMPLETE.md`, `SETUP_COMPLETE.md`, `PERMISSION_FIX_COMPLETE.md`, `PERMISSION_FIX_SUMMARY.md`, `FINAL_PERMISSION_FIX.md`, `DELIVERY_EXPORT_UPDATE.md`

### Configuration Files
- **Next.js**: `next.config.ts` (PWA configuration)
- **TypeScript**: `tsconfig.json` (strict mode, path aliases)
- **Prisma**: `prisma/schema.prisma` (14 models), `prisma.config.ts`, `prisma/seed.ts`
- **ESLint**: `eslint.config.mjs`
- **PostCSS**: `postcss.config.mjs`
- **Tailwind**: Embedded in PostCSS v4
- **Environment**: `.env` (DATABASE_URL, NEXTAUTH_SECRET, Supabase keys, Email config)
- **Deployment**: `vercel.json` (Vercel configuration)

## Testing Locally

### Initial Setup
1. Install dependencies: `npm install`
2. Configure environment variables in `.env` file
3. Ensure Prisma schema synced: `npx prisma generate`
4. Apply migrations: `npx prisma migrate dev`
5. Seed initial data: `npx prisma db seed` (creates admin user)

### Development Server
1. Start dev server: `npm run dev` (runs on `http://localhost:3000`)
2. Open Prisma Studio: `npx prisma studio` (database GUI on `http://localhost:5555`)
3. Login with default credentials: username `admin`, password `admin123`
4. Test on mobile: Use network IP (e.g., `http://192.168.1.100:3000`)

### Testing Checklist
- ✅ Authentication flow (login/logout)
- ✅ Role-based access (ADMIN, COORDINATOR, VIEWER)
- ✅ Show creation and management
- ✅ Shot creation with tasks
- ✅ Bulk operations (multi-select, delete)
- ✅ Excel import/export
- ✅ Delivery scheduling
- ✅ Shot notes with mentions
- ✅ Activity logging and undo
- ✅ Real-time updates (Supabase)
- ✅ Mobile responsiveness
- ✅ PWA installation (production only)

### Debugging
- Check browser console for client errors
- Check terminal logs for server/API errors
- Use Prisma Studio to inspect database state
- Check Network tab for API responses
- Verify environment variables are set correctly
- Check middleware logs for auth issues

## Production Readiness Assessment

### ✅ Implemented Features
- Complete CRUD operations for Shows, Shots, Tasks
- Role-based access control with granular permissions
- Activity logging with undo capability
- Real-time collaboration via Supabase
- Bulk operations (delete, update)
- Excel import/export with styled formatting
- Automated delivery scheduling
- Shot notes with @mentions
- Notification system
- PWA support for mobile
- Advanced caching strategies
- Pagination (offset and cursor-based)
- Mobile-responsive UI
- Multiple workspace versions (v01, v02, v03)

### ⚠️ Areas for Improvement (Major Updates Needed)

#### 1. Security Enhancements
- **Password Reset Flow**: No password recovery mechanism (CRITICAL)
- **Rate Limiting**: No API rate limiting implemented
- **CSRF Protection**: Should implement CSRF tokens for state-changing operations
- **Session Timeout**: No automatic session expiration handling
- **2FA Support**: Multi-factor authentication not implemented
- **Audit Trail**: Activity logs lack IP addresses and device info
- **File Upload Security**: No file upload validation for attachments

#### 2. Performance Optimizations
- **Database Indexing**: Review and optimize indexes for frequently queried fields
- **Query Optimization**: Some N+1 query patterns detected in nested includes
- **Image Optimization**: No image CDN or optimization for attachments
- **Bundle Size**: Consider code splitting for large components (TrackerTable.tsx 2364 lines)
- **Server-Side Rendering**: Evaluate SSR vs CSR for initial page loads
- **Database Connection Pooling**: Optimize for serverless environments

#### 3. Error Handling & Monitoring
- **Global Error Boundary**: Implemented but could be more comprehensive
- **Error Logging Service**: No integration with Sentry/LogRocket
- **API Error Standardization**: Inconsistent error response formats
- **Retry Logic**: No automatic retry for failed API calls
- **Offline Support**: PWA installed but offline functionality incomplete

#### 4. Testing & Quality Assurance
- **Unit Tests**: No test files found (Jest/Vitest recommended)
- **Integration Tests**: No API route tests
- **E2E Tests**: No Playwright/Cypress tests
- **Type Coverage**: Some `any` types in session handling
- **Code Coverage**: No coverage reporting configured

#### 5. Data Validation & Integrity
- **Input Sanitization**: Basic validation but no comprehensive schema validation (consider Zod)
- **Date Timezone Handling**: Mixed timezone handling (IST hardcoded in some places)
- **Data Migration**: No rollback strategy for failed migrations
- **Backup Strategy**: No automated database backup solution documented

#### 6. User Experience Enhancements
- **Loading Skeletons**: Inconsistent loading states across components
- **Optimistic UI Updates**: Partially implemented, needs consistency
- **Keyboard Shortcuts**: Not implemented for power users
- **Accessibility**: No ARIA labels or keyboard navigation in tables
- **Dark Mode**: Theme preference in DB but not fully implemented
- **Internationalization**: No i18n support for multiple languages

#### 7. DevOps & Infrastructure
- **CI/CD Pipeline**: No GitHub Actions or automated testing
- **Environment Validation**: Basic check-env endpoint but no comprehensive validation
- **Database Migrations**: Manual process, needs automation
- **Logging Strategy**: Console logs only, no structured logging
- **Health Checks**: No /health endpoint for monitoring
- **Performance Monitoring**: No APM integration

#### 8. Documentation Gaps
- **API Documentation**: No OpenAPI/Swagger spec
- **Component Storybook**: No visual component documentation
- **Architecture Diagrams**: No system architecture visuals
- **Onboarding Guide**: Documentation exists but needs user-facing guide
- **Change Log**: No CHANGELOG.md for version tracking

#### 9. Code Quality Issues Found
- **TODO Comments**: 3 TODO items in codebase (TrackerTable.tsx, DepartmentView.tsx, bulk-update route)
- **Commented Code**: Some debug logs left in production code
- **Magic Numbers**: Hardcoded values (e.g., pageSize: 50, cache TTL: 5 minutes)
- **Component Size**: TrackerTable.tsx is 2364 lines (needs refactoring)
- **Duplicate Logic**: Permission check logic repeated across API routes

#### 10. Feature Completions Needed
- **Search Functionality**: Basic shot name search exists, needs advanced search
- **Export Formats**: Only Excel, consider PDF/CSV
- **Batch Import**: Shot ingest exists, but no batch user import
- **Email Templates**: Plain emails, needs branded HTML templates
- **Notification Preferences**: No user control over notification types
- **Version Control**: Shot versions mentioned but not fully implemented
- **Dependencies**: Task dependencies field exists but UI not implemented
- **Bidding**: Bid MDs field exists but no bidding workflow

## Recommended Major Updates Roadmap

### Phase 1: Security & Stability (CRITICAL)
**Priority: IMMEDIATE**
1. Implement password reset flow with email verification
2. Add rate limiting to API routes (express-rate-limit or similar)
3. Implement CSRF protection for mutations
4. Add session timeout and auto-logout
5. Enhance error logging with Sentry integration
6. Add comprehensive input validation with Zod schemas
7. Implement file upload validation and scanning
8. Add security headers (helmet.js or Next.js config)

### Phase 2: Testing & Quality (HIGH PRIORITY)
**Priority: 1-2 weeks**
1. Set up Jest/Vitest for unit testing
2. Write tests for all API routes
3. Implement E2E tests with Playwright
4. Add code coverage reporting (>80% target)
5. Set up ESLint rules stricter enforcement
6. Implement pre-commit hooks (Husky)
7. Add TypeScript strict mode fixes (eliminate `any` types)

### Phase 3: Performance & Scalability (HIGH PRIORITY)
**Priority: 2-3 weeks**
1. Optimize database indexes (analyze slow queries)
2. Implement proper database connection pooling for serverless
3. Refactor large components (split TrackerTable.tsx)
4. Add code splitting and lazy loading
5. Implement React Query for better cache management
6. Optimize Prisma queries (reduce N+1 patterns)
7. Add Redis caching layer for API responses
8. Implement CDN for static assets

### Phase 4: User Experience (MEDIUM PRIORITY)
**Priority: 3-4 weeks**
1. Implement dark mode fully
2. Add keyboard shortcuts for power users
3. Improve accessibility (WCAG 2.1 AA compliance)
4. Add loading skeletons consistently
5. Implement advanced search with filters
6. Add user notification preferences
7. Implement proper offline mode for PWA
8. Add internationalization (i18n) support

### Phase 5: DevOps & Monitoring (MEDIUM PRIORITY)
**Priority: 4-5 weeks**
1. Set up GitHub Actions CI/CD pipeline
2. Implement automated database backups
3. Add application performance monitoring (APM)
4. Create /health endpoint for monitoring
5. Implement structured logging (Winston/Pino)
6. Add environment validation on startup
7. Set up staging environment
8. Document deployment runbooks

### Phase 6: Feature Completions (LOW PRIORITY)
**Priority: Ongoing**
1. Complete task dependencies UI workflow
2. Implement bidding workflow and approval
3. Add PDF export option for deliveries
4. Create batch user import functionality
5. Implement email HTML templates
6. Complete shot versioning system
7. Add bulk edit for show settings
8. Implement custom status workflows

### Phase 7: Code Quality & Refactoring (ONGOING)
**Priority: Continuous**
1. Resolve all TODO comments in codebase
2. Refactor permission check logic into middleware/utility
3. Create reusable API response utilities
4. Extract magic numbers to constants
5. Split large components into smaller pieces
6. Standardize error response formats
7. Document all API routes (OpenAPI spec)
8. Create component library with Storybook

## Migration Considerations for Major Updates

### Database Schema Changes
- Always create reversible migrations
- Test migrations on copy of production data
- Plan for zero-downtime deployments
- Consider using database triggers for complex validations
- Implement soft deletes instead of hard deletes where appropriate

### Breaking Changes Strategy
- Version API endpoints if changing contracts
- Maintain backward compatibility for 2 versions
- Communicate breaking changes to all users
- Provide migration scripts for data transformation
- Use feature flags for gradual rollouts

### Data Migration Best Practices
- Always backup before major migrations
- Test rollback procedures
- Monitor migration performance
- Implement batch processing for large datasets
- Validate data integrity post-migration

## Quick Reference Commands

### Development
```powershell
npm run dev                              # Start development server
npx prisma studio                        # Open database GUI
npx prisma migrate dev --name <name>     # Create new migration
npx prisma generate                      # Regenerate Prisma client
npx prisma db seed                       # Seed database
```

### Production
```powershell
npm run build                            # Build for production (runs migrations)
npm run start                            # Start production server
npx prisma migrate deploy                # Apply migrations (production)
```

### Database
```powershell
npx prisma db push                       # Push schema without migration (dev only)
npx prisma migrate reset                 # Reset database (WARNING: deletes data)
npx prisma migrate status                # Check migration status
```

### Debugging
```powershell
# Check environment variables
node -e "console.log(process.env.DATABASE_URL)"

# Test database connection
npx prisma db execute --stdin < test.sql

# Check Next.js build info
npm run build -- --debug
```

---

**Last Updated**: November 14, 2025  
**Status**: Production-ready with recommended improvements  
**Maintainer**: VFX Tracker Development Team

**Remember**: This is a production-ready VFX tracking system with room for enterprise-grade improvements. Prioritize security and testing before adding new features. Always test locally, use migrations for schema changes, and maintain backward compatibility.
