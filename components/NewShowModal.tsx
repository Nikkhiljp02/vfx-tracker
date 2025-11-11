'use client';

import { useState } from 'react';
import { useVFXStore } from '@/lib/store';
import { X } from 'lucide-react';

interface NewShowModalProps {
  onClose: () => void;
}

export default function NewShowModal({ onClose }: NewShowModalProps) {
  const { setShows } = useVFXStore();
  const [formData, setFormData] = useState({
    showName: '',
    clientName: '',
    departments: ['Comp', 'Paint', 'Roto', 'MMRA'],
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.showName.trim()) {
      alert('Show name is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create show');
      }

      // Fetch updated shows to refresh the table instantly
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
      onClose();
    } catch (error) {
      console.error('Error creating show:', error);
      alert('Failed to create show');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDepartment = (dept: string) => {
    if (formData.departments.includes(dept)) {
      setFormData({
        ...formData,
        departments: formData.departments.filter(d => d !== dept),
      });
    } else {
      setFormData({
        ...formData,
        departments: [...formData.departments, dept],
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Create New Show</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Show Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Show Name *
            </label>
            <input
              type="text"
              value={formData.showName}
              onChange={(e) => setFormData({ ...formData, showName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter show name"
              required
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name
            </label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter client name"
            />
          </div>

          {/* Departments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departments *
            </label>
            <div className="space-y-2">
              {['Comp', 'Paint', 'Roto', 'MMRA'].map((dept) => (
                <label key={dept} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.departments.includes(dept)}
                    onChange={() => toggleDepartment(dept)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{dept}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Enter notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || formData.departments.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Creating...' : 'Create Show'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
