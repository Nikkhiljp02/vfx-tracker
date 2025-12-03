'use client';

import { useVFXStore } from '@/lib/store';
import { useMemo, useState, useEffect } from 'react';
import { Task, Shot, Show } from '@/lib/types';
import TaskCell from './TaskCell';
import BulkActionsBar from './BulkActionsBar';
import ShotChatPanel from './ShotChatPanel';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { showSuccess, showError, showUndo } from '@/lib/toast';
import { Search, X, ChevronRight, MessageSquarePlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { matchesShotName } from '@/lib/searchUtils';
import { useFeedbackModal } from '@/lib/feedbackModalContext';

interface DepartmentViewProps {
  detailedView: boolean;
}

export default function DepartmentView({ detailedView }: DepartmentViewProps) {
  const { data: session } = useSession();
  const { shows, filters, statusOptions, setShows, selectionMode, selectedShotIds, toggleShotSelection, selectAllShots, clearSelection } = useVFXStore();
  const { openFeedbackModal } = useFeedbackModal();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Comp');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); // For delete mode
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Check if user has edit permission
  const hasEditPermission = useMemo(() => {
    if (!session?.user) return false;
    const role = (session.user as any).role;
    // Admin, Coordinator, Production Coordinator, or any role with COORDINATOR in name has full edit access
    if (role === 'ADMIN' || 
        role === 'COORDINATOR' || 
        role === 'PRODUCTION COORDINATOR' ||
        role?.toUpperCase().includes('COORDINATOR')) {
      return true;
    }
    // Check if user has edit permission on any show
    return shows.some(show => show.canEdit === true);
  }, [session, shows]);
  
  // Cell selection state for multi-select (non-detailed view)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [lastSelectedCell, setLastSelectedCell] = useState<{ cellId: string; rowIndex: number } | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    flipSubmenu: boolean; // Add this to control submenu direction
  }>({ x: 0, y: 0, visible: false, flipSubmenu: false });

  // Chat panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatShotId, setChatShotId] = useState<string | null>(null);
  const [chatShotName, setChatShotName] = useState<string>('');
  
  // Department mentions state
  const [shotDeptMentions, setShotDeptMentions] = useState<Map<string, Set<string>>>(new Map());
  const [shotsWithNotes, setShotsWithNotes] = useState<Set<string>>(new Set());

  // Get all tasks for the selected department
  const departmentTasks = useMemo(() => {
    const tasks: Array<{
      taskId: string;
      shotId: string;
      showName: string;
      shotName: string;
      shotTag: string;
      task: Task;
    }> = [];

    shows.forEach((show) => {
      show.shots?.forEach((shot) => {
        shot.tasks?.forEach((task) => {
          // Check if task matches selected department (including internal)
          const deptMatch = task.department === selectedDepartment || 
                           (task.isInternal && task.department === selectedDepartment);
          
          if (deptMatch) {
            tasks.push({
              taskId: task.id,
              shotId: shot.id,
              showName: show.showName,
              shotName: shot.shotName,
              shotTag: shot.shotTag,
              task,
            });
          }
        });
      });
    });

    // Apply filters
    let filteredTasks = tasks;

    if ((filters?.showIds?.length ?? 0) > 0) {
      const showNames = shows.filter(s => filters.showIds.includes(s.id)).map(s => s.showName);
      filteredTasks = filteredTasks.filter(t => showNames.includes(t.showName));
    }

    if ((filters?.shotNames?.length ?? 0) > 0) {
      filteredTasks = filteredTasks.filter(t => 
        filters.shotNames.some(name => 
          matchesShotName(t.shotName, name)
        )
      );
    }    if ((filters?.statuses?.length ?? 0) > 0) {
      filteredTasks = filteredTasks.filter(t => filters.statuses.includes(t.task.status));
    }

    if ((filters?.leadNames?.length ?? 0) > 0) {
      const hasUnassignedFilter = filters.leadNames.includes('__UNASSIGNED__');
      const otherLeadNames = filters.leadNames.filter(l => l !== '__UNASSIGNED__');
      
      filteredTasks = filteredTasks.filter(t => {
        // Check for unassigned (no lead name)
        if (hasUnassignedFilter && !t.task.leadName) {
          return true;
        }
        // Check for specific lead names
        if (otherLeadNames.length > 0 && t.task.leadName && otherLeadNames.includes(t.task.leadName)) {
          return true;
        }
        return false;
      });
    }

    if (filters?.shotTag) {
      filteredTasks = filteredTasks.filter(t => t.shotTag === filters.shotTag);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(t =>
        t.showName.toLowerCase().includes(query) ||
        matchesShotName(t.shotName, query) ||
        t.shotTag.toLowerCase().includes(query) ||
        t.task.status.toLowerCase().includes(query) ||
        t.task.leadName?.toLowerCase().includes(query)
      );
    }

    if (filters?.dateRange?.from || filters?.dateRange?.to) {
      filteredTasks = filteredTasks.filter(t => {
        const internalEta = t.task.internalEta ? new Date(t.task.internalEta) : null;
        const clientEta = t.task.clientEta ? new Date(t.task.clientEta) : null;
        const fromDate = filters.dateRange.from ? new Date(filters.dateRange.from) : null;
        const toDate = filters.dateRange.to ? new Date(filters.dateRange.to) : null;

        const checkDate = (date: Date | null) => {
          if (!date) return false;
          if (fromDate && date < fromDate) return false;
          if (toDate && date > toDate) return false;
          return true;
        };

        return checkDate(internalEta) || checkDate(clientEta);
      });
    }

    return filteredTasks;
  }, [shows, selectedDepartment, filters, searchQuery]);

  // Fetch department mentions on mount and when shows change
  useEffect(() => {
    fetchAllShotDeptMentions();
  }, [shows]);
  
  const fetchAllShotDeptMentions = async () => {
    try {
      // Get all shot IDs
      const allShots = shows.flatMap(show => show.shots || []);
      const deptMentions = new Map<string, Set<string>>();
      const shotsWithNotesSet = new Set<string>();
      
      // Fetch notes for each shot to check department mentions
      await Promise.all(
        allShots.map(async (shot) => {
          try {
            const res = await fetch(`/api/shot-notes?shotId=${shot.id}`);
            if (res.ok) {
              const notes = await res.json();
              
              // Track shots that have notes
              if (notes.length > 0) {
                shotsWithNotesSet.add(shot.id);
              }
              
              // Extract department mentions
              const mentionedDepts = new Set<string>();
              notes.forEach((note: any) => {
                if (note.mentions) {
                  note.mentions
                    .filter((m: any) => m.type === 'dept')
                    .forEach((m: any) => mentionedDepts.add(m.name));
                }
              });
              if (mentionedDepts.size > 0) {
                deptMentions.set(shot.id, mentionedDepts);
              }
            }
          } catch (error) {
            console.error(`Failed to fetch notes for shot ${shot.id}:`, error);
          }
        })
      );
      
      setShotDeptMentions(deptMentions);
      setShotsWithNotes(shotsWithNotesSet);
    } catch (error) {
      console.error('Failed to fetch shot department mentions:', error);
    }
  };

  // Get status summary
  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    departmentTasks.forEach(({ task }) => {
      summary[task.status] = (summary[task.status] || 0) + 1;
    });
    return summary;
  }, [departmentTasks]);

  const departments = ['Comp', 'Paint', 'Roto', 'MMRA'];

  // Cell selection handlers for multi-select
  const handleCellClick = (cellId: string, e: React.MouseEvent, rowIndex: number) => {
    if (detailedView) return; // Only in non-detailed view
    if (!hasEditPermission) return; // View-only users cannot select cells
    
    e.stopPropagation();
    e.preventDefault(); // Prevent default text selection behavior
    
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: Toggle individual cell
      const newSelected = new Set(selectedCells);
      if (newSelected.has(cellId)) {
        newSelected.delete(cellId);
      } else {
        newSelected.add(cellId);
      }
      setSelectedCells(newSelected);
      setLastSelectedCell({ cellId, rowIndex });
    } else if (e.shiftKey && lastSelectedCell) {
      // Shift+Click: Select vertical range of cells
      const newSelected = new Set(selectedCells);
      
      // Determine the range of rows
      const startRowIndex = Math.min(lastSelectedCell.rowIndex, rowIndex);
      const endRowIndex = Math.max(lastSelectedCell.rowIndex, rowIndex);
      
      // Select all cells in the range
      for (let i = startRowIndex; i <= endRowIndex; i++) {
        const taskItem = departmentTasks[i];
        if (taskItem) {
          const rangeCellId = taskItem.taskId;
          newSelected.add(rangeCellId);
        }
      }
      
      setSelectedCells(newSelected);
    } else {
      // Normal click: Toggle selection if clicking same cell, otherwise select only this cell
      if (selectedCells.has(cellId) && selectedCells.size === 1) {
        // Deselect if clicking the same already-selected cell
        setSelectedCells(new Set());
        setLastSelectedCell(null);
      } else {
        // Select only this cell
        setSelectedCells(new Set([cellId]));
        setLastSelectedCell({ cellId, rowIndex });
      }
    }
  };
  
  const handleCellRightClick = (e: React.MouseEvent, cellId: string, rowIndex: number) => {
    if (detailedView) return; // Only in non-detailed view
    if (!hasEditPermission) return; // View-only users cannot access context menu
    
    e.preventDefault();
    e.stopPropagation();
    
    // If right-clicked cell is not in selection, select only it
    if (!selectedCells.has(cellId)) {
      setSelectedCells(new Set([cellId]));
      setLastSelectedCell({ cellId, rowIndex });
    }
    
    // Calculate menu position - flip to left if too close to right edge
    const menuWidth = 200; // Approximate width of main context menu
    const submenuWidth = 150; // Approximate width of submenu
    const viewportWidth = window.innerWidth;
    const menuX = e.clientX + menuWidth > viewportWidth ? e.clientX - menuWidth : e.clientX;
    
    // Check if submenu will overflow on the right
    const flipSubmenu = e.clientX + menuWidth + submenuWidth > viewportWidth;
    
    // Show context menu
    setContextMenu({
      x: menuX,
      y: e.clientY,
      visible: true,
      flipSubmenu,
    });
  };
  
  const handleStatusChange = async (newStatus: string) => {
    setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
    
    if (selectedCells.size === 0) return;
    
    // Store task IDs before clearing
    const taskIds = Array.from(selectedCells);
    
    // Optimistic update - update status immediately
    const updatedShows = shows.map(show => ({
      ...show,
      shots: show.shots?.map(shot => ({
        ...shot,
        tasks: shot.tasks?.map(task => 
          taskIds.includes(task.id) ? { ...task, status: newStatus } : task
        )
      }))
    }));
    setShows(updatedShows);
    
    // Clear selection immediately
    setSelectedCells(new Set());
    setLastSelectedCell(null);
    
    try {
      // Update server and get responses with auto-generated values
      const responses = await Promise.all(
        taskIds.map(taskId =>
          fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          }).then(res => res.json())
        )
      );
      
      // Update with actual server response (includes version/date for AWF)
      // Use updatedShows as base (not stale shows) to preserve optimistic status update
      if (newStatus === 'AWF' || responses.some(r => r.deliveredVersion || r.deliveredDate)) {
        const showsWithServerData = updatedShows.map(show => ({
          ...show,
          shots: show.shots?.map(shot => ({
            ...shot,
            tasks: shot.tasks?.map(task => {
              const serverTask = responses.find(r => r.id === task.id);
              if (serverTask) {
                return {
                  ...task,
                  status: serverTask.status,
                  deliveredVersion: serverTask.deliveredVersion,
                  deliveredDate: serverTask.deliveredDate,
                };
              }
              return task;
            })
          }))
        }));
        setShows(showsWithServerData);
      }
    } catch (error) {
      console.error('Failed to update statuses:', error);
      alert('Failed to update some statuses');
      // Revert on error
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (selectedRows.size === 0) return;

    setDeleting(true);
    setShowDeleteConfirm(false);

    try {
      const shotIds = Array.from(selectedRows);
      
      const response = await fetch('/api/shots/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete shots');
      }

      const data = await response.json();

      // Clear selection
      setSelectedRows(new Set());

      // Refresh data instantly
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);

      // Show success toast with undo option
      showUndo(
        `Deleted ${data.deletedShots} shot(s) and ${data.deletedTasks} task(s)`,
        () => {
          // TODO: Implement undo via Activity Log restore
          showError('Undo feature coming soon! Check Activity Log to restore.');
        }
      );
    } catch (error) {
      console.error('Error during deletion:', error);
      showError('Failed to delete shots. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div 
      className="space-y-4"
      onClick={() => {
        // Deselect cells when clicking anywhere
        if (selectedCells.size > 0) {
          setSelectedCells(new Set());
          setLastSelectedCell(null);
        }
        // Hide context menu
        if (contextMenu.visible) {
          setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
        }
      }}
    >
      {/* Department Tabs and Search Bar - Inline */}
      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="flex items-center gap-4">
          {/* Department Tabs */}
          <div className="flex gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  ${selectedDepartment === dept
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {dept}
              </button>
            ))}
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by show, shot, status, lead..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-3">
          {selectedDepartment} Department - Status Summary
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(statusSummary).map(([status, count]) => (
            <div
              key={status}
              className="px-3 py-1 rounded-lg bg-gray-100 text-sm"
            >
              <span className="font-medium">{status}:</span>{' '}
              <span className="text-gray-700">{count}</span>
            </div>
          ))}
          <div className="px-3 py-1 rounded-lg bg-blue-100 text-sm font-medium">
            Total: {departmentTasks.length}
          </div>
        </div>
      </div>

      {/* Delete Selection Bar (when in delete mode with selections) */}
      {!selectionMode && selectedRows.size > 0 && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={true}
                onChange={() => setSelectedRows(new Set())}
                className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="font-semibold text-red-900">
                {selectedRows.size} shot{selectedRows.size !== 1 ? 's' : ''} selected for deletion
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRows(new Set())}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {departmentTasks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No tasks found for {selectedDepartment} department.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  {/* Checkbox column - switches between delete and bulk operations */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectionMode 
                          ? selectedShotIds.size === departmentTasks.length && departmentTasks.length > 0
                          : selectedRows.size === departmentTasks.length && departmentTasks.length > 0
                      }
                      onChange={(e) => {
                        if (selectionMode) {
                          // Bulk operations mode
                          if (e.target.checked) {
                            selectAllShots(departmentTasks.map(t => t.shotId));
                          } else {
                            clearSelection();
                          }
                        } else {
                          // Delete mode
                          if (e.target.checked) {
                            setSelectedRows(new Set(departmentTasks.map(t => t.shotId)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      title={selectionMode ? "Select all for bulk operations" : "Select all for deletion"}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[150px]">
                    Show
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[150px]">
                    Shot
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[100px]">
                    Tag
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[100px]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[120px]">
                    Lead
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[250px]">
                    Task Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {departmentTasks.map(({ taskId, showName, shotName, shotTag, task, shotId }, idx) => (
                  <tr
                    key={taskId}
                    className={`
                      border-b border-gray-200 hover:bg-gray-50 transition-colors
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    `}
                  >
                    {/* Checkbox cell */}
                    <td className="px-4 py-3 border-r border-gray-200">
                      <input
                        type="checkbox"
                        checked={selectionMode ? selectedShotIds.has(shotId) : selectedRows.has(shotId)}
                        onChange={() => {
                          if (selectionMode) {
                            toggleShotSelection(shotId);
                          } else {
                            const newSelected = new Set(selectedRows);
                            if (newSelected.has(shotId)) {
                              newSelected.delete(shotId);
                            } else {
                              newSelected.add(shotId);
                            }
                            setSelectedRows(newSelected);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`
                          w-4 h-4 rounded border-gray-300 cursor-pointer
                          ${selectionMode ? 'text-blue-600 focus:ring-blue-500' : 'text-red-600 focus:ring-red-500'}
                        `}
                        title={selectionMode ? "Select for bulk operations" : "Select for deletion"}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                      {showName}
                    </td>
                    <td 
                      className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors relative"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle chat panel - close if already open for this shot
                        if (chatPanelOpen && chatShotId === shotId) {
                          setChatPanelOpen(false);
                          setChatShotId(null);
                          fetchAllShotDeptMentions();
                        } else {
                          setChatShotId(shotId);
                          setChatShotName(shotName);
                          setChatPanelOpen(true);
                        }
                      }}
                      title="Click to toggle notes"
                    >
                      {/* Single red dot for shots with notes */}
                      {shotsWithNotes.has(shotId) && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full z-20 animate-pulse" title="Has notes" />
                      )}
                      {shotName}
                    </td>
                    <td className="px-4 py-3 text-sm border-r border-gray-200">
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium whitespace-nowrap
                        ${shotTag === 'Fresh' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}
                      `}>
                        {shotTag}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm border-r border-gray-200">
                      {task.isInternal ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                          Internal
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 whitespace-nowrap">
                          Main
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                      {task.leadName || <span className="text-gray-400 italic">-</span>}
                    </td>
                    <td className="px-2 py-2 relative">
                      {/* Red dot for department mentions */}
                      {shotDeptMentions.get(shotId)?.has(selectedDepartment.toUpperCase()) && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full z-20 animate-pulse" title={`${selectedDepartment} mentioned in notes`} />
                      )}
                      {detailedView ? (
                        <TaskCell task={task} />
                      ) : (
                        // Compact status-only view with multi-select
                        (() => {
                          const cellId = taskId;
                          const isSelected = selectedCells.has(cellId);
                          
                          return (
                            <div 
                              className={`text-xs font-medium px-2 py-1 rounded text-white text-center transition-all select-none ${
                                hasEditPermission 
                                  ? 'cursor-pointer hover:opacity-80' 
                                  : 'cursor-not-allowed opacity-75'
                              } ${
                                isSelected ? 'ring-4 ring-blue-400 ring-opacity-50 scale-105' : ''
                              }`}
                              style={{ backgroundColor: (() => {
                                const statusOption = statusOptions.find(s => s.statusName === task.status);
                                return statusOption?.colorCode || '#6B7280';
                              })() }}
                              onClick={hasEditPermission ? (e) => handleCellClick(cellId, e, idx) : undefined}
                              onContextMenu={hasEditPermission 
                                ? (e) => handleCellRightClick(e, cellId, idx)
                                : (e) => e.preventDefault() // Block default context menu for view-only
                              }
                              title={hasEditPermission 
                                ? "Click to select | Shift+Click for range | Ctrl+Click for multi-select | Right-click for options"
                                : "View only - No edit permission"
                              }
                            >
                              {task.status}
                            </div>
                          );
                        })()
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selection Info Bar */}
      {selectedCells.size > 0 && !detailedView && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-4">
          <span className="font-medium">
            {selectedCells.size} task{selectedCells.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCells(new Set());
              setLastSelectedCell(null);
            }}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors text-sm"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Context Menu for Status Change */}
      {contextMenu.visible && hasEditPermission && (
        <div
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 py-1 z-[100] min-w-[200px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
            {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
          </div>
          
          {/* Status submenu */}
          <div className="relative group">
            <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between text-sm">
              <span>Change Status</span>
              <ChevronRight size={16} className={`text-gray-400 ${contextMenu.flipSubmenu ? 'rotate-180' : ''}`} />
            </div>
            
            {/* Status options submenu - flip to left if near right edge */}
            <div className={`absolute ${contextMenu.flipSubmenu ? 'right-full mr-1' : 'left-full ml-1'} top-0 bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[150px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all`}>
              {statusOptions
                .filter(opt => opt.isActive)
                .sort((a, b) => a.statusOrder - b.statusOrder)
                .map(status => (
                  <button
                    key={status.id}
                    onClick={() => handleStatusChange(status.statusName)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: status.colorCode }}
                    />
                    <span>{status.statusName}</span>
                  </button>
                ))}
            </div>
          </div>
          
          {/* Add Feedback Option */}
          <div className="border-t border-gray-200 mt-1 pt-1">
            <button
              onClick={() => {
                if (selectedCells.size > 0) {
                  const firstCell = Array.from(selectedCells)[0];
                  const [taskId] = firstCell.split('|');
                  
                  const task = departmentTasks.find(t => t.taskId === taskId);
                  
                  if (task) {
                    openFeedbackModal({
                      showName: task.showName,
                      shotName: task.shotName,
                      shotTag: task.shotTag,
                      version: task.task.deliveredVersion || 'v001',
                      department: selectedDepartment,
                      status: 'C KB',
                      taskId: taskId,
                    });
                    setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
                  }
                }
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 text-blue-600"
            >
              <MessageSquarePlus size={16} />
              Add Feedback
            </button>
            
            <button
              onClick={() => {
                setSelectedCells(new Set());
                setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-600"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {chatPanelOpen && chatShotId && (
        <ShotChatPanel
          shotId={chatShotId}
          shotName={chatShotName}
          onClose={() => {
            setChatPanelOpen(false);
            setChatShotId(null);
            // Refresh department mentions after closing
            fetchAllShotDeptMentions();
          }}
          onNotesChange={() => {
            // Refresh indicators when notes are added/deleted
            fetchAllShotDeptMentions();
          }}
        />
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRows.size > 0 && (
        <DeleteConfirmationModal
          shots={shows
            .flatMap(show => show.shots || [])
            .filter(shot => selectedRows.has(shot.id))}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
