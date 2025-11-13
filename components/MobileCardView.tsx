'use client';

import { useState, useRef, useEffect } from 'react';
import { Shot, Task } from '@/lib/types';
import { ChevronDown, ChevronRight, MessageSquare, Calendar, User, Layers, Clock, CheckCircle2, Circle, AlertCircle, X } from 'lucide-react';
import { formatDisplayDate } from '@/lib/utils';
import { showSuccess, showError } from '@/lib/toast';

interface MobileCardViewProps {
  shots: Shot[];
  onShotClick: (shotId: string, shotName: string) => void;
  shotsWithNotes: Set<string>;
  onStatusUpdate?: (taskId: string, newStatus: string) => void;
  hasEditPermission: boolean;
}

interface TaskCardProps {
  task: Task;
  hasEditPermission: boolean;
  onStatusClick: (task: Task) => void;
  getStatusIcon: (status: string) => React.ReactElement;
  getStatusColor: (status: string) => string;
}

function TaskCard({ 
  task, 
  hasEditPermission, 
  onStatusClick,
  getStatusIcon,
  getStatusColor 
}: TaskCardProps) {
  return (
    <div className="space-y-2 mt-2">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Status</span>
        <button 
          onClick={() => hasEditPermission && onStatusClick(task)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)} ${
            hasEditPermission ? 'active:scale-95 transition-transform cursor-pointer' : 'cursor-default'
          }`}
          disabled={!hasEditPermission}
        >
          {getStatusIcon(task.status)}
          {task.status}
        </button>
      </div>

      {/* Lead */}
      {task.leadName && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Lead</span>
          <span className="text-sm text-gray-900 flex items-center gap-1">
            <User className="w-3 h-3" />
            {task.leadName}
          </span>
        </div>
      )}

      {/* ETAs */}
      {(task.internalEta || task.clientEta) && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">ETA</span>
          <div className="text-sm text-gray-900 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {task.internalEta ? formatDisplayDate(new Date(task.internalEta)) : 
             task.clientEta ? formatDisplayDate(new Date(task.clientEta)) : '-'}
          </div>
        </div>
      )}

      {/* Delivered */}
      {task.deliveredDate && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Delivered</span>
          <div className="text-sm text-gray-900 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            {formatDisplayDate(new Date(task.deliveredDate))}
            {task.deliveredVersion && (
              <span className="text-xs text-gray-500 ml-1">
                (v{task.deliveredVersion})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bid MDs */}
      {task.bidMds && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Bid</span>
          <span className="text-sm text-gray-900 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {task.bidMds} MDs
          </span>
        </div>
      )}
    </div>
  );
}

export default function MobileCardView({ 
  shots, 
  onShotClick, 
  shotsWithNotes,
  onStatusUpdate,
  hasEditPermission 
}: MobileCardViewProps) {
  const [expandedShots, setExpandedShots] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);

  // Pull-to-refresh state
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch status options
  useEffect(() => {
    const fetchStatusOptions = async () => {
      try {
        const response = await fetch('/api/status-options');
        if (response.ok) {
          const data = await response.json();
          setStatusOptions(data);
        }
      } catch (error) {
        console.error('Failed to fetch status options:', error);
      }
    };
    fetchStatusOptions();
  }, []);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedTask) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      showSuccess(`Status updated to ${newStatus}`);
      setSelectedTask(null);
      
      // Refresh the page to show updated status
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const toggleShotExpanded = (shotId: string) => {
    setExpandedShots(prev => {
      const next = new Set(prev);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      return next;
    });
  };

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop === 0 && pullStartY.current > 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - pullStartY.current;
      
      if (distance > 0 && distance < 120) {
        setPullDistance(distance);
        setPulling(true);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      // Trigger refresh
      try {
        await fetch('/api/shows'); // Force cache update
        window.location.reload();
      } catch (error) {
        console.error('Refresh failed:', error);
      }
    }
    
    setPulling(false);
    setPullDistance(0);
    pullStartY.current = 0;
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || '';
    
    if (normalizedStatus.includes('app') || normalizedStatus.includes('delivered')) {
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    } else if (normalizedStatus.includes('wip') || normalizedStatus.includes('yts')) {
      return <Circle className="w-4 h-4 text-yellow-600" />;
    } else if (normalizedStatus.includes('hold') || normalizedStatus.includes('omit')) {
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
    return <Circle className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || '';
    
    if (normalizedStatus.includes('app') || normalizedStatus.includes('delivered')) {
      return 'bg-green-50 border-green-200 text-green-800';
    } else if (normalizedStatus.includes('wip')) {
      return 'bg-blue-50 border-blue-200 text-blue-800';
    } else if (normalizedStatus.includes('yts')) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    } else if (normalizedStatus.includes('hold')) {
      return 'bg-red-50 border-red-200 text-red-800';
    } else if (normalizedStatus.includes('omit')) {
      return 'bg-gray-50 border-gray-200 text-gray-800';
    }
    return 'bg-gray-50 border-gray-200 text-gray-600';
  };

  return (
    <div 
      ref={containerRef}
      className="space-y-3 pb-4 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pulling && (
        <div 
          className="flex items-center justify-center py-2 transition-all duration-200"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
        >
          <div className={`rounded-full p-2 ${pullDistance > 80 ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <svg
              className={`w-5 h-5 ${pullDistance > 80 ? 'text-blue-600' : 'text-gray-400'}`}
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {shots.map((shot) => {
        const isExpanded = expandedShots.has(shot.id);
        const hasNotes = shotsWithNotes.has(shot.id);
        const tasks = shot.tasks || [];
        
        // Group tasks by department
        const tasksByDept = tasks.reduce((acc, task) => {
          if (!acc[task.department]) {
            acc[task.department] = [];
          }
          acc[task.department].push(task);
          return acc;
        }, {} as Record<string, Task[]>);

        return (
          <div 
            key={shot.id} 
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Card Header - Always Visible */}
            <div 
              className="p-4 cursor-pointer active:bg-gray-50"
              onClick={() => toggleShotExpanded(shot.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <h3 className="font-semibold text-gray-900 truncate">
                      {shot.shotName}
                    </h3>
                    {hasNotes && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShotClick(shot.id, shot.shotName);
                        }}
                        className="flex-shrink-0 p-1 hover:bg-blue-50 rounded"
                      >
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {shot.show?.showName || 'Unknown Show'}
                  </p>
                </div>
                
                {/* Quick Status Badge */}
                {tasks.length > 0 && (
                  <div className="flex-shrink-0 ml-2">
                    {tasks.filter(t => t.status?.toLowerCase().includes('app')).length === tasks.length ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Complete
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {tasks.filter(t => t.status?.toLowerCase().includes('app')).length}/{tasks.length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Shot Metadata - Compact View */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-2">
                {shot.episode && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                    EP: {shot.episode}
                  </span>
                )}
                {shot.sequence && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                    SQ: {shot.sequence}
                  </span>
                )}
                {shot.frames && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                    {shot.frames}f
                  </span>
                )}
                {shot.shotTag && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                    shot.shotTag === 'Fresh' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {shot.shotTag}
                  </span>
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50">
                {/* Scope of Work */}
                {shot.scopeOfWork && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-white">
                    <p className="text-xs font-medium text-gray-500 mb-1">Scope of Work</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{shot.scopeOfWork}</p>
                  </div>
                )}

                {/* Remark */}
                {shot.remark && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-white">
                    <p className="text-xs font-medium text-gray-500 mb-1">Remark</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{shot.remark}</p>
                  </div>
                )}

                {/* Tasks by Department */}
                {tasks.length > 0 ? (
                  <div className="px-4 py-3 space-y-3">
                    {Object.entries(tasksByDept).map(([dept, deptTasks]) => (
                      <div key={dept} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="w-4 h-4 text-gray-500" />
                          <h4 className="font-medium text-sm text-gray-900">{dept}</h4>
                          {deptTasks[0].isInternal && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              Internal
                            </span>
                          )}
                        </div>
                        
                        {deptTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            hasEditPermission={hasEditPermission}
                            onStatusClick={(task) => setSelectedTask(task)}
                            getStatusIcon={getStatusIcon}
                            getStatusColor={getStatusColor}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    No tasks for this shot
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {shots.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No shots to display</p>
        </div>
      )}

      {/* Status Update Modal */}
      {selectedTask && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setSelectedTask(null)}
          />
          
          {/* Modal */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[70vh] overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Update Status</h3>
                <p className="text-sm text-gray-500">{selectedTask.department}</p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Current Status */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Current Status</p>
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium border ${getStatusColor(selectedTask.status)}`}>
                {getStatusIcon(selectedTask.status)}
                {selectedTask.status}
              </span>
            </div>

            {/* Status Options */}
            <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
              {statusOptions
                .filter(option => option.isActive)
                .sort((a, b) => a.statusOrder - b.statusOrder)
                .map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleStatusUpdate(option.statusName)}
                    disabled={updating || option.statusName === selectedTask.status}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      option.statusName === selectedTask.status
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50 active:scale-98'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {getStatusIcon(option.statusName)}
                    <span className="font-medium text-gray-900">{option.statusName}</span>
                    {option.statusName === selectedTask.status && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 ml-auto" />
                    )}
                  </button>
                ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <button
                onClick={() => setSelectedTask(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 active:scale-98 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
