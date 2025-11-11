'use client';

import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportChange {
  show: string;
  shot: string;
  tag: string;
  department: string;
  isInternal: boolean;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  changes: ImportChange[];
  onConfirm: (updateExisting: boolean) => Promise<void>;
}

export default function ImportPreviewModal({
  isOpen,
  onClose,
  changes,
  onConfirm,
}: ImportPreviewModalProps) {
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(updateExisting);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold">Import Preview</h2>
              <p className="text-sm text-gray-600">
                Review changes before importing ({changes.length} records)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Update Mode Toggle */}
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  Update Existing Data
                </span>
                {updateExisting ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <AlertCircle className="text-orange-600" size={18} />
                )}
              </div>
              <p className="text-sm text-gray-600">
                {updateExisting
                  ? 'Will update existing tasks for matching Show + Shot + Department'
                  : 'Will create new shows and shots (may create duplicates)'}
              </p>
            </div>
          </label>
        </div>

        {/* Changes List */}
        <div className="flex-1 overflow-auto p-6">
          {changes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Changes Detected</h3>
              <p className="text-gray-600">
                The data in your Excel file matches the current database.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {changes.map((change, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                {/* Record Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                      {change.show}
                    </div>
                    <div className="text-gray-400">→</div>
                    <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold">
                      {change.shot}
                    </div>
                    <div className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {change.tag}
                    </div>
                    <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                      {change.department}
                      {change.isInternal && ' (Internal)'}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {change.changes.length} change{change.changes.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Changes */}
                <div className="space-y-2">
                  {change.changes.map((fieldChange, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-sm bg-gray-50 rounded p-2"
                    >
                      <span className="font-medium text-gray-700 min-w-[100px]">
                        {fieldChange.field}:
                      </span>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded line-through">
                          {fieldChange.oldValue || '(empty)'}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                          {fieldChange.newValue || '(empty)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {updateExisting ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={16} />
                Will update {changes.length} existing record{changes.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <AlertCircle className="text-orange-600" size={16} />
                Will create new records (check for duplicates!)
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  {updateExisting ? 'Update Data' : 'Import as New'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
