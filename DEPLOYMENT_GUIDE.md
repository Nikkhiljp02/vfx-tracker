# VFX Tracker - Vercel + Supabase Deployment Guide

## 📋 Pre-Deployment Checklist

### Current Setup Analysis
- ✅ **Framework**: Next.js 16.0.1 with App Router
- ✅ **Build Config**: vercel.json configured correctly
- ⚠️ **Database**: SQLite (needs migration to PostgreSQL)
- ⚠️ **Email**: Outlook COM automation (Windows-only, needs production alternative)
- ⚠️ **Auth**: NextAuth v5 (needs production secret)

---

## 🎯 Deployment Strategy Overview

### Phase 1: Database Migration (SQLite → PostgreSQL)
### Phase 2: Supabase Setup
### Phase 3: Environment Variables Configuration
### Phase 4: Code Updates for Production
### Phase 5: Vercel Deployment
### Phase 6: Testing & Validation

---

## 📦 Phase 1: Database Migration

### 1.1 Export Current Data

**Option A: Using Prisma Studio (Recommended)**
```powershell
# Open Prisma Studio
npx prisma studio

# Manually export data from each table or use the export feature
```

**Option B: Using SQLite Command Line**
```powershell
# Export data to SQL file
sqlite3 prisma/dev.db .dump > backup.sql
```

**Option C: Using Prisma Seed Script**
Your current schema likely has seed data. We'll use this after migrating.

### 1.2 Update Prisma Schema

**File**: `prisma/schema.prisma`

**Change:**
```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Important Schema Changes for PostgreSQL:**
- SQLite uses `@default(cuid())` - PostgreSQL supports this ✅
- SQLite uses `DateTime @default(now())` - PostgreSQL supports this ✅
- Check for any SQLite-specific types (your schema looks clean)

---

## 🐘 Phase 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with GitHub (recommended for Vercel integration)
3. Click **"New Project"**
4. Fill in details:
   - **Name**: `vfx-tracker-prod` (or your preference)
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier works for start, Pro for production

### 2.2 Get Database Connection String

1. In Supabase Dashboard → **Settings** → **Database**
2. Find **Connection String** section
3. Copy **Connection Pooling** string (recommended for serverless):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
   ```
4. **IMPORTANT**: Replace `[YOUR-PASSWORD]` with your actual password
5. For migrations, also copy **Direct connection** string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### 2.3 Configure Connection Pooling (Important for Vercel)

Vercel serverless functions need connection pooling:
- **Use Transaction Mode**: Add `&pgbouncer=true&connection_limit=1` to connection string
- **Prisma Optimization**: Prisma handles pooling well with this setup

---

## 🔐 Phase 3: Environment Variables

### 3.1 Create `.env.local` (Local Development)

Create this file in your project root if it doesn't exist:

```env
# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_SECRET="[GENERATE-RANDOM-SECRET-HERE]"
NEXTAUTH_URL="http://localhost:3000"

# Email Configuration (Production Alternative)
# Option 1: Use a transactional email service
SMTP_HOST="smtp.gmail.com"  # or SendGrid, AWS SES, etc.
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="VFX Tracker <your-email@gmail.com>"

# Option 2: Use Resend (recommended for Vercel)
# RESEND_API_KEY="re_xxxxxxxxxxxxx"

# Optional: Feature Flags
NODE_ENV="development"
```

### 3.2 Generate NextAuth Secret

```powershell
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and use it as `NEXTAUTH_SECRET`

### 3.3 Production Environment Variables (Vercel)

You'll need to add these in Vercel Dashboard (covered in Phase 5):

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
NEXTAUTH_SECRET="[YOUR-PRODUCTION-SECRET]"
NEXTAUTH_URL="https://your-app.vercel.app"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="VFX Tracker <your-email@gmail.com>"
```

---

## 💻 Phase 4: Code Updates for Production

### 4.1 Update Prisma Configuration

**File**: `prisma/schema.prisma`

Add `directUrl` for migrations:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled connection for queries
  directUrl = env("DIRECT_URL")        // Direct connection for migrations
}
```

### 4.2 Update Email Functionality

**Current Issue**: Outlook COM automation only works on Windows with Outlook installed.

**Solution**: Replace with Nodemailer SMTP (already in dependencies!)

**File**: `app/api/deliveries/export/route.ts`

Replace the `sendEmailViaOutlook` function with:

```typescript
async function sendEmailViaSMTP(
  data: any[],
  htmlTable: string,
  excelPath: string,
  date?: string | null,
  fromDate?: string | null,
  toDate?: string | null,
  sendDirectly: boolean = true
): Promise<void> {
  const nodemailer = require('nodemailer');
  const path = require('path');

  // Determine subject line
  let subject = "VFX Delivery List";
  if (date) {
    subject += ` - ${new Date(date).toLocaleDateString()}`;
  } else if (fromDate && toDate) {
    subject += ` - ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
  }

  const excelFileName = path.basename(excelPath);

  // Email body with properly formatted HTML table
  const emailBody = `
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 0;">
  <p style="font-size: 10pt; margin: 10px 0;">Hi Team,</p>
  
  <p style="font-size: 10pt; margin: 10px 0;">
    Please find the VFX delivery list for ${date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : `${new Date(fromDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(toDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} below:
  </p>
  
  ${htmlTable}
</body>
</html>
  `;

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Send email
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: 'nikhil.patil@digikore.com',
    subject: subject,
    html: emailBody,
    attachments: [
      {
        filename: excelFileName,
        path: excelPath,
      },
    ],
  });
}
```

**Update the function call** (around line 130):

```diff
-    await sendEmailViaOutlook(
+    await sendEmailViaSMTP(
      deliveryData,
      htmlTable,
      excelPath,
      date,
      fromDate,
      toDate,
      sendDirectly
    );
```

### 4.3 Set Up Gmail App Password (for SMTP)

If using Gmail for email:

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. **Security** → **2-Step Verification** (enable if not already)
3. **Security** → **App Passwords**
4. Generate new app password for "Mail"
5. Use this password in `SMTP_PASSWORD` environment variable

**Alternative**: Use [Resend](https://resend.com) (recommended for production):
- Free tier: 3,000 emails/month
- Much better deliverability
- Simple API integration

---

## 🚀 Phase 5: Vercel Deployment

### 5.1 Push Code to GitHub

```powershell
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for production deployment"

# Create GitHub repository and push
# (Follow GitHub instructions to create repo and add remote)
git remote add origin https://github.com/YOUR-USERNAME/vfx-tracker.git
git branch -M main
git push -u origin main
```

### 5.2 Connect Vercel to GitHub

1. Go to [https://vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your `vfx-tracker` repository
5. Vercel will auto-detect Next.js

### 5.3 Configure Build Settings

Vercel should detect from `vercel.json`:
- **Framework**: Next.js
- **Build Command**: `prisma generate && next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

✅ These are already configured in your `vercel.json`

### 5.4 Add Environment Variables in Vercel

1. In Vercel project settings → **Environment Variables**
2. Add each variable:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres:...` | Production, Preview |
| `DIRECT_URL` | `postgresql://postgres:...` | Production, Preview |
| `NEXTAUTH_SECRET` | `[your-generated-secret]` | Production, Preview |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Production |
| `SMTP_HOST` | `smtp.gmail.com` | Production, Preview |
| `SMTP_PORT` | `587` | Production, Preview |
| `SMTP_USER` | `your-email@gmail.com` | Production, Preview |
| `SMTP_PASSWORD` | `[your-app-password]` | Production, Preview |
| `SMTP_FROM` | `VFX Tracker <your-email@gmail.com>` | Production, Preview |

**Important**: 
- Use different secrets for Production vs Preview if possible
- Update `NEXTAUTH_URL` after first deployment to your actual Vercel URL

### 5.5 Deploy

1. Click **"Deploy"** in Vercel
2. Wait for build to complete
3. **FIRST BUILD WILL FAIL** - This is expected! (Database tables don't exist yet)

---

## 🗄️ Phase 6: Database Migration & Seeding

### 6.1 Run Migrations on Supabase

**Local Machine:**

```powershell
# Update your .env.local with Supabase connection strings
# Make sure DIRECT_URL is set for migrations

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# If migration succeeds, deploy to production
npx prisma migrate deploy
```

**Alternative: Run via Vercel CLI**

```powershell
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Pull environment variables
vercel env pull .env.production

# Run migration
npx prisma migrate deploy
```

### 6.2 Seed Database

**Option A: Run seed script locally**

```powershell
# Make sure .env.local points to Supabase
npx prisma db seed
```

**Option B: Manually create admin user via Supabase SQL Editor**

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query to create admin user:

```sql
-- Insert admin user (password: "admin123" - CHANGE THIS!)
INSERT INTO users (id, username, password, "firstName", "lastName", email, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'admin-' || gen_random_uuid()::text,
  'admin',
  '$2b$10$YourHashedPasswordHere',  -- Use bcrypt to hash password
  'Admin',
  'User',
  'admin@digikore.com',
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

**To generate bcrypt hash:**
```powershell
node -e "console.log(require('bcrypt').hashSync('YourPassword123', 10))"
```

### 6.3 Verify Database

1. Go to Supabase Dashboard → **Table Editor**
2. Check that all tables exist:
   - users
   - permissions
   - user_permissions
   - show_access
   - sessions
   - shows
   - shots
   - tasks
   - delivery_schedules
   - notes
   - activity_logs

---

## 🧪 Phase 7: Testing & Validation

### 7.1 Redeploy Vercel

After database is set up:

```powershell
# Trigger new deployment
git commit --allow-empty -m "Trigger deployment"
git push
```

Or in Vercel Dashboard: **Deployments** → **Redeploy**

### 7.2 Test Checklist

- [ ] **Authentication**: Can log in with admin user
- [ ] **Shows**: Can create/view/edit shows
- [ ] **Shots**: Can create/view/edit shots
- [ ] **Tasks**: Can create/view/edit tasks
- [ ] **Delivery List**: Can generate delivery list
- [ ] **Email**: Can send delivery list email
- [ ] **Filters**: All filters work
- [ ] **Keyboard Shortcuts**: Ctrl+U, Ctrl+Q work
- [ ] **Permissions**: VIEWER role can only view
- [ ] **Dashboard**: Shows correct task counts

### 7.3 Monitor Errors

1. Vercel Dashboard → **Logs** (check for runtime errors)
2. Supabase Dashboard → **Logs** (check for database errors)
3. Browser Console (check for client-side errors)

---

## 🔧 Troubleshooting

### Issue: "P1001: Can't reach database server"

**Solution**: 
- Check `DATABASE_URL` has correct password
- Verify Supabase project is not paused (free tier pauses after 1 week inactivity)
- Check if connection string uses port `6543` (pooler) not `5432` (direct)

### Issue: "P1017: Server has closed the connection"

**Solution**:
- Use connection pooling: `?pgbouncer=true&connection_limit=1`
- Update to Prisma 6.x (you're already on 6.19.0 ✅)

### Issue: Email not sending

**Solution**:
- Check SMTP credentials are correct
- Verify Gmail App Password is used (not regular password)
- Check Vercel logs for email errors
- Test locally first with `sendDirectly: false`

### Issue: Migration fails with "relation already exists"

**Solution**:
```powershell
# Reset shadow database
npx prisma migrate reset --force

# Redeploy migrations
npx prisma migrate deploy
```

---

## 📊 Post-Deployment Optimization

### 1. Set Up Custom Domain (Optional)

1. Vercel Dashboard → **Settings** → **Domains**
2. Add your domain (e.g., `vfx-tracker.digikore.com`)
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable

### 2. Enable Edge Caching (Optional)

Add to `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};
```

### 3. Set Up Monitoring

**Vercel Analytics:**
- Enable in Vercel Dashboard → **Analytics**
- Free tier includes Web Vitals

**Sentry (Error Tracking):**
```powershell
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 4. Database Backups

Supabase automatically backs up your database:
- Free tier: Daily backups (7 days retention)
- Pro tier: Point-in-time recovery

---

## 🎯 Quick Start Checklist

For a streamlined deployment, follow these steps in order:

### ✅ Prerequisites
- [ ] GitHub account
- [ ] Vercel account (sign in with GitHub)
- [ ] Supabase account (sign in with GitHub)
- [ ] Gmail account with App Password (or Resend account)

### ✅ Database Setup (30 minutes)
- [ ] Create Supabase project
- [ ] Copy Connection Pooling string
- [ ] Copy Direct connection string
- [ ] Update `schema.prisma` to PostgreSQL
- [ ] Add `directUrl` to datasource

### ✅ Code Updates (15 minutes)
- [ ] Replace `sendEmailViaOutlook` with `sendEmailViaSMTP`
- [ ] Test email locally
- [ ] Commit changes to Git

### ✅ GitHub Setup (5 minutes)
- [ ] Create GitHub repository
- [ ] Push code to GitHub

### ✅ Vercel Setup (20 minutes)
- [ ] Import project from GitHub
- [ ] Add all environment variables
- [ ] Deploy (first deployment will fail - expected)

### ✅ Database Migration (10 minutes)
- [ ] Run `npx prisma migrate deploy` locally
- [ ] Create admin user in Supabase
- [ ] Verify tables exist

### ✅ Testing (15 minutes)
- [ ] Redeploy Vercel
- [ ] Test login
- [ ] Test CRUD operations
- [ ] Test email sending

**Total Time: ~2 hours**

---

## 📞 Support Resources

- **Vercel Docs**: [https://vercel.com/docs](https://vercel.com/docs)
- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **Prisma PostgreSQL**: [https://www.prisma.io/docs/concepts/database-connectors/postgresql](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- **NextAuth.js Docs**: [https://next-auth.js.org](https://next-auth.js.org)

---

## 🎉 Success!

Once deployed, your VFX Tracker will be accessible at:
```
https://your-project.vercel.app
```

All features will work:
- ✅ Real-time task tracking
- ✅ Delivery scheduling
- ✅ Email notifications
- ✅ User management
- ✅ Keyboard shortcuts (Ctrl+U, Ctrl+Q)
- ✅ Activity logging
- ✅ Excel exports

Enjoy your production VFX Tracker! 🚀
