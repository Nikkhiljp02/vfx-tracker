'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ResourceMember {
  id: string;
  empId: string;
  empName: string;
  designation: string;
  reportingTo: string | null;
  department: string;
  shift: string;
  isActive: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member?: ResourceMember | null; // For editing existing member
}

export default function ResourceMemberForm({ isOpen, onClose, onSuccess, member }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    empId: '',
    empName: '',
    designation: '',
    reportingTo: '',
    department: '',
    shift: 'Day',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = !!member;

  // Load member data when editing
  useEffect(() => {
    if (member) {
      setFormData({
        empId: member.empId,
        empName: member.empName,
        designation: member.designation,
        reportingTo: member.reportingTo || '',
        department: member.department,
        shift: member.shift,
        isActive: member.isActive,
      });
    }
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.empId || !formData.empName || !formData.designation || !formData.department) {
      setError('Emp ID, Name, Designation, and Department are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = isEditMode ? `/api/resource/members/${member.id}` : '/api/resource/members';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empId: formData.empId.trim(),
          empName: formData.empName.trim(),
          designation: formData.designation.trim(),
          reportingTo: formData.reportingTo.trim() || null,
          department: formData.department.trim(),
          shift: formData.shift,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} member`);
      }

      // Invalidate cache to refresh member list
      queryClient.invalidateQueries({ queryKey: ['resourceMembers'] });
      queryClient.invalidateQueries({ queryKey: ['resourceForecast'] });

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
      empId: '',
      empName: '',
      designation: '',
      reportingTo: '',
      department: '',
      shift: 'Day',
      isActive: true,
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditMode ? 'Edit Resource Member' : 'Add Resource Member'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emp ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.empId}
              onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              placeholder="EMP001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.empName}
              onChange={(e) => setFormData({ ...formData, empName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Designation <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              placeholder="Senior Compositor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reporting To
            </label>
            <input
              type="text"
              value={formData.reportingTo}
              onChange={(e) => setFormData({ ...formData, reportingTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Department</option>
              <option value="Roto">Roto</option>
              <option value="Paint">Paint</option>
              <option value="Comp">Comp</option>
              <option value="MMRA">MMRA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift
            </label>
            <select
              value={formData.shift}
              onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Day">Day</option>
              <option value="Night">Night</option>
              <option value="Flexible">Flexible</option>
            </select>
          </div>

          {isEditMode && (
            <div className="flex items-center gap-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Active Member</span>
              </label>
              <span className="text-xs text-gray-500">(Uncheck to mark as inactive)</span>
            </div>
          )}

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
              disabled={loading}
            >
              {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Member' : 'Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
