# VFX Tracker - Deployment Guide

## Current Setup: Local Development ✅

Your app is currently running locally with SQLite database.

### Running Locally:
```powershell
npm run dev
```

Access at: `http://localhost:3000`

**Default Login:**
- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## Future: Deploy to Vercel + Supabase (When Needed)

### Prerequisites:
1. GitHub account
2. Vercel account (free tier)
3. Supabase account (free tier)

### Step 1: Push to GitHub
```powershell
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/vfx-tracker.git
git branch -M main
git push -u origin main
```

### Step 2: Set Up Supabase Database
1. Go to https://supabase.com
2. Create new project
3. Wait for database to provision
4. Go to Settings → Database
5. Copy the "Connection string" (choose "Transaction" pooling mode)
6. It will look like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Step 3: Deploy to Vercel
1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure Environment Variables:
   - `DATABASE_URL` = Your Supabase connection string
   - `NEXTAUTH_SECRET` = Generate with: `openssl rand -base64 32`
   - `NEXTAUTH_URL` = Your Vercel URL (e.g., `https://vfx-tracker.vercel.app`)
5. Click "Deploy"

### Step 4: Initialize Database
After deployment:
```powershell
# Set DATABASE_URL to your Supabase connection
$env:DATABASE_URL="postgresql://..."

# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

---

## Switching Between Local and Production

### For Local Development:
- Use `DATABASE_URL="file:./dev.db"` in `.env.local`
- Run `npm run dev`

### For Production:
- Update `DATABASE_URL` to PostgreSQL connection string
- Deploy via Vercel

---

## Cost Breakdown

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | Yes | 100GB bandwidth/month, unlimited projects |
| **Supabase** | Yes | 500MB database, 2GB file storage, 50,000 monthly active users |

**Total Cost: $0/month** for small teams!

---

## Network Access

### Local Setup:
- **Same Network:** Others can access via `http://YOUR_IP:3000`
  - Find your IP: `ipconfig` (look for IPv4 Address)
  - Share with team: `http://192.168.x.x:3000`

### Cloud Setup (Vercel):
- **Anywhere:** `https://your-app.vercel.app`
- Works from home, mobile, anywhere with internet

---

## Security Checklist

- ✅ All passwords hashed with bcrypt
- ✅ JWT sessions with NextAuth
- ✅ Role-based access control (ADMIN, COORDINATOR, ARTIST)
- ✅ Permission checks on all mutations
- ✅ CSRF protection enabled
- ✅ Environment variables for secrets

---

## Support

Need help deploying? Check:
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
