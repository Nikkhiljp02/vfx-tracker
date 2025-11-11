# 🎬 VFX Tracker - Quick Start Guide

## ✅ You're All Set for Local Use!

### **How to Start the Application:**

1. **Open PowerShell in this folder**
2. **Run:**
   ```powershell
   npm run dev
   ```
3. **Open browser:** `http://localhost:3000`

### **Default Login Credentials:**
- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## 📱 Access from Other Devices on Same Network

### Find Your Computer's IP Address:
```powershell
ipconfig
```
Look for "IPv4 Address" (e.g., `192.168.1.100`)

### Share with Team:
Give them: `http://YOUR_IP:3000`
Example: `http://192.168.1.100:3000`

**Note:** Your computer must be running `npm run dev` and both devices must be on same WiFi/network.

---

## 👥 User Management

### Create New Users:
1. Login as admin
2. Go to **Admin → Users**
3. Click "Add User"
4. Set role: ADMIN / COORDINATOR / ARTIST

### Roles:
- **ADMIN:** Full access + user management
- **COORDINATOR:** Can edit assigned shows
- **ARTIST:** View-only access

---

## 📊 Features Overview

### ✅ Shot Tracking
- Import shots from Excel
- Track status across departments
- Set ETAs and assignments

### ✅ Delivery Management
- Schedule deliveries
- Export delivery lists (Excel)
- Email delivery notifications

### ✅ Activity Logs
- Track all changes
- See who changed what and when

### ✅ Department Views
- Filter by show, shot, status
- Bulk updates
- Department-specific tracking

---

## 🚀 When Ready to Go Cloud (Optional)

See `DEPLOYMENT.md` for instructions on deploying to Vercel + Supabase.

**Benefits of Cloud Deployment:**
- ✅ Access from anywhere (home, mobile, remote offices)
- ✅ No need to keep your computer running
- ✅ Automatic backups
- ✅ Free tier available

**Current Setup Works Great For:**
- ✅ Office/studio use (same network)
- ✅ Testing and evaluation
- ✅ Small teams in one location

---

## 💾 Backup Your Data

Your database is stored in: `prisma/dev.db`

**To backup:**
```powershell
copy prisma\dev.db prisma\backup-$(Get-Date -Format 'yyyy-MM-dd').db
```

---

## 🔧 Troubleshooting

### Port 3000 Already in Use?
```powershell
# Kill existing Node processes
Get-Process | Where-Object { $_.Name -like "*node*" } | Stop-Process -Force

# Then run again
npm run dev
```

### Database Issues?
```powershell
# Reset and reseed database
npx prisma migrate reset
npx prisma db seed
```

### Need to Reinstall?
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

---

## 📞 Support

- Check `README.md` for detailed feature documentation
- See `DEPLOYMENT.md` for cloud deployment guide
- All your data is safely stored in `prisma/dev.db`

---

**🎉 Happy Tracking!**
