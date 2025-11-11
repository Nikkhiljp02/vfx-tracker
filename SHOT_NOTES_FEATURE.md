# Shot Notes & Communication Feature

## Overview
Added a comprehensive notes and communication system for shots in the VFX Tracker. Users can now add notes, comments, @mentions (users & departments), and see visual indicators when departments are mentioned.

## Features Implemented

### 1. Database Schema
**New Model: `ShotNote`**
- `id`: Unique identifier
- `shotId`: Reference to shot
- `content`: Note text
- `mentions`: JSON array of @mentions (users/departments)
- `attachments`: JSON array for future file attachments
- `userName`: Author name
- `createdDate`: Timestamp
- `updatedDate`: Timestamp
- `isEdited`: Boolean flag for edited notes

**Migration:** `20251106182828_add_shot_notes`

### 2. API Endpoints

#### GET /api/shot-notes?shotId=xxx
- Fetches all notes for a specific shot
- Returns notes with parsed mentions and attachments
- Sorted by creation date (newest first)

#### POST /api/shot-notes
- Creates a new note
- Body: `{ shotId, content, mentions, attachments, userName }`
- Automatically parses @mentions from content

#### PUT /api/shot-notes/[id]
- Updates an existing note
- Marks note as edited
- Updates mentions if content changed

#### DELETE /api/shot-notes/[id]
- Deletes a note permanently

### 3. Frontend Components

#### ShotChatPanel Component (`components/ShotChatPanel.tsx`)
- **Slide-in panel** from the right side (384px width)
- **Real-time chat interface** with:
  - Message list with timestamps
  - User avatars (gradient colored)
  - "X ago" relative timestamps (using date-fns)
  - Edit/Delete actions (hover to reveal)
  - @mention highlighting (blue for departments, purple for users)
  - Department badges showing which departments are mentioned
  - Auto-scroll to latest message

- **Input Features:**
  - Multi-line textarea with auto-resize
  - Enter to send, Shift+Enter for new line
  - @mention support (@PAINT, @COMP, etc.)
  - Helper text showing keyboard shortcuts
  - Loading states with spinner

- **Visual Design:**
  - Gradient header (blue-50 to white)
  - Info banner explaining @mentions
  - Empty state when no notes
  - Smooth animations (slide-in, fade)

### 4. Tracker Table Integration

#### Shot Column Enhancement
- Added **chat icon** (MessageSquare) next to shot name
- **Badge counter** showing number of notes (if any)
- Clicking icon opens chat panel for that shot
- Hover effect and tooltip

#### Department Cell Indicators
- **Red dot** (pulsing) appears in department cells when that department is @mentioned in any note
- Positioned at top-right corner of cell
- Only shows for departments that are mentioned
- Tooltip shows "DEPT mentioned in notes"

#### Note Count Tracking
- Fetches all shot notes on component mount
- Tracks note counts per shot
- Tracks which departments are mentioned per shot
- Refreshes after chat panel closes

### 5. Mention System

#### Parsing Logic
- Regex pattern: `/@(\w+)/g`
- Uppercase = department mention (e.g., @PAINT, @COMP)
- Mixed/lowercase = user mention (e.g., @john, @Sarah)
- Stored as JSON: `[{"type": "dept", "name": "PAINT"}, ...]`

#### Visual Indicators
- **In Chat:**
  - Blue highlight for department mentions
  - Purple highlight for user mentions
  - Badge pills below message for departments

- **In Tracker:**
  - Red pulsing dot in department cells
  - Badge count on shot name chat icon

### 6. Styling & Animations

#### New CSS Animations (`app/globals.css`)
```css
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out;
}
```

#### Responsive Design
- Fixed width panel (384px)
- Full height
- Scrollable message area
- Sticky header and input
- Z-index 50 (above tracker table)

## Technical Details

### Dependencies Added
- `date-fns` - For relative time formatting ("2 hours ago")

### State Management
```typescript
// In TrackerTable
const [chatPanelOpen, setChatPanelOpen] = useState(false);
const [chatShotId, setChatShotId] = useState<string | null>(null);
const [chatShotName, setChatShotName] = useState<string>('');
const [shotNoteCounts, setShotNoteCounts] = useState<Map<string, number>>(new Map());
const [shotDeptMentions, setShotDeptMentions] = useState<Map<string, Set<string>>>(new Map());
```

### Performance Considerations
- Notes fetched per shot (parallel requests)
- Cached counts in state
- Only re-fetches on panel close or data refresh
- Auto-scroll throttled

## User Workflow

### Adding a Note
1. Click chat icon next to shot name in tracker
2. Panel slides in from right
3. Type message in textarea
4. Use @PAINT, @COMP, etc. to mention departments
5. Press Enter to send (or click send button)
6. Note appears instantly with timestamp

### Viewing Department Mentions
1. If any note mentions @PAINT, a red dot appears in the Paint cell for that shot
2. Hover over dot to see tooltip
3. Click shot's chat icon to read the note

### Editing/Deleting Notes
1. Hover over any note
2. Edit icon and Delete icon appear
3. Click Edit → modify text → Save
4. Click Delete → confirm → note removed

## Future Enhancements (Prepared For)

### 1. User Authentication
- `userName` field ready for actual user system
- Replace "User" with logged-in user name
- User avatars can be photos instead of initials

### 2. File Attachments
- `attachments` JSON field prepared
- Can add file upload UI
- Store file paths/URLs in attachments array

### 3. Notifications
- Email/push notifications when mentioned
- Unread count system
- Badge on shots with unread notes

### 4. Mentions Autocomplete
- Dropdown showing available departments/users
- Filter as you type @
- Arrow keys to select

### 5. Rich Text
- Bold, italic, lists
- Code blocks for technical notes
- Emoji support

### 6. Search & Filter
- Search within notes
- Filter by department mentions
- Filter by date range

## Files Modified/Created

### Created
- `prisma/migrations/20251106182828_add_shot_notes/migration.sql`
- `app/api/shot-notes/route.ts`
- `app/api/shot-notes/[id]/route.ts`
- `components/ShotChatPanel.tsx`

### Modified
- `prisma/schema.prisma` - Added ShotNote model
- `lib/types.ts` - Added ShotNote, Mention, Attachment interfaces
- `components/TrackerTable.tsx` - Added chat icon, red dots, chat panel
- `app/globals.css` - Added slideIn animation
- `components/DashboardView.tsx` - Fixed dept.name → dept.deptName

## Usage Tips

### For Production Coordinators
- Use @PAINT to flag issues for paint department
- Add notes about client feedback
- Track revisions and approvals

### For Department Leads
- Check red dots for your department
- Respond to @mentions in notes
- Document technical issues

### For Supervisors
- Review all notes before client calls
- Track communication history per shot
- Identify bottlenecks via note patterns

## Testing Checklist

- [x] Create new note
- [x] Edit existing note
- [x] Delete note
- [x] @mention departments (@PAINT, @COMP)
- [x] Red dot appears in correct department cell
- [x] Chat panel slides in smoothly
- [x] Note count badge updates
- [x] Auto-scroll to latest message
- [x] Keyboard shortcuts work (Enter, Shift+Enter)
- [x] Empty state displays correctly
- [x] Timestamps update ("5 minutes ago")
- [x] Multiple shots can have separate notes
- [x] Edited flag shows on edited notes

## Known Limitations

1. **No real-time sync** - Must close and reopen panel to see new notes from others
2. **No user authentication** - All notes show as "User" currently
3. **No file attachments** - Field exists but UI not implemented
4. **No notification system** - Users must manually check for @mentions
5. **No note threading** - All notes are flat, no replies

## Recommended Next Steps

1. Add user authentication system
2. Implement WebSocket for real-time note updates
3. Add file upload for attachments
4. Create notification center for @mentions
5. Add note search and filtering
6. Implement read/unread status
7. Add note templates for common scenarios
8. Create analytics dashboard for communication patterns

---

**Version:** 1.0  
**Date:** November 6, 2025  
**Status:** ✅ Complete & Working
