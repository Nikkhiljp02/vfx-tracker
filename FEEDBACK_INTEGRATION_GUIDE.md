// Add this to app/page.tsx to enable context menu "Add Feedback" functionality

import { useState } from 'react';
import FeedbackView from '@/components/FeedbackView';

// Add these state variables to page.tsx
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [feedbackPrefilledData, setFeedbackPrefilledData] = useState<any>(null);

// Export this function to be called from TrackerTable/DepartmentView
export function openFeedbackModal(data: {
  showName: string;
  shotName: string;
  shotTag: string;
  version?: string;
  department: string;
  status: string;
  taskId?: string;
}) {
  setFeedbackPrefilledData(data);
  setShowFeedbackModal(true);
}

// Add this modal to the render section (before closing </div>)
{showFeedbackModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">Add Feedback</h2>
        <button 
          onClick={() => {
            setShowFeedbackModal(false);
            setFeedbackPrefilledData(null);
          }}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
        <FeedbackView prefilledData={feedbackPrefilledData} />
      </div>
    </div>
  </div>
)}
