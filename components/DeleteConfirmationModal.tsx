'use client';

import React from 'react';
import type { Shot } from '@/lib/types';

interface DeleteConfirmationModalProps {
  shots: Shot[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmationModal({ 
  shots, 
  onConfirm, 
  onCancel 
}: DeleteConfirmationModalProps) {
  const shotCount = shots.length;
  const maxDisplayShots = 5;
  const displayShots = shots.slice(0, maxDisplayShots);
  const remainingCount = shotCount - maxDisplayShots;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete {shotCount} {shotCount === 1 ? 'Shot' : 'Shots'}?
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                This action cannot be undone directly. You can restore from Activity Log.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ All tasks associated with these shots will also be deleted.
            </p>
          </div>

          {/* Shot List */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Shots to be deleted:
            </p>
            <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {displayShots.map((shot) => (
                  <li key={shot.id} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                    <span className="font-medium">{shot.shotName}</span>
                    {shot.sequence && (
                      <span className="text-gray-500">({shot.sequence})</span>
                    )}
                  </li>
                ))}
                {remainingCount > 0 && (
                  <li className="text-sm text-gray-500 italic mt-2">
                    ...and {remainingCount} more {remainingCount === 1 ? 'shot' : 'shots'}
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Recovery Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Recovery:</strong> You can restore deleted shots from the Activity Log
              within the session. Click the "Undo" button in the toast notification or use
              the Activity Log panel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm hover:shadow"
          >
            Delete {shotCount} {shotCount === 1 ? 'Shot' : 'Shots'}
          </button>
        </div>
      </div>
    </div>
  );
}
