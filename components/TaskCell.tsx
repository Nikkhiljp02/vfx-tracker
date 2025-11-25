'use client';

import { Task, StatusOption } from '@/lib/types';
import { useState, useMemo } from 'react';
import { useVFXStore } from '@/lib/store';
import { formatDisplayDate, isValidStatusTransition, incrementVersion } from '@/lib/utils';
import { Pencil, Save, X, Lock } from 'lucide-react';

interface TaskCellProps {
  task: Task;
}

export default function TaskCell({ task }: TaskCellProps) {
  const { statusOptions, setShows, shows } = useVFXStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [isSaving, setIsSaving] = useState(false);

  // Find the show this task belongs to and check if user can edit
  const canEdit = useMemo(() => {
    // First try to use shotId directly (optimized API response)
    if (task.shotId) {
      // Find which show contains this shot
      const show = shows.find(s => 
        s.shots?.some(shot => shot.id === task.shotId)
      );
      
      const hasPermission = show?.canEdit ?? false;
      
      console.log('🔐 TaskCell Permission Check (via shotId):', {
        taskId: task.id,
        shotId: task.shotId,
        showName: show?.showName,
        canEdit: show?.canEdit,
        result: hasPermission
      });
      
      return hasPermission;
    }
    
    // Fallback: try using task.shot relationship (if loaded)
    const shot = task.shot;
    if (!shot) {
      console.log('❌ TaskCell: No shot or shotId for task', task.id);
      return false;
    }
    
    const show = shows.find(s => s.id === shot.showId);
    const hasPermission = show?.canEdit ?? false;
    
    console.log('🔐 TaskCell Permission Check (via shot):', {
      taskId: task.id,
      showId: shot.showId,
      showName: show?.showName,
      canEdit: show?.canEdit,
      result: hasPermission
    });
    
    return hasPermission;
  }, [shows, task.shotId, task.shot, task.id]);

  const statusOption = statusOptions.find(s => s.statusName === task.status);
  const statusColor = statusOption?.colorCode || '#6B7280';

  const handleSave = async () => {
    // Validate internal task status - cannot be AWF or C APP
    if (task.isInternal && (editedTask.status === 'AWF' || editedTask.status === 'C APP')) {
      alert('Internal dependency tasks cannot be marked as AWF or C APP.\nAllowed statuses: YTS, WIP, Int App, OMIT, HOLD');
      return;
    }

    setIsSaving(true);
    
    // Optimistic update - update UI immediately
    const updatedShows = shows.map(show => ({
      ...show,
      shots: show.shots?.map(shot => ({
        ...shot,
        tasks: shot.tasks?.map(t => 
          t.id === task.id 
            ? { ...t, ...editedTask }
            : t
        )
      }))
    }));
    setShows(updatedShows);
    setIsEditing(false);
    
    try {
      // Prepare request body
      const requestBody: any = {
        status: editedTask.status,
        leadName: editedTask.leadName,
        bidMds: editedTask.bidMds,
        internalEta: editedTask.internalEta,
        clientEta: editedTask.clientEta,
      };

      // Only include deliveredVersion and deliveredDate if:
      // 1. Status is already AWF (editing existing AWF task)
      // 2. OR they have been explicitly modified from the original task values
      if (task.status === 'AWF' || editedTask.deliveredVersion !== task.deliveredVersion) {
        requestBody.deliveredVersion = editedTask.deliveredVersion;
      }
      if (task.status === 'AWF' || editedTask.deliveredDate !== task.deliveredDate) {
        requestBody.deliveredDate = editedTask.deliveredDate;
      }

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update task');
        // Revert optimistic update on error
        const showsRes = await fetch('/api/shows');
        const showsData = await showsRes.json();
        setShows(showsData);
        return;
      }

      // Don't refresh immediately - let polling pick it up naturally
      
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
      // Revert optimistic update on error
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-2 bg-white border-2 border-blue-500 rounded space-y-2">
        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Status
            {task.isInternal && (
              <span className="ml-1 text-[10px] text-blue-600">(Internal - Limited)</span>
            )}
          </label>
          <select
            value={editedTask.status}
            onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          >
            {statusOptions.map((status) => {
              const isDisallowed = task.isInternal && (status.statusName === 'AWF' || status.statusName === 'C APP');
              return (
                <option 
                  key={status.id} 
                  value={status.statusName}
                  disabled={isDisallowed}
                  style={{ color: isDisallowed ? '#9CA3AF' : 'inherit' }}
                >
                  {status.statusName}{isDisallowed ? ' (Not allowed for internal)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Lead */}
        <div>
          <label className="block text-xs font-medium text-gray-700">Lead</label>
          <input
            type="text"
            value={editedTask.leadName || ''}
            onChange={(e) => setEditedTask({ ...editedTask, leadName: e.target.value })}
            placeholder="Lead name"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Bid */}
        <div>
          <label className="block text-xs font-medium text-gray-700">Bid (MDs)</label>
          <input
            type="number"
            step="0.25"
            value={editedTask.bidMds || ''}
            onChange={(e) => setEditedTask({ ...editedTask, bidMds: parseFloat(e.target.value) })}
            placeholder="0.00"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Internal ETA */}
        <div>
          <label className="block text-xs font-medium text-gray-700">Int ETA</label>
          <input
            type="date"
            value={editedTask.internalEta ? new Date(editedTask.internalEta).toISOString().split('T')[0] : ''}
            onChange={(e) => setEditedTask({ ...editedTask, internalEta: e.target.value ? new Date(e.target.value) : null })}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Client ETA */}
        <div>
          <label className="block text-xs font-medium text-gray-700">Client ETA</label>
          <input
            type="date"
            value={editedTask.clientEta ? new Date(editedTask.clientEta).toISOString().split('T')[0] : ''}
            onChange={(e) => setEditedTask({ ...editedTask, clientEta: e.target.value ? new Date(e.target.value) : null })}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Delivered Version */}
        <div>
          <label className="block text-xs font-medium text-gray-700">Delivered Version</label>
          <input
            type="text"
            value={editedTask.deliveredVersion || ''}
            onChange={(e) => setEditedTask({ ...editedTask, deliveredVersion: e.target.value })}
            placeholder="v001"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Delivered Date */}
        <div>
          <label className="block text-xs font-medium text-gray-700">Delivered Date</label>
          <input
            type="date"
            value={editedTask.deliveredDate ? new Date(editedTask.deliveredDate).toISOString().split('T')[0] : ''}
            onChange={(e) => setEditedTask({ ...editedTask, deliveredDate: e.target.value ? new Date(e.target.value) : null })}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            <Save size={12} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={12} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`p-2 rounded transition-colors group relative ${canEdit ? 'hover:bg-gray-100 cursor-pointer' : 'bg-gray-50'}`}
      onClick={() => canEdit && setIsEditing(true)}
      title={canEdit ? 'Click to edit' : 'View only - No edit permission'}
    >
      {/* Status Badge */}
      <div 
        className="text-xs font-medium px-2 py-1 rounded text-white text-center mb-1"
        style={{ backgroundColor: statusColor }}
      >
        {task.status}
      </div>

      {/* Task Details */}
      <div className="text-xs space-y-1">
        {task.leadName && (
          <div className="text-gray-700">
            <span className="font-medium">Lead:</span> {task.leadName}
          </div>
        )}
        
        {task.bidMds !== null && (
          <div className="text-gray-700">
            <span className="font-medium">Bid:</span> {task.bidMds} MDs
          </div>
        )}

        {task.internalEta && (
          <div className="text-gray-600">
            <span className="font-medium">Int ETA:</span> {formatDisplayDate(task.internalEta)}
          </div>
        )}

        {task.clientEta && (
          <div className="text-gray-600">
            <span className="font-medium">Client ETA:</span> {formatDisplayDate(task.clientEta)}
          </div>
        )}

        {task.deliveredVersion && (
          <div className="text-green-700 font-medium">
            {task.deliveredVersion} - {formatDisplayDate(task.deliveredDate)}
          </div>
        )}

        {task.isInternal && (
          <div className="text-xs text-blue-600 font-medium">
            (Internal)
          </div>
        )}
      </div>

      {/* Edit Icon on Hover or Lock Icon if no permission */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canEdit ? (
          <Pencil size={14} className="text-blue-600" />
        ) : (
          <Lock size={14} className="text-gray-400 opacity-100" />
        )}
      </div>
    </div>
  );
}
