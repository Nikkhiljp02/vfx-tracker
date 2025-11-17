# Quick Reference: Import/Export & Sync

## 🎯 Quick Actions

### Import Allocations
```
Allocations Page → Select Mode → Import CSV → Choose File → Confirm
```

**Modes:**
- **Add New**: Creates new allocations
- **Update Existing**: Modifies existing allocations only

### Export Allocations
```
Allocations Page → Apply Filters → Export CSV → Download
```

**Filters Available:**
- Search (name/emp ID/shot)
- Department
- Shift
- Show
- Date Range (From/To)

---

## 📋 CSV Format

### Minimal Format (Required Only)
```csv
Action,Emp ID,Show,Shot,Start Date,End Date,Total MD
UPDATE,VFX001,ProjectX,Shot_010,2025-01-15,2025-01-17,3.0
NEW,VFX002,ProjectY,Shot_020,2025-01-16,2025-01-18,1.5
```

### Full Format (Export)
```csv
Action,Emp ID,Artist Name,Designation,Department,Shift,Show,Shot,Start Date,End Date,Days,Total MD
UPDATE,VFX001,John Doe,Compositor,Compositing,Day,ProjectX,Shot_010,2025-01-15,2025-01-17,3,3.0
NEW,VFX002,Jane Smith,Animator,Animation,Night,ProjectY,Shot_020,2025-01-16,2025-01-18,3,1.5
```

**Key Points:**
- **Action column required**: NEW (create) or UPDATE (replace existing)
- **Grouped format** (one row per allocation, not per day)
- **Required**: Action, Emp ID, Show, Shot, Start Date, End Date, Total MD
- **Auto-filled**: Artist Name, Designation, Department, Shift (from employee data)
- **1 MD/day limit**: Total MD ÷ Days cannot exceed 1.0
- Start/End dates define the period
- Total MD distributed evenly across days
- Export includes all columns; import accepts minimal or full

---

## 🔄 Sync Behavior

| Action | Updates |
|--------|---------|
| Add shot in Forecast | → Allocations + Dashboard |
| Delete shot in Forecast | → Allocations + Dashboard |
| Import CSV in Allocations | → Forecast + Dashboard |
| Bulk paste in Forecast | → Allocations + Dashboard |

**Sync Time:** < 1 second  
**Cross-Tab:** ✅ Yes

---

## ⚠️ Action Column Behavior

| Feature | NEW | UPDATE |
|---------|-----|--------|
| Create new entries | ✅ Yes | ✅ Yes (after delete) |
| Delete existing allocations | ❌ No | ✅ Yes (all for that member/date) |
| Can create duplicates | ⚠️ Yes | ❌ No (deletes first) |
| Use when | Adding new shots | Reassigning artist to different shot |
| Overwrites existing | ❌ No | ✅ Yes (complete replacement) |---

## 🎬 Common Workflows

### Update Man-Days
1. Export filtered allocations
2. Edit Man Days in Excel
3. Switch to **Update Existing** mode
4. Import modified CSV

### Add New Show Allocations
1. Prepare CSV with new allocations
2. Switch to **Add New** mode
3. Import CSV
4. Verify in Forecast view

### Department Report
1. Filter by department
2. Set date range
3. Export CSV
4. Share with team

---

## 🛡️ Data Safety

✅ **Safe Operations:**
- Update Existing mode (no duplicates)
- Filtered exports (only what you see)
- Cross-view sync (automatic)

⚠️ **Be Careful:**
- Add New mode (can create duplicates if allocation exists)
- Importing without validation (check Emp IDs first)
- Bulk operations (review before confirming)

---

## 🔍 Validation Rules

**Import Checks:**
- ✅ Employee ID must exist
- ✅ Employee must be active
- ✅ Date must be valid (YYYY-MM-DD)
- ✅ Man Days must be numeric
- ✅ Required columns present

**Auto-Sync Triggers:**
- Cell save in Forecast
- Bulk paste in Forecast
- Delete in Forecast
- Import completion in Allocations

---

## 🚀 Performance Tips

- Import in batches of <1000 rows for best speed
- Use filters before export to reduce file size
- Clear browser cache if sync seems slow
- Refresh views after very large imports (>5000 rows)

---

## 📞 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Employee not found" | Check Emp ID, verify employee is active |
| Changes not syncing | Wait 2s, then refresh view |
| Export is empty | Clear filters, check date range |
| Import all failed | Verify CSV column names exact match |

---

**Tip:** Always test import with 1-2 rows first before bulk importing!
