'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isWeekend, isSaturday, isSunday } from 'date-fns';
import { useResourceContext } from '@/lib/resourceContext';
import { TrendingUp, TrendingDown, Users, Calendar, Clock, Award, BarChart3, PieChart, Activity } from 'lucide-react';

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
  allocationDate: string;
  showName: string;
  shotName: string;
  manDays: number;
  isWeekendWorking: boolean;
  isLeave: boolean;
}

interface DepartmentStats {
  department: string;
  totalMembers: number;
  activeMembers: number;
  totalCapacity: number;
  allocatedManDays: number;
  availableManDays: number;
  onLeave: number;
  occupancyRate: number;
}

interface AvailabilityFilter {
  department: string;
  shift: string;
  minAvailability: number;
  date: Date;
}

export default function ResourceDashboard() {
  const { members, allocations, loading, setMembers, setAllocations, setLoading, refreshTrigger } = useResourceContext();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Filters for availability checker
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [minAvailability, setMinAvailability] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [currentWeekStart, refreshTrigger]);

  // Listen for allocation updates from other views
  useEffect(() => {
    const bc = new BroadcastChannel('resource-updates');
    
    bc.onmessage = (event) => {
      if (event.data.type === 'allocation-updated') {
        // Reload data when changes come from Forecast or Allocations page
        loadData();
      }
    };

    return () => bc.close();
  }, [currentWeekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load members
      const membersRes = await fetch('/api/resource/members');
      if (!membersRes.ok) throw new Error('Failed to load members');
      const membersData = await membersRes.json();
      setMembers(membersData);

      // Load allocations for current week
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const allocRes = await fetch(
        `/api/resource/allocations?startDate=${format(currentWeekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      if (!allocRes.ok) throw new Error('Failed to load allocations');
      const allocData = await allocRes.json();
      setAllocations(allocData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const weekDays = useMemo(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  }, [currentWeekStart]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const activeMembers = members.filter(m => m.isActive);
    
    // Count actual working days including weekend working allocations
    const workingDaysSet = new Set<string>();
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isSat = isSaturday(day);
      const isSun = isSunday(day);
      
      // Check if any allocation is marked as weekend working for this date
      const hasWeekendWorking = allocations.some(a => 
        a.allocationDate === dateStr && a.isWeekendWorking && !a.isLeave
      );
      
      // Count as working day if it's not weekend, or if weekend but has working allocations
      if (!isSat && !isSun) {
        workingDaysSet.add(dateStr);
      } else if (hasWeekendWorking) {
        workingDaysSet.add(dateStr);
      }
    });
    
    const workingDaysCount = workingDaysSet.size;
    const totalCapacity = activeMembers.length * workingDaysCount;

    let allocatedManDays = 0;
    let leaveDays = 0;

    allocations.forEach(alloc => {
      if (alloc.isLeave) {
        leaveDays += alloc.manDays;
      } else {
        allocatedManDays += alloc.manDays;
      }
    });

    const adjustedCapacity = totalCapacity - leaveDays;
    const availableManDays = adjustedCapacity - allocatedManDays;
    const occupancyRate = adjustedCapacity > 0 ? (allocatedManDays / adjustedCapacity) * 100 : 0;

    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      totalCapacity,
      adjustedCapacity,
      allocatedManDays,
      availableManDays,
      leaveDays,
      occupancyRate,
      workingDays: workingDaysCount,
    };
  }, [members, allocations, weekDays]);

  // Calculate department-wise statistics
  const departmentStats = useMemo(() => {
    const departments = Array.from(new Set(members.map(m => m.department))).sort();
    
    // Use same working days calculation as overall stats
    const workingDaysSet = new Set<string>();
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isSat = isSaturday(day);
      const isSun = isSunday(day);
      
      const hasWeekendWorking = allocations.some(a => 
        a.allocationDate === dateStr && a.isWeekendWorking && !a.isLeave
      );
      
      if (!isSat && !isSun) {
        workingDaysSet.add(dateStr);
      } else if (hasWeekendWorking) {
        workingDaysSet.add(dateStr);
      }
    });
    
    const workingDaysCount = workingDaysSet.size;

    return departments.map(dept => {
      const deptMembers = members.filter(m => m.department === dept && m.isActive);
      const totalCapacity = deptMembers.length * workingDaysCount;

      let allocatedManDays = 0;
      let leaveDays = 0;

      deptMembers.forEach(member => {
        const memberAllocs = allocations.filter(a => a.resourceId === member.id);
        memberAllocs.forEach(alloc => {
          if (alloc.isLeave) {
            leaveDays += alloc.manDays;
          } else {
            allocatedManDays += alloc.manDays;
          }
        });
      });

      const adjustedCapacity = totalCapacity - leaveDays;
      const availableManDays = adjustedCapacity - allocatedManDays;
      const occupancyRate = adjustedCapacity > 0 ? (allocatedManDays / adjustedCapacity) * 100 : 0;

      return {
        department: dept,
        totalMembers: deptMembers.length,
        activeMembers: deptMembers.length,
        totalCapacity,
        allocatedManDays,
        availableManDays: Math.max(0, availableManDays),
        onLeave: Math.round(leaveDays),
        occupancyRate,
      };
    });
  }, [members, allocations, weekDays]);

  // Calculate show-wise statistics
  const showStats = useMemo(() => {
    const showMap = new Map<string, {
      showName: string;
      totalManDays: number;
      uniqueShots: Set<string>;
      uniqueArtists: Set<string>;
      departmentBreakdown: Map<string, number>;
    }>();

    allocations.forEach(alloc => {
      if (alloc.isLeave || !alloc.showName || alloc.showName === 'Default') return;

      if (!showMap.has(alloc.showName)) {
        showMap.set(alloc.showName, {
          showName: alloc.showName,
          totalManDays: 0,
          uniqueShots: new Set(),
          uniqueArtists: new Set(),
          departmentBreakdown: new Map(),
        });
      }

      const show = showMap.get(alloc.showName)!;
      show.totalManDays += alloc.manDays;
      
      if (alloc.shotName) {
        show.uniqueShots.add(alloc.shotName);
      }
      
      show.uniqueArtists.add(alloc.resourceId);

      const member = members.find(m => m.id === alloc.resourceId);
      if (member) {
        const currentDept = show.departmentBreakdown.get(member.department) || 0;
        show.departmentBreakdown.set(member.department, currentDept + alloc.manDays);
      }
    });

    return Array.from(showMap.values())
      .map(show => ({
        showName: show.showName,
        totalManDays: show.totalManDays,
        shotCount: show.uniqueShots.size,
        artistCount: show.uniqueArtists.size,
        departmentBreakdown: Array.from(show.departmentBreakdown.entries()).map(([dept, md]) => ({
          department: dept,
          manDays: md,
        })),
      }))
      .sort((a, b) => b.totalManDays - a.totalManDays);
  }, [allocations, members]);

  // Calculate efficiency metrics
  const efficiencyMetrics = useMemo(() => {
    const totalPossibleCapacity = members.filter(m => m.isActive).length * 7; // Full week
    const actualWorkingCapacity = overallStats.adjustedCapacity;
    const utilizationRate = totalPossibleCapacity > 0 
      ? (overallStats.allocatedManDays / totalPossibleCapacity) * 100 
      : 0;

    const weekendWorkingDays = allocations.filter(a => {
      const date = new Date(a.allocationDate);
      return a.isWeekendWorking && !a.isLeave && (isSaturday(date) || isSunday(date));
    }).reduce((sum, a) => sum + a.manDays, 0);

    return {
      utilizationRate,
      weekendWorkingDays,
      productivityIndex: overallStats.occupancyRate,
      leaveRate: overallStats.adjustedCapacity > 0 
        ? (overallStats.leaveDays / (overallStats.adjustedCapacity + overallStats.leaveDays)) * 100 
        : 0,
    };
  }, [members, allocations, overallStats]);

  // Calculate availability for specific date
  const availableResources = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const isWeekendDay = isWeekend(selectedDate);

    let filteredMembers = members.filter(m => m.isActive);

    if (selectedDepartment !== 'all') {
      filteredMembers = filteredMembers.filter(m => m.department === selectedDepartment);
    }

    if (selectedShift !== 'all') {
      filteredMembers = filteredMembers.filter(m => m.shift === selectedShift);
    }

    return filteredMembers.map(member => {
      const dayAllocs = allocations.filter(
        a => a.resourceId === member.id && a.allocationDate === dateStr
      );

      const isOnLeave = dayAllocs.some(a => a.isLeave);
      const totalAllocated = dayAllocs.reduce((sum, a) => sum + (a.isLeave ? 0 : a.manDays), 0);
      const availability = isOnLeave ? 0 : Math.max(0, 1 - totalAllocated);

      const allocatedTo = dayAllocs
        .filter(a => !a.isLeave && a.showName && a.shotName)
        .map(a => `${a.showName} - ${a.shotName}`)
        .join(', ');

      return {
        ...member,
        availability,
        isOnLeave,
        allocatedTo: allocatedTo || 'N/A',
        totalAllocated,
      };
    }).filter(m => m.availability >= minAvailability / 100);
  }, [members, allocations, selectedDate, selectedDepartment, selectedShift, minAvailability]);

  const departments = Array.from(new Set(members.map(m => m.department))).sort();
  const shifts = Array.from(new Set(members.map(m => m.shift))).sort();

  const handlePreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const handleCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header with Week Navigation */}
      <div className="flex-none bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Resource Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Comprehensive workforce intelligence & utilization metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreviousWeek}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all text-sm font-medium border border-gray-700"
            >
              ← Previous
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold shadow-lg"
            >
              Current Week
            </button>
            <button
              onClick={handleNextWeek}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all text-sm font-medium border border-gray-700"
            >
              Next →
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Calendar className="text-blue-400" size={18} />
          <span className="text-gray-300 font-medium">
            {format(currentWeekStart, 'MMM dd')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
          </span>
          <span className="ml-4 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold">
            {overallStats.workingDays} Working Days
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading analytics data...</div>
          </div>
        ) : (
          <>
            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Resources */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="text-blue-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Active Resources</div>
                    <div className="text-3xl font-bold text-white mt-1">{overallStats.activeMembers}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  of {overallStats.totalMembers} total members
                </div>
              </div>

              {/* Total Capacity */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Clock className="text-purple-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Week Capacity</div>
                    <div className="text-3xl font-bold text-white mt-1">{overallStats.adjustedCapacity.toFixed(0)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {overallStats.leaveDays.toFixed(0)} MD on leave
                </div>
              </div>

              {/* Allocated Man-Days */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Activity className="text-emerald-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Allocated</div>
                    <div className="text-3xl font-bold text-emerald-400 mt-1">{overallStats.allocatedManDays.toFixed(1)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {efficiencyMetrics.utilizationRate.toFixed(1)}% utilization
                </div>
              </div>

              {/* Available Man-Days */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <TrendingUp className="text-amber-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Available</div>
                    <div className="text-3xl font-bold text-amber-400 mt-1">{overallStats.availableManDays.toFixed(1)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {overallStats.occupancyRate.toFixed(1)}% occupied
                </div>
              </div>
            </div>

            {/* Occupancy Rate Visualization */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-blue-400" size={20} />
                  <h2 className="text-lg font-bold text-white">Resource Occupancy Rate</h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">{overallStats.occupancyRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {overallStats.occupancyRate >= 90 ? 'High Load' : overallStats.occupancyRate >= 70 ? 'Optimal' : 'Available'}
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-8 overflow-hidden relative">
                <div
                  className={`h-full flex items-center justify-center text-sm font-bold text-white transition-all duration-500 ${
                    overallStats.occupancyRate >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    overallStats.occupancyRate >= 70 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 
                    'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, overallStats.occupancyRate)}%` }}
                >
                  {overallStats.occupancyRate > 5 && `${overallStats.occupancyRate.toFixed(1)}%`}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700/50">
                <div>
                  <div className="text-xs text-gray-400 uppercase font-semibold">Capacity</div>
                  <div className="text-lg font-bold text-white mt-1">{overallStats.adjustedCapacity.toFixed(0)} MD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase font-semibold">Allocated</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{overallStats.allocatedManDays.toFixed(1)} MD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase font-semibold">Available</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">{overallStats.availableManDays.toFixed(1)} MD</div>
                </div>
              </div>
            </div>

            {/* Show-wise Breakdown */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Award className="text-blue-400" size={20} />
                <h2 className="text-lg font-bold text-white">Show-wise Allocation Breakdown</h2>
              </div>
              {showStats.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No show allocations for this week</div>
              ) : (
                <div className="space-y-3">
                  {showStats.map((show, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                          <h3 className="font-semibold text-white text-lg">{show.showName}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-400">{show.totalManDays.toFixed(1)}</div>
                          <div className="text-xs text-gray-400">Man-Days</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-700/30">
                        <div>
                          <div className="text-xs text-gray-400 uppercase">Shots</div>
                          <div className="text-lg font-semibold text-white mt-1">{show.shotCount}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 uppercase">Artists</div>
                          <div className="text-lg font-semibold text-white mt-1">{show.artistCount}</div>
                        </div>
                      </div>
                      {show.departmentBreakdown.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700/30">
                          <div className="text-xs text-gray-400 uppercase mb-2">Department Breakdown</div>
                          <div className="flex flex-wrap gap-2">
                            {show.departmentBreakdown.map((dept, i) => (
                              <div key={i} className="px-3 py-1 bg-gray-800 rounded-full text-xs">
                                <span className="text-gray-300 font-medium">{dept.department}:</span>
                                <span className="text-blue-400 font-bold ml-1">{dept.manDays.toFixed(1)} MD</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Efficiency & Productivity Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <PieChart className="text-purple-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Utilization</div>
                    <div className="text-3xl font-bold text-purple-400 mt-1">{efficiencyMetrics.utilizationRate.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Capacity efficiency rate
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <Clock className="text-orange-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Weekend Work</div>
                    <div className="text-3xl font-bold text-orange-400 mt-1">{efficiencyMetrics.weekendWorkingDays.toFixed(1)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Man-days on weekends
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <TrendingUp className="text-cyan-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Productivity</div>
                    <div className="text-3xl font-bold text-cyan-400 mt-1">{efficiencyMetrics.productivityIndex.toFixed(1)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Productivity index score
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-rose-500/20 rounded-lg">
                    <TrendingDown className="text-rose-400" size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Leave Rate</div>
                    <div className="text-3xl font-bold text-rose-400 mt-1">{efficiencyMetrics.leaveRate.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Percentage on leave
                </div>
              </div>
            </div>

            {/* Department-wise Statistics */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Users className="text-blue-400" size={20} />
                <h2 className="text-lg font-bold text-white">Department-wise Performance Analysis</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Members</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Capacity</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Allocated</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Available</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">On Leave</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentStats.map((dept, idx) => (
                      <tr key={dept.department} className={`border-b border-gray-700/30 hover:bg-gray-800/50 transition-colors ${idx % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
                        <td className="px-4 py-4 text-sm font-semibold text-white">{dept.department}</td>
                        <td className="px-4 py-4 text-sm text-center text-gray-300">{dept.activeMembers}</td>
                        <td className="px-4 py-4 text-sm text-center text-gray-300 font-medium">{dept.totalCapacity}</td>
                        <td className="px-4 py-4 text-sm text-center text-emerald-400 font-bold">{dept.allocatedManDays.toFixed(1)}</td>
                        <td className="px-4 py-4 text-sm text-center text-amber-400 font-bold">{dept.availableManDays.toFixed(1)}</td>
                        <td className="px-4 py-4 text-sm text-center text-rose-400">{dept.onLeave}</td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-700/50 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  dept.occupancyRate >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                  dept.occupancyRate >= 70 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                  'bg-gradient-to-r from-blue-500 to-blue-600'
                                }`}
                                style={{ width: `${Math.min(100, dept.occupancyRate)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold min-w-[3rem] text-right ${
                              dept.occupancyRate >= 90 ? 'text-red-400' :
                              dept.occupancyRate >= 70 ? 'text-emerald-400' :
                              'text-blue-400'
                            }`}>
                              {dept.occupancyRate.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Availability Checker */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="text-blue-400" size={20} />
                <h2 className="text-lg font-bold text-white">Resource Availability Checker</h2>
              </div>
              
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 uppercase font-semibold">Date</label>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 uppercase font-semibold">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 uppercase font-semibold">Shift</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    <option value="all">All Shifts</option>
                    {shifts.map(shift => <option key={shift} value={shift}>{shift}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 uppercase font-semibold">Min Availability</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="10"
                      value={minAvailability}
                      onChange={(e) => setMinAvailability(Number(e.target.value))}
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                    />
                    <span className="text-sm text-gray-400 font-semibold">%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 justify-end">
                  <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <div className="text-xs text-gray-400 uppercase font-semibold">Found</div>
                    <div className="text-2xl font-bold text-blue-400">{availableResources.length}</div>
                  </div>
                </div>
              </div>

              {/* Available Resources Table */}
              <div className="overflow-x-auto max-h-96 rounded-lg border border-gray-700/30">
                <table className="min-w-full">
                  <thead className="bg-gray-900/70 sticky top-0">
                    <tr className="border-b border-gray-700/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Emp ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Shift</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Availability</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Allocated To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableResources.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="text-gray-600" size={48} />
                            <p>No resources found matching the criteria</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      availableResources.map((resource, idx) => (
                        <tr key={resource.id} className={`border-b border-gray-700/30 hover:bg-gray-800/50 transition-colors ${idx % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
                          <td className="px-4 py-4 text-sm text-gray-300 font-medium">{resource.empId}</td>
                          <td className="px-4 py-4 text-sm text-gray-300">{resource.department}</td>
                          <td className="px-4 py-4 text-sm text-gray-300">{resource.shift}</td>
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center justify-center gap-3">
                              <div className="w-20 bg-gray-700/50 rounded-full h-3">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    resource.availability >= 0.8 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                    resource.availability >= 0.5 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                    resource.availability > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                    'bg-gradient-to-r from-rose-500 to-rose-600'
                                  }`}
                                  style={{ width: `${resource.availability * 100}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold min-w-[3rem] ${
                                resource.availability >= 0.8 ? 'text-emerald-400' :
                                resource.availability >= 0.5 ? 'text-amber-400' :
                                resource.availability > 0 ? 'text-orange-400' :
                                'text-rose-400'
                              }`}>
                                {(resource.availability * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {resource.isOnLeave ? (
                              <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-semibold border border-rose-500/30">On Leave</span>
                            ) : resource.availability >= 0.8 ? (
                              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold border border-emerald-500/30">Available</span>
                            ) : resource.availability > 0 ? (
                              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold border border-amber-500/30">Partial</span>
                            ) : (
                              <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-semibold border border-orange-500/30">Full</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-400 truncate max-w-xs">{resource.allocatedTo}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
