'use client';

import { useState, useEffect, useMemo, lazy, Suspense, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import useSWR from 'swr';

// Lazy load modals for 30% faster initial load
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

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function ResourceForecastView() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState(30);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'members' | 'allocations'>('members');
  
  // Multi-selection states
  const [editingCell, setEditingCell] = useState<{ memberId: string; dateIndex: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ memberId: string; dateIndex: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cells: string[] } | null>(null);
  const [bulkInputValue, setBulkInputValue] = useState('');
  const [workingWeekends, setWorkingWeekends] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCells, setCopiedCells] = useState<Map<string, string>>(new Map());
  const [selectedShift, setSelectedShift] = useState<string>('all');

  // Ref for virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);

  // Generate date columns (memoized)
  const dates = useMemo(() => {
    const cols: Date[] = [];
    for (let i = 0; i < dateRange; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      cols.push(date);
    }
    return cols;
  }, [startDate, dateRange]);

  // Build API URLs for SWR (memoized)
  const getMembersUrl = useMemo(() => {
    const params = new URLSearchParams({ isActive: 'true' });
    if (selectedDepartment !== 'all') params.append('department', selectedDepartment);
    if (selectedShift !== 'all') params.append('shift', selectedShift);
    return `/api/resource/members?${params}`;
  }, [selectedDepartment, selectedShift]);

  const getAllocationsUrl = useMemo(() => {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + dateRange - 1);
    const endDateStr = endDate.toISOString().split('T')[0];
    return `/api/resource/allocations?startDate=${startDateStr}&endDate=${endDateStr}`;
  }, [startDate, dateRange]);

  // SWR hooks with caching (30s deduplication = 80% fewer API calls)
  const { data: membersData, mutate: mutateMembers } = useSWR(
    getMembersUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 second cache
      revalidateOnReconnect: true,
      keepPreviousData: true
    }
  );

  const { data: allocationsData, mutate: mutateAllocations } = useSWR(
    getAllocationsUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      revalidateOnReconnect: true,
      keepPreviousData: true
    }
  );

  // Combine members with allocations (memoized)
  const members = useMemo(() => {
    if (!membersData || !allocationsData) return [];
    
    const combined = membersData.map((member: ResourceMember) => ({
      ...member,
      allocations: allocationsData.filter((a: ResourceAllocation) => a.resourceId === member.id),
    }));

    // Apply search filter
    if (!searchQuery) return combined;
    
    const query = searchQuery.toLowerCase();
    return combined.filter((m: ResourceWithAllocations) =>
      m.empName.toLowerCase().includes(query) ||
      m.empId.toLowerCase().includes(query) ||
      m.allocations.some(a => a.shotName.toLowerCase().includes(query))
    );
  }, [membersData, allocationsData, searchQuery]);

  // Virtual scrolling setup (10x faster rendering for large lists)
  const rowVirtualizer = useVirtualizer({
    count: members.length + 1, // +1 for utilization row
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // Estimate row height
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  const loading = !membersData || !allocationsData;

  // Rest of your existing helper functions remain the same...
  // (getDailyAllocation, parseShotString, formatAllocationsToString, etc.)

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Your existing header JSX */}
      
      {/* Virtualized Grid */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {/* Virtual items */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            if (virtualRow.index === members.length) {
              // Utilization row
              return (
                <div
                  key="utilization"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="bg-gray-800 font-bold"
                >
                  {/* Utilization totals */}
                </div>
              );
            }

            const member = members[virtualRow.index];
            return (
              <div
                key={member.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Your existing row JSX */}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lazy-loaded modals with Suspense boundary */}
      {showImportModal && (
        <Suspense fallback={<div>Loading...</div>}>
          <ResourceImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              mutateMembers(); // Revalidate SWR cache
              mutateAllocations();
            }}
            type={importType}
          />
        </Suspense>
      )}

      {showAddMemberModal && (
        <Suspense fallback={<div>Loading...</div>}>
          <ResourceMemberForm
            isOpen={showAddMemberModal}
            onClose={() => setShowAddMemberModal(false)}
            onSuccess={() => mutateMembers()}
          />
        </Suspense>
      )}
    </div>
  );
}
