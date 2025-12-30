'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSaturday, isSunday, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useResourceMembers, useResourceAllocations } from '@/hooks/useQueryHooks';
import { Users, Calendar, Clock, Award, BarChart3, TrendingUp, Activity, Zap, Target, AlertTriangle, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Briefcase, UserCheck, UserX, BookCheck, Sliders, Minus } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ResourceDashboard() {
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [workingWeekends, setWorkingWeekends] = useState<Set<string>>(new Set());
  
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
  const endDateStr = format(weekEnd, 'yyyy-MM-dd');
  
  // React Query - instant caching
  const { data: members = [], isLoading: membersLoading } = useResourceMembers();
  const { data: allocations = [], isLoading: allocationsLoading } = useResourceAllocations(startDateStr, endDateStr);
  
  // Soft Bookings with React Query for cache sync
  const { data: softBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['softBookings'],
    queryFn: async () => {
      const res = await fetch('/api/resource/soft-bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
  
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const loading = membersLoading || allocationsLoading;

  // Delete booking and its associated allocations
  const handleDeleteBooking = async (booking: any) => {
    if (deletingBookingId) return; // Prevent double-click
    
    const confirmDelete = window.confirm(
      `Delete booking for "${booking.showName}"?\n\nThis will also remove all associated allocations from the Forecast and revert cells to "Available".`
    );
    
    if (!confirmDelete) return;
    
    setDeletingBookingId(booking.id);
    
    try {
      // 1. Fetch ALL allocations with this showName that are "Booked:" type (not just current week)
      const allocsRes = await fetch(`/api/resource/allocations?showName=${encodeURIComponent(booking.showName)}`);
      if (allocsRes.ok) {
        const allAllocations = await allocsRes.json();
        const bookedAllocs = allAllocations.filter((a: any) => a.shotName?.startsWith('Booked:'));
        
        // Delete all booked allocations
        for (const alloc of bookedAllocs) {
          await fetch(`/api/resource/allocations/${alloc.id}`, {
            method: 'DELETE',
            headers: { 'Cache-Control': 'no-cache' }
          });
        }
      }
      
      // 2. Delete ALL soft booking records with this showName
      const softBookingsRes = await fetch('/api/resource/soft-bookings');
      if (softBookingsRes.ok) {
        const allSoftBookings = await softBookingsRes.json();
        const matchingSoftBookings = allSoftBookings.filter((sb: any) => sb.showName === booking.showName);
        for (const sb of matchingSoftBookings) {
          await fetch(`/api/resource/soft-bookings/${sb.id}`, {
            method: 'DELETE',
            headers: { 'Cache-Control': 'no-cache' }
          });
        }
      }
      
      // 3. Invalidate all caches
      await queryClient.invalidateQueries({ queryKey: ['softBookings'] });
      await queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
      await queryClient.invalidateQueries({ queryKey: ['resourceForecast'] });
      
      toast.success(`Booking "${booking.showName}" deleted successfully!`);
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
    } finally {
      setDeletingBookingId(null);
    }
  };

  // Load working weekends from localStorage and allocations
  useEffect(() => {
    const weekendWorkingDates = new Set<string>();
    
    // Check allocations for weekend working flags
    allocations.forEach((alloc: any) => {
      if (alloc.isWeekendWorking) {
        const dateKey = alloc.date?.split('T')[0] || alloc.date;
        weekendWorkingDates.add(dateKey);
      }
    });
    
    // Also check localStorage for manually toggled weekends
    const storedWeekends = localStorage.getItem('workingWeekends');
    if (storedWeekends) {
      try {
        const parsedWeekends = JSON.parse(storedWeekends);
        parsedWeekends.forEach((dateKey: string) => weekendWorkingDates.add(dateKey));
      } catch (e) {
        console.error('Error parsing working weekends:', e);
      }
    }

    (async () => {
      try {
        const res = await fetch('/api/resource/weekend-working', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load weekend working');
        const data = await res.json().catch(() => ({}));
        const weekends = Array.isArray(data?.weekends) ? (data.weekends as string[]) : [];
        weekends.forEach((dateKey: string) => weekendWorkingDates.add(dateKey));
      } catch {
        // ignore
      } finally {
        setWorkingWeekends(new Set(weekendWorkingDates));
      }
    })();
  }, [allocations, currentWeekStart]);

  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  }, [currentWeekStart, weekEnd]);

  // Check if a date is a working day (including working weekends)
  const isWorkingDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!isSaturday(date) && !isSunday(date)) return true; // Weekdays are always working
    return workingWeekends.has(dateKey); // Weekends only if marked as working
  };

  // Calculate which weekend days are considered working this week
  const weekendWorkingStatus = useMemo(() => {
    let saturdayWorking = false;
    let sundayWorking = false;
    
    weekDays.forEach((day: Date) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      if (isSaturday(day) && workingWeekends.has(dateKey)) {
        saturdayWorking = true;
      }
      if (isSunday(day) && workingWeekends.has(dateKey)) {
        sundayWorking = true;
      }
    });
    
    return { saturdayWorking, sundayWorking };
  }, [weekDays, workingWeekends]);

  // Generate weekend status text
  const getWeekendStatusText = () => {
    const { saturdayWorking, sundayWorking } = weekendWorkingStatus;
    if (saturdayWorking && sundayWorking) return '(Saturday/Sunday: Considered)';
    if (saturdayWorking) return '(Saturday: Considered)';
    if (sundayWorking) return '(Sunday: Considered)';
    return null;
  };

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const activeMembers = members.filter((m: any) => m.isActive);
    
    // Count working days including working weekends
    const workingDaysCount = weekDays.filter((day: Date) => isWorkingDay(day)).length;
    const totalCapacity = activeMembers.length * workingDaysCount;

    let allocatedManDays = 0;
    let leaveDays = 0;

    allocations.forEach((alloc: any) => {
      if (alloc.isLeave) {
        leaveDays += alloc.manDays;
      } else {
        allocatedManDays += alloc.manDays;
      }
    });

    const adjustedCapacity = totalCapacity - leaveDays;
    const availableManDays = Math.max(0, adjustedCapacity - allocatedManDays);
    const occupancyRate = adjustedCapacity > 0 ? (allocatedManDays / adjustedCapacity) * 100 : 0;
    
    // Calculate over/under utilization
    const utilizationDiff = allocatedManDays - adjustedCapacity;
    const isOverUtilized = utilizationDiff > 0;

    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      inactiveMembers: members.length - activeMembers.length,
      totalCapacity,
      adjustedCapacity,
      allocatedManDays,
      availableManDays,
      leaveDays,
      occupancyRate,
      workingDays: workingDaysCount,
      utilizationDiff: Math.abs(utilizationDiff),
      isOverUtilized,
    };
  }, [members, allocations, weekDays, workingWeekends]);

  // Extract "Booked:" allocations and group by showName for display
  const bookedFromAllocations = useMemo(() => {
    const bookedAllocs = allocations.filter((a: any) => a.shotName?.startsWith('Booked:'));
    
    // Group by showName
    const groupedByShow = bookedAllocs.reduce((acc: any, alloc: any) => {
      const showName = alloc.showName;
      if (!acc[showName]) {
        // Try to find matching soft booking for manager name
        const matchingSoftBooking = softBookings.find((sb: any) => sb.showName === showName);
        acc[showName] = {
          id: `alloc-${showName}`,
          showName,
          managerName: matchingSoftBooking?.managerName || '-',
          department: matchingSoftBooking?.department || members.find((m: any) => m.id === alloc.resourceId)?.department || 'Unknown',
          manDays: 0,
          startDate: new Date(alloc.allocationDate),
          endDate: new Date(alloc.allocationDate),
          status: 'Allocated',
          splitEnabled: false,
          isFromAllocations: true,
        };
      }
      acc[showName].manDays += alloc.manDays;
      const allocDate = new Date(alloc.allocationDate);
      if (allocDate < acc[showName].startDate) acc[showName].startDate = allocDate;
      if (allocDate > acc[showName].endDate) acc[showName].endDate = allocDate;
      return acc;
    }, {});
    
    return Object.values(groupedByShow);
  }, [allocations, members, softBookings]);

  // Combine soft bookings with booked allocations for display
  const allBookings = useMemo(() => {
    // Merge allocations and soft bookings, preferring soft_booking status when available
    const bookedShowNames = new Set(bookedFromAllocations.map((b: any) => b.showName));
    
    // For shows with both allocations and soft_bookings, use soft_booking record with enriched data
    const mergedBookings = bookedFromAllocations.map((allocBooking: any) => {
      const matchingSB = softBookings.find((sb: any) => sb.showName === allocBooking.showName);
      if (matchingSB) {
        // Use soft_booking record but enrich with allocation data
        return {
          ...matchingSB,
          manDays: allocBooking.manDays, // Use actual MD from allocations
          startDate: allocBooking.startDate,
          endDate: allocBooking.endDate,
        };
      }
      // No soft_booking found - show as 'Booked' (legacy allocation-only)
      return { ...allocBooking, status: 'Booked' };
    });
    
    // Add soft bookings that don't have allocations yet
    const filteredSoftBookings = softBookings.filter((sb: any) => !bookedShowNames.has(sb.showName));
    
    return [...mergedBookings, ...filteredSoftBookings];
  }, [softBookings, bookedFromAllocations]);

  // Department statistics
  const departmentStats = useMemo(() => {
    const departments = ['Roto', 'Paint', 'Comp', 'MMRA'];
    const workingDaysCount = weekDays.filter((day: Date) => isWorkingDay(day)).length;

    return departments.map(dept => {
      const deptMembers = members.filter((m: any) => m.department === dept && m.isActive);
      const totalCapacity = deptMembers.length * workingDaysCount;

      let allocatedManDays = 0;
      let leaveDays = 0;

      deptMembers.forEach((member: any) => {
        const memberAllocs = allocations.filter((a: any) => a.resourceId === member.id);
        memberAllocs.forEach((alloc: any) => {
          if (alloc.isLeave) {
            leaveDays += alloc.manDays;
          } else {
            allocatedManDays += alloc.manDays;
          }
        });
      });

      const adjustedCapacity = totalCapacity - leaveDays;
      const availableManDays = Math.max(0, adjustedCapacity - allocatedManDays);
      const occupancyRate = adjustedCapacity > 0 ? (allocatedManDays / adjustedCapacity) * 100 : 0;
      
      // Calculate over/under utilization per department
      const utilizationDiff = allocatedManDays - adjustedCapacity;
      const isOverUtilized = utilizationDiff > 0;

      return {
        department: dept,
        memberCount: deptMembers.length,
        capacity: adjustedCapacity,
        allocated: allocatedManDays,
        available: availableManDays,
        onLeave: leaveDays,
        occupancyRate,
        utilizationDiff: Math.abs(utilizationDiff),
        isOverUtilized,
      };
    });
  }, [members, allocations, weekDays, workingWeekends]);

  // Show statistics
  const showStats = useMemo(() => {
    const showMap = new Map<string, { showName: string; totalMD: number; artists: Set<string>; shots: Set<string> }>();

    allocations.forEach((alloc: any) => {
      if (alloc.isLeave || !alloc.showName || alloc.showName === 'Default') return;

      if (!showMap.has(alloc.showName)) {
        showMap.set(alloc.showName, { showName: alloc.showName, totalMD: 0, artists: new Set(), shots: new Set() });
      }
      const show = showMap.get(alloc.showName)!;
      show.totalMD += alloc.manDays;
      show.artists.add(alloc.resourceId);
      if (alloc.shotName) show.shots.add(alloc.shotName);
    });

    return Array.from(showMap.values())
      .map(s => ({ ...s, artistCount: s.artists.size, shotCount: s.shots.size }))
      .sort((a, b) => b.totalMD - a.totalMD)
      .slice(0, 5);
  }, [allocations]);

  // Shift distribution
  const shiftStats = useMemo(() => {
    const activeMembers = members.filter((m: any) => m.isActive);
    const dayShift = activeMembers.filter((m: any) => m.shift === 'Day').length;
    const nightShift = activeMembers.filter((m: any) => m.shift === 'Night').length;
    const flexibleShift = activeMembers.filter((m: any) => m.shift === 'Flexible' || m.shift === 'General').length;

    return { day: dayShift, night: nightShift, flexible: flexibleShift };
  }, [members]);

  // Critical metrics
  const criticalMetrics = useMemo(() => {
    const workingDaysCount = weekDays.filter((day: Date) => isWorkingDay(day)).length;
    
    const overallocatedMembers = members.filter((m: any) => {
      if (!m.isActive) return false;
      const memberAllocs = allocations.filter((a: any) => a.resourceId === m.id && !a.isLeave);
      const totalAllocated = memberAllocs.reduce((sum: number, a: any) => sum + a.manDays, 0);
      return totalAllocated > workingDaysCount;
    });

    const idleMembers = members.filter((m: any) => {
      if (!m.isActive) return false;
      const memberAllocs = allocations.filter((a: any) => a.resourceId === m.id && !a.isLeave);
      return memberAllocs.length === 0;
    });

    const membersOnLeave = new Set(
      allocations.filter((a: any) => a.isLeave).map((a: any) => a.resourceId)
    ).size;

    return {
      overallocated: overallocatedMembers.length,
      idle: idleMembers.length,
      onLeave: membersOnLeave,
      fullyUtilized: Math.max(0, overallStats.activeMembers - overallocatedMembers.length - idleMembers.length - membersOnLeave),
    };
  }, [members, allocations, overallStats, weekDays, workingWeekends]);

  const handlePreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const handleCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-[#111111] border-b border-[#1a1a1a] px-4 md:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Resource Summary</h1>
            <p className="text-gray-500 text-xs md:text-sm mt-1">Workforce analytics and utilization overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePreviousWeek} className="px-3 py-2 bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#252525] transition-all text-sm font-medium border border-[#252525]">
              ← Prev
            </button>
            <button onClick={handleCurrentWeek} className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 transition-all text-sm font-semibold">
              This Week
            </button>
            <button onClick={handleNextWeek} className="px-3 py-2 bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#252525] transition-all text-sm font-medium border border-[#252525]">
              Next →
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Calendar className="text-cyan-500" size={16} />
          <span className="text-gray-300 font-medium text-sm">
            {format(currentWeekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
          </span>
          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs font-semibold border border-cyan-500/20">
            {overallStats.workingDays} Working Days
          </span>
          {getWeekendStatusText() && (
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
              {getWeekendStatusText()}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent animate-spin"></div>
              <div className="text-gray-500 text-sm">Loading analytics...</div>
            </div>
          </div>
        ) : (
          <>
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Resources */}
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-cyan-500/10 flex items-center justify-center">
                    <Users className="text-cyan-500" size={20} />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Resources</span>
                </div>
                <div className="text-3xl font-bold text-white">{overallStats.activeMembers}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">of {overallStats.totalMembers} total</span>
                  {overallStats.inactiveMembers > 0 && (
                    <span className="text-xs text-orange-400">({overallStats.inactiveMembers} inactive)</span>
                  )}
                </div>
              </div>

              {/* Week Capacity */}
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-500/10 flex items-center justify-center">
                    <Target className="text-purple-500" size={20} />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Capacity</span>
                </div>
                <div className="text-3xl font-bold text-white">{overallStats.adjustedCapacity.toFixed(0)}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Man-days this week
                  {getWeekendStatusText() && (
                    <span className="block text-amber-400 mt-1">{getWeekendStatusText()}</span>
                  )}
                </div>
              </div>

              {/* Allocated */}
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center">
                    <Activity className="text-emerald-500" size={20} />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Allocated</span>
                </div>
                <div className="text-3xl font-bold text-emerald-400">{overallStats.allocatedManDays.toFixed(1)}</div>
                <div className="text-xs text-gray-500 mt-2">{overallStats.occupancyRate.toFixed(1)}% utilized</div>
              </div>

              {/* Available */}
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 flex items-center justify-center">
                    <Zap className="text-amber-500" size={20} />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Available</span>
                </div>
                <div className="text-3xl font-bold text-amber-400">{overallStats.availableManDays.toFixed(1)}</div>
                <div className="text-xs text-gray-500 mt-2">Man-days remaining</div>
              </div>
            </div>

            {/* Occupancy Progress Bar */}
            <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-cyan-500" size={18} />
                  <span className="text-sm font-semibold text-white">Overall Occupancy Rate</span>
                  {getWeekendStatusText() && (
                    <span className="text-xs text-amber-400">{getWeekendStatusText()}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    overallStats.occupancyRate >= 90 ? 'text-red-400' :
                    overallStats.occupancyRate >= 70 ? 'text-emerald-400' : 'text-cyan-400'
                  }`}>{overallStats.occupancyRate.toFixed(1)}%</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {overallStats.occupancyRate >= 90 ? 'HIGH LOAD' : overallStats.occupancyRate >= 70 ? 'OPTIMAL' : 'AVAILABLE'}
                  </span>
                </div>
              </div>
              <div className="w-full bg-[#1a1a1a] h-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    overallStats.occupancyRate >= 90 ? 'bg-red-500' :
                    overallStats.occupancyRate >= 70 ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, overallStats.occupancyRate)}%` }}
                />
              </div>
              <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-[#1a1a1a]">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Total Capacity</div>
                  <div className="text-lg font-bold text-white mt-1">{overallStats.totalCapacity} MD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">On Leave</div>
                  <div className="text-lg font-bold text-rose-400 mt-1">{overallStats.leaveDays.toFixed(0)} MD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Allocated</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{overallStats.allocatedManDays.toFixed(1)} MD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Available</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">{overallStats.availableManDays.toFixed(1)} MD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">{overallStats.isOverUtilized ? 'Over Utilized' : 'Under Utilized'}</div>
                  <div className={`text-lg font-bold mt-1 ${overallStats.isOverUtilized ? 'text-red-400' : 'text-cyan-400'}`}>
                    {overallStats.isOverUtilized ? '+' : '-'}{overallStats.utilizationDiff.toFixed(1)} MD
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department Performance */}
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="text-cyan-500" size={18} />
                  <span className="text-sm font-semibold text-white">Department Performance</span>
                  {getWeekendStatusText() && (
                    <span className="text-xs text-amber-400 ml-auto">{getWeekendStatusText()}</span>
                  )}
                </div>
                <div className="space-y-3">
                  {departmentStats.map((dept) => (
                    <div key={dept.department} className="bg-[#0a0a0a] border border-[#1a1a1a] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-white">{dept.department}</span>
                          <span className="text-xs text-gray-500">{dept.memberCount} members</span>
                        </div>
                        <span className={`text-sm font-bold ${
                          dept.occupancyRate >= 90 ? 'text-red-400' :
                          dept.occupancyRate >= 70 ? 'text-emerald-400' : 'text-cyan-400'
                        }`}>{dept.occupancyRate.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-[#1a1a1a] h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            dept.occupancyRate >= 90 ? 'bg-red-500' :
                            dept.occupancyRate >= 70 ? 'bg-emerald-500' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.min(100, dept.occupancyRate)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-gray-500">Allocated: <span className="text-emerald-400 font-medium">{dept.allocated.toFixed(1)} MD</span></span>
                        <span className="text-gray-500">Available: <span className="text-amber-400 font-medium">{dept.available.toFixed(1)} MD</span></span>
                        <span className={`font-medium ${dept.isOverUtilized ? 'text-red-400' : 'text-cyan-400'}`}>
                          {dept.isOverUtilized ? 'Over' : 'Under'}: {dept.utilizationDiff.toFixed(1)} MD
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Alerts */}
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-500" size={18} />
                  <span className="text-sm font-semibold text-white">Resource Status Overview</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0a0a0a] border border-red-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpRight className="text-red-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase">Overallocated</span>
                    </div>
                    <div className="text-2xl font-bold text-red-400">{criticalMetrics.overallocated}</div>
                    <div className="text-xs text-gray-500 mt-1">Need attention</div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-amber-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserX className="text-amber-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase">Idle</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{criticalMetrics.idle}</div>
                    <div className="text-xs text-gray-500 mt-1">No allocations</div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-rose-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDownRight className="text-rose-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase">On Leave</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-400">{criticalMetrics.onLeave}</div>
                    <div className="text-xs text-gray-500 mt-1">This week</div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-emerald-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="text-emerald-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase">Optimal</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{criticalMetrics.fullyUtilized}</div>
                    <div className="text-xs text-gray-500 mt-1">Well utilized</div>
                  </div>
                </div>

                {/* Shift Distribution */}
                <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                  <div className="text-xs text-gray-400 uppercase mb-3">Shift Distribution</div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-cyan-500"></div>
                      <span className="text-xs text-gray-400">Day: <span className="text-white font-medium">{shiftStats.day}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500"></div>
                      <span className="text-xs text-gray-400">Night: <span className="text-white font-medium">{shiftStats.night}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500"></div>
                      <span className="text-xs text-gray-400">Flexible: <span className="text-white font-medium">{shiftStats.flexible}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Shows */}
            <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <Award className="text-cyan-500" size={18} />
                <span className="text-sm font-semibold text-white">Top Active Shows This Week</span>
              </div>
              {showStats.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No show allocations for this week</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {showStats.map((show, idx) => (
                    <div key={idx} className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">#{idx + 1}</span>
                        <span className="text-lg font-bold text-cyan-400">{show.totalMD.toFixed(1)} MD</span>
                      </div>
                      <div className="text-sm font-semibold text-white truncate mb-2" title={show.showName}>
                        {show.showName}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{show.artistCount} artists</span>
                        <span>{show.shotCount} shots</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Soft Bookings Card */}
            <div className="bg-[#111111] border border-[#1a1a1a] p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookCheck className="text-indigo-500" size={18} />
                  <span className="text-sm font-semibold text-white">Bookings</span>
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20 rounded-full">
                    {allBookings.length} Active
                  </span>
                </div>
              </div>
              {bookingsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : allBookings.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <BookCheck className="mx-auto mb-2 opacity-50" size={32} />
                  <p>No bookings yet</p>
                  <p className="text-xs mt-1">Select cells in Forecast and click Book</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allBookings.slice(0, 6).map((booking: any) => (
                    <div key={booking.id} className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-lg relative group">
                      {/* Delete button - top left corner */}
                      <button
                        onClick={() => handleDeleteBooking(booking)}
                        disabled={deletingBookingId === booking.id}
                        className="absolute -top-2 -left-2 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed z-10"
                        title="Delete booking"
                      >
                        {deletingBookingId === booking.id ? (
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Minus size={14} className="text-white" />
                        )}
                      </button>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white truncate" title={booking.showName}>
                          {booking.showName}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          booking.status === 'Booked' ? 'bg-cyan-500/20 text-cyan-400' :
                          booking.status === 'Allocated' ? 'bg-indigo-500/20 text-indigo-400' :
                          booking.status === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                          booking.status === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                          booking.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Manager</span>
                          <span className="text-gray-300">{booking.managerName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Department</span>
                          <span className="text-cyan-400 font-medium">{booking.department}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Man Days</span>
                          <span className="text-emerald-400 font-bold">{booking.manDays} MD</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Duration</span>
                          <span className="text-gray-300">
                            {format(new Date(booking.startDate), 'MMM dd')} - {format(new Date(booking.endDate), 'MMM dd')}
                          </span>
                        </div>
                        {booking.splitEnabled && (
                          <div className="pt-2 border-t border-[#1a1a1a] mt-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Sliders className="text-gray-500" size={12} />
                              <span className="text-gray-500">Designation Split</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-cyan-400">SR: {booking.srPercentage}%</span>
                              <span className="text-amber-400">MID: {booking.midPercentage}%</span>
                              <span className="text-emerald-400">JR: {booking.jrPercentage}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {allBookings.length > 6 && (
                <div className="text-center mt-4">
                  <span className="text-xs text-gray-500">+ {allBookings.length - 6} more bookings</span>
                </div>
              )}
            </div>

            {/* Quick Stats Footer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 text-center">
                <div className="text-xs text-gray-500 uppercase mb-1">Utilization Rate</div>
                <div className="text-xl font-bold text-purple-400">
                  {overallStats.adjustedCapacity > 0 ? ((overallStats.allocatedManDays / overallStats.adjustedCapacity) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 text-center">
                <div className="text-xs text-gray-500 uppercase mb-1">Avg MD/Artist</div>
                <div className="text-xl font-bold text-cyan-400">
                  {overallStats.activeMembers > 0 ? (overallStats.allocatedManDays / overallStats.activeMembers).toFixed(2) : 0}
                </div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 text-center">
                <div className="text-xs text-gray-500 uppercase mb-1">Leave Rate</div>
                <div className="text-xl font-bold text-rose-400">
                  {overallStats.totalCapacity > 0 ? ((overallStats.leaveDays / overallStats.totalCapacity) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] p-4 text-center">
                <div className="text-xs text-gray-500 uppercase mb-1">Active Shows</div>
                <div className="text-xl font-bold text-emerald-400">{showStats.length}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
