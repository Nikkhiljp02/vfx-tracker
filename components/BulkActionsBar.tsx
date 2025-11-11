'use client';

import { useState, useMemo } from 'react';
import { useVFXStore } from '@/lib/store';
import { Calendar, User, X } from 'lucide-react';

export default function BulkActionsBar() {
  const { selectedShotIds, clearSelection, shows, shots } = useVFXStore();
  const [showETAModal, setShowETAModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [etaType, setETAType] = useState<'internal' | 'client'>('internal');

  // Check if user has edit permission for selected shots
  const hasEditPermission = useMemo(() => {
    if (selectedShotIds.size === 0) return false;
    
    const selectedShots = shots.filter(s => selectedShotIds.has(s.id));
    return selectedShots.some(shot => {
      const show = shows.find(sh => sh.id === shot.showId);
      return show?.canEdit === true;
    });
  }, [selectedShotIds, shots, shows]);

  // Don't show bar if no selection or no edit permission
  if (selectedShotIds.size === 0 || !hasEditPermission) return null;

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
        <div className="bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 px-6 py-4 flex items-center gap-4">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="font-semibold">
              {selectedShotIds.size} shot{selectedShotIds.size !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="w-px h-8 bg-gray-700"></div>

          {/* Action Buttons */}
          <button
            onClick={() => {
              setETAType('internal');
              setShowETAModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
          >
            <Calendar size={18} />
            Set Internal ETA
          </button>

          <button
            onClick={() => {
              setETAType('client');
              setShowETAModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium"
          >
            <Calendar size={18} />
            Set Client ETA
          </button>

          <button
            onClick={() => setShowLeadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-medium"
          >
            <User size={18} />
            Assign Lead
          </button>

          <div className="w-px h-8 bg-gray-700"></div>

          {/* Clear Selection */}
          <button
            onClick={clearSelection}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <X size={18} />
            Clear
          </button>
        </div>
      </div>

      {/* Modals */}
      {showETAModal && (
        <BulkETAModal
          etaType={etaType}
          onClose={() => setShowETAModal(false)}
        />
      )}

      {showLeadModal && (
        <BulkLeadModal onClose={() => setShowLeadModal(false)} />
      )}
    </>
  );
}

// Bulk ETA Update Modal
function BulkETAModal({
  etaType,
  onClose
}: {
  etaType: 'internal' | 'client';
  onClose: () => void;
}) {
  const { selectedShotIds, clearSelection, setShows } = useVFXStore();
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!date) {
      setError('Please select a date');
      return;
    }

    const confirmed = confirm(
      `Set ${etaType === 'internal' ? 'Internal' : 'Client'} ETA to ${new Date(date).toLocaleDateString()} for ${selectedShotIds.size} shot${selectedShotIds.size !== 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/tasks/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotIds: Array.from(selectedShotIds),
          updates: {
            [etaType === 'internal' ? 'internalEta' : 'clientEta']: new Date(date).toISOString()
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update ETAs');
        return;
      }

      // Fetch updated shows (which includes nested shots and tasks)
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
      
      clearSelection();
      onClose();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">
          Set {etaType === 'internal' ? 'Internal' : 'Client'} ETA
        </h2>

        <p className="text-gray-600 mb-4">
          This will update the {etaType === 'internal' ? 'Internal' : 'Client'} ETA for all tasks in {selectedShotIds.size} selected shot{selectedShotIds.size !== 1 ? 's' : ''}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update ETA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Bulk Lead Assignment Modal
function BulkLeadModal({ onClose }: { onClose: () => void }) {
  const { selectedShotIds, clearSelection, setShows, shows } = useVFXStore();
  const [department, setDepartment] = useState('');
  const [leadName, setLeadName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get all departments from shows
  const allDepartments = Array.from(
    new Set(
      shows.flatMap(show => {
        try {
          return JSON.parse(show.departments);
        } catch {
          return [];
        }
      })
    )
  ).sort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!department || !leadName.trim()) {
      setError('Please select department and enter lead name');
      return;
    }

    const confirmed = confirm(
      `Assign "${leadName}" as ${department} lead for ${selectedShotIds.size} shot${selectedShotIds.size !== 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/tasks/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotIds: Array.from(selectedShotIds),
          department,
          updates: {
            leadName
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to assign lead');
        return;
      }

      // Fetch updated shows (which includes nested shots and tasks)
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
      
      clearSelection();
      onClose();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Assign Lead Artist</h2>

        <p className="text-gray-600 mb-4">
          This will assign a lead artist to tasks in {selectedShotIds.size} selected shot{selectedShotIds.size !== 1 ? 's' : ''}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select Department --</option>
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Name
            </label>
            <input
              type="text"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="Enter lead artist name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Assigning...' : 'Assign Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
