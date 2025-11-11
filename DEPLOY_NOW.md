# 🚀 DEPLOY NOW - Follow These Steps!

## ✅ Progress So Far:
- ✅ Code pushed to GitHub: https://github.com/Nikkhiljp02/vfx-tracker
- ✅ Supabase database ready
- ✅ All credentials prepared

---

## 🎯 STEP 1: Deploy to Vercel (5 minutes)

### A. Import Repository
1. Go to: **https://vercel.com/new**
2. Click **"Import Git Repository"**
3. Find **"vfx-tracker"** and click **"Import"**

### B. Add Environment Variables

Click **"Environment Variables"** and add these **ONE BY ONE**:

#### Required Variables (Copy-paste exactly):

**Name**: `DATABASE_URL`  
**Value**:
```
postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx@1#2#3#4#5#@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```
**Environment**: Production, Preview ✅

---

**Name**: `DIRECT_URL`  
**Value**:
```
postgresql://postgres:Dgkvfx@1#2#3#4#5#@db.gcuypucjznrtfltsxwsd.supabase.co:5432/postgres
```
**Environment**: Production, Preview ✅

---

**Name**: `NEXTAUTH_SECRET`  
**Value**:
```
/9aVon6G6sUG7uqZL9ZcrJpvoRnaXadcLSA0w6SWFg8=
```
**Environment**: Production, Preview ✅

---

**Name**: `NEXTAUTH_URL`  
**Value**: `https://vfx-tracker.vercel.app` (temporary - we'll update this)  
**Environment**: Production ONLY ✅

---

**Name**: `SMTP_HOST`  
**Value**: `smtp.gmail.com`  
**Environment**: Production, Preview ✅

---

**Name**: `SMTP_PORT`  
**Value**: `587`  
**Environment**: Production, Preview ✅

---

**Name**: `SMTP_USER`  
**Value**: `nikhil.patil@digikore.com`  
**Environment**: Production, Preview ✅

---

**Name**: `SMTP_PASSWORD`  
**Value**: `[GET GMAIL APP PASSWORD FIRST - See below]`  
**Environment**: Production, Preview ✅

---

**Name**: `SMTP_FROM`  
**Value**: `VFX Tracker <nikhil.patil@digikore.com>`  
**Environment**: Production, Preview ✅

---

### C. Get Gmail App Password (2 minutes)

**Before deploying**, get your Gmail App Password:

1. Open: https://myaccount.google.com/apppasswords
2. Sign in with your Gmail account
3. Select:
   - **App**: Mail
   - **Device**: Windows Computer
4. Click **"Generate"**
5. **COPY** the 16-character password (like: `abcd efgh ijkl mnop`)
6. Go back to Vercel and add it as `SMTP_PASSWORD`

**OR skip email for now**: Leave `SMTP_PASSWORD` empty (you can add it later)

---

### D. Deploy!

1. Click **"Deploy"**
2. Wait 2-3 minutes for build
3. ⚠️ **Expected**: Build will **FAIL** - this is NORMAL! (database tables don't exist yet)
4. **Copy your Vercel URL** from the deployment (e.g., `https://vfx-tracker-abc123.vercel.app`)

---

## 🗄️ STEP 2: Create Database Tables (3 minutes)

### Run These Commands in PowerShell:

```powershell
# Add Git to PATH (for this session)
$env:Path += ";C:\Users\nikhil patil\AppData\Local\Programs\Git\cmd"

# Navigate to project
cd "c:\Users\nikhil patil\VFX TRACKER\vfx-tracker"

# Generate Prisma client for PostgreSQL
npx prisma generate

# Deploy migrations to Supabase
npx prisma migrate deploy

# Seed admin user
npx prisma db seed
```

**Before running**, create `.env` file in project root with:

```env
DATABASE_URL="postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx@1#2#3#4#5#@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:Dgkvfx@1#2#3#4#5#@db.gcuypucjznrtfltsxwsd.supabase.co:5432/postgres"
```

---

## 🔄 STEP 3: Update Vercel URL & Redeploy (2 minutes)

1. Go to Vercel project → **Settings** → **Environment Variables**
2. Find `NEXTAUTH_URL`
3. Click **"Edit"**
4. Replace with your **actual Vercel URL** (from Step 1D)
5. Click **"Save"**
6. Go to **Deployments** tab
7. Click **"..."** on latest deployment → **"Redeploy"**
8. Wait 2-3 minutes

---

## 🎉 STEP 4: Test Your Live App!

1. Visit your Vercel URL
2. You should see the login page
3. Log in with:
   - **Username**: `admin`
   - **Password**: `admin123`
4. Test creating shows, shots, tasks!

---

## 📊 Summary of Your Setup:

✅ **GitHub**: https://github.com/Nikkhiljp02/vfx-tracker  
✅ **Supabase**: VFX-TRACKER project  
✅ **Database Password**: Dgkvfx@1#2#3#4#5#  
✅ **NextAuth Secret**: /9aVon6G6sUG7uqZL9ZcrJpvoRnaXadcLSA0w6SWFg8=  
⏳ **Vercel**: Deploy now at https://vercel.com/new  

---

## 🚨 Important Notes:

1. **First deploy will fail** - This is expected! Database tables don't exist yet.
2. **Run migrations** (Step 2) after first deploy
3. **Update NEXTAUTH_URL** (Step 3) with your real Vercel URL
4. **Redeploy** after updating NEXTAUTH_URL

---

## ⏭️ NEXT ACTION:

**Go to https://vercel.com/new and start Step 1!** 🚀

When you're done (or need help), let me know!
