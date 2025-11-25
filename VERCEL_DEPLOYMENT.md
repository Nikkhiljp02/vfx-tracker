# Vercel Deployment Guide - VFX Tracker

## ✅ Pre-Deployment Checklist

### 1. Environment Variables (Set in Vercel Dashboard)
Go to: **Project Settings → Environment Variables**

#### Required Variables:
```bash
# Database (PostgreSQL/Supabase)
DATABASE_URL="postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx%401%232%233%234%235%23@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=15&connection_limit=5&pool_timeout=10"
DIRECT_URL="postgresql://postgres:Dgkvfx%401%232%233%234%235%23@db.gcuypucjznrtfltsxwsd.supabase.co:5432/postgres"

# NextAuth (Authentication)
NEXTAUTH_SECRET="/9aVon6G6sUG7uqZL9ZcrJpvoRnaXadcLSA0w6SWFg8="
NEXTAUTH_URL="https://vfx-tracker.vercel.app"
AUTH_TRUST_HOST="true"

# Supabase (Realtime)
NEXT_PUBLIC_SUPABASE_URL="https://gcuypucjznrtfltsxwsd.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdXlwdWNqem5ydGZsdHN4d3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTAwNTksImV4cCI6MjA3ODQ2NjA1OX0.gcGBzi3Va0dnkcJ7-Jl2BXZjAWhBLy7jL238QbXe5_4"

# Email (SMTP for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="nikhil.patil@digikore.com"
SMTP_PASSWORD="qqqkstqpsgjfnjkw"
SMTP_FROM="VFX Tracker <nikhil.patil@digikore.com>"
```

#### Important Notes:
- Set all variables for **Production** environment
- For `NEXT_PUBLIC_*` variables, also add to **Preview** and **Development** if needed
- `AUTH_TRUST_HOST="true"` is required for Vercel deployment

### 2. Vercel Configuration
File: `vercel.json` (already configured)
```json
{
  "buildCommand": "prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### 3. Project Settings in Vercel

#### Build & Development Settings:
- **Framework Preset**: Next.js
- **Build Command**: `prisma generate && next build`
- **Install Command**: `npm install`
- **Output Directory**: `.next`
- **Node Version**: 20.x (recommended)

#### Root Directory:
- Leave blank (project is in root)

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to GitHub**
   ```powershell
   git add -A
   git commit -m "chore: Prepare for Vercel production deployment"
   git push origin main
   ```

2. **Import Project to Vercel**
   - Go to https://vercel.com/new
   - Select your GitHub repository: `Nikkhiljp02/vfx-tracker`
   - Configure project:
     - Framework: Next.js (auto-detected)
     - Root Directory: `./` (leave blank)
     - Build Command: `prisma generate && next build`

3. **Set Environment Variables**
   - Copy all variables from `.env.production`
   - Go to Project Settings → Environment Variables
   - Add each variable (select "Production" environment)

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)

### Option 2: Deploy via Vercel CLI

```powershell
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow prompts to link project
```

## 📋 Post-Deployment Checklist

### 1. Verify Database Connection
- Open https://vfx-tracker.vercel.app
- Try logging in with admin credentials
- Check if data loads correctly

### 2. Test Key Features
- [ ] Authentication (login/logout)
- [ ] Shot tracking (view/edit tasks)
- [ ] Resource forecast (allocations)
- [ ] Feedback system
- [ ] Admin panel (users, shows, settings)
- [ ] Realtime updates (open multiple tabs)
- [ ] Mobile view (test on phone or responsive mode)

### 3. Monitor Logs
- Go to Vercel Dashboard → Project → Logs
- Check for any runtime errors
- Monitor function execution times

### 4. Performance Check
- Run Lighthouse audit
- Check Core Web Vitals in Vercel Analytics
- Monitor serverless function cold starts

## 🔧 Troubleshooting

### Issue: 500 Errors on API Routes
**Cause**: Database connection issues
**Fix**:
1. Verify `DATABASE_URL` is correct in Vercel env vars
2. Check Supabase connection pooling settings
3. Ensure `AUTH_TRUST_HOST="true"` is set

### Issue: Prisma Client Not Generated
**Cause**: Build command doesn't include `prisma generate`
**Fix**:
1. Check `vercel.json` has correct build command
2. Or set in Vercel Dashboard: `prisma generate && next build`

### Issue: Environment Variables Not Loading
**Cause**: Variables not set for correct environment
**Fix**:
1. Go to Project Settings → Environment Variables
2. Ensure variables are set for "Production"
3. Redeploy after adding variables

### Issue: NextAuth Redirect Errors
**Cause**: Incorrect `NEXTAUTH_URL`
**Fix**:
1. Set `NEXTAUTH_URL="https://vfx-tracker.vercel.app"`
2. Set `AUTH_TRUST_HOST="true"`
3. Redeploy

### Issue: Realtime Subscriptions Not Working
**Cause**: Supabase public variables not set
**Fix**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is set
2. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
3. Check Supabase Realtime is enabled in dashboard

## 📊 Monitoring & Maintenance

### Vercel Analytics
- Enable Web Analytics in Project Settings
- Monitor page load times
- Track Core Web Vitals

### Database Monitoring
- Monitor Supabase dashboard for:
  - Connection pool usage
  - Query performance
  - Database size
  - Active connections

### Error Tracking
- Check Vercel Function Logs regularly
- Set up error alerts in Vercel
- Monitor for failed deployments

## 🔄 Continuous Deployment

Once connected to GitHub, Vercel will automatically:
- Deploy on every push to `main` branch
- Create preview deployments for pull requests
- Run build checks before deploying

### Auto-Deploy Settings:
- **Production Branch**: `main`
- **Preview Branches**: All branches
- **Ignored Build Step**: None (deploy on every push)

## 🎯 Domain Configuration (Optional)

### Custom Domain Setup:
1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `tracker.yourdomain.com`)
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to match new domain
5. Update Supabase redirect URLs

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma on Vercel**: https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
- **Supabase Connection**: https://supabase.com/docs/guides/integrations/vercel

## ✅ Deployment Complete!

Your VFX Tracker is now live at: **https://vfx-tracker.vercel.app**

**Default Admin Login**:
- Username: `admin`
- Password: Check your database or reset via admin panel

**Next Steps**:
1. Change default admin password
2. Create user accounts for team
3. Import show/shot data
4. Configure delivery schedules
5. Test mobile optimization on real devices
