'use client';

import { useState, useEffect } from 'react';

// Type definition (will be replaced by Prisma types after migration)
interface ResourceMember {
  id: string;
  empId: string;
  empName: string;
  designation: string;
  reportingTo: string | null;
  department: string;
  shift: string;
  isActive: boolean;
  createdDate: Date;
  updatedDate: Date;
}

interface AllocationFormData {
  showName: string;
  shotName: string;
  manDays: number;
  isLeave: boolean;
  isIdle: boolean;
  notes: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  member: ResourceMember;
  date: Date;
  onSuccess: () => void;
}

export default function ResourceAllocationModal({ isOpen, onClose, member, date, onSuccess }: Props) {
  const [formData, setFormData] = useState<AllocationFormData>({
    showName: '',
    shotName: '',
    manDays: 0,
    isLeave: false,
    isIdle: false,
    notes: '',
  });
  const [existingAllocations, setExistingAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState<any>(null);

  // Load existing allocations for this member and date
  useEffect(() => {
    if (isOpen && member && date) {
      loadAllocations();
    }
  }, [isOpen, member, date]);

  const loadAllocations = async () => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(
        `/api/resource/allocations?resourceId=${member.id}&startDate=${dateStr}&endDate=${dateStr}`
      );
      if (!response.ok) throw new Error('Failed to load allocations');
      const data = await response.json();
      setExistingAllocations(data);
    } catch (error) {
      console.error('Error loading allocations:', error);
    }
  };

  // Validate allocation when MD changes
  useEffect(() => {
    if (formData.manDays > 0) {
      validateAllocation();
    }
  }, [formData.manDays]);

  const validateAllocation = async () => {
    try {
      const response = await fetch('/api/resource/allocations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: member.id,
          allocationDate: date.toISOString(),
          manDays: formData.manDays,
        }),
      });

      if (!response.ok) throw new Error('Validation failed');
      const data = await response.json();
      setValidation(data);
      
      if (!data.valid) {
        setError(data.error);
      } else {
        setError('');
      }
    } catch (error) {
      console.error('Error validating allocation:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.isLeave && !formData.isIdle && (!formData.showName || !formData.shotName)) {
      setError('Show Name and Shot Name are required for active allocations');
      return;
    }

    if (formData.manDays <= 0 || formData.manDays > 1.0) {
      setError('Man Days must be between 0 and 1.0');
      return;
    }

    if (!validation?.valid) {
      setError('Please fix validation errors before submitting');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/resource/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: member.id,
          allocationDate: date.toISOString(),
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create allocation');
      }

      const result = await response.json();
      
      if (result.warning) {
        alert(`Warning: ${result.warning}`);
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      showName: '',
      shotName: '',
      manDays: 0,
      isLeave: false,
      isIdle: false,
      notes: '',
    });
    setError('');
    setValidation(null);
    onClose();
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm('Delete this allocation?')) return;

    try {
      const response = await fetch(`/api/resource/allocations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete allocation');
      
      await loadAllocations();
      onSuccess();
    } catch (error) {
      console.error('Error deleting allocation:', error);
      alert('Failed to delete allocation');
    }
  };

  if (!isOpen) return null;

  const totalAllocated = existingAllocations.reduce((sum, a) => sum + a.manDays, 0);
  const remaining = 1.0 - totalAllocated;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Allocate Resource - {member.empName}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="p-6">
          {/* Existing Allocations */}
          {existingAllocations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Allocations</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {existingAllocations.map((alloc) => (
                  <div key={alloc.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {alloc.isLeave ? '🏖️ Leave' : alloc.isIdle ? '💤 Idle' : `${alloc.showName} / ${alloc.shotName}`}
                      </div>
                      {alloc.notes && <div className="text-xs text-gray-500">{alloc.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{alloc.manDays.toFixed(2)} MD</span>
                      <button
                        onClick={() => handleDeleteAllocation(alloc.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-300">
                  <span>Total Allocated:</span>
                  <span>{totalAllocated.toFixed(2)} MD</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Remaining:</span>
                  <span className={remaining <= 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {remaining.toFixed(2)} MD
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* New Allocation Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isLeave}
                  onChange={(e) => setFormData({ ...formData, isLeave: e.target.checked, isIdle: false })}
                  className="rounded"
                />
                <span className="text-sm">Leave</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isIdle}
                  onChange={(e) => setFormData({ ...formData, isIdle: e.target.checked, isLeave: false })}
                  className="rounded"
                />
                <span className="text-sm">Idle Time</span>
              </label>
            </div>

            {!formData.isLeave && !formData.isIdle && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Show Name</label>
                  <input
                    type="text"
                    value={formData.showName}
                    onChange={(e) => setFormData({ ...formData, showName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shot Name</label>
                  <input
                    type="text"
                    value={formData.shotName}
                    onChange={(e) => setFormData({ ...formData, shotName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Man Days (0.0 - 1.0)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="1.0"
                value={formData.manDays}
                onChange={(e) => setFormData({ ...formData, manDays: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {validation && (
                <div className={`text-xs mt-1 ${validation.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {validation.valid ? (
                    <>
                      New total: {validation.newTotal.toFixed(2)} MD | Remaining: {validation.remaining.toFixed(2)} MD
                      {validation.warning && <div className="text-orange-600 mt-1">⚠️ {validation.warning}</div>}
                    </>
                  ) : (
                    validation.error
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                disabled={loading || !validation?.valid}
              >
                {loading ? 'Adding...' : 'Add Allocation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
