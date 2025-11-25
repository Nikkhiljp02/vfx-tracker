'use client';

import { useState, useEffect, useMemo } from 'react';
import { useVFXStore } from '@/lib/store';
import { showSuccess, showError } from '@/lib/toast';
import { X, RotateCcw, Filter, Calendar, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  actionType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  userName: string | null;
  timestamp: string;
  isReversed: boolean;
  relatedEntityName?: string | null;
  relatedShotName?: string | null;
  relatedShowName?: string | null;
}

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityLogModal({ isOpen, onClose }: ActivityLogModalProps) {
  const { data: session } = useSession();
  const { setShows } = useVFXStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [undoing, setUndoing] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [bulkUndoing, setBulkUndoing] = useState(false);
  
  // Check if user has edit permission (only Admin and Coordinator can undo)
  const canUndo = useMemo(() => {
    if (!session?.user) return false;
    const role = (session.user as any).role;
    return role === 'ADMIN' || role === 'COORDINATOR';
  }, [session]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, filterType]);

  // Filter logs based on search query
  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      log.entityType.toLowerCase().includes(query) ||
      log.entityId.toLowerCase().includes(query) ||
      log.actionType.toLowerCase().includes(query) ||
      (log.fieldName && log.fieldName.toLowerCase().includes(query)) ||
      (log.oldValue && log.oldValue.toLowerCase().includes(query)) ||
      (log.newValue && log.newValue.toLowerCase().includes(query)) ||
      (log.userName && log.userName.toLowerCase().includes(query)) ||
      // Search enriched entity names
      (log.relatedEntityName && log.relatedEntityName.toLowerCase().includes(query)) ||
      (log.relatedShotName && log.relatedShotName.toLowerCase().includes(query)) ||
      (log.relatedShowName && log.relatedShowName.toLowerCase().includes(query))
    );
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = filterType === 'all' 
        ? '/api/activity-logs?limit=200'
        : `/api/activity-logs?entityType=${filterType}&limit=200`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      const data = await response.json();
      
      // Handle both array format (legacy) and object format with logs property
      if (Array.isArray(data)) {
        setLogs(data);
      } else if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        console.error('Unexpected response format:', data);
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Get undoable logs (not reversed, and either UPDATE or DELETE)
  const undoableLogs = useMemo(() => {
    return filteredLogs.filter(log => 
      !log.isReversed && (log.actionType === 'UPDATE' || log.actionType === 'DELETE')
    );
  }, [filteredLogs]);

  // Toggle single log selection
  const toggleLogSelection = (logId: string) => {
    setSelectedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  // Toggle all logs selection
  const toggleSelectAll = () => {
    if (selectedLogs.length === undoableLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(undoableLogs.map(log => log.id));
    }
  };

  // Bulk undo selected logs
  const handleBulkUndo = async () => {
    if (selectedLogs.length === 0) return;

    const confirmMessage = `Are you sure you want to undo ${selectedLogs.length} selected change(s)?`;
    if (!confirm(confirmMessage)) return;

    setBulkUndoing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process each selected log
      for (const logId of selectedLogs) {
        try {
          const response = await fetch(`/api/activity-logs/${logId}/undo`, {
            method: 'POST',
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to undo log ${logId}:`, error);
          failCount++;
        }
      }

      // Show result message
      if (successCount > 0) {
        showSuccess(`Successfully undone ${successCount} change(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
      }
      if (failCount > 0 && successCount === 0) {
        showError(`Failed to undo ${failCount} change(s)`);
      }

      // Refresh logs and shows
      fetchLogs();
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);

      // Clear selection
      setSelectedLogs([]);
    } catch (error) {
      console.error('Bulk undo failed:', error);
      showError('Bulk undo operation failed');
    } finally {
      setBulkUndoing(false);
    }
  };

  const handleUndo = async (logId: string) => {
    const log = logs.find(l => l.id === logId);
    const confirmMessage = log?.actionType === 'DELETE' 
      ? 'Are you sure you want to restore this deleted item?' 
      : 'Are you sure you want to undo this change?';
    
    if (!confirm(confirmMessage)) return;

    setUndoing(logId);
    try {
      const response = await fetch(`/api/activity-logs/${logId}/undo`, {
        method: 'POST',
      });

      if (response.ok) {
        const successMessage = log?.actionType === 'DELETE'
          ? 'Item restored successfully!'
          : 'Change reversed successfully!';
        showSuccess(successMessage);
        fetchLogs();
        
        // Fetch updated shows to refresh the table instantly
        const showsRes = await fetch('/api/shows');
        const showsData = await showsRes.json();
        setShows(showsData);
      } else {
        const error = await response.json();
        showError(`Failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to undo change:', error);
      showError('Failed to perform action. Please try again.');
    } finally {
      setUndoing(null);
    }
  };

  const formatValue = (value: string | null) => {
    if (!value) return '-';
    
    // Check if it's a date string (ISO format)
    if (value.includes('T') && value.includes('Z')) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    
    // Return as-is for other values
    return value;
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'CREATE': return 'text-green-600 bg-green-50';
      case 'UPDATE': return 'text-blue-600 bg-blue-50';
      case 'DELETE': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold">Activity Log</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track all changes and undo actions
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by shot name, show name, entity ID, field, value, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            
            {/* Filter Row */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter by:</span>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Changes</option>
                <option value="Feedback">Feedback</option>
                <option value="Shot">Shots</option>
                <option value="Task">Tasks</option>
                <option value="Show">Shows</option>
                <option value="StatusOption">Status Options</option>
                <option value="Department">Departments</option>
              </select>
              <button
                onClick={fetchLogs}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>

            {/* Bulk Actions Toolbar */}
            {canUndo && undoableLogs.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedLogs.length === undoableLogs.length && undoableLogs.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedLogs.length > 0 
                      ? `${selectedLogs.length} selected`
                      : 'Select all undoable logs'
                    }
                  </span>
                </div>
                {selectedLogs.length > 0 && (
                  <button
                    onClick={handleBulkUndo}
                    disabled={bulkUndoing}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={16} />
                    {bulkUndoing ? 'Processing...' : `Undo ${selectedLogs.length} Selected`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchQuery || filterType !== 'all' 
                  ? 'No activity logs match your filters' 
                  : 'No activity logs found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.isArray(filteredLogs) && filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`
                    border border-gray-200 rounded-lg p-4 
                    ${log.isReversed ? 'bg-gray-50 opacity-60' : 'bg-white'}
                    ${selectedLogs.includes(log.id) ? 'ring-2 ring-blue-500' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    {/* Checkbox for bulk selection */}
                    {canUndo && !log.isReversed && (log.actionType === 'CREATE' || log.actionType === 'UPDATE' || log.actionType === 'DELETE') && (
                      <div className="mr-3 pt-1">
                        <input
                          type="checkbox"
                          checked={selectedLogs.includes(log.id)}
                          onChange={() => toggleLogSelection(log.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.actionType)}`}>
                          {log.actionType}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {log.entityType}
                        </span>
                        {/* Show related entity names for context */}
                        {log.relatedShotName && (
                          <span className="text-sm text-blue-600 font-medium">
                            Shot: {log.relatedShotName}
                          </span>
                        )}
                        {log.relatedShowName && (
                          <span className="text-sm text-purple-600">
                            Show: {log.relatedShowName}
                          </span>
                        )}
                        {log.relatedEntityName && !log.relatedShotName && (
                          <span className="text-sm text-gray-700 font-medium">
                            {log.relatedEntityName}
                          </span>
                        )}
                        {log.fieldName && (
                          <span className="text-sm text-gray-600">
                            Field: <span className="font-medium">{log.fieldName}</span>
                          </span>
                        )}
                        {log.isReversed && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                            REVERSED
                          </span>
                        )}
                      </div>

                      {log.actionType === 'UPDATE' && (
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Old Value:</p>
                            <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                              {formatValue(log.oldValue)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">New Value:</p>
                            <p className="text-sm text-green-600 font-mono bg-green-50 p-2 rounded">
                              {formatValue(log.newValue)}
                            </p>
                          </div>
                        </div>
                      )}

                      {log.actionType === 'DELETE' && (
                        <div className="mt-3">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-900 font-semibold mb-1">
                              Entity Deleted: {log.entityId}
                            </p>
                            {log.fieldName === 'cascadeFrom' && log.oldValue && (
                              <p className="text-xs text-red-700">
                                Cascade deletion from: {log.oldValue}
                              </p>
                            )}
                            <p className="text-xs text-red-600 mt-2">
                              Full backup available - can be restored
                            </p>
                          </div>
                        </div>
                      )}

                      {log.actionType === 'CREATE' && (
                        <div className="mt-3">
                          <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
                            New {log.entityType} created: {log.entityId}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        {log.userName && (
                          <div>
                            By: <span className="font-medium">{log.userName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {canUndo && !log.isReversed && !log.fieldName?.startsWith('undo_') && (log.actionType === 'CREATE' || log.actionType === 'UPDATE' || log.actionType === 'DELETE') && (
                      <button
                        onClick={() => handleUndo(log.id)}
                        disabled={undoing === log.id}
                        className={`flex items-center gap-2 px-3 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ml-4 ${
                          log.actionType === 'DELETE' 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-yellow-600 hover:bg-yellow-700'
                        }`}
                        title={log.actionType === 'DELETE' ? 'Restore deleted entity' : 'Undo this change'}
                      >
                        <RotateCcw size={16} />
                        {undoing === log.id 
                          ? (log.actionType === 'DELETE' ? 'Restoring...' : 'Undoing...') 
                          : (log.actionType === 'DELETE' ? 'Restore' : 'Undo')
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
