'use client';

import { useState, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Download, Upload, Filter, RefreshCw } from 'lucide-react';
import ResourceImportModal from './ResourceImportModal';
import { useResourceMembers, useResourceAllocations } from '@/hooks/useQueryHooks';

interface AllocationWithDetails {
  id: string;
  member: {
    empId: string;
    empName: string;
    designation: string;
    department: string;
    shift: string;
  };
  shotName: string;
  showName: string;
  startDate: Date;
  endDate: Date;
  totalManDays: number;
  status: string;
}

export default function AllocationListView() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedShow, setSelectedShow] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState(false);

  // React Query - instant caching, zero refresh!
  const { data: members = [], isLoading: membersLoading } = useResourceMembers(undefined, undefined, true);
  const { data: rawAllocations = [], isLoading: allocationsLoading } = useResourceAllocations(dateFrom, dateTo);
  const loading = membersLoading || allocationsLoading;

  // Group allocations by member and shot (computed from cached data)
  const allocations = useMemo(() => {
    const groupedAllocations = new Map<string, AllocationWithDetails>();

    for (const alloc of rawAllocations) {
      if (alloc.isLeave || alloc.isIdle) continue;

      const member = members.find((m: any) => m.id === alloc.resourceId);
      if (!member) continue;

      if (selectedDepartment !== 'all' && member.department !== selectedDepartment) continue;

      const key = `${alloc.resourceId}-${alloc.shotName}`;
      const allocDate = new Date(alloc.allocationDate);

      if (groupedAllocations.has(key)) {
        const existing = groupedAllocations.get(key)!;
        existing.startDate = new Date(Math.min(existing.startDate.getTime(), allocDate.getTime()));
        existing.endDate = new Date(Math.max(existing.endDate.getTime(), allocDate.getTime()));
        existing.totalManDays += alloc.manDays;
      } else {
        groupedAllocations.set(key, {
          id: key,
          member: {
            empId: member.empId,
            empName: member.empName,
            designation: member.designation,
            department: member.department,
            shift: member.shift,
          },
          shotName: alloc.shotName,
          showName: alloc.showName,
          startDate: allocDate,
          endDate: allocDate,
          totalManDays: alloc.manDays,
          status: alloc.isLeave ? 'Leave' : alloc.isIdle ? 'Idle' : 'Active',
        });
      }
    }

    return Array.from(groupedAllocations.values()).sort((a, b) => {
      if (a.member.empName !== b.member.empName) return a.member.empName.localeCompare(b.member.empName);
      return a.startDate.getTime() - b.startDate.getTime();
    });
  }, [members, rawAllocations, selectedDepartment]);

  // No more manual loading - React Query handles everything!

  const filteredAllocations = allocations.filter(alloc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      alloc.member.empName.toLowerCase().includes(query) ||
      alloc.member.empId.toLowerCase().includes(query) ||
      alloc.shotName.toLowerCase().includes(query) ||
      alloc.showName.toLowerCase().includes(query)
    );
  }).filter(alloc => {
    if (selectedShift !== 'all' && alloc.member.shift !== selectedShift) return false;
    if (selectedShow !== 'all' && alloc.showName !== selectedShow) return false;
    return true;
  });

  const departments = Array.from(new Set(allocations.map(a => a.member.department))).sort();
  const shifts = Array.from(new Set(allocations.map(a => a.member.shift))).sort();
  const shows = Array.from(new Set(allocations.map(a => a.showName))).sort();

  // Export filtered allocations to CSV (grouped format matching table view)
  const handleExport = () => {
    try {
      // Use the same filtered allocations as displayed in the table
      const csvRows = ['Action,Emp ID,Artist Name,Designation,Department,Shift,Show,Shot,Start Date,End Date,Days,Total MD'];
      
      filteredAllocations.forEach(alloc => {
        const daysDiff = Math.ceil((alloc.endDate.getTime() - alloc.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        csvRows.push([
          'UPDATE', // Default to UPDATE for existing allocations
          alloc.member.empId,
          alloc.member.empName,
          alloc.member.designation,
          alloc.member.department,
          alloc.member.shift,
          alloc.showName,
          alloc.shotName,
          format(alloc.startDate, 'yyyy-MM-dd'),
          format(alloc.endDate, 'yyyy-MM-dd'),
          daysDiff,
          alloc.totalManDays.toFixed(2)
        ].map(v => `"${v}"`).join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `allocations_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export allocations');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Resource Allocations</h1>
          
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              title="Export filtered allocations to CSV"
            >
              <Download size={18} />
              Export CSV
            </button>

            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              title="Import allocations with conflict resolution"
            >
              <Upload size={18} />
              Import CSV
            </button>

            <button 
              onClick={loadAllocations}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, emp ID, or shot..."
            className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg w-64 placeholder-gray-400"
          />

          <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg">
            <option value="all">All Departments</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>

          <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg">
            <option value="all">All Shifts</option>
            {shifts.map(shift => <option key={shift} value={shift}>{shift}</option>)}
          </select>

          <select value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)} className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg">
            <option value="all">All Shows</option>
            {shows.map(show => <option key={show} value={show}>{show}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg"
            />
          </div>

          <div className="ml-auto text-sm text-gray-400">
            Total: {filteredAllocations.length} allocations
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800 sticky top-0 z-10">
            <tr className="h-10">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Emp ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Artist Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Designation</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Department</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Shift</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Show</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Shot</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Start Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">End Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase border-r border-gray-700">Days</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Total MD</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-700">
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : filteredAllocations.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No allocations found</td></tr>
            ) : (
              filteredAllocations.map(alloc => {
                const daysDiff = Math.ceil((alloc.endDate.getTime() - alloc.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <tr key={alloc.id} className="hover:bg-gray-800 h-10">
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{alloc.member.empId}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 font-medium text-white">{alloc.member.empName}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{alloc.member.designation}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{alloc.member.department}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{alloc.member.shift}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{alloc.showName}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 font-semibold text-white">{alloc.shotName}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{format(alloc.startDate, 'MMM dd, yyyy')}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-gray-300">{format(alloc.endDate, 'MMM dd, yyyy')}</td>
                    <td className="px-4 py-2 text-xs border-r border-gray-700 text-center text-gray-300">{daysDiff}</td>
                    <td className="px-4 py-2 text-xs text-center font-semibold text-white">{alloc.totalManDays.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      <ResourceImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          loadAllocations();
          // Trigger refresh in ResourceForecastView via broadcast
          const bc = new BroadcastChannel('resource-updates');
          bc.postMessage({ type: 'allocation-updated' });
          bc.close();
        }}
        type="allocations"
      />
    </div>
  );
}
