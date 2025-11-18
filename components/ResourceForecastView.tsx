'use client';

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useResourceContext } from '@/lib/resourceContext';
import { useResourceForecast, useBulkAddAllocations, useAddAllocation, useUpdateAllocation, useDeleteAllocation } from '@/hooks/useQueryHooks';
import { toast } from 'react-hot-toast';

// Lazy load modals for better initial performance
const ResourceImportModal = lazy(() => import('./ResourceImportModal'));
const ResourceMemberForm = lazy(() => import('./ResourceMemberForm'));

// Type definitions
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

interface ResourceAllocation {
  id: string;
  resourceId: string;
  showName: string;
  shotName: string;
  allocationDate: Date;
  manDays: number;
  isLeave: boolean;
  isIdle: boolean;
  isWeekendWorking?: boolean;
  notes: string | null;
  createdBy: string;
  createdDate: Date;
  updatedDate: Date;
}

interface ResourceWithAllocations extends ResourceMember {
  allocations: ResourceAllocation[];
}

interface DailyAllocation {
  date: Date;
  allocations: ResourceAllocation[];
  totalMD: number;
  status: 'available' | 'partial' | 'full';
}

export default function ResourceForecastView() {
  const { triggerRefresh } = useResourceContext();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState(30);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ResourceMember | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'members' | 'allocations'>('members');
  
  // Advanced filtering
  const [selectedShow, setSelectedShow] = useState<string>('all');
  const [utilizationFilter, setUtilizationFilter] = useState<'all' | 'overallocated' | 'available' | 'partial'>('all');
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  
  // Bulk operations
  const [bulkMode, setBulkMode] = useState<'fill' | 'copy' | 'reassign' | null>(null);
  const [bulkSourceMember, setBulkSourceMember] = useState<string | null>(null);
  
  // Multi-selection states
  const [editingCell, setEditingCell] = useState<{ memberId: string; dateIndex: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Calculate date range for API
  const startDateStr = useMemo(() => startDate.toISOString().split('T')[0], [startDate]);
  const endDateStr = useMemo(() => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + dateRange - 1);
    return endDate.toISOString().split('T')[0];
  }, [startDate, dateRange]);

  // Use React Query for data fetching - NO MORE MANUAL LOADING!
  const { members: fetchedMembers, allocations: fetchedAllocations, isLoading: loading } = useResourceForecast({
    department: selectedDepartment,
    shift: selectedShift,
    startDate: startDateStr,
    endDate: endDateStr,
  });

  // Mutations for instant updates
  const addAllocation = useAddAllocation();
  const updateAllocation = useUpdateAllocation();
  const deleteAllocation = useDeleteAllocation();
  const bulkAddAllocations = useBulkAddAllocations();

  // Combine members with their allocations
  const members = useMemo(() => {
    return fetchedMembers.map((member: ResourceMember) => ({
      ...member,
      allocations: fetchedAllocations.filter((a: ResourceAllocation) => a.resourceId === member.id),
    }));
  }, [fetchedMembers, fetchedAllocations]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ memberId: string; dateIndex: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cells: string[] } | null>(null);
  const [bulkInputValue, setBulkInputValue] = useState('');
  const [workingWeekends, setWorkingWeekends] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCells, setCopiedCells] = useState<Map<string, string>>(new Map());
  const [fillHandleActive, setFillHandleActive] = useState(false);
  const [fillHandleCell, setFillHandleCell] = useState<{ memberId: string; dateIndex: number } | null>(null);

  // Ref for virtual scrolling container
  const parentRef = useRef<HTMLDivElement>(null);

  // Generate date columns
  const dates = useMemo(() => {
    const cols: Date[] = [];
    for (let i = 0; i < dateRange; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      cols.push(date);
    }
    return cols;
  }, [startDate, dateRange]);

  // Load weekend working from allocations and localStorage
  useEffect(() => {
    const weekendWorkingDates = new Set<string>();
    
    fetchedAllocations.forEach((alloc: ResourceAllocation) => {
      if (alloc.isWeekendWorking) {
        const dateKey = new Date(alloc.allocationDate).toISOString().split('T')[0];
        weekendWorkingDates.add(dateKey);
      }
    });
    
    const storedWeekends = localStorage.getItem('workingWeekends');
    if (storedWeekends) {
      try {
        const parsedWeekends = JSON.parse(storedWeekends) as string[];
        parsedWeekends.forEach((dateKey: string) => weekendWorkingDates.add(dateKey));
      } catch (e) {
        console.error('Failed to parse stored working weekends:', e);
      }
    }
    
    setWorkingWeekends(weekendWorkingDates);
  }, [fetchedAllocations]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      handleFillHandleMouseUp();
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editingCell || contextMenu) return;
      
      // Delete key
      if (e.key === 'Delete' && selectedCells.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
      
      // Copy - Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedCells.size > 0) {
        e.preventDefault();
        handleCopy();
      }
      
      // Paste - Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && selectedCells.size > 0) {
        e.preventDefault();
        handlePaste();
      }
      
      // Undo - Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Redo - Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [selectedCells, editingCell, contextMenu, copiedCells, history, historyIndex]);

  // Load saved views
  const loadSavedViews = async () => {
    try {
      const response = await fetch('/api/saved-views?viewType=resource');
      if (response.ok) {
        const views = await response.json();
        setSavedViews(views);
      }
    } catch (error) {
      console.error('Error loading saved views:', error);
    }
  };

  // Apply saved view
  const applyView = (view: any) => {
    const filters = JSON.parse(view.filters);
    setSelectedDepartment(filters.department || 'all');
    setSelectedShift(filters.shift || 'all');
    setSelectedShow(filters.show || 'all');
    setUtilizationFilter(filters.utilization || 'all');
    setSearchQuery(filters.search || '');
    if (filters.startDate) setStartDate(new Date(filters.startDate));
    if (filters.dateRange) setDateRange(filters.dateRange);
    setActiveViewId(view.id);
  };

  // Save current filters as view
  const saveCurrentView = async (name: string, isPublic: boolean, isQuickFilter: boolean) => {
    try {
      const filters = {
        department: selectedDepartment,
        shift: selectedShift,
        show: selectedShow,
        utilization: utilizationFilter,
        search: searchQuery,
        startDate: startDate.toISOString(),
        dateRange
      };

      const response = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          viewType: 'resource',
          filters,
          isPublic,
          isQuickFilter
        })
      });

      if (response.ok) {
        await loadSavedViews();
        setShowSaveViewModal(false);
        alert('View saved successfully!');
      }
    } catch (error) {
      console.error('Error saving view:', error);
      alert('Failed to save view');
    }
  };

  // Delete saved view
  const deleteSavedView = async (viewId: string) => {
    if (!confirm('Delete this saved view?')) return;
    
    try {
      const response = await fetch(`/api/saved-views/${viewId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadSavedViews();
        if (activeViewId === viewId) setActiveViewId(null);
      }
    } catch (error) {
      console.error('Error deleting view:', error);
    }
  };

  // Bulk operations
  const handleBulkReassign = async (fromMemberId: string, toMemberId: string, dateIndices: number[]) => {
    const fromMember = members.find((m: any) => m.id === fromMemberId);
    const toMember = members.find((m: any) => m.id === toMemberId);
    
    if (!fromMember || !toMember) return;

    saveToHistory();

    for (const dateIndex of dateIndices) {
      const date = dates[dateIndex];
      const dailyAlloc = getDailyAllocation(fromMember, date);
      
      if (dailyAlloc.allocations.length === 0) continue;

      // Delete from source
      await Promise.all(dailyAlloc.allocations.map((alloc: any) =>
        fetch(`/api/resource/allocations/${alloc.id}`, { method: 'DELETE' })
      ));

      // Create for target
      await Promise.all(dailyAlloc.allocations.map((alloc: any) =>
        fetch('/api/resource/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: toMemberId,
            showName: alloc.showName,
            shotName: alloc.shotName,
            allocationDate: date.toISOString(),
            manDays: alloc.manDays,
            isLeave: alloc.isLeave,
            isIdle: alloc.isIdle,
            isWeekendWorking: alloc.isWeekendWorking
          })
        })
      ));
    }

    // React Query auto-refetches
    triggerRefresh();
    
    const bc = new BroadcastChannel('resource-updates');
    bc.postMessage({ type: 'allocation-updated' });
    bc.close();
  };

  // Bulk copy (copy allocation pattern from one week to another)
  const handleBulkCopyWeek = async (sourceMemberId: string, sourceStartDate: Date, targetStartDate: Date) => {
    const member = members.find((m: any) => m.id === sourceMemberId);
    if (!member) return;

    saveToHistory();

    // Get 7 days worth of allocations from source
    for (let i = 0; i < 7; i++) {
      const sourceDate = new Date(sourceStartDate);
      sourceDate.setDate(sourceDate.getDate() + i);
      
      const targetDate = new Date(targetStartDate);
      targetDate.setDate(targetDate.getDate() + i);

      const dailyAlloc = getDailyAllocation(member, sourceDate);
      
      // Create same allocations for target date
      await Promise.all(dailyAlloc.allocations.map((alloc: any) =>
        fetch('/api/resource/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: member.id,
            showName: alloc.showName,
            shotName: alloc.shotName,
            allocationDate: targetDate.toISOString(),
            manDays: alloc.manDays,
            isLeave: alloc.isLeave,
            isIdle: alloc.isIdle,
            isWeekendWorking: false
          })
        })
      ));
    }

    // React Query auto-refetches
    triggerRefresh();
    
    const bc = new BroadcastChannel('resource-updates');
    bc.postMessage({ type: 'allocation-updated' });
    bc.close();
  };

  useEffect(() => {
    loadSavedViews();
  }, []);

  const getDailyAllocation = (member: ResourceWithAllocations, date: Date): DailyAllocation => {
    const dateStr = date.toISOString().split('T')[0];
    const dayAllocations = member.allocations.filter((a: any) => {
      const allocDateStr = new Date(a.allocationDate).toISOString().split('T')[0];
      return allocDateStr === dateStr;
    });

    const totalMD = dayAllocations.reduce((sum, a) => sum + a.manDays, 0);
    let status: 'available' | 'partial' | 'full' = 'available';
    if (totalMD >= 1.0) status = 'full';
    else if (totalMD > 0) status = 'partial';

    return { date, allocations: dayAllocations, totalMD, status };
  };

  const parseShotString = (input: string): Array<{ shotName: string; manDays: number }> => {
    if (!input.trim()) return [];
    
    const shots = input.split('/').map((s: string) => s.trim()).filter(Boolean);
    const result: Array<{ shotName: string; manDays: number }> = [];
    
    const hasExplicitMD = shots.some((s: string) => s.includes(':'));
    
    if (hasExplicitMD) {
      for (const shot of shots) {
        const [shotName, mdStr] = shot.split(':').map((s: string) => s.trim());
        const manDays = mdStr ? parseFloat(mdStr) : 1.0;
        if (shotName && !isNaN(manDays)) {
          result.push({ shotName, manDays });
        }
      }
    } else {
      const mdPerShot = 1.0 / shots.length;
      for (const shotName of shots) {
        result.push({ shotName, manDays: mdPerShot });
      }
    }
    
    return result;
  };

  const formatAllocationsToString = (allocations: ResourceAllocation[]): string => {
    const shots = allocations.filter((a: any) => !a.isLeave && !a.isIdle);
    if (shots.length === 0) return '';
    
    const firstMD = shots[0].manDays;
    const allEqual = shots.every((s: any) => Math.abs(s.manDays - firstMD) < 0.001);
    
    if (allEqual && shots.length > 1 && Math.abs(firstMD - 1.0 / shots.length) < 0.001) {
      return shots.map((s: any) => s.shotName).join('/');
    } else {
      return shots.map((s: any) => `${s.shotName}:${s.manDays}`).join('/');
    }
  };

  const getCellKey = (memberId: string, dateIndex: number) => `${memberId}-${dateIndex}`;

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isWorkingDay = (date: Date) => {
    if (!isWeekend(date)) return true;
    const dateKey = date.toISOString().split('T')[0];
    return workingWeekends.has(dateKey);
  };

  const toggleWeekendWorking = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    setWorkingWeekends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      // Persist to localStorage
      localStorage.setItem('workingWeekends', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  const handleCellMouseDown = (member: ResourceWithAllocations, dateIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const cellKey = getCellKey(member.id, dateIndex);
    
    if (e.ctrlKey || e.metaKey) {
      const newSelected = new Set(selectedCells);
      if (newSelected.has(cellKey)) {
        newSelected.delete(cellKey);
      } else {
        newSelected.add(cellKey);
      }
      setSelectedCells(newSelected);
    } else {
      setSelectedCells(new Set([cellKey]));
      setDragStart({ memberId: member.id, dateIndex });
      setIsDragging(true);
    }
  };

  // Drag-to-fill handle functionality
  const handleFillHandleMouseDown = (member: ResourceWithAllocations, dateIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFillHandleActive(true);
    setFillHandleCell({ memberId: member.id, dateIndex });
    saveToHistory();
  };

  const handleFillHandleMouseEnter = (member: ResourceWithAllocations, dateIndex: number) => {
    if (!fillHandleActive || !fillHandleCell) return;

    const sourceMember = members.find((m: any) => m.id === fillHandleCell.memberId);
    if (!sourceMember) return;

    const sourceDate = dates[fillHandleCell.dateIndex];
    const sourceDailyAlloc = getDailyAllocation(sourceMember, sourceDate);
    const sourceValue = formatAllocationsToString(sourceDailyAlloc.allocations);

    // Only fill if source has data
    if (!sourceValue) return;

    // Fill cells in the same row from source to current
    const startDateIdx = Math.min(fillHandleCell.dateIndex, dateIndex);
    const endDateIdx = Math.max(fillHandleCell.dateIndex, dateIndex);

    for (let di = startDateIdx; di <= endDateIdx; di++) {
      if (di !== fillHandleCell.dateIndex) {
        saveCellValue(member, di, sourceValue);
      }
    }
  };

  const handleFillHandleMouseUp = () => {
    setFillHandleActive(false);
    setFillHandleCell(null);
    triggerRefresh();
  };

  const handleCellMouseEnter = (member: ResourceWithAllocations, dateIndex: number) => {
    if (fillHandleActive) {
      handleFillHandleMouseEnter(member, dateIndex);
      return;
    }
    
    if (!isDragging || !dragStart) return;
    
    const newSelected = new Set<string>();
    
    const startMemberIdx = members.findIndex((m: any) => m.id === dragStart.memberId);
    const endMemberIdx = members.findIndex((m: any) => m.id === member.id);
    const startDateIdx = Math.min(dragStart.dateIndex, dateIndex);
    const endDateIdx = Math.max(dragStart.dateIndex, dateIndex);
    const minMemberIdx = Math.min(startMemberIdx, endMemberIdx);
    const maxMemberIdx = Math.max(startMemberIdx, endMemberIdx);
    
    for (let mi = minMemberIdx; mi <= maxMemberIdx; mi++) {
      for (let di = startDateIdx; di <= endDateIdx; di++) {
        newSelected.add(getCellKey(members[mi].id, di));
      }
    }
    
    setSelectedCells(newSelected);
  };

  const handleCellClick = (member: ResourceWithAllocations, dateIndex: number) => {
    if (selectedCells.size > 1) return;
    
    const date = dates[dateIndex];
    const dailyAlloc = getDailyAllocation(member, date);
    const currentValue = formatAllocationsToString(dailyAlloc.allocations);
    
    setEditingCell({ memberId: member.id, dateIndex });
    setEditValue(currentValue);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedCells.size === 0) return;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      cells: Array.from(selectedCells)
    });
  };

  const saveToHistory = () => {
    const snapshot = {
      members: JSON.parse(JSON.stringify(members)),
      timestamp: Date.now()
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    // Undo/redo disabled with React Query - data comes from cache
    // if (historyIndex > 0) {
    //   const prevState = history[historyIndex - 1];
    //   setMembers(JSON.parse(JSON.stringify(prevState.members)));
    //   setHistoryIndex(historyIndex - 1);
    // }
  };

  const handleRedo = () => {
    // Undo/redo disabled with React Query - data comes from cache
    // if (historyIndex < history.length - 1) {
    //   const nextState = history[historyIndex + 1];
    //   setMembers(JSON.parse(JSON.stringify(nextState.members)));
    //   setHistoryIndex(historyIndex + 1);
    // }
  };

  const handleCopy = () => {
    const cellData = new Map<string, string>();
    
    for (const cellKey of Array.from(selectedCells)) {
      const [memberId, dateIndexStr] = cellKey.split('-');
      const dateIndex = parseInt(dateIndexStr);
      const member = members.find((m: any) => m.id === memberId);
      const date = dates[dateIndex];
      
      if (member && date) {
        const dailyAlloc = getDailyAllocation(member, date);
        const value = formatAllocationsToString(dailyAlloc.allocations);
        cellData.set(cellKey, value);
      }
    }
    
    setCopiedCells(cellData);
  };

  const handlePaste = async () => {
    if (copiedCells.size === 0) return;
    
    saveToHistory();
    
    const pastePromises = Array.from(selectedCells).map((cellKey: string) => {
      const [memberId, dateIndexStr] = cellKey.split('-');
      const dateIndex = parseInt(dateIndexStr);
      const member = members.find((m: any) => m.id === memberId);
      
      if (member && copiedCells.size === 1) {
        const value = Array.from(copiedCells.values())[0];
        return saveCellValue(member, dateIndex, value);
      }
      return Promise.resolve();
    });
    
    await Promise.all(pastePromises);
    
    
  };

  const handleMarkLeave = async () => {
    if (selectedCells.size === 0) return;
    
    saveToHistory();
    
    const leavePromises = Array.from(selectedCells).map(async (cellKey) => {
      const [memberId, dateIndexStr] = cellKey.split('-');
      const dateIndex = parseInt(dateIndexStr);
      const member = members.find((m: any) => m.id === memberId);
      const date = dates[dateIndex];
      
      if (member && date) {
        const dailyAlloc = getDailyAllocation(member, date);
        
        // Delete existing in parallel
        await Promise.all(dailyAlloc.allocations.map((alloc: any) =>
          fetch(`/api/resource/allocations/${alloc.id}`, {
            method: 'DELETE',
            headers: { 'Cache-Control': 'no-cache' }
          })
        ));
        
        // Create leave allocation
        await fetch('/api/resource/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: member.id,
            showName: 'Leave',
            shotName: 'Leave',
            allocationDate: date.toISOString(),
            manDays: 1.0,
            isLeave: true,
            isIdle: false,
            isWeekendWorking: false,
          }),
        });
      }
    });
    
    await Promise.all(leavePromises);
    
    
    setSelectedCells(new Set());
  };

  const exportToExcel = () => {
    const rows: any[][] = [];
    
    // Header row
    const headerRow = ['ID', 'Name', 'Designation', 'Reporting', 'Dept', 'Shift'];
    dates.forEach((date: Date) => {
      headerRow.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    });
    rows.push(headerRow);
    
    // Data rows
    members.forEach((member: any) => {
      const row = [
        member.empId,
        member.empName,
        member.designation,
        member.reportingTo || '',
        member.department,
        member.shift
      ];
      
      dates.forEach((date: Date) => {
        const dailyAlloc = getDailyAllocation(member, date);
        row.push(formatAllocationsToString(dailyAlloc.allocations) || '');
      });
      
      rows.push(row);
    });
    
    // Utilization row
    const utilRow = ['', '', '', '', '', 'TOTAL MD'];
    dates.forEach((date: Date, idx: number) => {
      let totalMD = 0;
      members.forEach((member: any) => {
        const dailyAlloc = getDailyAllocation(member, date);
        totalMD += dailyAlloc.totalMD;
      });
      utilRow.push(totalMD.toFixed(2));
    });
    rows.push(utilRow);
    
    // Create CSV
    const csv = rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resource-forecast-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveCellValue = async (member: ResourceWithAllocations, dateIndex: number, value: string) => {
    const date = dates[dateIndex];
    const dailyAlloc = getDailyAllocation(member, date);
    
    // Delete ALL existing allocations (including Leave and Idle)
    const allocsToDelete = dailyAlloc.allocations;
    
    if (allocsToDelete.length > 0) {
      await Promise.all(allocsToDelete.map((alloc: any) =>
        fetch(`/api/resource/allocations/${alloc.id}`, {
          method: 'DELETE',
          headers: { 'Cache-Control': 'no-cache' }
        })
      ));
    }

    if (!value.trim()) {
      // Just delete, no new allocations - React Query will refetch
      triggerRefresh();
      return;
    }

    

    // Parse shots and validate each against award sheet
    const shots = parseShotString(value);
    const validatedShots: Array<{ shotName: string; showName: string; manDays: number }> = [];
    const invalidShots: string[] = [];

    // Validate total man-days doesn't exceed 1.0 per day
    const totalManDays = shots.reduce((sum, shot) => sum + shot.manDays, 0);
    if (totalManDays > 1.0) {
      alert(`⚠️ Warning: Total man-days (${totalManDays.toFixed(2)}) exceeds 1.0 for a single day!\n\nA member can only be allocated maximum 1 MD per day.\n\nPlease adjust the allocations.`);
      return;
    }

    for (const { shotName, manDays } of shots) {
      try {
        const response = await fetch('/api/award-sheet/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shotName }),
        });

        const result = await response.json();

        if (result.valid) {
          validatedShots.push({ shotName, showName: result.showName, manDays });
        } else {
          invalidShots.push(shotName);
        }
      } catch (error) {
        console.error(`Error validating shot ${shotName}:`, error);
        invalidShots.push(shotName);
      }
    }

    // If there are invalid shots, show popup with option to add to award sheet
    if (invalidShots.length > 0) {
      const shouldAdd = confirm(
        `The following shot(s) are not in the Award Sheet:\n${invalidShots.join(', ')}\n\n` +
        `Would you like to add them to the Award Sheet?\n\n` +
        `Click OK to open Award Sheet, or Cancel to skip.`
      );

      if (shouldAdd) {
        // Open award sheet view - you'll need to implement navigation
        alert('Please add the shots to the Award Sheet first, then retry the allocation.');
        return;
      } else {
        // User chose to skip - don't create allocations for invalid shots
        if (validatedShots.length === 0) {
          return; // All shots were invalid and user chose to skip
        }
      }
    }

    // Create new allocations in parallel (only for validated shots)
    const isWeekendDate = isWeekend(date);
    const isWorkingWeekend = isWeekendDate && isWorkingDay(date);
    
    const createPromises = validatedShots.map(({ shotName, showName, manDays }) =>
      fetch('/api/resource/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: member.id,
          showName,
          shotName,
          allocationDate: date.toISOString(),
          manDays,
          isLeave: false,
          isIdle: false,
          isWeekendWorking: isWorkingWeekend,
        }),
      }).then(r => r.ok ? r.json() : null)
    );

    const createdAllocs = (await Promise.all(createPromises)).filter(Boolean) as ResourceAllocation[];

    // React Query will refetch and update cache automatically
    triggerRefresh();
            
  };

  const handleBulkPaste = async () => {
    if (!contextMenu || !bulkInputValue.trim()) return;
    
    saveToHistory();
    
    const savePromises = contextMenu.cells.map((cellKey: string) => {
      const [memberId, dateIndexStr] = cellKey.split('-');
      const dateIndex = parseInt(dateIndexStr);
      const member = members.find((m: any) => m.id === memberId);
      
      if (member) {
        return saveCellValue(member, dateIndex, bulkInputValue.trim());
      }
      return Promise.resolve();
    });
    
    await Promise.all(savePromises);
    
    // Trigger dashboard refresh
    triggerRefresh();
    
    // Broadcast change to other views
    const bc = new BroadcastChannel('resource-updates');
    bc.postMessage({ type: 'allocation-updated' });
    bc.close();
    
    setContextMenu(null);
    setBulkInputValue('');
    setSelectedCells(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedCells.size === 0) return;
    
    saveToHistory();
    
    const deletePromises = Array.from(selectedCells).map((cellKey: string) => {
      const [memberId, dateIndexStr] = cellKey.split('-');
      const dateIndex = parseInt(dateIndexStr);
      const member = members.find((m: any) => m.id === memberId);
      
      if (member) {
        return saveCellValue(member, dateIndex, '');
      }
      return Promise.resolve();
    });
    
    await Promise.all(deletePromises);
    
    // Trigger dashboard refresh
    triggerRefresh();
    
    // Broadcast change to other views
    const bc = new BroadcastChannel('resource-updates');
    bc.postMessage({ type: 'allocation-updated' });
    bc.close();
    
    setSelectedCells(new Set());
  };

  const handleEditKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, member: ResourceWithAllocations, dateIndex: number) => {
    if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      saveCellValue(member, dateIndex, editValue);
      triggerRefresh();

      const memberIndex = members.findIndex((m: any) => m.id === member.id);
      let nextMemberIndex = memberIndex;
      let nextDateIndex = dateIndex;

      switch (e.key) {
        case 'Enter':
          nextMemberIndex = e.shiftKey ? Math.max(0, memberIndex - 1) : Math.min(members.length - 1, memberIndex + 1);
          break;
        case 'Tab':
          nextDateIndex = e.shiftKey ? Math.max(0, dateIndex - 1) : Math.min(dates.length - 1, dateIndex + 1);
          break;
        case 'ArrowUp':
          nextMemberIndex = Math.max(0, memberIndex - 1);
          break;
        case 'ArrowDown':
          nextMemberIndex = Math.min(members.length - 1, memberIndex + 1);
          break;
        case 'ArrowLeft':
          nextDateIndex = Math.max(0, dateIndex - 1);
          break;
        case 'ArrowRight':
          nextDateIndex = Math.min(dates.length - 1, dateIndex + 1);
          break;
      }

      const nextMember = members[nextMemberIndex];
      const nextDate = dates[nextDateIndex];
      const dailyAlloc = getDailyAllocation(nextMember, nextDate);
      const currentValue = formatAllocationsToString(dailyAlloc.allocations);

      requestAnimationFrame(() => {
        setEditingCell({ memberId: nextMember.id, dateIndex: nextDateIndex });
        setEditValue(currentValue);
      });
    }
  };

  const departments = useMemo(() => {
    const depts = new Set(members.map((m: any) => m.department));
    return ['all', ...Array.from(depts).sort()] as string[];
  }, [members]);

  const navigateDates = (days: number) => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + days);
    setStartDate(newDate);
  };

  // Advanced filtered members with multiple criteria
  const filteredMembers = useMemo(() => {
    return members.filter((member: any) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
          member.empName.toLowerCase().includes(query) ||
          member.empId.toLowerCase().includes(query) ||
          member.allocations.some((a: any) => a.shotName.toLowerCase().includes(query))
        );
        if (!matchesSearch) return false;
      }

      // Show filter
      if (selectedShow !== 'all') {
        const hasShow = member.allocations.some((a: any) => a.showName === selectedShow);
        if (!hasShow) return false;
      }

      // Utilization filter
      if (utilizationFilter !== 'all') {
        const totalAllocated = dates.reduce((sum: number, date: Date) => {
          const daily = getDailyAllocation(member, date);
          return sum + daily.totalMD;
        }, 0);
        const avgUtilization = totalAllocated / dates.length;

        if (utilizationFilter === 'overallocated' && avgUtilization <= 1.0) return false;
        if (utilizationFilter === 'available' && avgUtilization > 0) return false;
        if (utilizationFilter === 'partial' && (avgUtilization === 0 || avgUtilization >= 1.0)) return false;
      }

      return true;
    });
  }, [members, searchQuery, selectedShow, utilizationFilter, dates]);

  // Get unique shows from allocations
  const availableShows = useMemo(() => {
    const shows = new Set<string>();
    members.forEach((member: any) => {
      member.allocations.forEach((alloc: any) => {
        if (alloc.showName && alloc.showName !== 'Default') {
          shows.add(alloc.showName);
        }
      });
    });
    return Array.from(shows).sort();
  }, [members]);

  return (
    <div className="h-full flex flex-col bg-gray-900" onClick={() => setContextMenu(null)}>
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[100] py-2 min-w-[250px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700 font-medium">
            {contextMenu.cells.length} cell{contextMenu.cells.length > 1 ? 's' : ''} selected
          </div>
          <div className="p-3">
            <input
              type="text"
              placeholder="Enter shots (e.g., Shot1/Shot2)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={bulkInputValue}
              onChange={(e) => setBulkInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBulkPaste();
                else if (e.key === 'Escape') {
                  setContextMenu(null);
                  setBulkInputValue('');
                }
              }}
              autoFocus
            />
          </div>
          <button
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
            onClick={handleBulkPaste}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Apply to Selected Cells
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
            onClick={() => {
              handleDeleteSelected();
              setContextMenu(null);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Clear Selected Cells
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
            onClick={() => {
              handleMarkLeave();
              setContextMenu(null);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Mark as Leave
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Resource Forecast</h1>
            {selectedCells.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{selectedCells.size} cells selected</span>
                <button onClick={handleCopy} className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600" title="Copy (Ctrl+C)">Copy</button>
                <button onClick={handlePaste} disabled={copiedCells.size === 0} className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50" title="Paste (Ctrl+V)">Paste</button>
                <button onClick={handleMarkLeave} className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700" title="Mark Leave">Leave</button>
                <button onClick={handleDeleteSelected} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700" title="Delete">Delete</button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleUndo} disabled={historyIndex <= 0} className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50" title="Undo (Ctrl+Z)">↶ Undo</button>
            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50" title="Redo (Ctrl+Y)">↷ Redo</button>
            <button onClick={exportToExcel} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">📊 Export CSV</button>
            <button onClick={() => { setImportType('members'); setShowImportModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Import Members</button>
            <button onClick={() => { setImportType('allocations'); setShowImportModal(true); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Import Allocations</button>
            <button onClick={() => setShowAddMemberModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Add Member</button>
            
            {/* Bulk Operations Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                Bulk Operations ▾
              </button>
              <div className="absolute right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => setBulkMode('reassign')}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors rounded-t-lg"
                >
                  🔄 Bulk Reassign Allocations
                </button>
                <button
                  onClick={() => setBulkMode('copy')}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors rounded-b-lg"
                >
                  📋 Copy Week Pattern
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Filter Views */}
        {savedViews.filter(v => v.isQuickFilter).length > 0 && (
          <div className="flex gap-2 items-center mb-3 pb-3 border-b border-gray-700">
            <span className="text-xs text-gray-400 font-semibold">QUICK FILTERS:</span>
            {savedViews.filter(v => v.isQuickFilter).map(view => (
              <button
                key={view.id}
                onClick={() => applyView(view)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeViewId === view.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {view.name}
              </button>
            ))}
          </div>
        )}

        {/* Saved Views Dropdown */}
        {savedViews.length > 0 && (
          <div className="flex gap-2 items-center mb-3">
            <span className="text-xs text-gray-400 font-semibold">SAVED VIEWS:</span>
            <select 
              value={activeViewId || ''} 
              onChange={(e) => {
                const view = savedViews.find((v: any) => v.id === e.target.value);
                if (view) applyView(view);
              }}
              className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs"
            >
              <option value="">Select a view...</option>
              {savedViews.map((view: any) => (
                <option key={view.id} value={view.id}>
                  {view.name} {view.isPublic ? '(Shared)' : '(Private)'}
                </option>
              ))}
            </select>
            {activeViewId && (
              <button
                onClick={() => deleteSavedView(activeViewId)}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                title="Delete this view"
              >
                🗑️
              </button>
            )}
          </div>
        )}

        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            placeholder="🔍 Search employee or shot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[250px]"
          />
          
          <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {departments.map((dept: string) => <option key={dept} value={dept}>{dept === 'all' ? 'All Departments' : dept}</option>)}
          </select>
          
          <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Shifts</option>
            <option value="Day">Day</option>
            <option value="Night">Night</option>
            <option value="General">General</option>
          </select>

          <select value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Shows</option>
            {availableShows.map((show: string) => <option key={show} value={show}>{show}</option>)}
          </select>

          <select value={utilizationFilter} onChange={(e) => setUtilizationFilter(e.target.value as any)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Utilization</option>
            <option value="overallocated">⚠️ Overallocated (&gt;1 MD/day)</option>
            <option value="available">✅ Available (0 MD)</option>
            <option value="partial">🟡 Partial (&lt;1 MD/day)</option>
          </select>

          <button 
            onClick={() => setShowSaveViewModal(true)}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            title="Save current filter as view"
          >
            💾 Save View
          </button>

          {activeViewId && (
            <button 
              onClick={() => { setActiveViewId(null); setSelectedDepartment('all'); setSelectedShift('all'); setSelectedShow('all'); setUtilizationFilter('all'); setSearchQuery(''); }}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              ✕ Clear View
            </button>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => navigateDates(-7)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-white text-sm transition-colors">&lt; Week</button>
            <button onClick={() => setStartDate(new Date())} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-white text-sm transition-colors">Today</button>
            <button onClick={() => navigateDates(7)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-white text-sm transition-colors">Week &gt;</button>
          </div>

          <select value={dateRange} onChange={(e) => setDateRange(Number(e.target.value))} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
          </select>

          <div className="ml-auto text-xs text-gray-400">
            <span className="font-medium">Tips:</span> Click+Drag to select | Right-click bulk edit | Delete to clear | Ctrl+C/V copy/paste | Ctrl+Z/Y undo/redo | Dbl-click weekend to toggle | Search filters
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-800 sticky top-0 z-30">
            <tr className="h-10">
              <th className="sticky left-0 z-40 bg-gray-800 px-2 py-2 text-left text-xs font-semibold text-gray-300 uppercase border-r border-gray-700" style={{width: '80px', minWidth: '80px'}}>ID</th>
              <th className="sticky z-40 bg-gray-800 px-2 py-2 text-left text-xs font-semibold text-gray-300 uppercase border-r border-gray-700" style={{left: '80px', width: '160px', minWidth: '160px'}}>Name</th>
              <th className="sticky z-40 bg-gray-800 px-2 py-2 text-left text-xs font-semibold text-gray-300 uppercase border-r border-gray-700" style={{left: '240px', width: '120px', minWidth: '120px'}}>Designation</th>
              <th className="sticky z-40 bg-gray-800 px-2 py-2 text-left text-xs font-semibold text-gray-300 uppercase border-r border-gray-700" style={{left: '360px', width: '120px', minWidth: '120px'}}>Reporting</th>
              <th className="sticky z-40 bg-gray-800 px-2 py-2 text-left text-xs font-semibold text-gray-300 uppercase border-r border-gray-700" style={{left: '480px', width: '100px', minWidth: '100px'}}>Dept</th>
              <th className="sticky z-40 bg-gray-800 px-2 py-2 text-left text-xs font-semibold text-gray-300 uppercase border-r-2 border-gray-600 shadow-[2px_0_5px_rgba(0,0,0,0.3)]" style={{left: '580px', width: '80px', minWidth: '80px'}}>Shift</th>
              {dates.map((date: Date) => {
                const weekend = isWeekend(date);
                const working = isWorkingDay(date);
                const dateKey = date.toISOString().split('T')[0];
                return (
                  <th 
                    key={date.toISOString()} 
                    className={`px-2 py-2 text-center text-xs font-semibold border-r border-gray-700 min-w-[100px] cursor-pointer select-none transition-colors ${
                      weekend ? (working ? 'bg-blue-800/50 text-blue-200' : 'bg-red-900/50 text-red-300') : 'bg-gray-800 text-gray-300'
                    } hover:brightness-110`}
                    onDoubleClick={() => weekend && toggleWeekendWorking(date)}
                    title={weekend ? (working ? 'Weekend - Working (Double-click to disable)' : 'Weekend - Off (Double-click to enable)') : 'Weekday'}
                  >
                    <div>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="text-[10px] opacity-75">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    {weekend && (
                      <div className="text-[9px] font-bold mt-0.5">
                        {working ? '✓ WORKING' : '✗ OFF'}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-gray-900">
            {loading ? (
              <tr><td colSpan={6 + dates.length} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={6 + dates.length} className="px-4 py-8 text-center text-gray-500">No members found</td></tr>
            ) : (
              <>
                {filteredMembers.map((member: any) => (
                <tr key={member.id} className="hover:bg-gray-800/50 h-10 border-b border-gray-800 transition-colors group">
                  <td className="sticky left-0 z-20 bg-gray-900 px-2 py-2 text-xs border-r border-gray-700 font-medium text-gray-300 truncate" style={{width: '80px', minWidth: '80px'}}>{member.empId}</td>
                  <td className="sticky z-20 bg-gray-900 px-2 py-2 text-xs border-r border-gray-700 text-gray-300 truncate" style={{left: '80px', width: '160px', minWidth: '160px'}}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{member.empName}</span>
                      <button
                        onClick={() => setEditingMember(member)}
                        className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity flex-shrink-0"
                        title="Edit member"
                      >
                        ✏️
                      </button>
                    </div>
                  </td>
                  <td className="sticky z-20 bg-gray-900 px-2 py-2 text-xs border-r border-gray-700 text-gray-400 truncate" style={{left: '240px', width: '120px', minWidth: '120px'}}>{member.designation}</td>
                  <td className="sticky z-20 bg-gray-900 px-2 py-2 text-xs border-r border-gray-700 text-gray-400 truncate" style={{left: '360px', width: '120px', minWidth: '120px'}}>{member.reportingTo || '-'}</td>
                  <td className="sticky z-20 bg-gray-900 px-2 py-2 text-xs border-r border-gray-700 text-gray-400 truncate" style={{left: '480px', width: '100px', minWidth: '100px'}}>{member.department}</td>
                  <td className="sticky z-20 bg-gray-900 px-2 py-2 text-xs border-r-2 border-gray-600 text-gray-400 truncate shadow-[2px_0_5px_rgba(0,0,0,0.3)]" style={{left: '580px', width: '80px', minWidth: '80px'}}>{member.shift}</td>
                  {dates.map((date, dateIndex) => {
                    const dailyAlloc = getDailyAllocation(member, date);
                    const isEditing = editingCell?.memberId === member.id && editingCell?.dateIndex === dateIndex;
                    const isSelected = selectedCells.has(getCellKey(member.id, dateIndex));
                    const weekend = isWeekend(date);
                    const working = isWorkingDay(date);
                    const disabled = weekend && !working;
                    const isLeave = dailyAlloc.allocations.some((a: any) => a.isLeave);
                    const hasData = dailyAlloc.totalMD > 0;
                    
                    let bgColor = 'bg-green-900/20'; // Default: Available (light green)
                    if (isSelected) bgColor = 'bg-blue-600/40';
                    else if (disabled) bgColor = 'bg-red-950/30';
                    else if (isLeave) bgColor = 'bg-red-900/40'; // Leave: red
                    else if (weekend && working) bgColor = 'bg-blue-950/30';
                    else if (hasData && dailyAlloc.status === 'full') bgColor = 'bg-orange-900/40';
                    else if (hasData && dailyAlloc.status === 'partial') bgColor = 'bg-yellow-900/40';
                    
                    const displayText = formatAllocationsToString(dailyAlloc.allocations);
                    
                    return (
                      <td 
                        key={date.toISOString()} 
                        className={`px-1 py-1 text-center text-xs border-r border-gray-700 select-none transition-all relative ${bgColor} ${
                          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:ring-2 hover:ring-blue-400'
                        } ${isSelected ? 'ring-1 ring-blue-500' : ''}`}
                        onMouseDown={(e) => !disabled && handleCellMouseDown(member, dateIndex, e)}
                        onMouseEnter={() => !disabled && handleCellMouseEnter(member, dateIndex)}
                        onClick={() => !disabled && !isEditing && handleCellClick(member, dateIndex)}
                        onContextMenu={(e) => !disabled && handleContextMenu(e)}
                        title={disabled ? 'Weekend - Not working' : isLeave ? 'On Leave' : !hasData ? 'Available' : ''}
                      >
                        {disabled ? (
                          <div className="text-[10px] text-red-400/60">OFF</div>
                        ) : isEditing ? (
                          <input 
                            type="text" 
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)} 
                            onKeyDown={(e) => handleEditKeyDown(e, member, dateIndex)} 
                            placeholder="Shot1/Shot2" 
                            className="w-full px-1 py-1 text-xs bg-gray-800 border-2 border-blue-500 rounded text-white focus:outline-none" 
                            autoFocus 
                            onFocus={(e) => e.target.select()} 
                          />
                        ) : isLeave ? (
                          <div className="text-base font-bold text-red-400">A</div>
                        ) : !hasData ? (
                          <div className="text-[10px] text-green-400/60 font-medium">Available</div>
                        ) : (
                          <div className="text-xs leading-tight">
                            <div className="font-medium truncate text-gray-200">{displayText}</div>
                            <div className="text-[10px] text-gray-500">({dailyAlloc.totalMD.toFixed(2)} MD)</div>
                          </div>
                        )}
                        
                        {/* Drag-to-fill handle (Excel-style) */}
                        {isSelected && !disabled && !isEditing && hasData && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair hover:bg-blue-400 border border-white"
                            style={{ transform: 'translate(25%, 25%)' }}
                            onMouseDown={(e) => handleFillHandleMouseDown(member, dateIndex, e)}
                            title="Drag to fill"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {/* Utilization Totals Row */}
              <tr className="bg-gray-800 font-bold border-t-2 border-gray-600 sticky bottom-0 z-10">
                <td colSpan={6} className="sticky left-0 z-20 bg-gray-800 px-2 py-3 text-xs text-yellow-400 uppercase border-r-2 border-gray-600 shadow-[2px_0_5px_rgba(0,0,0,0.3)]" style={{left: '0px', width: '660px'}}>
                  TOTAL UTILIZATION
                </td>
                {dates.map((date, idx) => {
                  const total = members.reduce((sum, m) => {
                    const alloc = getDailyAllocation(m, date);
                    return sum + alloc.totalMD;
                  }, 0);
                  const weekend = isWeekend(date);
                  const working = isWorkingDay(date);
                  return (
                    <td 
                      key={idx} 
                      className={`px-2 py-3 text-center text-xs border-r border-gray-700 ${
                        weekend ? (working ? 'bg-blue-800/30' : 'bg-red-900/30') : 'bg-gray-800'
                      }`}
                    >
                      <span className="text-yellow-400">{total.toFixed(2)} MD</span>
                    </td>
                  );
                })}
              </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Legend */}
      <div className="flex-none bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center gap-6 text-sm text-gray-300 flex-wrap">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-900/20 border border-gray-700 rounded"></div><span>Available (Light Green)</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-900/40 border border-gray-700 rounded"></div><span>Leave (Red with 'A')</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-900/40 border border-gray-700 rounded"></div><span>Partial (&lt;1.0 MD)</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-900/40 border border-gray-700 rounded"></div><span>Full (1.0 MD)</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-950/30 border border-gray-700 rounded"></div><span>Weekend (Working)</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-950/30 border border-gray-700 rounded"></div><span>Weekend (Off)</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-600/40 border border-blue-500 rounded"></div><span>Selected</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 border border-white rounded-sm"></div><span>Drag-to-Fill (Excel-style)</span></div>
        </div>
      </div>

      {showAddMemberModal && <ResourceMemberForm isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} onSuccess={() => setShowAddMemberModal(false)} />}
      {editingMember && <ResourceMemberForm isOpen={true} onClose={() => setEditingMember(null)} onSuccess={() => setEditingMember(null)} member={editingMember} />}
      {showImportModal && <ResourceImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onSuccess={() => setShowImportModal(false)} type={importType} />}
      
      {/* Save View Modal */}
      {showSaveViewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 w-[500px]">
            <h2 className="text-xl font-bold text-white mb-4">Save Current View</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name') as string;
              const isPublic = formData.get('isPublic') === 'on';
              const isQuickFilter = formData.get('isQuickFilter') === 'on';
              
              if (!name.trim()) {
                alert('Please enter a name for this view');
                return;
              }
              
              await saveCurrentView(name, isPublic, isQuickFilter);
              setShowSaveViewModal(false);
            }}>
              
              {/* Current Filter Summary */}
              <div className="mb-4 p-3 bg-gray-900/50 rounded border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Current Filters:</p>
                <div className="text-sm text-white space-y-1">
                  {selectedDepartment !== 'all' && <div>• Department: {selectedDepartment}</div>}
                  {selectedShift !== 'all' && <div>• Shift: {selectedShift}</div>}
                  {selectedShow !== 'all' && <div>• Show: {selectedShow}</div>}
                  {utilizationFilter !== 'all' && <div>• Utilization: {utilizationFilter}</div>}
                  {searchQuery && <div>• Search: "{searchQuery}"</div>}
                  {(!selectedDepartment || selectedDepartment === 'all') && (!selectedShift || selectedShift === 'all') && 
                   (!selectedShow || selectedShow === 'all') && (!utilizationFilter || utilizationFilter === 'all') && !searchQuery && (
                    <div className="text-gray-500">No filters applied</div>
                  )}
                </div>
              </div>
              
              {/* View Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  View Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g., My Team, Overallocated Artists, Compositing Dept"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
              
              {/* Options */}
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" name="isPublic" className="w-4 h-4 rounded bg-gray-900 border-gray-700" />
                  <span>Make this view public (visible to all users)</span>
                </label>
                
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" name="isQuickFilter" className="w-4 h-4 rounded bg-gray-900 border-gray-700" />
                  <span>Add to Quick Filters bar (for frequent use)</span>
                </label>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSaveViewModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                >
                  Save View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Bulk Reassign Modal */}
      {bulkMode === 'reassign' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 w-[600px]">
            <h2 className="text-xl font-bold text-white mb-4">Bulk Reassign Allocations</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const fromMemberId = formData.get('fromMember') as string;
              const toMemberId = formData.get('toMember') as string;
              const dateRange = formData.get('dateRange') as string;
              
              if (!fromMemberId || !toMemberId) {
                alert('Please select both source and target artists');
                return;
              }
              
              if (fromMemberId === toMemberId) {
                alert('Source and target must be different artists');
                return;
              }
              
              // Parse date range or use all dates
              let dateIndices: number[] = [];
              if (dateRange === 'all') {
                dateIndices = dates.map((_, idx) => idx);
              } else if (dateRange === 'current-week') {
                // Get current week's indices (7 days from today)
                const today = new Date();
                dateIndices = dates.map((d, idx) => ({ date: d, idx }))
                  .filter(({ date }) => {
                    const diff = Math.abs(date.getTime() - today.getTime());
                    return diff < 7 * 24 * 60 * 60 * 1000;
                  })
                  .map(({ idx }) => idx);
              }
              
              if (dateIndices.length === 0) {
                alert('No dates selected for reassignment');
                return;
              }
              
              if (confirm(`Reassign ${dateIndices.length} days of allocations from one artist to another?`)) {
                await handleBulkReassign(fromMemberId, toMemberId, dateIndices);
                setBulkMode(null);
              }
            }}>
              
              <div className="space-y-4 mb-6">
                {/* From Artist */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Move allocations FROM <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="fromMember"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select source artist...</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.empName} ({m.empId}) - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* To Artist */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Move allocations TO <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="toMember"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select target artist...</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.empName} ({m.empId}) - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date Range <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="dateRange"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
                    defaultValue="all"
                  >
                    <option value="all">All visible dates ({dates.length} days)</option>
                    <option value="current-week">Current week (7 days)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    All allocations in this range will be moved from source to target artist
                  </p>
                </div>
              </div>
              
              {/* Warning */}
              <div className="mb-6 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded">
                <p className="text-sm text-yellow-400">
                  ⚠️ This will delete allocations from the source artist and create them for the target artist. This action cannot be undone (except via manual undo).
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setBulkMode(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition"
                >
                  Reassign Allocations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Bulk Copy Week Modal */}
      {bulkMode === 'copy' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 w-[600px]">
            <h2 className="text-xl font-bold text-white mb-4">Bulk Copy Week Pattern</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const sourceMemberId = formData.get('sourceMember') as string;
              const sourceWeekStart = formData.get('sourceWeekStart') as string;
              const targetWeekStart = formData.get('targetWeekStart') as string;
              
              if (!sourceMemberId || !sourceWeekStart || !targetWeekStart) {
                alert('Please fill in all fields');
                return;
              }
              
              if (sourceWeekStart === targetWeekStart) {
                alert('Source and target weeks must be different');
                return;
              }
              
              if (confirm('Copy 7-day allocation pattern from source week to target week?')) {
                await handleBulkCopyWeek(sourceMemberId, new Date(sourceWeekStart), new Date(targetWeekStart));
                setBulkMode(null);
              }
            }}>
              
              <div className="space-y-4 mb-6">
                {/* Artist Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Artist <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="sourceMember"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select artist...</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.empName} ({m.empId}) - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Source Week */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Copy FROM week starting <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="sourceWeekStart"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Will copy 7 days starting from this date
                  </p>
                </div>
                
                {/* Target Week */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Copy TO week starting <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="targetWeekStart"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Allocations will be created for 7 days starting from this date
                  </p>
                </div>
              </div>
              
              {/* Info */}
              <div className="mb-6 p-3 bg-blue-900/20 border border-blue-700/50 rounded">
                <p className="text-sm text-blue-400">
                  ℹ️ This will duplicate the allocation pattern from the source week to the target week for the selected artist. Existing allocations in the target week will be preserved.
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setBulkMode(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                >
                  Copy Week Pattern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

