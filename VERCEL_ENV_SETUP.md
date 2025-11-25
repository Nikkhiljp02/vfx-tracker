# CRITICAL: Vercel Environment Variables Setup

## 🚨 Your Production is Empty Because Environment Variables Are Missing

Your app is still using SQLite locally but needs PostgreSQL (Supabase) in production. You need to configure Vercel environment variables.

---

## 📋 Required Environment Variables in Vercel

### 1. Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Select your **vfx-tracker** project
3. Click **Settings** → **Environment Variables**

### 2. Add These Variables

#### Database Connection (Required):
```
DATABASE_URL
postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx%401%232%233%234%235%23@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

```
DIRECT_URL
postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx%401%232%233%234%235%23@db.gcuypucjznrtfltsxwsd.supabase.co:5432/postgres
```

#### NextAuth (Required):
```
NEXTAUTH_SECRET
vfx-tracker-secret-key-change-in-production-2025
```

```
NEXTAUTH_URL
https://your-domain.vercel.app
```
*Replace with your actual Vercel deployment URL*

#### Supabase Real-time (Required):
```
NEXT_PUBLIC_SUPABASE_URL
https://gcuypucjznrtfltsxwsd.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
[Your Supabase Anon Key - Get from Supabase Dashboard → Settings → API]
```

---

## 🎯 Step-by-Step in Vercel

### For Each Variable:
1. Click **Add New** button
2. Enter **Key** (e.g., `DATABASE_URL`)
3. Enter **Value** (the connection string)
4. Select **All Environments** (Production, Preview, Development)
5. Click **Save**

### After Adding All Variables:
1. Go to **Deployments** tab
2. Click **...** (three dots) on latest deployment
3. Click **Redeploy**
4. Wait for redeployment to complete (~2 minutes)

---

## ⚠️ Important Notes

### Database URL Format:
- **DATABASE_URL**: Uses connection pooler (port 6543) - for Prisma queries
- **DIRECT_URL**: Uses direct connection (port 5432) - for migrations

### Supabase Keys Location:
1. Go to https://supabase.com/dashboard
2. Select your **vfx-tracker** project
3. Click **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🔍 Verification Checklist

After redeploying, check:

- [ ] Environment variables added to Vercel
- [ ] Redeployment triggered
- [ ] Deployment successful (no build errors)
- [ ] Visit your production site
- [ ] Check if data appears (should show your Supabase data)
- [ ] Test creating a new show/shot
- [ ] Verify real-time updates work

---

## 🐛 If Still Empty After Redeploy

### Check Vercel Build Logs:
1. Go to Deployments → Latest deployment
2. Click on it
3. Check **Build Logs** for errors like:
   - `DATABASE_URL not found`
   - `Connection refused`
   - `Authentication failed`

### Common Issues:

**Issue 1: Database is empty in Supabase**
- You need to run the schema migration in Supabase first
- Go to Supabase → SQL Editor
- Run the contents of `supabase-schema.sql`

**Issue 2: Wrong environment variable names**
- Must be EXACT: `DATABASE_URL`, not `DB_URL` or `DATABASE_URI`
- Check spelling carefully

**Issue 3: Connection string encoding**
- Password special characters must be URL-encoded
- Your password `Dgkvfx@1#2#3#4#5#` is encoded as `Dgkvfx%401%232%233%234%235%23`

---

## 📝 Quick Reference

### Your Supabase Connection Details:
- **Project ID**: `gcuypucjznrtfltsxwsd`
- **Region**: `aws-1-ap-southeast-1`
- **Pooler Port**: `6543` (for queries)
- **Direct Port**: `5432` (for migrations)
- **Database**: `postgres`

---

## ✅ Final Checklist

1. [ ] Prisma schema changed to `postgresql` (DONE ✅)
2. [ ] Committed and pushed to GitHub (DONE ✅)
3. [ ] Add `DATABASE_URL` to Vercel ← **YOU ARE HERE**
4. [ ] Add `DIRECT_URL` to Vercel
5. [ ] Add `NEXTAUTH_SECRET` to Vercel
6. [ ] Add `NEXTAUTH_URL` to Vercel
7. [ ] Add `NEXT_PUBLIC_SUPABASE_URL` to Vercel
8. [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel
9. [ ] Redeploy in Vercel
10. [ ] Verify data appears in production

---

## 🆘 Need Help?

If you're still seeing an empty database after following all steps:
1. Check Vercel deployment logs
2. Check browser console for errors (F12)
3. Verify Supabase has data (check in Supabase Dashboard → Table Editor)
4. Ensure you ran `supabase-performance-indexes.sql` in Supabase SQL Editor
