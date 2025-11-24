# Complete Implementation Guide for Add Feedback Feature

## ✅ COMPLETED:
1. Enhanced FeedbackView component with all requested features
2. Created FeedbackModalContext for global modal access
3. Updated schema to PostgreSQL (fixed production issue)

## 🔧 REMAINING STEPS:

### Step 1: Update app/page.tsx

Add these imports at the top:
```typescript
import { FeedbackModalProvider, useFeedbackModal } from '@/lib/feedbackModalContext';
import { X } from 'lucide-react';
```

Wrap the entire app content with FeedbackModalProvider (after the return statement):
```typescript
return (
  <FeedbackModalProvider>
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* ... existing content ... */}
    </div>
    
    {/* Add this Feedback Modal before closing FeedbackModalProvider */}
    <FeedbackModalComponent />
  </FeedbackModalProvider>
);
```

Add this component inside Home() function:
```typescript
function FeedbackModalComponent() {
  const { isOpen, closeFeedbackModal, prefilledData } = useFeedbackModal();
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4" onClick={closeFeedbackModal}>
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">Add Feedback</h2>
          <button 
            onClick={closeFeedbackModal}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
        <div className="overflow-auto max-h-[calc(90vh-80px)]">
          <FeedbackView prefilledData={prefilledData || undefined} />
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Update TrackerTable.tsx

Add import at top:
```typescript
import { useFeedbackModal } from '@/lib/feedbackModalContext';
import { MessageSquarePlus } from 'lucide-react';
```

Inside TrackerTable component, add:
```typescript
const { openFeedbackModal } = useFeedbackModal();
```

Find the context menu rendering section (search for "Context Menu for Multi-Select") and add this menu item after "Update Status":

```typescript
{/* Add Feedback option */}
<button
  onClick={() => {
    if (contextMenu.selectedCells.size > 0) {
      const firstCell = Array.from(contextMenu.selectedCells)[0];
      const [taskId, dept] = firstCell.split('|');
      const task = contextMenu.tasks.find(t => t.id === taskId);
      
      if (task) {
        const shot = shows
          .flatMap(s => s.shots || [])
          .find(sh => sh.tasks?.some(t => t.id === taskId));
        const show = shows.find(s => s.shots?.some(sh => sh.id === shot?.id));
        
        openFeedbackModal({
          showName: show?.showName || '',
          shotName: shot?.shotName || '',
          shotTag: shot?.shotTag || 'Fresh',
          version: task.deliveredVersion || 'v001',
          department: dept,
          status: 'C KB',
          taskId: taskId,
        });
        setContextMenu({ ...contextMenu, isOpen: false });
      }
    }
  }}
  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 text-blue-600"
>
  <MessageSquarePlus size={16} />
  Add Feedback
</button>
```

### Step 3: Update DepartmentView.tsx

Same as TrackerTable - add the import, useFeedbackModal hook, and add the "Add Feedback" menu item to the context menu.

### Step 4: Commit and Push

```bash
git add .
git commit -m "feat: Add Feedback context menu integration with auto-fill and autocomplete

- Added global FeedbackModalContext for opening feedback modal from anywhere
- Integrated 'Add Feedback' option in TrackerTable and DepartmentView context menus
- Enhanced FeedbackView with shot/show autocomplete and no-reload caching
- Pre-fills all data when opening from context menu (user only adds notes)
- Fixed production database connection (PostgreSQL provider)"

git push origin main
```

## 🎯 Features Implemented:

1. ✅ No reload on tab switch (data cached)
2. ✅ Auto-fill show name from shot selection
3. ✅ Shot name autocomplete with dropdown
4. ✅ Accept prefilled data from context menu
5. ✅ Right-click "Add Feedback" in Tracker/Department views
6. ✅ Pre-populated form (only feedback notes needed)
7. ✅ Multiple shot selection UI (ready for future)

## 🧪 Testing:

1. Go to Tracker view
2. Right-click on any task cell
3. Select "Add Feedback"
4. Modal opens with pre-filled data
5. Add feedback notes and save
6. Switch to Feedback tab - no reload, data persists
