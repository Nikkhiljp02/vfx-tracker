# Delivery Tracking Feature - Complete Guide

## 🚀 Overview

The new **Delivery Tracking** system provides comprehensive delivery management with smart filtering, deadline tracking, and visual urgency indicators.

---

## 📋 Features Implemented

### 1. **Delivery View Page**
A dedicated page for tracking deliveries with powerful filtering capabilities.

**Location:** Accessible from the main navigation tabs (next to Department View)

**Key Components:**
- Department-wise filtering (with "ALL" option)
- Delivery type selection (Internal ETA / Client ETA)
- Date range filters
- Multi-dimensional filtering (Shows, Status, Leads, Tags, Type)
- Color-coded urgency indicators
- Sortable delivery table
- **Excel Export** - Export filtered or unfiltered data

---

### 2. **Excel Export Functionality**

#### **Export Button**
- Located in the header (green button with download icon)
- Exports currently visible filtered data
- Automatically disabled when no deliveries to export

#### **Export Features**
- ✅ Exports all visible columns based on delivery type selection
- ✅ Auto-sized columns for readability
- ✅ Smart filename generation with timestamp and filters
- ✅ Includes all filtered deliveries (no pagination)

#### **Filename Format**
```
Delivery_Report_YYYY-MM-DD_[Department]_[DateFilter].xlsx
```

**Examples:**
- `Delivery_Report_2025-11-06_Comp_today.xlsx`
- `Delivery_Report_2025-11-06_ALL_thisWeek.xlsx`
- `Delivery_Report_2025-11-06.xlsx` (no filters)

#### **Exported Columns**
| Column | Always Included | Conditional |
|--------|----------------|-------------|
| Show | ✅ | |
| Shot | ✅ | |
| Tag | ✅ | |
| Type | ✅ | |
| Department | ✅ | |
| Lead | ✅ | |
| Status | ✅ | |
| Internal ETA | | Only if selected |
| Client ETA | | Only if selected |
| Delivered Date | ✅ | |
| Delivered Version | ✅ | |

---

### 3. **Smart Filtering System**

#### **Delivery Type Filter**
- ✅ **Internal ETA**: Internal delivery deadlines
- ✅ **Client ETA**: Client delivery deadlines
- Toggle individually or view both simultaneously
- Columns dynamically show/hide based on selection

#### **Date Range Filters**
- **All**: Show all deliveries
- **Today**: Deliveries due today only
- **This Week**: Next 7 days (including today)
- **Overdue**: Past delivery dates (not yet delivered)
- **Custom Range**: Select specific date range (From/To)

#### **Additional Filters**
- **Shows**: Multi-select checkbox list
- **Status**: Filter by task status
- **Lead Name**: Filter by assigned lead
- **Tag**: Fresh vs Additional shots (checkbox)
- **Type**: Internal vs Main tasks (checkbox)

---

### 4. **Visual Urgency System**

#### **Color-Coded Stats Cards**
```
🔴 Red (Overdue)    - Past deadline, not delivered
🟠 Orange (Today)   - Due today
🟡 Yellow (Urgent)  - Due within 3 days
🟢 Green (Total)    - All deliveries
```

#### **Table Row Highlighting**
- **Red background**: Overdue deliveries
- **Orange background**: Due today
- **Yellow background**: Due within 3 days
- **White background**: Normal deliveries

#### **Date Indicators**
- ⚠️ Warning icon for overdue dates (bold red text)
- 🔔 Bell icon for today's deliveries (bold orange text)

---

### 4. **Delivery Table Columns**

| Column | Description |
|--------|-------------|
| **Show** | Show name |
| **Shot** | Shot name (bold) |
| **Tag** | Fresh (green) / Additional (orange) badge |
| **Type** | Internal / Main task |
| **Department** | Task department (bold) |
| **Lead** | Assigned lead name |
| **Status** | Colored status badge |
| **Internal ETA** | Internal delivery date (if selected) |
| **Client ETA** | Client delivery date (if selected) |
| **Delivered** | ✓ Delivered date + version number |

---

### 5. **Upcoming Deliveries Widget (Dashboard)**

**Location:** Dashboard view, between global stats and show-wise breakdown

**Features:**
- Shows next 10 deliveries (7-day window)
- Quick stats: Overdue, Today, This Week
- Compact card view with:
  - Shot name & department
  - Show name & lead
  - Status badge
  - Delivery type badge (Internal/Client)
  - Days until delivery
  - Urgency color coding

**Auto-sorting:** Earliest delivery first

---

## 🎯 Use Cases & Workflows

### **Daily Delivery Check**
1. Open **Delivery** tab
2. Select **"Today"** date filter
3. Review all deliveries due today
4. Monitor urgency indicators

### **Weekly Planning**
1. Select **"This Week"** filter
2. View all upcoming deliveries
3. Group by department (use Department dropdown)
4. Identify bottlenecks

### **Client Deliveries Only**
1. Uncheck "Internal ETA"
2. Keep only "Client ETA" checked
3. View client-facing deadlines only

### **Department-Specific Tracking**
1. Select department from dropdown (e.g., "Comp")
2. All other filters apply to that department
3. Perfect for department leads

### **Show-Specific Deliveries**
1. Open filter panel
2. Check specific show(s) in Shows filter
3. View deliveries for selected shows only

### **Overdue Management**
1. Select **"Overdue"** filter
2. Review all missed deadlines
3. Red highlighting for quick identification

### **Export Delivery Report**
1. Apply desired filters (department, date range, shows, etc.)
2. Click **"Export Report"** button (green button in header)
3. Excel file downloads automatically with filtered data
4. Filename includes timestamp and active filters

### **Client Meeting Report**
1. Select specific show from filter panel
2. Uncheck "Internal ETA" (show only Client ETA)
3. Select date range (e.g., "This Week")
4. Click **"Export Report"**
5. Share Excel file with client

### **Department Weekly Report**
1. Select department (e.g., "Comp")
2. Select **"This Week"** filter
3. Click **"Export Report"**
4. Send to department lead for review

### **Fresh Shots Tracking**
1. Open filter panel
2. Check **"Fresh"** in Tag filter
3. View only fresh shot deliveries
4. Export if needed for management reports

### **Internal vs Main Task Separation**
1. Open filter panel
2. Select **"Internal"** or **"Main"** in Type filter
3. Track each type separately
4. Export separate reports for different stakeholders
3. Red highlighting for quick identification

---

## 💡 Suggested Additional Features

### **1. Delivery Notifications**
- Browser notifications for deliveries due today
- Email alerts for upcoming client ETAs
- Slack/Teams integration

### **2. Delivery History**
- Track delivered vs. on-time percentage
- Show historical delivery performance
- Department-wise on-time delivery rates

### **3. Bulk Actions**
- Update multiple delivery dates at once
- Mark multiple items as delivered
- Reschedule deliveries in bulk

### **4. Export Delivery Reports**
- Export filtered deliveries to Excel
- Generate delivery timeline reports
- Create department delivery summaries

### **5. Calendar View**
- Visual calendar showing delivery dates
- Drag-and-drop to reschedule
- Month/week/day views

### **6. Delivery Dependencies**
- Link dependent deliveries (e.g., Layout → Animation → Lighting)
- Auto-adjust subsequent ETAs when dependencies change
- Visual dependency chains

### **7. Client Portal Integration**
- Share delivery timelines with clients
- Client-visible delivery status
- Automated delivery confirmations

### **8. Performance Metrics**
- Average delivery time by department
- On-time delivery percentage
- Delivery velocity trends
- Lead performance metrics

### **9. Priority Levels**
- Mark deliveries as High/Medium/Low priority
- Sort by priority + date
- Visual priority indicators

### **10. Delivery Comments/Notes**
- Add notes to specific deliveries
- Track delivery blockers
- Communication thread per delivery

---

## 🔧 Technical Details

### **File Structure**
```
components/
├── DeliveryView.tsx              # Main delivery page
├── UpcomingDeliveriesWidget.tsx  # Dashboard widget
└── DashboardView.tsx             # Updated with widget

app/
└── page.tsx                      # Added Delivery tab
```

### **State Management**
- Uses Zustand store (`useVFXStore`)
- Filters stored in component state
- Real-time filtering (no API calls needed)

### **Performance Optimizations**
- `useMemo` for expensive calculations
- Filtered data computed once per state change
- Virtual scrolling for large delivery lists

### **Data Sources**
Delivery data comes from existing Task fields:
- `task.internalEta` (Date)
- `task.clientEta` (Date)
- `task.deliveredDate` (Date)
- `task.deliveredVersion` (String)
- `task.department` (String)
- `task.leadName` (String)
- `task.status` (String)

---

## 📊 Sample Workflows

### **Production Coordinator's Daily Routine**
```
1. Morning: Check Dashboard → Upcoming Deliveries Widget
   - See today's deliveries at a glance
   - Identify any overdue items

2. Mid-day: Open Delivery page
   - Filter by "Today" + specific department
   - Follow up with leads on pending deliveries

3. End of day: Review "This Week"
   - Plan next day's priorities
   - Update ETAs if needed
```

### **Department Lead's Workflow**
```
1. Select their department (e.g., "Comp")
2. Filter by "This Week"
3. Review all upcoming deliveries
4. Check lead assignments
5. Update status as work progresses
6. Mark delivered when complete
```

### **VFX Supervisor's Overview**
```
1. Dashboard view → Upcoming Deliveries Widget
   - Quick glance at all critical deadlines

2. Delivery page → "Client ETA" only
   - Focus on client-facing deliveries
   - Ensure client deadlines are met

3. Filter by "Overdue"
   - Address delayed deliveries
   - Reschedule or escalate as needed
```

---

## 🎨 UI/UX Highlights

### **Color System**
- **Red tones**: Urgent/Overdue (immediate action required)
- **Orange tones**: Today (attention needed)
- **Yellow tones**: Soon (plan ahead)
- **Blue tones**: Normal (standard tracking)
- **Green tones**: Completed (success state)

### **Icon Usage**
- 📦 **Truck icon**: Delivery tab
- ⚠️ **Alert Triangle**: Overdue items
- 🔔 **Bell**: Today's deliveries
- ✅ **Check Circle**: Delivered items
- 📅 **Calendar**: Date-related features
- 🔍 **Filter**: Filter panel

### **Responsive Design**
- Mobile-friendly filter panel
- Collapsible filter sections
- Horizontal scroll for table on small screens
- Stacked cards on mobile

---

## 🚦 Status Legend

### **Urgency Levels**
| Level | Timing | Color | Action Required |
|-------|--------|-------|-----------------|
| **Overdue** | Past deadline | 🔴 Red | Immediate action |
| **Today** | Due today | 🟠 Orange | Complete ASAP |
| **Urgent** | ≤3 days | 🟡 Yellow | Plan completion |
| **Soon** | 4-7 days | 🟦 Blue | Monitor progress |
| **Normal** | >7 days | ⚪ White | Track normally |

---

## 📈 Metrics & KPIs

### **Available Metrics**
1. **Total Deliveries**: All tracked deliveries in filtered view
2. **Overdue Count**: Deliveries past deadline (not delivered)
3. **Today Count**: Deliveries due today
4. **This Week Count**: Deliveries due in next 7 days

### **Suggested Additional KPIs**
- On-time delivery percentage
- Average days to deliver
- Department efficiency rating
- Lead performance scores
- Client vs Internal delivery accuracy

---

## 🔐 Best Practices

### **For Production Coordinators**
✅ Check Dashboard widget every morning
✅ Update delivery dates as soon as they change
✅ Mark items as delivered immediately upon completion
✅ Use "Overdue" filter to catch missed deadlines
✅ Export weekly reports for management

### **For Department Leads**
✅ Filter by your department daily
✅ Keep "This Week" view open during planning
✅ Update task status to reflect delivery progress
✅ Communicate delays immediately
✅ Review lead assignments for balance

### **For VFX Supervisors**
✅ Focus on "Client ETA" for stakeholder reporting
✅ Monitor "Overdue" for escalation
✅ Review department completion rates
✅ Use custom date ranges for milestone planning
✅ Export delivery reports for client meetings

---

## 🛠️ Configuration

### **Customizing Date Ranges**
Edit `DeliveryView.tsx` to adjust date filter logic:
```typescript
// Current: This Week = 7 days
// Change to: This Week = 5 days (M-F only)
weekFromNow.setDate(today.getDate() + 5);
```

### **Adjusting Urgency Thresholds**
Modify urgency calculation in `getDeliveryUrgency()`:
```typescript
// Current thresholds:
if (daysUntil <= 3) return 'urgent';  // Change to 2 for tighter urgency
if (daysUntil <= 7) return 'soon';    // Change to 5 for shorter window
```

### **Widget Display Limit**
Change number of items shown in widget:
```typescript
// UpcomingDeliveriesWidget.tsx
.slice(0, 10)  // Change 10 to desired number
```

### **Customizing Export Filename**
Modify filename generation in `handleExportDeliveries()`:
```typescript
// Current format: Delivery_Report_YYYY-MM-DD_[dept]_[filter].xlsx
// Custom format:
const filename = `MyCompany_Deliveries_${timestamp}.xlsx`;
```

### **Export Column Customization**
Add or remove columns in the export data mapping:
```typescript
// Add custom columns:
row['Priority'] = item.priority || 'Normal';
row['Notes'] = item.notes || '';
```

---

## 🎉 Summary

The Delivery Tracking system provides:
- ✅ **Comprehensive delivery management**
- ✅ **Smart filtering (date, department, show, status, lead, tag, type)**
- ✅ **Visual urgency indicators**
- ✅ **Dashboard widget for quick overview**
- ✅ **Flexible date range selection**
- ✅ **Department-wise tracking**
- ✅ **Color-coded status system**
- ✅ **Delivered status tracking**
- ✅ **Excel export with smart filtering** ⭐ NEW!
- ✅ **Type filter (Internal/Main)** ⭐ NEW!
- ✅ **Tag filter (Fresh/Additional)** ⭐ NEW!

**Perfect for:** Production coordinators, department leads, VFX supervisors, and anyone managing delivery deadlines!

### **Export Features:**
- 📊 Export filtered or unfiltered deliveries
- 📁 Smart filename with timestamp and filters
- 📋 Conditional columns based on delivery type selection
- 💾 Auto-sized columns for readability
- 🎯 One-click export for reports

---

**Next Steps:** Consider implementing suggested features like notifications, calendar view, and delivery history for even more powerful tracking!
