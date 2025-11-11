# Deployment FAQ - Common Questions Answered

## ❓ Frequently Asked Questions

### 1️⃣ **How do I push updates after deployment?**

**Answer**: It's automatic! Just push to GitHub:

```powershell
# Make your changes locally
# Test with: npm run dev

# Commit and push
git add .
git commit -m "Updated feature X"
git push origin main

# ✅ Vercel automatically deploys in 2-3 minutes!
```

**What happens:**
1. Vercel detects GitHub push
2. Runs build command: `prisma generate && next build`
3. Deploys to production
4. Sends you email notification
5. Your app is live! 🚀

**Rollback if needed:**
- Go to Vercel Dashboard → Deployments
- Click any previous deployment → "Promote to Production"

---

### 2️⃣ **Will updates affect my existing data?**

**Answer**: No, your data is safe! ✅

| Update Type | Data Impact | Example |
|-------------|-------------|---------|
| **UI Changes** | No impact | Change button colors, layout |
| **Business Logic** | No impact | Update task calculations, filters |
| **API Changes** | No impact | Modify endpoints, add features |
| **Database Schema** | **Requires migration** | Add/remove columns, tables |

**Code vs Data:**
- **Code**: Lives in Vercel (updated on every push)
- **Data**: Lives in Supabase (separate database)
- Updates to code don't touch your data!

**When schema changes (rare):**

```powershell
# Example: Adding a new field to User table

# 1. Update schema.prisma
# 2. Create migration locally
npx prisma migrate dev --name add_user_phone

# 3. Test locally
npm run dev

# 4. Push to GitHub (triggers deployment)
git push

# 5. Run migration on production
npx prisma migrate deploy
```

**Best Practice:**
- Always test schema changes locally first
- Create backups before major schema changes (Supabase does this automatically)
- Use staging environment for risky changes

---

### 3️⃣ **Can multiple users login simultaneously?**

**Answer**: Yes, after cloud deployment! 🎉

**Current Local Setup (SQLite):**
- ❌ Only one user at a time
- ❌ Browser conflicts (Chrome vs Edge)
- ❌ Database locks on writes
- ⚠️ This is a **SQLite limitation**, not your code!

**After Deployment (PostgreSQL on Supabase):**
- ✅ Unlimited concurrent users
- ✅ Multiple browsers per user
- ✅ Real-time sync across all clients
- ✅ Proper connection pooling
- ✅ Team can collaborate simultaneously

**Technical Reason:**
- **SQLite**: File-based database, single-writer mode
- **PostgreSQL**: Client-server database, handles 1000+ concurrent connections

**Example Scenario (After Deployment):**
```
User A (Chrome)    → Editing Shot 001  ✅
User B (Edge)      → Creating Show     ✅
User C (Firefox)   → Sending Delivery  ✅
User A (Phone)     → Viewing Dashboard ✅

All working at the SAME TIME! 🚀
```

---

### 4️⃣ **How does email work for multiple users?**

**Answer**: Updated to use logged-in user's email! ✅

**Before (Fixed!):**
```typescript
// ❌ OLD: Always used hardcoded email
$mail.To = "nikhil.patil@digikore.com"
```

**After (Current):**
```typescript
// ✅ NEW: Uses logged-in user's email from session
const session = await auth();
const userEmail = session.user.email; // Gets from User table

// Send delivery list using THIS user's email
$mail.To = "${userEmail}"
```

**How it works:**

1. **User logs in** → Session created with email from database
2. **User clicks "Send Delivery List"** → API checks session
3. **Gets user's email** → `session.user.email`
4. **Sends via their Outlook** → Uses their email address

**Important Setup:**

When creating user accounts, **email field is REQUIRED**:

```typescript
// In admin panel when creating user
email: "john.doe@digikore.com"  // ✅ Required for sending emails
```

**Example Flow:**
```
Admin creates user "John Doe"
  ↓
Email: john.doe@digikore.com (stored in database)
  ↓
John logs in → Session includes email
  ↓
John sends delivery list → Email sent FROM john.doe@digikore.com
  ↓
Recipients see: "From: john.doe@digikore.com"
```

**For Production (After Deployment):**

You have two options:

**Option A: SMTP (Gmail, Office 365)**
```env
# Each user needs their own email configured
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="john.doe@digikore.com"
SMTP_PASSWORD="app-password-here"
```

**Option B: Service Account (Recommended)**
```env
# Use a shared service account
SMTP_USER="vfx-tracker@digikore.com"
SMTP_FROM="${userEmail}" # Still shows sender as logged-in user

# Email appears to come from user, but sent via service account
```

**Option C: Resend API (Best for Production)**
```typescript
// Send email with dynamic "From" based on logged-in user
await resend.emails.send({
  from: `${userName} <vfx-tracker@digikore.com>`,
  to: recipientEmail,
  subject: "VFX Delivery List",
  html: emailBody,
});
```

**Current Local Setup:**
- Uses Outlook COM automation (Windows only)
- Requires Outlook to be installed and logged in
- Works great for local testing!

**After Cloud Deployment:**
- Switch to SMTP or Resend
- No Outlook required
- Works on any platform (Linux servers)

---

## 🔐 Security Notes

### Session Management
- ✅ Sessions expire after 24 hours (configurable)
- ✅ Email verified from authenticated session
- ✅ No user can send email as another user

### Email Security
```typescript
// ✅ SECURE: Gets email from authenticated session
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userEmail = session.user.email;

// ❌ INSECURE: Don't get email from request body
// const userEmail = req.body.email; // Can be spoofed!
```

---

## 📊 Database Connection Limits

### Local (SQLite)
- **Concurrent Users**: 1 writer at a time
- **Connections**: Not applicable (file-based)
- **Performance**: Fast for single user

### Production (Supabase PostgreSQL)

**Free Tier:**
- **Direct Connections**: 60 max
- **Pooled Connections**: 200 max
- **Recommendation**: Use connection pooling

**Pro Tier:**
- **Direct Connections**: 400 max
- **Pooled Connections**: Unlimited
- **Better for teams > 10 users**

**Your Configuration:**
```env
# Connection pooling (required for Vercel serverless)
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"

# Each Vercel function gets 1 connection from pool
# Can handle 200 concurrent requests on free tier!
```

---

## 🚀 Performance After Deployment

### Expected Improvements

| Metric | Local (SQLite) | Production (PostgreSQL) |
|--------|---------------|------------------------|
| **Page Load** | ~500ms | ~300ms (CDN caching) |
| **API Response** | ~100ms | ~80ms (edge functions) |
| **Concurrent Users** | 1 | 200+ (free tier) |
| **Database Queries** | Sequential | Parallel execution |
| **Email Sending** | Outlook COM | SMTP/API (faster) |

### Vercel Edge Network
- ✅ Code deployed to 100+ edge locations worldwide
- ✅ Automatic HTTPS
- ✅ DDoS protection
- ✅ Automatic scaling (no config needed)

---

## 🔄 Deployment Workflow

### Daily Development Cycle

```powershell
# Morning: Pull latest from production
git pull origin main

# Work on feature locally
npm run dev
# Test changes...

# Afternoon: Push to production
git add .
git commit -m "Add new feature"
git push origin main

# ✅ Live in 2-3 minutes!
```

### Emergency Rollback

```powershell
# Option 1: Via Vercel Dashboard
# Go to Deployments → Click previous version → "Promote to Production"

# Option 2: Via Git
git revert HEAD
git push origin main

# ✅ Previous version deployed in 2-3 minutes
```

### Feature Branches (Recommended)

```powershell
# Create feature branch
git checkout -b feature/new-dashboard

# Make changes and push
git push origin feature/new-dashboard

# ✅ Vercel creates PREVIEW deployment automatically!
# Test at: https://vfx-tracker-git-feature-new-dashboard.vercel.app

# If good, merge to main
git checkout main
git merge feature/new-dashboard
git push origin main

# ✅ Now deployed to production!
```

---

## 📧 Email Configuration Checklist

### Before Deployment

- [ ] Ensure all users have email addresses in database
- [ ] Test email sending locally with Outlook
- [ ] Verify email format is correct

### After Deployment

**If using Gmail SMTP:**
- [ ] Enable 2-Step Verification
- [ ] Generate App Password
- [ ] Add to Vercel environment variables
- [ ] Test email sending in production

**If using Resend (Recommended):**
- [ ] Sign up at resend.com
- [ ] Add domain verification
- [ ] Get API key
- [ ] Update code to use Resend SDK
- [ ] Add `RESEND_API_KEY` to Vercel

**If using Office 365:**
- [ ] Create service account
- [ ] Configure SMTP settings
- [ ] Add credentials to Vercel
- [ ] Test with delivery list

---

## 🎯 Quick Reference

### When to Run Migrations

| Scenario | Command | Where |
|----------|---------|-------|
| **Local development** | `npx prisma migrate dev` | Local machine |
| **Production deploy** | `npx prisma migrate deploy` | Vercel CLI or local |
| **Reset database** | `npx prisma migrate reset` | ⚠️ Local only (deletes data!) |

### Environment Variables by Environment

**Local (`.env.local`):**
```env
DATABASE_URL="file:./dev.db"  # SQLite
NEXTAUTH_URL="http://localhost:3000"
```

**Production (Vercel Dashboard):**
```env
DATABASE_URL="postgresql://..."  # Supabase
NEXTAUTH_URL="https://your-app.vercel.app"
```

### Common Commands

```powershell
# Local development
npm run dev

# Build production locally (test)
npm run build
npm start

# Database commands
npx prisma studio           # Open database GUI
npx prisma migrate dev      # Create migration
npx prisma migrate deploy   # Run migrations
npx prisma db seed          # Seed database
npx prisma generate         # Generate client

# Deployment
git push origin main        # Auto-deploys to Vercel
vercel --prod              # Manual deploy via CLI
```

---

## ✅ Summary

1. **Updates**: Just `git push` → Auto-deploys
2. **Data Safety**: Code ≠ Data, updates are safe
3. **Concurrent Users**: Works after PostgreSQL migration
4. **User Emails**: Now uses logged-in user's email from session

**You're ready to deploy! 🚀**

Follow the main `DEPLOYMENT_GUIDE.md` for step-by-step instructions.
