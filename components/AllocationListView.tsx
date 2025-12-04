'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Download, Upload, ListTodo, Search, Calendar } from 'lucide-react';
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

  // Calculate totals
  const totalMD = filteredAllocations.reduce((sum, a) => sum + a.totalManDays, 0);
  const uniqueArtists = new Set(filteredAllocations.map(a => a.member.empId)).size;
  const uniqueShows = new Set(filteredAllocations.map(a => a.showName)).size;

  // Export filtered allocations to CSV
  const handleExport = () => {
    try {
      const csvRows = ['Action,Emp ID,Artist Name,Designation,Department,Shift,Show,Shot,Start Date,End Date,Days,Total MD'];
      
      filteredAllocations.forEach(alloc => {
        const daysDiff = Math.ceil((alloc.endDate.getTime() - alloc.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        csvRows.push([
          'UPDATE',
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
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-[#111111] border-b border-[#1a1a1a] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 flex items-center justify-center">
              <ListTodo className="text-cyan-500" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Resource Allocations</h2>
              <p className="text-xs text-gray-500">Manage artist assignments across shows and shots</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 flex items-center gap-2 transition-colors"
            >
              <Download size={16} />
              Export CSV
            </button>

            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 flex items-center gap-2 transition-colors"
            >
              <Upload size={16} />
              Import CSV
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Allocations</div>
            <div className="text-xl font-bold text-white mt-1">{filteredAllocations.length}</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Total MD</div>
            <div className="text-xl font-bold text-cyan-400 mt-1">{totalMD.toFixed(1)}</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Artists</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{uniqueArtists}</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Shows</div>
            <div className="text-xl font-bold text-amber-400 mt-1">{uniqueShows}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artist, shot, show..."
              className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-[#252525] text-white text-sm placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
            />
          </div>

          <select 
            value={selectedDepartment} 
            onChange={(e) => setSelectedDepartment(e.target.value)} 
            className="px-3 py-2 bg-[#0a0a0a] border border-[#252525] text-white text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>

          <select 
            value={selectedShift} 
            onChange={(e) => setSelectedShift(e.target.value)} 
            className="px-3 py-2 bg-[#0a0a0a] border border-[#252525] text-white text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Shifts</option>
            {shifts.map(shift => <option key={shift} value={shift}>{shift}</option>)}
          </select>

          <select 
            value={selectedShow} 
            onChange={(e) => setSelectedShow(e.target.value)} 
            className="px-3 py-2 bg-[#0a0a0a] border border-[#252525] text-white text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Shows</option>
            {shows.map(show => <option key={show} value={show}>{show}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-500" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#252525] text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#252525] text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full">
          <thead className="bg-[#111111] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Emp ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Artist</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Designation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Shift</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Show</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Shot</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Start</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">End</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-[#1a1a1a]">Days</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-[#1a1a1a]">MD</th>
            </tr>
          </thead>
          <tbody className="bg-[#0a0a0a]">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent animate-spin"></div>
                    <span className="text-gray-400 text-sm">Loading allocations...</span>
                  </div>
                </td>
              </tr>
            ) : filteredAllocations.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                  No allocations found matching your filters
                </td>
              </tr>
            ) : (
              filteredAllocations.map(alloc => {
                const daysDiff = Math.ceil((alloc.endDate.getTime() - alloc.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <tr key={alloc.id} className="border-b border-[#1a1a1a] hover:bg-[#111111] transition-colors">
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-gray-400">{alloc.member.empId}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] font-medium text-white">{alloc.member.empName}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-gray-400">{alloc.member.designation}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a]">
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs">{alloc.member.department}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-gray-400">{alloc.member.shift}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-gray-300">{alloc.showName}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] font-semibold text-white">{alloc.shotName}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-gray-400">{format(alloc.startDate, 'MMM dd')}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-gray-400">{format(alloc.endDate, 'MMM dd')}</td>
                    <td className="px-4 py-2.5 text-xs border-r border-[#1a1a1a] text-center text-gray-300">{daysDiff}</td>
                    <td className="px-4 py-2.5 text-xs text-center font-bold text-cyan-400">{alloc.totalManDays.toFixed(1)}</td>
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
          setShowImportModal(false);
        }}
        type="allocations"
      />
    </div>
  );
}
