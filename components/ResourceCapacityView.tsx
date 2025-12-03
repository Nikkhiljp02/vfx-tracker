'use client';

import { useState, useMemo } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Users, Calendar } from 'lucide-react';
import { useResourceMembers, useResourceAllocations } from '@/hooks/useQueryHooks';

interface ResourceMember {
  id: string;
  empId: string;
  empName: string;
  designation: string;
  department: string;
  shift: string;
  isActive: boolean;
}

interface ResourceAllocation {
  id: string;
  resourceId: string;
  allocationDate: Date;
  manDays: number;
  isLeave: boolean;
  isIdle: boolean;
  isWeekendWorking?: boolean;
}

interface DepartmentCapacity {
  department: string;
  artistCount: number;
  dailyCapacity: { date: Date; availableMD: number; allocatedMD: number }[];
}

const DEPARTMENTS = ['Roto', 'Paint', 'Comp', 'MMRA'];

export default function ResourceCapacityView() {
  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfDay(new Date()));

  // Generate 14 days from start date
  const dates = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(weekStartDate, i));
  }, [weekStartDate]);

  const startDate = format(dates[0], 'yyyy-MM-dd');
  const endDate = format(dates[dates.length - 1], 'yyyy-MM-dd');

  // React Query - instant caching, zero refresh!
  const { data: members = [], isLoading: membersLoading } = useResourceMembers(undefined, undefined, true);
  const { data: rawAllocations = [], isLoading: allocationsLoading } = useResourceAllocations(startDate, endDate);
  const isLoading = membersLoading || allocationsLoading;

  // Convert dates from API
  const allocations = useMemo((): ResourceAllocation[] => 
    rawAllocations.map((a: any) => ({
      ...a,
      allocationDate: new Date(a.allocationDate)
    })),
    [rawAllocations]
  );

  // Calculate department capacity
  const departmentCapacities = useMemo((): DepartmentCapacity[] => {
    return DEPARTMENTS.map(dept => {
      // Get active members in this department
      const deptMembers = members.filter((m: ResourceMember) => m.department === dept && m.isActive);
      const artistCount = deptMembers.length;
      const memberIds = new Set(deptMembers.map((m: ResourceMember) => m.id));

      // Calculate available MD for each day
      const dailyCapacity = dates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Total capacity = number of artists (1 MD per artist per day)
        const totalCapacity = artistCount;
        
        // Get allocations for this department on this date
        const deptAllocations = allocations.filter((a: ResourceAllocation) => {
          const allocDateStr = format(a.allocationDate, 'yyyy-MM-dd');
          return allocDateStr === dateStr && memberIds.has(a.resourceId);
        });

        // Sum up allocated MDs (excluding leave and idle)
        const allocatedMD = deptAllocations.reduce((sum: number, a: ResourceAllocation) => {
          if (a.isLeave || a.isIdle) return sum;
          return sum + a.manDays;
        }, 0);

        // Available = Total Capacity - Allocated
        const availableMD = Math.max(0, totalCapacity - allocatedMD);

        return { date, availableMD, allocatedMD };
      });

      return { department: dept, artistCount, dailyCapacity };
    });
  }, [members, allocations, dates]);

  // Calculate totals
  const totalArtists = departmentCapacities.reduce((sum, d) => sum + d.artistCount, 0);
  const totalCapacity = totalArtists * 14;
  const totalAllocated = departmentCapacities.reduce((sum, d) => 
    sum + d.dailyCapacity.reduce((s, day) => s + day.allocatedMD, 0), 0
  );
  const totalAvailable = departmentCapacities.reduce((sum, d) => 
    sum + d.dailyCapacity.reduce((s, day) => s + day.availableMD, 0), 0
  );

  const previousWeek = () => {
    setWeekStartDate(prev => addDays(prev, -7));
  };

  const nextWeek = () => {
    setWeekStartDate(prev => addDays(prev, 7));
  };

  const today = () => {
    setWeekStartDate(startOfDay(new Date()));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent animate-spin"></div>
          <div className="text-gray-400 text-sm">Loading capacity data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-[#111111] border-b border-[#1a1a1a] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 flex items-center justify-center">
              <Users className="text-cyan-500" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Resource Capacity</h2>
              <p className="text-xs text-gray-500">14-day capacity overview by department</p>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={previousWeek}
              className="p-2 bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white transition-colors"
              title="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            
            <button
              onClick={today}
              className="px-4 py-2 bg-cyan-500 text-black text-sm font-medium hover:bg-cyan-400 transition-colors"
            >
              Today
            </button>
            
            <button
              onClick={nextWeek}
              className="p-2 bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-white transition-colors"
              title="Next week"
            >
              <ChevronRight size={18} />
            </button>

            <div className="ml-2 flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#252525]">
              <Calendar size={14} className="text-gray-500" />
              <span className="text-sm text-gray-300">
                {format(dates[0], 'MMM dd')} - {format(dates[dates.length - 1], 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Total Artists</div>
            <div className="text-xl font-bold text-white mt-1">{totalArtists}</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Total Capacity</div>
            <div className="text-xl font-bold text-cyan-400 mt-1">{totalCapacity.toFixed(0)} MD</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Allocated</div>
            <div className="text-xl font-bold text-amber-400 mt-1">{totalAllocated.toFixed(1)} MD</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Available</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{totalAvailable.toFixed(1)} MD</div>
          </div>
        </div>
      </div>

      {/* Capacity Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr>
                <th className="sticky left-0 z-20 bg-[#111111] border-b border-r border-[#1a1a1a] px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ width: '140px', minWidth: '140px' }}>
                  Department
                </th>
                <th className="sticky z-20 bg-[#111111] border-b border-r border-[#1a1a1a] px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ left: '140px', width: '80px', minWidth: '80px' }}>
                  Artists
                </th>
                {dates.map((date, idx) => {
                  const isWeekend = [0, 6].includes(date.getDay());
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <th
                      key={idx}
                      className={`border-b border-r border-[#1a1a1a] px-2 py-3 text-center min-w-[70px] ${isWeekend ? 'bg-[#0a0a0a]' : ''} ${isToday ? 'bg-cyan-500/10' : ''}`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-cyan-400' : 'text-gray-400'}`}>
                        {format(date, 'EEE')}
                      </div>
                      <div className={`text-xs mt-0.5 ${isToday ? 'text-cyan-300' : 'text-gray-500'}`}>
                        {format(date, 'dd')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {departmentCapacities.map((deptCapacity) => (
                <tr key={deptCapacity.department} className="hover:bg-[#111111]/50 transition-colors">
                  {/* Department Name */}
                  <td className="sticky left-0 z-10 bg-[#0a0a0a] border-b border-r border-[#1a1a1a] px-4 py-3" style={{ width: '140px', minWidth: '140px' }}>
                    <span className="font-medium text-white">{deptCapacity.department}</span>
                  </td>

                  {/* Artist Count */}
                  <td className="sticky z-10 bg-[#0a0a0a] border-b border-r border-[#1a1a1a] px-4 py-3 text-center" style={{ left: '140px', width: '80px', minWidth: '80px' }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-cyan-500/10 text-cyan-400 text-sm font-semibold">
                      {deptCapacity.artistCount}
                    </span>
                  </td>

                  {/* Daily Available MDs */}
                  {deptCapacity.dailyCapacity.map((day, dayIdx) => {
                    const isWeekend = [0, 6].includes(day.date.getDay());
                    const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const utilization = deptCapacity.artistCount > 0 
                      ? ((deptCapacity.artistCount - day.availableMD) / deptCapacity.artistCount) * 100 
                      : 0;
                    
                    // Color based on utilization
                    let textColor = 'text-emerald-400'; // Low utilization - lots available
                    if (utilization > 90) textColor = 'text-red-400';
                    else if (utilization > 70) textColor = 'text-amber-400';
                    else if (utilization > 50) textColor = 'text-cyan-400';

                    return (
                      <td
                        key={dayIdx}
                        className={`border-b border-r border-[#1a1a1a] px-2 py-3 text-center ${isWeekend ? 'bg-[#0a0a0a]' : 'bg-[#111111]/30'} ${isToday ? 'bg-cyan-500/5 ring-1 ring-inset ring-cyan-500/30' : ''}`}
                      >
                        <div className={`text-sm font-semibold ${textColor}`}>
                          {day.availableMD.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          avail
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Total Row */}
              <tr className="bg-[#111111] font-semibold">
                <td className="sticky left-0 z-10 bg-[#111111] border-b border-r border-[#1a1a1a] px-4 py-3" style={{ width: '140px', minWidth: '140px' }}>
                  <span className="text-cyan-400 uppercase text-xs tracking-wide">Total</span>
                </td>
                <td className="sticky z-10 bg-[#111111] border-b border-r border-[#1a1a1a] px-4 py-3 text-center" style={{ left: '140px', width: '80px', minWidth: '80px' }}>
                  <span className="text-white font-bold">{totalArtists}</span>
                </td>
                {dates.map((date, dayIdx) => {
                  const isWeekend = [0, 6].includes(date.getDay());
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const dayTotal = departmentCapacities.reduce((sum, d) => sum + d.dailyCapacity[dayIdx].availableMD, 0);
                  
                  return (
                    <td
                      key={dayIdx}
                      className={`border-b border-r border-[#1a1a1a] px-2 py-3 text-center ${isWeekend ? 'bg-[#0a0a0a]' : ''} ${isToday ? 'bg-cyan-500/10' : ''}`}
                    >
                      <div className="text-sm font-bold text-white">
                        {dayTotal.toFixed(1)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#111111] border-t border-[#1a1a1a] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-500 font-medium uppercase tracking-wide">Availability:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-emerald-400"></div>
            <span className="text-gray-400">High (&gt;50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-cyan-400"></div>
            <span className="text-gray-400">Medium (30-50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-amber-400"></div>
            <span className="text-gray-400">Low (10-30%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-400"></div>
            <span className="text-gray-400">Critical (&lt;10%)</span>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-3 h-3 bg-cyan-500/20 ring-1 ring-cyan-500"></div>
            <span className="text-gray-400">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
