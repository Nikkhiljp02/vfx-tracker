'use client';

import { useState, useMemo } from 'react';
import { useResourceMembers, useResourceAllocations } from '@/hooks/useQueryHooks';
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, addMonths, subMonths } from 'date-fns';

// Glass morphism card component
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-slate-800/40 backdrop-blur-lg border border-slate-700/50 rounded-lg shadow-xl ${className}`}>
    {children}
  </div>
);

// Skeleton loader component
const SkeletonLoader = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`}></div>
);

// Empty state component
const EmptyState = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-6xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-400 text-center max-w-md">{description}</p>
  </div>
);

interface CapacityData {
  department: string;
  totalArtists: number;
  availableMD: number;
  allocatedMD: number;
  utilizationPercent: number;
  status: 'available' | 'near-capacity' | 'over-capacity' | 'full';
}

interface WeekCapacity {
  weekStart: Date;
  weekEnd: Date;
  departments: Record<string, { available: number; allocated: number; utilization: number }>;
}

export default function CapacityPlanningDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'department' | 'artist'>('department');
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [hypotheticalShow, setHypotheticalShow] = useState({ name: '', manDays: 0, department: '' });

  const { data: members, isLoading: membersLoading } = useResourceMembers();
  const { data: allocations, isLoading: allocationsLoading } = useResourceAllocations();

  const isLoading = membersLoading || allocationsLoading;

  // Calculate working days in month
  const workingDaysInMonth = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const totalDays = end.getDate();
    // Approximate: 22 working days per month (excluding weekends)
    return Math.floor(totalDays * 22 / 30);
  }, [selectedMonth]);

  // Calculate capacity by department
  const capacityByDepartment = useMemo((): CapacityData[] => {
    if (!members || !allocations) return [];

    const departments = ['Comp', 'Paint', 'Roto', 'MMRA'];
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return departments.map(dept => {
      // Filter artists by department and type (only Artists, not Leads/Supervisors)
      const deptArtists = members.filter((m: any) => 
        m.department === dept && 
        m.employeeType === 'Artist' && 
        m.isActive
      );
      
      const totalArtists = deptArtists.length;
      const availableMD = totalArtists * workingDaysInMonth;

      // Calculate allocated man-days for this department in selected month
      const allocatedMD = allocations
        .filter((a: any) => {
          const allocDate = new Date(a.allocationDate);
          const artist = members.find((m: any) => m.id === a.resourceId);
          return artist?.department === dept && 
                 allocDate >= monthStart && 
                 allocDate <= monthEnd &&
                 !a.isLeave &&
                 !a.isIdle;
        })
        .reduce((sum: number, a: any) => sum + a.manDays, 0);

      // Add hypothetical show impact
      const hypotheticalMD = whatIfMode && hypotheticalShow.department === dept ? hypotheticalShow.manDays : 0;
      const totalAllocated = allocatedMD + hypotheticalMD;

      const utilizationPercent = availableMD > 0 ? (totalAllocated / availableMD) * 100 : 0;

      let status: CapacityData['status'] = 'available';
      if (utilizationPercent >= 100) status = 'full';
      else if (utilizationPercent >= 90) status = 'over-capacity';
      else if (utilizationPercent >= 60) status = 'near-capacity';

      return {
        department: dept,
        totalArtists,
        availableMD,
        allocatedMD: totalAllocated,
        utilizationPercent: Math.round(utilizationPercent * 10) / 10,
        status
      };
    });
  }, [members, allocations, selectedMonth, workingDaysInMonth, whatIfMode, hypotheticalShow]);

  // Calculate weekly capacity
  const weeklyCapacity = useMemo((): WeekCapacity[] => {
    if (!members || !allocations) return [];

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });

    return weeks.map(weekStart => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const departments: Record<string, { available: number; allocated: number; utilization: number }> = {};

      ['Comp', 'Paint', 'Roto', 'MMRA'].forEach(dept => {
        const deptArtists = members.filter((m: any) => 
          m.department === dept && 
          m.employeeType === 'Artist' && 
          m.isActive
        );
        const available = deptArtists.length * 5; // 5 working days per week

        const allocated = allocations
          .filter((a: any) => {
            const allocDate = new Date(a.allocationDate);
            const artist = members.find((m: any) => m.id === a.resourceId);
            return artist?.department === dept && 
                   allocDate >= weekStart && 
                   allocDate <= weekEnd &&
                   !a.isLeave &&
                   !a.isIdle;
          })
          .reduce((sum: number, a: any) => sum + a.manDays, 0);

        departments[dept] = {
          available,
          allocated,
          utilization: available > 0 ? (allocated / available) * 100 : 0
        };
      });

      return { weekStart, weekEnd, departments };
    });
  }, [members, allocations, selectedMonth]);

  // Calculate hiring recommendations
  const hiringRecommendations = useMemo(() => {
    return capacityByDepartment
      .filter(d => d.utilizationPercent > 85)
      .map(d => {
        const overCapacity = d.allocatedMD - (d.availableMD * 0.85);
        const artistsNeeded = Math.ceil(overCapacity / workingDaysInMonth);
        return {
          department: d.department,
          artistsNeeded,
          reason: `${d.department} is at ${d.utilizationPercent}% capacity`,
          urgency: d.utilizationPercent > 95 ? 'high' : 'medium'
        };
      });
  }, [capacityByDepartment, workingDaysInMonth]);

  // Capacity alerts
  const capacityAlerts = useMemo(() => {
    const alerts: Array<{ type: 'warning' | 'danger' | 'info'; message: string }> = [];

    capacityByDepartment.forEach(d => {
      if (d.utilizationPercent > 100) {
        alerts.push({
          type: 'danger',
          message: `${d.department} over capacity by ${Math.round(d.allocatedMD - d.availableMD)} MD`
        });
      } else if (d.utilizationPercent > 90) {
        alerts.push({
          type: 'warning',
          message: `${d.department} nearing capacity at ${d.utilizationPercent}%`
        });
      } else if (d.utilizationPercent < 40) {
        alerts.push({
          type: 'info',
          message: `${d.department} under-utilized at ${d.utilizationPercent}%`
        });
      }
    });

    return alerts;
  }, [capacityByDepartment]);

  const getStatusColor = (status: CapacityData['status']) => {
    switch (status) {
      case 'available': return 'bg-emerald-500';
      case 'near-capacity': return 'bg-amber-500';
      case 'over-capacity': return 'bg-red-500';
      case 'full': return 'bg-slate-500';
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'bg-slate-600';
    if (utilization >= 90) return 'bg-red-600';
    if (utilization >= 60) return 'bg-amber-600';
    return 'bg-emerald-600';
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <SkeletonLoader className="h-8 w-64" />
          <SkeletonLoader className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <GlassCard key={i} className="p-6">
              <SkeletonLoader className="h-6 w-32 mb-4" />
              <SkeletonLoader className="h-8 w-24 mb-2" />
              <SkeletonLoader className="h-4 w-full" />
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  if (!members?.length) {
    return (
      <div className="p-6">
        <EmptyState
          icon="👥"
          title="No Team Members Found"
          description="Add artists to your team in the Admin Roster to start capacity planning."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Capacity Planning</h1>
          <p className="text-slate-400 mt-1">Analyze team capacity and optimize resource allocation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
          >
            ←
          </button>
          <div className="px-4 py-2 bg-slate-700 text-white rounded font-medium">
            {format(selectedMonth, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
          >
            →
          </button>
          <button
            onClick={() => setSelectedMonth(new Date())}
            className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 ml-2"
          >
            Today
          </button>
        </div>
      </div>

      {/* Capacity Alerts */}
      {capacityAlerts.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-lg font-bold text-white mb-3">⚠️ Capacity Alerts</h3>
          <div className="space-y-2">
            {capacityAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded flex items-center gap-2 ${
                  alert.type === 'danger' ? 'bg-red-500/20 border border-red-500/50' :
                  alert.type === 'warning' ? 'bg-amber-500/20 border border-amber-500/50' :
                  'bg-blue-500/20 border border-blue-500/50'
                }`}
              >
                <span className="text-white">{alert.message}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Department Capacity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {capacityByDepartment.map(dept => (
          <GlassCard key={dept.department} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-white">{dept.department}</h3>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(dept.status)}`} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Artists:</span>
                <span className="text-white font-medium">{dept.totalArtists}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Available:</span>
                <span className="text-white font-medium">{dept.availableMD} MD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Allocated:</span>
                <span className="text-white font-medium">{dept.allocatedMD} MD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Remaining:</span>
                <span className={`font-medium ${dept.availableMD - dept.allocatedMD < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {dept.availableMD - dept.allocatedMD} MD
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Utilization</span>
                <span className="font-bold text-white">{dept.utilizationPercent}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUtilizationColor(dept.utilizationPercent)}`}
                  style={{ width: `${Math.min(dept.utilizationPercent, 100)}%` }}
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Weekly Capacity Grid */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-bold text-white mb-4">📅 Weekly Capacity Breakdown</h3>
        {weeklyCapacity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 py-2 px-4">Week</th>
                  {['Comp', 'Paint', 'Roto', 'MMRA'].map(dept => (
                    <th key={dept} className="text-center text-slate-400 py-2 px-4">{dept}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyCapacity.map((week, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50">
                    <td className="py-3 px-4 text-white">
                      {format(week.weekStart, 'MMM dd')} - {format(week.weekEnd, 'MMM dd')}
                    </td>
                    {['Comp', 'Paint', 'Roto', 'MMRA'].map(dept => {
                      const data = week.departments[dept];
                      return (
                        <td key={dept} className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white font-medium">{data.allocated}/{data.available} MD</span>
                            <div className="w-16 bg-slate-700 rounded-full h-1.5 mt-1">
                              <div
                                className={`h-1.5 rounded-full ${getUtilizationColor(data.utilization)}`}
                                style={{ width: `${Math.min(data.utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 mt-0.5">{Math.round(data.utilization)}%</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="📊"
            title="No Weekly Data"
            description="Allocate resources to see weekly capacity breakdown."
          />
        )}
      </GlassCard>

      {/* What-If Scenario Planning */}
      <GlassCard className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">🔮 What-If Scenario Planning</h3>
          <button
            onClick={() => setWhatIfMode(!whatIfMode)}
            className={`px-4 py-2 rounded ${whatIfMode ? 'bg-cyan-600' : 'bg-slate-700'} text-white hover:opacity-80`}
          >
            {whatIfMode ? 'Active' : 'Enable'}
          </button>
        </div>
        {whatIfMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <input
              type="text"
              placeholder="Hypothetical Show Name"
              value={hypotheticalShow.name}
              onChange={(e) => setHypotheticalShow({ ...hypotheticalShow, name: e.target.value })}
              className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
            />
            <select
              value={hypotheticalShow.department}
              onChange={(e) => setHypotheticalShow({ ...hypotheticalShow, department: e.target.value })}
              className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Select Department</option>
              <option value="Comp">Comp</option>
              <option value="Paint">Paint</option>
              <option value="Roto">Roto</option>
              <option value="MMRA">MMRA</option>
            </select>
            <input
              type="number"
              placeholder="Man-Days Required"
              value={hypotheticalShow.manDays || ''}
              onChange={(e) => setHypotheticalShow({ ...hypotheticalShow, manDays: parseFloat(e.target.value) || 0 })}
              className="px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}
      </GlassCard>

      {/* Hiring Recommendations */}
      {hiringRecommendations.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">💡 Hiring Recommendations</h3>
          <div className="space-y-3">
            {hiringRecommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`p-4 rounded border ${
                  rec.urgency === 'high' 
                    ? 'bg-red-500/20 border-red-500/50' 
                    : 'bg-amber-500/20 border-amber-500/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white mb-1">{rec.department} Department</h4>
                    <p className="text-sm text-slate-300">{rec.reason}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{rec.artistsNeeded}</div>
                    <div className="text-xs text-slate-400">Artists Needed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
