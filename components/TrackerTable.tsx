'use client';

import { useVFXStore } from '@/lib/store';
import { transformToTrackerRows, parseDepartments, formatDisplayDate } from '@/lib/utils';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Task, Shot } from '@/lib/types';
import TaskCell from './TaskCell';
import ShotChatPanel from './ShotChatPanel';
import BulkActionsBar from './BulkActionsBar';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { showSuccess, showError, showUndo } from '@/lib/toast';
import { Trash2, Settings, X, ChevronRight, ChevronDown, Save, RotateCcw, Eye, EyeOff, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Download, Copy, ChevronUp } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface TrackerTableProps {
  detailedView: boolean;
  onToggleDetailedView: () => void;
  hiddenColumns: Set<string>;
  setHiddenColumns: (value: Set<string>) => void;
}

type SortField = 'show' | 'shot' | 'ep' | 'seq' | 'to' | 'frames' | 'tag' | 'sow' | 'remark' | string;
type SortDirection = 'asc' | 'desc' | null;

interface ColumnWidths {
  [key: string]: number;
}

interface SavedView {
  name: string;
  columnWidths: ColumnWidths;
  sowExpanded: boolean;
  isDefault: boolean;
}

export default function TrackerTable({ detailedView, onToggleDetailedView, hiddenColumns, setHiddenColumns }: TrackerTableProps) {
  const { data: session } = useSession();
  const { shows, selectionMode, selectedShotIds, toggleShotSelection, selectAllShots, clearSelection, setShows } = useVFXStore();
  const { filters } = useVFXStore();
  
  // Check if user has edit permission
  const hasEditPermission = useMemo(() => {
    if (!session?.user) return false;
    const role = (session.user as any).role;
    if (role === 'ADMIN' || role === 'COORDINATOR') return true;
    // Check if user has edit permission on any show
    return shows.some(show => show.canEdit === true);
  }, [session, shows]);
  
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showManageShows, setShowManageShows] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sowExpanded, setSowExpanded] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Show client name state
  const [showClientName, setShowClientName] = useState(false);
  
  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // View management state
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [currentView, setCurrentView] = useState<string | null>(null);
  
  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  
  // Multi-select cell state for non-detailed view
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [lastSelectedCell, setLastSelectedCell] = useState<{ cellId: string; rowIndex: number } | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    flipSubmenu: boolean;
  }>({ x: 0, y: 0, visible: false, flipSubmenu: false });
  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  
  // Chat panel state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatShotId, setChatShotId] = useState<string | null>(null);
  const [chatShotName, setChatShotName] = useState<string>('');
  const [shotDeptMentions, setShotDeptMentions] = useState<Map<string, Set<string>>>(new Map());
  const [shotsWithNotes, setShotsWithNotes] = useState<Set<string>>(new Set());
  
  // Table density state: 'compact' | 'comfortable' | 'spacious'
  const [tableDensity, setTableDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  
  // Column reordering state
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  // Hovered shot for Ctrl+C copy - using ref to avoid closure issues
  const hoveredShotNameRef = useRef<string | null>(null);
  
  // Search input ref for keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Keyboard shortcuts panel minimized state
  const [shortcutsMinimized, setShortcutsMinimized] = useState(false);

  // Remark editing state
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkValue, setEditingRemarkValue] = useState<string>('');

  // Load saved column widths from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vfx-tracker-column-widths');
    if (saved) {
      try {
        setColumnWidths(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load column widths:', e);
      }
    }
  }, []);
  
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
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
    const handleScroll = () => setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
    
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      document.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [contextMenu.visible]);
  
  // Real-time polling - fetch shows every 2 seconds
  useEffect(() => {
    const fetchShowsData = async () => {
      try {
        const response = await fetch('/api/shows');
        if (response.ok) {
          const data = await response.json();
          setShows(data);
        }
      } catch (error) {
        console.error('Failed to fetch shows:', error);
      }
    };

    // Initial fetch
    fetchShowsData();

    // Poll every 2 seconds
    const intervalId = setInterval(fetchShowsData, 2000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [setShows]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      
      // Ctrl/Cmd + K - Clear search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchQuery('');
        searchInputRef.current?.focus();
      }
      
      // Escape - Clear selection / close modals
      if (e.key === 'Escape') {
        setSelectedRows(new Set());
        setSelectedCells(new Set());
        setContextMenu({ x: 0, y: 0, visible: false, flipSubmenu: false });
        searchInputRef.current?.blur();
      }
      
      // Ctrl/Cmd + A - Select all visible rows (when not in input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        // Get all shot IDs from shows
        const allShotIds = shows.flatMap(show => show.shots?.map((shot: any) => shot.id) || []);
        setSelectedRows(new Set(allShotIds));
      }
      
      // Ctrl/Cmd + D - Toggle detailed view
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onToggleDetailedView();
      }
      
      // Ctrl/Cmd + E - Export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
      
      // Ctrl/Cmd + C - Copy hovered shot name
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const hoveredShot = hoveredShotNameRef.current;
        console.log('Ctrl+C pressed, hoveredShotName:', hoveredShot);
        console.log('Active element:', document.activeElement?.tagName);
        
        if (hoveredShot && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('Attempting to copy:', hoveredShot);
          
          // Try modern clipboard API first
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(hoveredShot)
              .then(() => {
                console.log(`✓ Copied shot name: ${hoveredShot}`);
                // Optional: You could add a toast notification here
              })
              .catch(err => {
                console.error('Clipboard API failed:', err);
                // Fallback method
                fallbackCopyTextToClipboard(hoveredShot);
              });
          } else {
            // Fallback for older browsers
            fallbackCopyTextToClipboard(hoveredShot);
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shows, onToggleDetailedView]);
  
  // Fallback copy method for older browsers
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log(`✓ Copied shot name (fallback): ${text}`);
      } else {
        console.error('Fallback copy failed');
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
    }
    
    document.body.removeChild(textArea);
  };
  
  // Fetch shot department mentions
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

  // Save column widths to localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem('vfx-tracker-column-widths', JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  const handleMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnKey] || getDefaultWidth(columnKey));
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const diff = e.clientX - startX;
    const newWidth = Math.max(80, startWidth + diff);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }));
  };

  const handleMouseUp = () => {
    setResizingColumn(null);
  };

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingColumn, startX, startWidth]);

  const getDefaultWidth = (columnKey: string): number => {
    if (columnKey === 'show') return 150;
    if (columnKey === 'shot') return 150;
    if (columnKey === 'ep') return 80;
    if (columnKey === 'seq') return 80;
    if (columnKey === 'to') return 80;
    if (columnKey === 'frames') return 100;
    if (columnKey === 'tag') return 100;
    if (columnKey === 'sow') return sowExpanded ? 200 : 80;
    if (columnKey === 'remark') return 200;
    return 180; // Default for department columns
  };

  const getColumnWidth = (columnKey: string): number => {
    return columnWidths[columnKey] || getDefaultWidth(columnKey);
  };
  
  // Get padding classes based on table density
  const getCellPadding = () => {
    switch (tableDensity) {
      case 'compact': return 'px-3 py-1';
      case 'spacious': return 'px-5 py-4';
      case 'comfortable':
      default: return 'px-4 py-3';
    }
  };

  const getHeaderPadding = () => {
    switch (tableDensity) {
      case 'compact': return 'px-3 py-2';
      case 'spacious': return 'px-5 py-4';
      case 'comfortable':
      default: return 'px-4 py-3';
    }
  };

  // Calculate cumulative widths for sticky positioning
  const getCheckboxWidth = () => 48; // Always show checkbox (switches between delete/bulk)
  const getShowLeft = () => getCheckboxWidth();
  const getShotLeft = () => getShowLeft() + getColumnWidth('show');
  const getEPLeft = () => getShotLeft() + getColumnWidth('shot');
  const getSEQLeft = () => {
    let left = getEPLeft();
    if (!hiddenColumns.has('ep')) left += getColumnWidth('ep');
    return left;
  };
  const getTOLeft = () => {
    let left = getSEQLeft();
    if (!hiddenColumns.has('seq')) left += getColumnWidth('seq');
    return left;
  };
  const getFramesLeft = () => {
    let left = getTOLeft();
    if (!hiddenColumns.has('to')) left += getColumnWidth('to');
    return left;
  };
  const getTagLeft = () => {
    let left = getFramesLeft();
    if (!hiddenColumns.has('frames')) left += getColumnWidth('frames');
    return left;
  };

  // Load saved views from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vfx-tracker-views');
    if (saved) {
      try {
        const views = JSON.parse(saved);
        setSavedViews(views);
        
        // Apply default view if exists and no current widths
        const defaultView = views.find((v: SavedView) => v.isDefault);
        if (defaultView && Object.keys(columnWidths).length === 0) {
          setColumnWidths(defaultView.columnWidths);
          setSowExpanded(defaultView.sowExpanded);
          setCurrentView(defaultView.name);
        }
      } catch (e) {
        console.error('Failed to load saved views:', e);
      }
    }
  }, []);

  // Save views to localStorage
  const saveViewsToStorage = (views: SavedView[]) => {
    localStorage.setItem('vfx-tracker-views', JSON.stringify(views));
    setSavedViews(views);
  };

  // Save current view
  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    
    const newView: SavedView = {
      name: newViewName.trim(),
      columnWidths: { ...columnWidths },
      sowExpanded,
      isDefault: savedViews.length === 0 // First view is default
    };
    
    const updatedViews = [...savedViews, newView];
    saveViewsToStorage(updatedViews);
    setNewViewName('');
    setCurrentView(newView.name);
  };

  // Load a saved view
  const handleLoadView = (view: SavedView) => {
    setColumnWidths(view.columnWidths);
    setSowExpanded(view.sowExpanded);
    setCurrentView(view.name);
    setShowViewModal(false);
  };

  // Delete a saved view
  const handleDeleteView = (viewName: string) => {
    const updatedViews = savedViews.filter(v => v.name !== viewName);
    saveViewsToStorage(updatedViews);
    if (currentView === viewName) {
      setCurrentView(null);
    }
  };

  // Set view as default
  const handleSetDefaultView = (viewName: string) => {
    const updatedViews = savedViews.map(v => ({
      ...v,
      isDefault: v.name === viewName
    }));
    saveViewsToStorage(updatedViews);
  };

  // Reset to default view
  const handleResetToDefault = () => {
    setColumnWidths({});
    setSowExpanded(true);
    localStorage.removeItem('vfx-tracker-column-widths');
    setCurrentView(null);
    
    // Apply default view if one exists
    const defaultView = savedViews.find(v => v.isDefault);
    if (defaultView) {
      handleLoadView(defaultView);
    }
  };

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp size={14} className="text-blue-600" />;
    }
    return <ArrowDown size={14} className="text-blue-600" />;
  };
  
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
      // Shift+Click: Select range of cells
      const [lastTaskId, lastDept] = lastSelectedCell.cellId.split('|');
      const [currentTaskId, currentDept] = cellId.split('|');
      
      const newSelected = new Set(selectedCells);
      
      // Check if it's a vertical range (same column/department, different rows)
      if (lastDept === currentDept && lastTaskId !== currentTaskId) {
        // VERTICAL RANGE SELECTION (same column, different rows)
        const startRowIndex = Math.min(lastSelectedCell.rowIndex, rowIndex);
        const endRowIndex = Math.max(lastSelectedCell.rowIndex, rowIndex);
        
        // Select all cells in the range (same column, different rows)
        for (let i = startRowIndex; i <= endRowIndex; i++) {
          const row = trackerRows[i];
          if (row) {
            const task = row.tasks[currentDept];
            if (task) {
              const rangeCellId = `${task.id}|${currentDept}`;
              newSelected.add(rangeCellId);
            }
          }
        }
      } 
      // Check if it's a horizontal range (same row/task, different columns)
      else if (lastTaskId === currentTaskId && lastDept !== currentDept) {
        // HORIZONTAL RANGE SELECTION (same row, different columns)
        const lastDeptIndex = orderedDepartmentColumns.indexOf(lastDept);
        const currentDeptIndex = orderedDepartmentColumns.indexOf(currentDept);
        
        if (lastDeptIndex !== -1 && currentDeptIndex !== -1) {
          const startIndex = Math.min(lastDeptIndex, currentDeptIndex);
          const endIndex = Math.max(lastDeptIndex, currentDeptIndex);
          
          // Select all cells in the range (same row, different columns)
          for (let i = startIndex; i <= endIndex; i++) {
            const dept = orderedDepartmentColumns[i];
            const rangeCellId = `${currentTaskId}|${dept}`;
            newSelected.add(rangeCellId);
          }
        }
      } 
      // Different row AND different column - just add both cells
      else {
        newSelected.add(lastSelectedCell.cellId);
        newSelected.add(cellId);
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
    
    // Show context menu with edge detection
    const menuWidth = 200; // Approximate width of main context menu
    const submenuWidth = 150; // Approximate width of submenu
    const viewportWidth = window.innerWidth;
    const menuX = e.clientX + menuWidth > viewportWidth ? e.clientX - menuWidth : e.clientX;
    
    // Check if submenu will overflow on the right
    const flipSubmenu = e.clientX + menuWidth + submenuWidth > viewportWidth;
    
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
    
    // Optimistic update - update UI immediately
    const updatedShows = shows.map(show => ({
      ...show,
      shots: show.shots?.map(shot => ({
        ...shot,
        tasks: shot.tasks?.map(task => {
          const cellId = `${task.id}|${task.department}`;
          if (selectedCells.has(cellId)) {
            return { ...task, status: newStatus };
          }
          return task;
        })
      }))
    }));
    setShows(updatedShows);
    
    // Clear selection immediately
    setSelectedCells(new Set());
    setLastSelectedCell(null);
    
    // Update server in background
    const updates: Promise<any>[] = [];
    selectedCells.forEach(cellId => {
      const [taskId] = cellId.split('|');
      if (taskId) {
        updates.push(
          fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
        );
      }
    });
    
    try {
      await Promise.all(updates);
      
      // Background refresh to ensure consistency
      fetch('/api/shows')
        .then(res => res.json())
        .then(data => setShows(data))
        .catch(err => console.error('Background refresh failed:', err));
    } catch (error) {
      console.error('Failed to update statuses:', error);
      alert('Failed to update some statuses');
      // Revert on error
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
    }
  };

  // Handle remark editing
  const handleRemarkEdit = async (shotId: string, newRemark: string) => {
    // Optimistic update - update UI immediately
    const updatedShows = shows.map(show => ({
      ...show,
      shots: show.shots?.map(shot => 
        shot.id === shotId 
          ? { ...shot, remark: newRemark || null }
          : shot
      )
    }));
    setShows(updatedShows);
    
    // Close editor immediately
    setEditingRemarkId(null);
    setEditingRemarkValue('');
    
    try {
      const response = await fetch(`/api/shots/${shotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: newRemark || null }),
      });

      if (!response.ok) {
        throw new Error('Failed to update remark');
      }

      // Background refresh to ensure consistency
      fetch('/api/shows')
        .then(res => res.json())
        .then(data => setShows(data))
        .catch(err => console.error('Background refresh failed:', err));
      
    } catch (error) {
      console.error('Failed to update remark:', error);
      alert('Failed to update remark');
      // Revert on error
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
    }
  };
      console.error('Failed to update remark:', error);
      alert('Failed to update remark');
    }
  };

  // Handle column visibility toggle
  const toggleColumnVisibility = (columnKey: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setHiddenColumns(newHidden);
  };

  // Export to Excel/CSV
  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx');
      
      // Get department columns in current order
      const deptColumns = orderedDepartmentColumns.length > 0 ? orderedDepartmentColumns : allDepartmentColumns;
      
      // Prepare data for export
      const exportData = trackerRows.map(row => {
        const baseData: any = {
          'Show': row.showName,
          'Shot': row.shotName,
          'EP': row.episode || '',
          'SEQ': row.sequence || '',
          'TO': row.turnover || '',
          'Frames': row.frames || '',
          'Tag': row.shotTag || '',
          'Scope of Work': row.scopeOfWork || '',
        };

        // Add department columns in custom order
        deptColumns.forEach(dept => {
          const task = row.tasks[dept];
          if (task) {
            baseData[`${dept} - Status`] = task.status;
            baseData[`${dept} - Lead`] = task.leadName || '';
            baseData[`${dept} - Internal ETA`] = task.internalEta ? new Date(task.internalEta).toLocaleDateString() : '';
            baseData[`${dept} - Client ETA`] = task.clientEta ? new Date(task.clientEta).toLocaleDateString() : '';
          }
        });

        // Add remark at the end
        baseData['Remark'] = row.remark || '';

        return baseData;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'VFX Tracker Export');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `VFX_Tracker_Export_${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  // Transform data to tracker rows
  const trackerRows = useMemo(() => {
    let rows = transformToTrackerRows(shows);

    // Apply filters
    if ((filters?.showIds?.length ?? 0) > 0) {
      rows = rows.filter(row => filters.showIds.includes(row.showId));
    }

    if (filters?.shotTag) {
      rows = rows.filter(row => row.shotTag === filters.shotTag);
    }

    if ((filters?.shotNames?.length ?? 0) > 0) {
      rows = rows.filter(row => 
        filters.shotNames.some(name => 
          row.shotName.toLowerCase().includes(name.toLowerCase())
        )
      );
    }

    // Filter by episode
    if ((filters?.episodes?.length ?? 0) > 0) {
      rows = rows.filter(row => 
        row.episode && filters.episodes.includes(row.episode)
      );
    }

    // Filter by sequence
    if ((filters?.sequences?.length ?? 0) > 0) {
      rows = rows.filter(row => 
        row.sequence && filters.sequences.includes(row.sequence)
      );
    }

    // Filter by turnover
    if ((filters?.turnovers?.length ?? 0) > 0) {
      rows = rows.filter(row => 
        row.turnover && filters.turnovers.includes(row.turnover)
      );
    }

    // Filter by status
    if ((filters?.statuses?.length ?? 0) > 0) {
      rows = rows.filter(row => {
        // Check if any task has one of the selected statuses
        return Object.values(row.tasks).some(task => 
          filters.statuses.includes(task.status)
        );
      });
    }

    // Filter by lead name
    if ((filters?.leadNames?.length ?? 0) > 0) {
      rows = rows.filter(row => {
        // Check if any task has one of the selected leads
        return Object.values(row.tasks).some(task => 
          task.leadName && filters.leadNames.includes(task.leadName)
        );
      });
    }

    // Filter by department
    if ((filters?.departments?.length ?? 0) > 0) {
      rows = rows.filter(row => {
        // Check if any task belongs to one of the selected departments
        return Object.keys(row.tasks).some(deptKey => 
          filters.departments.some(dept => deptKey.includes(dept))
        );
      });
    }

    // Filter by date range
    if (filters?.dateRange?.from || filters?.dateRange?.to) {
      rows = rows.filter(row => {
        return Object.values(row.tasks).some(task => {
          const internalEta = task.internalEta ? new Date(task.internalEta) : null;
          const clientEta = task.clientEta ? new Date(task.clientEta) : null;
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
      });
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      rows = rows.filter(row => {
        // Search in show name
        if (row.showName.toLowerCase().includes(query)) return true;
        
        // Search in shot name
        if (row.shotName.toLowerCase().includes(query)) return true;
        
        // Search in episode
        if (row.episode && row.episode.toLowerCase().includes(query)) return true;
        
        // Search in sequence
        if (row.sequence && row.sequence.toLowerCase().includes(query)) return true;
        
        // Search in turnover
        if (row.turnover && row.turnover.toLowerCase().includes(query)) return true;
        
        // Search in shot tag
        if (row.shotTag && row.shotTag.toLowerCase().includes(query)) return true;
        
        // Search in scope of work
        if (row.scopeOfWork && row.scopeOfWork.toLowerCase().includes(query)) return true;
        
        // Search in task leads
        const hasLead = Object.values(row.tasks).some(task => 
          task.leadName && task.leadName.toLowerCase().includes(query)
        );
        if (hasLead) return true;
        
        // Search in task statuses
        const hasStatus = Object.values(row.tasks).some(task => 
          task.status.toLowerCase().includes(query)
        );
        if (hasStatus) return true;
        
        // Search in departments
        const hasDept = Object.keys(row.tasks).some(dept => 
          dept.toLowerCase().includes(query)
        );
        if (hasDept) return true;
        
        return false;
      });
    }

    // Apply sorting
    if (sortField && sortDirection) {
      rows.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortField === 'show') {
          aValue = a.showName;
          bValue = b.showName;
        } else if (sortField === 'shot') {
          aValue = a.shotName;
          bValue = b.shotName;
        } else if (sortField === 'ep') {
          aValue = a.episode || '';
          bValue = b.episode || '';
        } else if (sortField === 'seq') {
          aValue = a.sequence || '';
          bValue = b.sequence || '';
        } else if (sortField === 'to') {
          aValue = a.turnover || '';
          bValue = b.turnover || '';
        } else if (sortField === 'frames') {
          aValue = a.frames ?? Number.MAX_SAFE_INTEGER; // Put null/undefined at end
          bValue = b.frames ?? Number.MAX_SAFE_INTEGER;
        } else if (sortField === 'tag') {
          aValue = a.shotTag || '';
          bValue = b.shotTag || '';
        } else if (sortField === 'sow') {
          aValue = a.scopeOfWork || '';
          bValue = b.scopeOfWork || '';
        } else if (sortField === 'remark') {
          aValue = a.remark || '';
          bValue = b.remark || '';
        } else {
          // Department column sorting - sort by status or lead
          const aTask = a.tasks[sortField];
          const bTask = b.tasks[sortField];
          aValue = aTask ? aTask.status : '';
          bValue = bTask ? bTask.status : '';
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortDirection === 'asc' ? comparison : -comparison;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    return rows;
  }, [shows, filters, searchQuery, sortField, sortDirection]);

  // Helper function to format show name with client if needed
  const getDisplayShowName = (row: any) => {
    const show = shows.find(s => s.id === row.showId);
    if (!show) return row.showName;
    
    if (showClientName && show.clientName) {
      return `${row.showName} (${show.clientName})`;
    }
    return row.showName;
  };

  // Handle row selection
  const handleRowSelect = (shotId: string, index: number, event: React.MouseEvent | MouseEvent) => {
    const newSelected = new Set(selectedRows);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: Select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        if (trackerRows[i]) {
          newSelected.add(trackerRows[i].shotId);
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle selection
      if (newSelected.has(shotId)) {
        newSelected.delete(shotId);
      } else {
        newSelected.add(shotId);
      }
    } else {
      // Normal click: Select only this
      newSelected.clear();
      newSelected.add(shotId);
    }

    setSelectedRows(newSelected);
    setLastSelectedIndex(index);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (selectedRows.size === 0) return;

    setDeleting(true);
    setShowDeleteConfirm(false);

    const shotIds = Array.from(selectedRows);
    
    // Optimistic update - remove from UI immediately
    const updatedShows = shows.map(show => ({
      ...show,
      shots: show.shots?.filter(shot => !shotIds.includes(shot.id))
    }));
    setShows(updatedShows);
    
    // Clear selection immediately
    setSelectedRows(new Set());
    setLastSelectedIndex(null);
    setDeleting(false);

    try {
      const response = await fetch('/api/shots/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete shots');
      }

      const data = await response.json();

      // Background refresh to ensure consistency
      fetch('/api/shows')
        .then(res => res.json())
        .then(showsData => setShows(showsData))
        .catch(err => console.error('Background refresh failed:', err));

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
      // Revert on error
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
    }
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteShow = async (showId: string) => {
    const show = shows.find(s => s.id === showId);
    if (!show) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${show.showName}"? This will delete ALL shots and tasks for this show and cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/shows/${showId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert(`Show "${show.showName}" deleted successfully!`);
        // Fetch updated shows to refresh the table instantly
        const showsRes = await fetch('/api/shows');
        const showsData = await showsRes.json();
        setShows(showsData);
      } else {
        alert('Failed to delete show. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting show:', error);
      alert('Failed to delete show. Please try again.');
    } finally {
      setDeleting(false);
      setShowManageShows(false);
    }
  };

  // Get all unique department columns (including internal ones)
  const allDepartmentColumns = useMemo(() => {
    const deptSet = new Set<string>();
    trackerRows.forEach(row => {
      Object.keys(row.tasks).forEach(dept => deptSet.add(dept));
    });
    return Array.from(deptSet).sort();
  }, [trackerRows]);
  
  // Column order state for department columns
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  
  // Load column order from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vfx-tracker-column-order');
    if (saved) {
      try {
        setColumnOrder(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load column order:', e);
      }
    }
  }, []);
  
  // Save column order to localStorage
  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem('vfx-tracker-column-order', JSON.stringify(columnOrder));
    }
  }, [columnOrder]);
  
  // Initialize column order when departments change
  useEffect(() => {
    if (allDepartmentColumns.length > 0 && columnOrder.length === 0) {
      setColumnOrder(allDepartmentColumns);
    } else if (allDepartmentColumns.length > 0) {
      // Add any new departments to the order
      const newDepts = allDepartmentColumns.filter(d => !columnOrder.includes(d));
      if (newDepts.length > 0) {
        setColumnOrder([...columnOrder, ...newDepts]);
      }
    }
  }, [allDepartmentColumns]);
  
  // Get ordered department columns based on custom order
  const orderedDepartmentColumns = useMemo(() => {
    if (columnOrder.length === 0) return allDepartmentColumns;
    // Filter to only include departments that exist
    return columnOrder.filter(dept => allDepartmentColumns.includes(dept));
  }, [columnOrder, allDepartmentColumns]);
  
  // Drag handlers for column reordering
  const handleDragStart = (dept: string) => {
    setDraggingColumn(dept);
  };
  
  const handleDragOver = (e: React.DragEvent, dept: string) => {
    e.preventDefault();
    setDragOverColumn(dept);
  };
  
  const handleDrop = (e: React.DragEvent, targetDept: string) => {
    e.preventDefault();
    
    if (!draggingColumn || draggingColumn === targetDept) {
      setDraggingColumn(null);
      setDragOverColumn(null);
      return;
    }
    
    const newOrder = [...orderedDepartmentColumns];
    const dragIndex = newOrder.indexOf(draggingColumn);
    const dropIndex = newOrder.indexOf(targetDept);
    
    // Remove from old position and insert at new position
    newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, draggingColumn);
    
    setColumnOrder(newOrder);
    setDraggingColumn(null);
    setDragOverColumn(null);
  };
  
  const handleDragEnd = () => {
    setDraggingColumn(null);
    setDragOverColumn(null);
  };

  if (trackerRows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500">No shots found. Create a show and add shots to get started.</p>
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation Bar */}
      {selectedRows.size > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={true}
                onChange={() => setSelectedRows(new Set())}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-blue-900">
                {selectedRows.size} shot{selectedRows.size !== 1 ? 's' : ''} selected
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
                <Trash2 size={16} />
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Shows Modal */}
      {showManageShows && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[70vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage Shows</h2>
              <button
                onClick={() => setShowManageShows(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2">
              {shows.map((show) => (
                <div
                  key={show.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-semibold">{show.showName}</p>
                    <p className="text-sm text-gray-600">{show.clientName}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteShow(show.id)}
                    disabled={deleting}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete Show"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Management Modal */}
      {showViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">View Management</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {/* Current View Info */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Current View:</span>{' '}
                {currentView || 'Default (unsaved)'}
              </p>
            </div>

            {/* Save New View */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Save Current Layout</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter view name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveView();
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveView}
                  disabled={!newViewName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  Save View
                </button>
              </div>
            </div>

            {/* Saved Views List */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-3">Saved Views</h3>
              {savedViews.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No saved views yet</p>
              ) : (
                <div className="space-y-2">
                  {savedViews.map((view) => (
                    <div
                      key={view.name}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleLoadView(view)}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {view.name}
                        </button>
                        {view.isDefault && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!view.isDefault && (
                          <button
                            onClick={() => handleSetDefaultView(view.name)}
                            className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 rounded transition-colors"
                            title="Set as default"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteView(view.name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete view"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reset to Default */}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors w-full justify-center"
              >
                <RotateCcw size={16} />
                Reset to Factory Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Controls Bar */}
      <div className="bg-white border-b border-gray-200 p-3 mb-2 rounded-t-lg shadow-sm flex items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by shot, show, lead, status, department... (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search (Ctrl+K)"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-3">
          {/* Table Density Selector */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setTableDensity('compact')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                tableDensity === 'compact' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Compact density"
            >
              Compact
            </button>
            <button
              onClick={() => setTableDensity('comfortable')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                tableDensity === 'comfortable' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Comfortable density"
            >
              Comfortable
            </button>
            <button
              onClick={() => setTableDensity('spacious')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                tableDensity === 'spacious' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Spacious density"
            >
              Spacious
            </button>
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            title="Export to Excel (Ctrl+E)"
          >
            <Download size={16} />
            Export
          </button>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={detailedView}
              onChange={onToggleDetailedView}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              title="Toggle detailed view (Ctrl+D)"
            />
            Detailed View
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showClientName}
              onChange={(e) => setShowClientName(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              title="Show client names in show column"
            />
            Client
          </label>
          
          <button
            onClick={() => setShowViewModal(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Manage column views"
          >
            <Eye size={16} />
            Views
          </button>
          
          {currentView && (
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
              {currentView}
            </span>
          )}
        </div>
      </div>

      <div 
        className="bg-white rounded-lg shadow-sm overflow-hidden"
        onClick={() => {
          // Deselect cells when clicking anywhere on the table container
          if (selectedCells.size > 0) {
            setSelectedCells(new Set());
            setLastSelectedCell(null);
          }
        }}
      >
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] relative">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-gray-100 border-b border-gray-200">
                {/* Single checkbox column - switches between delete and bulk operations */}
                <th className={`sticky left-0 z-20 bg-gray-100 ${getHeaderPadding()} text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-12`}>
                  <input
                    type="checkbox"
                    checked={
                      selectionMode 
                        ? selectedShotIds.size === trackerRows.length && trackerRows.length > 0
                        : selectedRows.size === trackerRows.length && trackerRows.length > 0
                    }
                    onChange={(e) => {
                      if (selectionMode) {
                        // Bulk operations mode
                        if (e.target.checked) {
                          selectAllShots(trackerRows.map(r => r.shotId));
                        } else {
                          clearSelection();
                        }
                      } else {
                        // Delete mode
                        if (e.target.checked) {
                          setSelectedRows(new Set(trackerRows.map(r => r.shotId)));
                        } else {
                          setSelectedRows(new Set());
                        }
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    title={selectionMode ? "Select all for bulk operations" : "Select all for deletion"}
                  />
                </th>
                {/* Fixed columns */}
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getShowLeft()}px`, width: getColumnWidth('show'), minWidth: getColumnWidth('show') }}
                onClick={() => handleSort('show')}
              >
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  {getSortIcon('show')}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowManageShows(true);
                    }}
                    className="p-1 hover:bg-gray-300 rounded transition-colors"
                    title="Manage Shows"
                  >
                    <Settings size={14} />
                  </button>
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('show', e);
                  }}
                />
              </th>
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getShotLeft()}px`, width: getColumnWidth('shot'), minWidth: getColumnWidth('shot') }}
                onClick={() => handleSort('shot')}
              >
                <div className="flex items-center gap-2">
                  <span>Shot</span>
                  {getSortIcon('shot')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('shot', e);
                  }}
                />
              </th>
              {!hiddenColumns.has('ep') && (
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getEPLeft()}px`, width: getColumnWidth('ep'), minWidth: getColumnWidth('ep') }}
                onClick={() => handleSort('ep')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('ep');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center gap-2">
                  <span>EP</span>
                  {getSortIcon('ep')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('ep', e);
                  }}
                />
              </th>
              )}
              {!hiddenColumns.has('seq') && (
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getSEQLeft()}px`, width: getColumnWidth('seq'), minWidth: getColumnWidth('seq') }}
                onClick={() => handleSort('seq')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('seq');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center gap-2">
                  <span>SEQ</span>
                  {getSortIcon('seq')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('seq', e);
                  }}
                />
              </th>
              )}
              {!hiddenColumns.has('to') && (
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getTOLeft()}px`, width: getColumnWidth('to'), minWidth: getColumnWidth('to') }}
                onClick={() => handleSort('to')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('to');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center gap-2">
                  <span>TO</span>
                  {getSortIcon('to')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('to', e);
                  }}
                />
              </th>
              )}
              {!hiddenColumns.has('frames') && (
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getFramesLeft()}px`, width: getColumnWidth('frames'), minWidth: getColumnWidth('frames') }}
                onClick={() => handleSort('frames')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('frames');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center gap-2">
                  <span>Frames</span>
                  {getSortIcon('frames')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('frames', e);
                  }}
                />
              </th>
              )}
              {!hiddenColumns.has('tag') && (
              <th 
                className={`sticky z-20 bg-gray-100 ${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ left: `${getTagLeft()}px`, width: getColumnWidth('tag'), minWidth: getColumnWidth('tag') }}
                onClick={() => handleSort('tag')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('tag');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center gap-2">
                  <span>Tag</span>
                  {getSortIcon('tag')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('tag', e);
                  }}
                />
              </th>
              )}
              {!hiddenColumns.has('sow') && (
              <th 
                className={`${getHeaderPadding()} text-left text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200`}
                style={{ width: getColumnWidth('sow'), minWidth: getColumnWidth('sow') }}
                onClick={() => handleSort('sow')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('sow');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSowExpanded(!sowExpanded);
                    }}
                    className="p-1 hover:bg-gray-300 rounded transition-colors"
                    title={sowExpanded ? "Collapse SOW" : "Expand SOW"}
                  >
                    {sowExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span>SOW</span>
                  {getSortIcon('sow')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('sow', e);
                  }}
                />
              </th>
              )}

              {/* Dynamic department columns (including internal) - draggable for reordering */}
              {orderedDepartmentColumns.map((dept) => (
                <th 
                  key={dept}
                  draggable
                  onDragStart={() => handleDragStart(dept)}
                  onDragOver={(e) => handleDragOver(e, dept)}
                  onDrop={(e) => handleDrop(e, dept)}
                  onDragEnd={handleDragEnd}
                  className={`${getHeaderPadding()} text-center text-sm font-semibold text-gray-900 border-r border-gray-200 relative group cursor-move hover:bg-gray-200 transition-colors ${
                    draggingColumn === dept ? 'opacity-50' : ''
                  } ${
                    dragOverColumn === dept ? 'border-l-4 border-l-blue-500' : ''
                  }`}
                  style={{ width: getColumnWidth(`dept-${dept}`), minWidth: getColumnWidth(`dept-${dept}`) }}
                  onClick={(e) => {
                    // Only sort if not dragging
                    if (!draggingColumn) {
                      handleSort(dept);
                    }
                  }}
                  title="Drag to reorder column"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{dept}</span>
                    {getSortIcon(dept)}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(`dept-${dept}`, e);
                    }}
                  />
                </th>
              ))}

              {/* REMARK Column - extreme right */}
              {!hiddenColumns.has('remark') && (
              <th
                className="sticky top-0 z-20 px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-100 border-b-2 border-gray-300 cursor-pointer select-none hover:bg-gray-200 transition-colors group"
                onClick={() => handleSort('remark')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleColumnVisibility('remark');
                }}
                title="Double-click to hide"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Remark</span>
                  {getSortIcon('remark')}
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown('remark', e);
                  }}
                />
              </th>
              )}
            </tr>
          </thead>
          <tbody>
            {trackerRows.map((row, idx) => (
              <tr
                key={row.shotId}
                className={`
                  border-b border-gray-200 hover:bg-gray-50 transition-colors
                  ${selectionMode 
                    ? (selectedShotIds.has(row.shotId) ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')
                    : (selectedRows.has(row.shotId) ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')
                  }
                `}
              >
                {/* Single checkbox - switches between delete and bulk operations */}
                <td 
                  className="sticky left-0 z-10 bg-inherit px-3 py-3 border-r border-gray-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectionMode ? selectedShotIds.has(row.shotId) : selectedRows.has(row.shotId)}
                    onChange={() => {
                      if (selectionMode) {
                        // Bulk operations mode
                        toggleShotSelection(row.shotId);
                      } else {
                        // Delete mode
                        const newSelected = new Set(selectedRows);
                        if (newSelected.has(row.shotId)) {
                          newSelected.delete(row.shotId);
                        } else {
                          newSelected.add(row.shotId);
                        }
                        setSelectedRows(newSelected);
                      }
                    }}
                    className={`w-4 h-4 rounded border-gray-300 cursor-pointer ${
                      selectionMode ? 'text-blue-600 focus:ring-blue-500' : 'text-red-600 focus:ring-red-500'
                    }`}
                    title={selectionMode ? "Select for bulk operations" : "Select for deletion"}
                  />
                </td>
                {/* Fixed columns */}
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm text-gray-900 border-r border-gray-200`}
                  style={{ left: `${getShowLeft()}px`, width: getColumnWidth('show'), minWidth: getColumnWidth('show') }}
                >
                  {getDisplayShowName(row)}
                </td>
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm font-medium text-gray-900 border-r border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors relative group`}
                  style={{ left: `${getShotLeft()}px`, width: getColumnWidth('shot'), minWidth: getColumnWidth('shot') }}
                  onMouseEnter={() => {
                    hoveredShotNameRef.current = row.shotName;
                    console.log('Hovering shot:', row.shotName);
                  }}
                  onMouseLeave={() => {
                    hoveredShotNameRef.current = null;
                    console.log('Left shot hover');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle chat panel - close if already open for this shot
                    if (chatPanelOpen && chatShotId === row.shotId) {
                      setChatPanelOpen(false);
                      setChatShotId(null);
                      fetchAllShotDeptMentions();
                    } else {
                      setChatShotId(row.shotId);
                      setChatShotName(row.shotName);
                      setChatPanelOpen(true);
                    }
                  }}
                  title="Click to toggle notes | Hover and press Ctrl+C to copy"
                >
                  {shotsWithNotes.has(row.shotId) && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full z-20 animate-pulse" title="Has notes" />
                  )}
                  {/* Copy icon that appears on hover */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <Copy size={12} className="text-gray-400" />
                  </div>
                  {row.shotName}
                </td>
                {!hiddenColumns.has('ep') && (
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm text-gray-700 border-r border-gray-200 text-center`}
                  style={{ left: `${getEPLeft()}px`, width: getColumnWidth('ep'), minWidth: getColumnWidth('ep') }}
                >
                  {row.episode || '-'}
                </td>
                )}
                {!hiddenColumns.has('seq') && (
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm text-gray-700 border-r border-gray-200 text-center`}
                  style={{ left: `${getSEQLeft()}px`, width: getColumnWidth('seq'), minWidth: getColumnWidth('seq') }}
                >
                  {row.sequence || '-'}
                </td>
                )}
                {!hiddenColumns.has('to') && (
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm text-gray-700 border-r border-gray-200 text-center`}
                  style={{ left: `${getTOLeft()}px`, width: getColumnWidth('to'), minWidth: getColumnWidth('to') }}
                >
                  {row.turnover || '-'}
                </td>
                )}
                {/* FRAMES Column */}
                {!hiddenColumns.has('frames') && (
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm text-gray-700 border-r border-gray-200 text-center`}
                  style={{ left: `${getFramesLeft()}px`, width: getColumnWidth('frames'), minWidth: getColumnWidth('frames') }}
                >
                  {row.frames || '-'}
                </td>
                )}
                {!hiddenColumns.has('tag') && (
                <td 
                  className={`sticky z-10 bg-inherit ${getCellPadding()} text-sm border-r border-gray-200 text-center`}
                  style={{ left: `${getTagLeft()}px`, width: getColumnWidth('tag'), minWidth: getColumnWidth('tag') }}
                >
                  <span className={`
                    px-2 py-1 rounded text-xs font-medium whitespace-nowrap
                    ${row.shotTag === 'Fresh' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}
                  `}>
                    {row.shotTag}
                  </span>
                </td>
                )}
                {!hiddenColumns.has('sow') && (
                <td 
                  className={`${getCellPadding()} text-sm text-gray-700 border-r border-gray-200`}
                  style={{ 
                    width: getColumnWidth('sow'), 
                    minWidth: getColumnWidth('sow'),
                    maxWidth: getColumnWidth('sow')
                  }}
                >
                  {sowExpanded ? (
                    <div className="whitespace-pre-wrap break-words">
                      {row.scopeOfWork || '-'}
                    </div>
                  ) : (
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap" title={row.scopeOfWork || '-'}>
                      {row.scopeOfWork || '-'}
                    </div>
                  )}
                </td>
                )}

                {/* Dynamic department task cells */}
                {orderedDepartmentColumns.map((dept) => {
                  const task = row.tasks[dept];
                  const hasDeptMention = shotDeptMentions.get(row.shotId)?.has(dept.toUpperCase());
                  
                  return (
                    <td 
                      key={dept} 
                      className="px-2 py-2 border-r border-gray-200 relative"
                      style={{ width: getColumnWidth(`dept-${dept}`), minWidth: getColumnWidth(`dept-${dept}`) }}
                    >
                      {hasDeptMention && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full z-20 animate-pulse" title={`${dept} mentioned in notes`} />
                      )}
                      {task ? (
                        detailedView ? (
                          <TaskCell task={task} />
                        ) : (
                          // Compact status-only view with multi-select
                          (() => {
                            const cellId = `${task.id}|${dept}`;
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
                                style={{ backgroundColor: task.status ? (() => {
                                  const statusColors: any = {
                                    'YTS': '#9CA3AF',
                                    'WIP': '#3B82F6',
                                    'Int App': '#10B981',
                                    'AWF': '#F59E0B',
                                    'C APP': '#22C55E',
                                    'C KB': '#EF4444',
                                    'OMIT': '#6B7280',
                                    'HOLD': '#8B5CF6',
                                  };
                                  return statusColors[task.status] || '#6B7280';
                                })() : '#6B7280' }}
                                onClick={hasEditPermission ? (e) => handleCellClick(cellId, e, idx) : undefined}
                                onContextMenu={hasEditPermission 
                                  ? (e) => handleCellRightClick(e, cellId, idx)
                                  : (e) => e.preventDefault() // Block default context menu for view-only
                                }
                                title={hasEditPermission 
                                  ? "Click to select | Shift+Click for range (horizontal/vertical) | Ctrl+Click for multi-select | Right-click for options"
                                  : "View only - No edit permission"
                                }
                              >
                                {task.status}
                              </div>
                            );
                          })()
                        )
                      ) : (
                        <div className="text-center text-gray-400 text-sm">-</div>
                      )}
                    </td>
                  );
                })}

                {/* REMARK Column - extreme right */}
                {!hiddenColumns.has('remark') && (
                <td 
                  className={`${getCellPadding()} text-sm text-gray-700 border-r border-gray-200 text-center`}
                  style={{ 
                    width: getColumnWidth('remark'), 
                    minWidth: getColumnWidth('remark'),
                    maxWidth: getColumnWidth('remark')
                  }}
                  onDoubleClick={() => {
                    if (hasEditPermission) {
                      setEditingRemarkId(row.shotId);
                      setEditingRemarkValue(row.remark || '');
                    }
                  }}
                >
                  {editingRemarkId === row.shotId ? (
                    <input
                      type="text"
                      value={editingRemarkValue}
                      onChange={(e) => setEditingRemarkValue(e.target.value)}
                      onBlur={() => handleRemarkEdit(row.shotId, editingRemarkValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRemarkEdit(row.shotId, editingRemarkValue);
                        } else if (e.key === 'Escape') {
                          setEditingRemarkId(null);
                          setEditingRemarkValue('');
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div 
                      className="overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      title={row.remark || '-'}
                    >
                      {row.remark || '-'}
                    </div>
                  )}
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Total Shots: <span className="font-semibold">{trackerRows.length}</span>
        </p>
      </div>
    </div>
    
    {/* Context Menu for Multi-Select Status Update */}
    {contextMenu.visible && !detailedView && hasEditPermission && (
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
        
        <div className="border-t border-gray-200 mt-1 pt-1">
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
    
    {/* Keyboard Shortcuts Help - Bottom Right Corner with Minimize/Expand */}
    <div className="fixed bottom-4 right-4 z-40">
      {/* Main Panel */}
      <div 
        className={`bg-gray-900 text-white text-xs rounded-lg shadow-2xl transition-all duration-300 ease-in-out ${
          shortcutsMinimized 
            ? 'opacity-0 translate-y-full pointer-events-none' 
            : 'opacity-90 hover:opacity-100'
        }`}
        style={{
          maxWidth: '300px',
        }}
      >
        <div className="p-3">
          <div className="font-semibold mb-2 text-sm">⌨️ Keyboard Shortcuts</div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Search</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+F</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Filter List</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+Q</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Clear Search</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+K</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Select All</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+A</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Toggle Detail</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+D</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Export</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+E</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Unhide Columns</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+U</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Copy Shot (hover)</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+C</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-300">Clear Selection</span>
              <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Esc</kbd>
            </div>
          </div>
        </div>
      </div>
      
      {/* Toggle Button - Transparent with Arrow */}
      <button
        onClick={() => setShortcutsMinimized(!shortcutsMinimized)}
        className="mt-2 w-full flex items-center justify-center py-2 px-3 bg-gray-900/40 hover:bg-gray-900/60 backdrop-blur-sm rounded-lg transition-all duration-300 ease-in-out group"
        title={shortcutsMinimized ? 'Show shortcuts' : 'Hide shortcuts'}
      >
        <ChevronUp 
          className={`w-4 h-4 text-white/70 group-hover:text-white transition-all duration-300 ${
            shortcutsMinimized ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>
    </div>

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

    {/* Unhide Columns Modal */}
    </>
  );
}
