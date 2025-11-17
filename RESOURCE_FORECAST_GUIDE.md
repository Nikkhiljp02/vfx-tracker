# Resource Forecast Module - Implementation Guide

## Overview

The Resource Forecast module is a completely separate capacity planning tool designed for production managers to track team member allocations on a daily basis. This module does not interact with or modify the existing VFX tracker features.

**Created:** November 14, 2025  
**Status:** ✅ Complete - Ready for Database Migration

---

## 🎯 Key Features

### 1. **Resource Member Management**
- Track team members with Employee ID, Name, Designation, Reporting Manager, Department, and Shift
- Import bulk members from Excel
- Mark members as active/inactive
- No login required for team members (data-only records)

### 2. **Daily Allocation Tracking**
- Visual calendar grid showing daily allocations
- Man-day (MD) based capacity tracking (0.0 to 1.0 per day)
- Fixed columns: Emp ID, Name, Designation, Reporting To, Department, Shift
- Scrollable date columns (14/30/60/90 day views)
- Color-coded status:
  - 🟢 Green: Available (0 MD allocated)
  - 🟡 Yellow: Partial (<1.0 MD allocated)
  - 🟠 Orange: Full (1.0 MD allocated)

### 3. **Allocation Rules**
- Maximum 1.0 MD per person per day (enforced)
- Maximum 4 concurrent shots per day (warning, not blocked)
- Validation before save prevents overallocation
- Support for Leave and Idle time tracking
- Ctrl+I keyboard shortcut for quick idle time addition

### 4. **Excel Import**
- Import resource members with template download
- Import allocations with date range expansion
- Validation and preview before import
- Duplicate detection and conflict resolution

### 5. **Role-Based Access**
- Only ADMIN and RESOURCE roles can access
- Separate navigation tab (hidden from other roles)
- Independent permission system

---

## 📁 Files Created

### Database Models
```
prisma/schema.prisma (modified)
├── ResourceMember model (8 fields + relations + 3 indexes)
└── ResourceAllocation model (12 fields + relations + 5 indexes)

prisma/migrations/add-resource-forecast-models.sql
└── Migration SQL with table creation and indexes
```

### API Routes (7 endpoints)
```
app/api/resource/
├── members/
│   ├── route.ts (GET list, POST create)
│   ├── [id]/route.ts (GET, PUT, DELETE)
│   └── import/route.ts (POST Excel import)
└── allocations/
    ├── route.ts (GET filtered, POST with validation)
    ├── [id]/route.ts (GET, PUT, DELETE)
    ├── import/route.ts (POST Excel date range import)
    └── validate/route.ts (POST MD rule validation)
```

### UI Components
```
components/
├── ResourceForecastView.tsx (370 lines - main calendar view)
├── ResourceAllocationModal.tsx (230 lines - allocation form)
└── ResourceImportModal.tsx (220 lines - Excel import UI)

app/
└── resource-forecast/
    └── page.tsx (45 lines - route guard wrapper)
```

### Configuration Updates
```
middleware.ts (modified)
└── Excluded /api/resource from middleware (has own auth)

app/page.tsx (modified)
└── Added Resource Forecast tab (conditional on role)

components/MobileNav.tsx (modified)
└── Added Resource tab for mobile (conditional on role)
```

---

## 🗄️ Database Schema

### ResourceMember Table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String (CUID) | ✓ | Primary key |
| empId | String (unique) | ✓ | Employee ID |
| empName | String | ✓ | Full name |
| designation | String | ✓ | Job title |
| reportingTo | String | ✗ | Manager name |
| department | String | ✓ | Department |
| shift | String | ✓ | Day/Night (default: Day) |
| isActive | Boolean | ✓ | Active status (default: true) |
| createdDate | DateTime | ✓ | Auto timestamp |
| updatedDate | DateTime | ✓ | Auto update |

**Indexes:**
- `empId` (unique)
- `department + isActive + empId`
- `department`

### ResourceAllocation Table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String (CUID) | ✓ | Primary key |
| resourceId | String (FK) | ✓ | Links to ResourceMember |
| showName | String | ✓* | Show name (*unless leave/idle) |
| shotName | String | ✓* | Shot name (*unless leave/idle) |
| allocationDate | DateTime | ✓ | Allocation date |
| manDays | Float | ✓ | MD value (0.0-1.0) |
| isLeave | Boolean | ✓ | Leave flag (default: false) |
| isIdle | Boolean | ✓ | Idle time flag (default: false) |
| notes | String | ✗ | Optional notes |
| createdBy | String | ✓ | User ID who created |
| createdDate | DateTime | ✓ | Auto timestamp |
| updatedDate | DateTime | ✓ | Auto update |

**Indexes:**
- `resourceId + allocationDate`
- `allocationDate`
- `showName + shotName`
- `resourceId`
- `showName`

**Cascade Delete:** Deleting a ResourceMember deletes all their allocations

---

## 🚀 Deployment Steps

### 1. Database Migration

**Option A: If Database is Available**
```powershell
cd "c:\Users\nikhil patil\VFX TRACKER\vfx-tracker"
npx prisma migrate dev --name add-resource-forecast-models
```

**Option B: Manual Migration (Supabase SQL Editor)**
```sql
-- Run the SQL from:
prisma/migrations/add-resource-forecast-models.sql
```

**Option C: Production Deployment**
```powershell
npx prisma migrate deploy
```

### 2. Update User Role (Manual)

Add RESOURCE role to the User table's role enum if needed:
```sql
-- Check if RESOURCE role exists
SELECT DISTINCT "role" FROM "users";

-- If not exists, manually update a user:
UPDATE "users" 
SET "role" = 'RESOURCE' 
WHERE "email" = 'resource.manager@company.com';
```

### 3. Verify Installation

1. ✅ Prisma client regenerated (already done)
2. ✅ API routes created (7 endpoints)
3. ✅ UI components created (3 files)
4. ✅ Navigation updated (desktop + mobile)
5. ⏳ Database migration applied (pending)
6. ⏳ User role assigned (manual step)

---

## 📖 User Guide

### Accessing Resource Forecast

1. **Login** as ADMIN or RESOURCE role user
2. **Navigate** to "Resource Forecast" tab (desktop) or "Resource" tab (mobile)
3. **View** appears with department filter and date range selector

### Adding Team Members

**Option 1: Manual Entry**
1. Click "Add Member" button
2. Fill in Employee ID, Name, Designation, Department
3. Optionally add Reporting Manager and Shift
4. Save

**Option 2: Excel Import**
1. Click "Import Members" button
2. Download template Excel file
3. Fill in member data (see template format)
4. Upload file and review preview
5. Confirm import

**Excel Template Format (Members):**
| Emp ID | Emp Name | Designation | Reporting To | Department | Shift |
|--------|----------|-------------|--------------|------------|-------|
| EMP001 | John Doe | Senior Compositor | Jane Smith | Compositing | Day |
| EMP002 | Alice Johnson | Junior Animator | Bob Wilson | Animation | Night |

### Allocating Resources

**Method 1: Click Cell**
1. Click on any date cell for a team member
2. Modal opens with existing allocations
3. Fill in Show Name, Shot Name, Man Days
4. Optionally mark as Leave or Idle
5. Save (validates MD rules automatically)

**Method 2: Ctrl+I Shortcut**
1. Click a date cell to select it
2. Press Ctrl+I to add idle time
3. Remaining MD capacity is automatically calculated and added

**Method 3: Excel Import**
1. Click "Import Allocations" button
2. Download template Excel file
3. Fill in allocation data with date ranges
4. Upload and review validation warnings
5. Confirm import

**Excel Template Format (Allocations):**
| Emp ID | Show Name | Shot Name | Start Date | End Date | Man Days | Notes |
|--------|-----------|-----------|------------|----------|----------|-------|
| EMP001 | Project Alpha | SH0010 | 2024-01-15 | 2024-01-20 | 0.5 | Compositing work |
| EMP002 | Project Beta | SH0050 | 2024-01-15 | 2024-01-18 | 1.0 | Animation task |

**Note:** Date range import automatically creates daily allocations from Start Date to End Date

### Understanding Validation

**✅ Valid Allocations:**
- Total MD ≤ 1.0 per person per day
- MD value between 0.0 and 1.0
- Show/Shot names provided (unless Leave/Idle)

**⚠️ Warning (Allowed):**
- More than 4 shots allocated on same day
- User will see warning but can proceed

**❌ Blocked:**
- Total MD > 1.0 per day
- Negative or >1.0 MD value
- Missing required fields

### Color Coding

- **🟢 Green Cell:** Person is available (0 MD allocated)
- **🟡 Yellow Cell:** Partial allocation (<1.0 MD)
- **🟠 Orange Cell:** Fully allocated (1.0 MD)

Hover over any cell to see allocation details.

---

## 🔧 API Documentation

### GET /api/resource/members
**Description:** Get list of resource members  
**Auth:** ADMIN or RESOURCE role required  
**Query Params:**
- `department` (optional): Filter by department
- `isActive` (optional): Filter by active status (true/false)

**Response:**
```json
[
  {
    "id": "clx...",
    "empId": "EMP001",
    "empName": "John Doe",
    "designation": "Senior Compositor",
    "reportingTo": "Jane Smith",
    "department": "Compositing",
    "shift": "Day",
    "isActive": true,
    "createdDate": "2025-11-14T...",
    "updatedDate": "2025-11-14T..."
  }
]
```

### POST /api/resource/members
**Description:** Create new resource member  
**Auth:** ADMIN or RESOURCE role required  
**Body:**
```json
{
  "empId": "EMP001",
  "empName": "John Doe",
  "designation": "Senior Compositor",
  "reportingTo": "Jane Smith",
  "department": "Compositing",
  "shift": "Day"
}
```

### GET /api/resource/allocations
**Description:** Get allocations with filtering  
**Auth:** ADMIN or RESOURCE role required  
**Query Params:**
- `resourceId` (optional): Filter by resource member
- `startDate` (optional): Filter from date (YYYY-MM-DD)
- `endDate` (optional): Filter to date (YYYY-MM-DD)
- `showName` (optional): Filter by show
- `shotName` (optional): Filter by shot

**Response:**
```json
[
  {
    "id": "clx...",
    "resourceId": "clx...",
    "showName": "Project Alpha",
    "shotName": "SH0010",
    "allocationDate": "2025-11-15T00:00:00.000Z",
    "manDays": 0.5,
    "isLeave": false,
    "isIdle": false,
    "notes": "Compositing work",
    "createdBy": "clx...",
    "createdDate": "2025-11-14T...",
    "updatedDate": "2025-11-14T...",
    "resource": {
      "empId": "EMP001",
      "empName": "John Doe",
      "department": "Compositing"
    }
  }
]
```

### POST /api/resource/allocations
**Description:** Create new allocation with validation  
**Auth:** ADMIN or RESOURCE role required  
**Body:**
```json
{
  "resourceId": "clx...",
  "showName": "Project Alpha",
  "shotName": "SH0010",
  "allocationDate": "2025-11-15",
  "manDays": 0.5,
  "isLeave": false,
  "isIdle": false,
  "notes": "Compositing work"
}
```

**Response (Success):**
```json
{
  "id": "clx...",
  "resourceId": "clx...",
  "showName": "Project Alpha",
  "shotName": "SH0010",
  "allocationDate": "2025-11-15T00:00:00.000Z",
  "manDays": 0.5,
  "isLeave": false,
  "isIdle": false,
  "notes": "Compositing work",
  "createdBy": "clx...",
  "createdDate": "2025-11-14T...",
  "updatedDate": "2025-11-14T...",
  "warning": "This resource is already allocated to 5 shots on this date"
}
```

**Response (Error):**
```json
{
  "error": "Total allocation for 11/15/2025 would exceed 1.0 MD (current: 0.8, adding: 0.5)"
}
```

### POST /api/resource/allocations/validate
**Description:** Validate allocation before creating  
**Auth:** ADMIN or RESOURCE role required  
**Body:**
```json
{
  "resourceId": "clx...",
  "allocationDate": "2025-11-15",
  "manDays": 0.5,
  "excludeId": "clx..." // Optional, for updates
}
```

**Response:**
```json
{
  "valid": true,
  "currentTotal": 0.5,
  "newTotal": 1.0,
  "remaining": 0.0,
  "activeShotsCount": 3,
  "warning": null,
  "allocations": [
    {
      "show": "Project Alpha",
      "shot": "SH0010",
      "md": 0.5,
      "isLeave": false,
      "isIdle": false
    }
  ]
}
```

### POST /api/resource/members/import
**Description:** Bulk import members from Excel  
**Auth:** ADMIN or RESOURCE role required  
**Body:** FormData with file  

**Response (Success):**
```json
{
  "success": true,
  "imported": 10,
  "total": 10
}
```

**Response (Error with preview):**
```json
{
  "error": "Import validation failed",
  "errors": [
    "Row 3: Missing required fields (Emp ID, Emp Name, Designation, Department)",
    "Duplicate Emp IDs in file: EMP001, EMP002",
    "Emp IDs already exist in database: EMP003"
  ],
  "preview": [/* first 5 rows for review */]
}
```

### POST /api/resource/allocations/import
**Description:** Bulk import allocations with date range expansion  
**Auth:** ADMIN or RESOURCE role required  
**Body:** FormData with file  

**Response (Success with warnings):**
```json
{
  "success": true,
  "imported": 50,
  "total": 50,
  "warnings": [
    "2025-11-15: Total MD would be 1.2 (limit: 1.0)",
    "2025-11-16: Total MD would be 1.1 (limit: 1.0)"
  ]
}
```

---

## 🐛 Troubleshooting

### "Property 'id' does not exist on type 'ResourceMember'"

**Cause:** Prisma client not regenerated after schema changes

**Solution:**
```powershell
cd "c:\Users\nikhil patil\VFX TRACKER\vfx-tracker"
npx prisma generate
```

### "Can't reach database server"

**Cause:** Database not running or connection issue

**Solution:** Apply migration manually via Supabase SQL Editor using `prisma/migrations/add-resource-forecast-models.sql`

### "Forbidden - Resource access required"

**Cause:** User role is not ADMIN or RESOURCE

**Solution:** Update user role in database:
```sql
UPDATE "users" SET "role" = 'RESOURCE' WHERE "email" = 'user@email.com';
```

### Excel import fails with "Employee not found"

**Cause:** Trying to import allocations for employees not yet in database

**Solution:** Import resource members first, then import allocations

### "Total allocation would exceed 1.0 MD"

**Cause:** Attempting to add allocation that would exceed daily limit

**Solution:** Reduce MD value or delete existing allocations for that day

---

## 📊 Performance Considerations

- **Indexes:** All foreign keys and frequently queried fields are indexed
- **Date Filtering:** Uses indexed `allocationDate` column for fast queries
- **Cascade Delete:** Deleting members automatically removes allocations (prevents orphans)
- **Batch Import:** Excel import creates multiple records in single transaction
- **Validation:** Server-side validation prevents invalid data entry

---

## 🔒 Security

- ✅ Role-based access (ADMIN + RESOURCE only)
- ✅ Server-side validation on all endpoints
- ✅ SQL injection protection via Prisma ORM
- ✅ File upload validation (Excel only, size limits via Next.js)
- ✅ Independent from tracker (no permission inheritance)

---

## 📝 Future Enhancements

Potential features for future releases:

1. **Reporting:**
   - Department utilization reports
   - Overallocation alerts
   - Capacity forecasting charts

2. **Integration:**
   - Link allocations to actual shots in tracker (optional)
   - Export allocations to Google Sheets
   - Calendar sync (Google Calendar, Outlook)

3. **Advanced Features:**
   - Multi-week bulk allocation
   - Allocation templates
   - Historical comparison
   - Skills-based allocation suggestions

---

## ✅ Testing Checklist

Before deploying to production:

- [ ] Database migration applied successfully
- [ ] RESOURCE role user created
- [ ] Resource Forecast tab visible for RESOURCE/ADMIN users
- [ ] Resource Forecast tab hidden for other roles
- [ ] Can create resource members manually
- [ ] Can import resource members from Excel
- [ ] Can create allocations with validation
- [ ] Ctrl+I adds idle time correctly
- [ ] Color coding works (green/yellow/orange)
- [ ] 1.0 MD limit is enforced
- [ ] 4-shot warning displays but allows save
- [ ] Excel allocation import expands date ranges
- [ ] Duplicate detection works
- [ ] Mobile navigation shows/hides tab correctly
- [ ] API authentication blocks non-RESOURCE users

---

## 🎉 Completion Status

**✅ Day 1 Complete - Module Ready for Deployment**

**Summary:**
- 2 database models created
- 7 API endpoints implemented
- 3 UI components built
- Excel import/export functionality
- Role-based access control
- Full validation system
- Desktop + mobile navigation
- Migration SQL generated

**Next Step:** Apply database migration and assign RESOURCE role to users.

---

**Documentation Created:** November 14, 2025  
**Version:** 1.0  
**Module Status:** Implementation Complete
