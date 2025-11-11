'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Trash2, GripVertical } from 'lucide-react';

interface StatusOption {
  id: string;
  statusName: string;
  colorCode: string;
  statusOrder: number;
  isActive: boolean;
}

interface StatusManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function StatusManagementModal({
  isOpen,
  onClose,
  onUpdate,
}: StatusManagementModalProps) {
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState({ name: '', color: '#3B82F6' });

  useEffect(() => {
    if (isOpen) {
      fetchStatuses();
    }
  }, [isOpen]);

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/status-options?includeInactive=true');
      const data = await response.json();
      setStatuses(data.sort((a: StatusOption, b: StatusOption) => a.statusOrder - b.statusOrder));
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const handleAddStatus = async () => {
    if (!newStatus.name.trim()) return;

    setIsLoading(true);
    try {
      const maxOrder = Math.max(...statuses.map(s => s.statusOrder), 0);
      const response = await fetch('/api/status-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStatus.name,
          color: newStatus.color,
          order: maxOrder + 1,
          isActive: true,
        }),
      });

      if (response.ok) {
        setNewStatus({ name: '', color: '#3B82F6' });
        await fetchStatuses();
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: StatusOption) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/status-options/${status.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status),
      });

      if (response.ok) {
        await fetchStatuses();
        setEditingId(null);
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStatus = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this status?')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/status-options/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchStatuses();
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newStatuses = [...statuses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newStatuses.length) return;

    [newStatuses[index], newStatuses[targetIndex]] = [
      newStatuses[targetIndex],
      newStatuses[index],
    ];

    // Update order values
    newStatuses.forEach((status, idx) => {
      status.statusOrder = idx;
      handleUpdateStatus(status);
    });

    setStatuses(newStatuses);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Manage Status Options</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Add New Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-3">Add New Status</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Status name (e.g., IN REVIEW)"
              value={newStatus.name}
              onChange={(e) =>
                setNewStatus({ ...newStatus, name: e.target.value })
              }
              className="flex-1 px-3 py-2 border rounded"
            />
            <input
              type="color"
              value={newStatus.color}
              onChange={(e) =>
                setNewStatus({ ...newStatus, color: e.target.value })
              }
              className="w-16 h-10 border rounded cursor-pointer"
            />
            <button
              onClick={handleAddStatus}
              disabled={isLoading || !newStatus.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {/* Status List */}
        <div className="space-y-2">
          <h3 className="font-semibold mb-3">Current Statuses</h3>
          {statuses.map((status, index) => (
            <div
              key={status.id}
              className={`flex items-center gap-2 p-3 border rounded ${
                !status.isActive ? 'bg-gray-100 opacity-50' : 'bg-white'
              }`}
            >
              <div className="flex flex-col">
                <button
                  onClick={() => handleReorder(index, 'up')}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20"
                >
                  <GripVertical size={16} />
                </button>
              </div>

              {editingId === status.id ? (
                <>
                  <input
                    type="text"
                    value={status.statusName}
                    onChange={(e) =>
                      setStatuses(
                        statuses.map((s) =>
                          s.id === status.id ? { ...s, statusName: e.target.value } : s
                        )
                      )
                    }
                    className="flex-1 px-3 py-2 border rounded"
                  />
                  <input
                    type="color"
                    value={status.colorCode}
                    onChange={(e) =>
                      setStatuses(
                        statuses.map((s) =>
                          s.id === status.id ? { ...s, colorCode: e.target.value } : s
                        )
                      )
                    }
                    className="w-16 h-10 border rounded cursor-pointer"
                  />
                  <button
                    onClick={() => handleUpdateStatus(status)}
                    disabled={isLoading}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: status.colorCode }}
                  />
                  <span className="flex-1 font-medium">{status.statusName}</span>
                  <span className="text-sm text-gray-500">
                    Order: {status.statusOrder}
                  </span>
                  <span
                    className={`text-sm px-2 py-1 rounded ${
                      status.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {status.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => setEditingId(status.id)}
                    className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStatus(status.id)}
                    disabled={isLoading || !status.isActive}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
