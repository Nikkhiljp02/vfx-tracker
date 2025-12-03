'use client';

import { useState, useMemo } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
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
  dailyCapacity: { date: Date; availableMD: number }[];
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

  // No more manual loading - React Query handles everything!

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

        return { date, availableMD };
      });

      return { department: dept, artistCount, dailyCapacity };
    });
  }, [members, allocations, dates]);

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
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading capacity data...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header - Mobile Optimized */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 md:gap-3">
            <Users className="text-blue-400 flex-shrink-0" size={20} />
            <h2 className="text-lg md:text-xl font-semibold text-white">Resource Capacity</h2>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={previousWeek}
              className="flex-1 sm:flex-none p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 active:bg-gray-500 transition-colors touch-manipulation"
              title="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            
            <button
              onClick={today}
              className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium touch-manipulation"
            >
              Today
            </button>
            
            <button
              onClick={nextWeek}
              className="flex-1 sm:flex-none p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 active:bg-gray-500 transition-colors touch-manipulation"
              title="Next week"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          Showing available MDs from {format(dates[0], 'MMM dd, yyyy')} to {format(dates[dates.length - 1], 'MMM dd, yyyy')}
        </div>
      </div>

      {/* Capacity Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-800">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-800 border-b border-r border-gray-700 px-4 py-3 text-left text-sm font-semibold text-gray-300" style={{ width: '150px', minWidth: '150px' }}>
                  Department
                </th>
                <th className="sticky z-20 bg-gray-800 border-b border-r border-gray-700 px-4 py-3 text-center text-sm font-semibold text-gray-300" style={{ left: '150px', width: '120px', minWidth: '120px' }}>
                  Artist Count
                </th>
                {dates.map((date, idx) => (
                  <th
                    key={idx}
                    className="border-b border-r border-gray-700 px-3 py-3 text-center min-w-[80px]"
                  >
                    <div className="text-xs font-semibold text-gray-300">
                      {format(date, 'EEE')}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {format(date, 'MMM dd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departmentCapacities.map((deptCapacity, deptIdx) => (
                <tr
                  key={deptCapacity.department}
                  className={deptIdx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}
                >
                  {/* Department Name */}
                  <td className="sticky left-0 z-10 bg-gray-800 border-b border-r border-gray-700 px-4 py-3 font-medium text-white" style={{ width: '150px', minWidth: '150px' }}>
                    {deptCapacity.department}
                  </td>

                  {/* Artist Count */}
                  <td className="sticky z-10 bg-gray-800 border-b border-r border-gray-700 px-4 py-3 text-center" style={{ left: '150px', width: '120px', minWidth: '120px' }}>
                    <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm font-semibold">
                      {deptCapacity.artistCount}
                    </span>
                  </td>

                  {/* Daily Available MDs */}
                  {deptCapacity.dailyCapacity.map((day, dayIdx) => {
                    const isWeekend = [0, 6].includes(day.date.getDay());
                    const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    
                    // No color coding - plain neutral styling
                    const cellColor = isWeekend ? 'bg-gray-800/50' : 'bg-gray-900';
                    const textColor = 'text-gray-300';

                    return (
                      <td
                        key={dayIdx}
                        className={`border-b border-r border-gray-700 px-3 py-3 text-center ${cellColor} ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                      >
                        <div className={`text-sm font-semibold ${textColor}`}>
                          {day.availableMD.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          / {deptCapacity.artistCount}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend - Removed color coding, keeping simple info */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
        <div className="flex items-center gap-6 text-xs">
          <span className="text-gray-400 font-semibold">Info:</span>
          <span className="text-gray-400">Available MD / Total Artists per day</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800/50 border border-gray-600 rounded"></div>
            <span className="text-gray-400">Weekend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 ring-2 ring-blue-500 bg-gray-900 rounded"></div>
            <span className="text-gray-400">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
