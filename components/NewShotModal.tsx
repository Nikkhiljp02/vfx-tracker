'use client';

import { useState, useEffect } from 'react';
import { useVFXStore } from '@/lib/store';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { parseDepartments } from '@/lib/utils';

interface NewShotModalProps {
  onClose: () => void;
}

export default function NewShotModal({ onClose }: NewShotModalProps) {
  const { shows, shots, setShows } = useVFXStore();
  const [formData, setFormData] = useState({
    showId: '',
    shotName: '',
    episode: '',
    sequence: '',
    turnover: '',
    frames: '',
    shotTag: 'Fresh',
    scopeOfWork: '',
    remark: '',
    tasks: [] as any[],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);

  const selectedShow = shows.find(s => s.id === formData.showId);
  const showDepartments = selectedShow ? parseDepartments(selectedShow.departments) : [];

  // Check for duplicates whenever shot name or show changes
  useEffect(() => {
    if (formData.showId && formData.shotName.trim()) {
      const showShots = shots.filter(s => s.showId === formData.showId);
      const duplicates = showShots.filter(s => 
        s.shotName.toLowerCase() === formData.shotName.toLowerCase().trim()
      );
      
      if (duplicates.length > 0) {
        setDuplicateWarning(duplicates.map(d => d.shotName));
      } else {
        // Check for similar names (fuzzy match)
        const similar = showShots.filter(s => {
          const shotLower = s.shotName.toLowerCase();
          const inputLower = formData.shotName.toLowerCase().trim();
          return shotLower.includes(inputLower) || inputLower.includes(shotLower);
        });
        
        if (similar.length > 0) {
          setDuplicateWarning(similar.map(d => d.shotName));
        } else {
          setDuplicateWarning([]);
        }
      }
    } else {
      setDuplicateWarning([]);
    }
  }, [formData.shotName, formData.showId, shots]);

  const addTask = () => {
    if (!formData.showId) {
      alert('Please select a show first');
      return;
    }

    setFormData({
      ...formData,
      tasks: [
        ...formData.tasks,
        {
          department: showDepartments[0] || 'Comp',
          isInternal: false,
          leadName: '',
          bidMds: null,
          internalEta: null,
          clientEta: null,
        },
      ],
    });
  };

  const removeTask = (index: number) => {
    setFormData({
      ...formData,
      tasks: formData.tasks.filter((_, i) => i !== index),
    });
  };

  const updateTask = (index: number, field: string, value: any) => {
    const updatedTasks = [...formData.tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setFormData({ ...formData, tasks: updatedTasks });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.showId || !formData.shotName.trim()) {
      alert('Show and shot name are required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create shot');
      }

      // Fetch updated shows to refresh the table instantly
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
      onClose();
    } catch (error) {
      console.error('Error creating shot:', error);
      alert('Failed to create shot');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Create New Shot</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Show */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Show *
              </label>
              <select
                value={formData.showId}
                onChange={(e) => setFormData({ ...formData, showId: e.target.value, tasks: [] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a show</option>
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.showName}
                  </option>
                ))}
              </select>
            </div>

            {/* Shot Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shot Name *
              </label>
              <input
                type="text"
                value={formData.shotName}
                onChange={(e) => setFormData({ ...formData, shotName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Shot_001"
                required
              />
              {duplicateWarning.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800">
                        Similar shots found:
                      </p>
                      <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                        {duplicateWarning.map((name, idx) => (
                          <li key={idx}>{name}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-yellow-600">
                        Please verify this is not a duplicate before creating.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Episode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Episode (EP)
              </label>
              <input
                type="text"
                value={formData.episode}
                onChange={(e) => setFormData({ ...formData, episode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., EP01"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Episode identifier
              </p>
            </div>

            {/* Sequence */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sequence (SEQ)
              </label>
              <input
                type="text"
                value={formData.sequence}
                onChange={(e) => setFormData({ ...formData, sequence: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., SQ010"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Sequence identifier
              </p>
            </div>

            {/* Turnover */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Turnover (TO)
              </label>
              <input
                type="text"
                value={formData.turnover}
                onChange={(e) => setFormData({ ...formData, turnover: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., TO01"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Group shots by turnover identifier
              </p>
            </div>

            {/* Frames */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frames
              </label>
              <input
                type="number"
                value={formData.frames}
                onChange={(e) => setFormData({ ...formData, frames: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 240"
                min="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Number of frames in this shot
              </p>
            </div>
          </div>

          {/* Shot Tag */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shot Tag
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="Fresh"
                  checked={formData.shotTag === 'Fresh'}
                  onChange={(e) => setFormData({ ...formData, shotTag: e.target.value })}
                  className="border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Fresh</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="Additional"
                  checked={formData.shotTag === 'Additional'}
                  onChange={(e) => setFormData({ ...formData, shotTag: e.target.value })}
                  className="border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Additional</span>
              </label>
            </div>
          </div>

          {/* Scope of Work */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scope of Work
            </label>
            <textarea
              value={formData.scopeOfWork}
              onChange={(e) => setFormData({ ...formData, scopeOfWork: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Describe the work required..."
            />
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remark
            </label>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Additional remarks or notes..."
            />
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Department Tasks
              </label>
              <button
                type="button"
                onClick={addTask}
                disabled={!formData.showId}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                Add Task
              </button>
            </div>

            {formData.tasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded">
                No tasks added yet. Click &quot;Add Task&quot; to create department tasks.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {formData.tasks.map((task, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Department
                        </label>
                        <select
                          value={task.department}
                          onChange={(e) => updateTask(index, 'department', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        >
                          {showDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Lead Name
                        </label>
                        <input
                          type="text"
                          value={task.leadName}
                          onChange={(e) => updateTask(index, 'leadName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="Lead name"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Bid (MDs)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          value={task.bidMds || ''}
                          onChange={(e) => updateTask(index, 'bidMds', parseFloat(e.target.value) || null)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={task.isInternal}
                            onChange={(e) => updateTask(index, 'isInternal', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Internal Dependency
                        </label>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeTask(index)}
                          className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Creating...' : 'Create Shot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
