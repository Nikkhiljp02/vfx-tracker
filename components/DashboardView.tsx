'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import UpcomingDeliveriesWidget from './UpcomingDeliveriesWidget';

export default function DashboardView() {
  const shows = useStore((state) => state.shows);
  const shots = useStore((state) => state.shots);
  const tasks = useStore((state) => state.tasks);
  const departments = useStore((state) => state.departments);

  const dashboardData = useMemo(() => {
    const showStats = shows.map((show) => {
      const showShots = shots.filter((shot) => shot.showId === show.id);
      const showTasks = tasks.filter((task) =>
        showShots.some((shot) => shot.id === task.shotId)
      );

      const departmentStats = departments.map((dept) => {
        const deptTasks = showTasks.filter(
          (task) => task.department === dept.deptName
        );
        const statusCounts = deptTasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const completed = (statusCounts['C APP'] || 0) + (statusCounts['C KB'] || 0);
        const wip = statusCounts['WIP'] || 0;
        const awf = statusCounts['AWF'] || 0;
        const yts = statusCounts['YTS'] || 0;
        const total = deptTasks.length;

        return {
          department: dept.deptName,
          total,
          completed,
          wip,
          awf,
          yts,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          statusCounts,
        };
      });

      const totalTasks = showTasks.length;
      const completedTasks = showTasks.filter(
        (t) => (t.status === 'C APP' || t.status === 'C KB')
      ).length;
      const overallCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        show,
        totalShots: showShots.length,
        freshShots: showShots.filter((s) => s.shotTag === 'Fresh').length,
        additionalShots: showShots.filter((s) => s.shotTag === 'Additional').length,
        totalTasks,
        completedTasks,
        overallCompletion,
        departmentStats,
      };
    });

    return showStats;
  }, [shows, shots, tasks, departments]);

  const globalStats = useMemo(() => {
    const totalShows = shows.length;
    const totalShots = shots.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => (t.status === 'C APP' || t.status === 'C KB')
    ).length;
    const wipTasks = tasks.filter((t) => t.status === 'WIP').length;
    const awfTasks = tasks.filter((t) => t.status === 'AWF').length;

    return {
      totalShows,
      totalShots,
      totalTasks,
      completedTasks,
      wipTasks,
      awfTasks,
      overallCompletion: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }, [shows, shots, tasks]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Global Stats - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div key="global-shows" className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 touch-manipulation active:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Total Shows</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{globalStats.totalShows}</p>
            </div>
            <BarChart3 className="text-blue-600" size={28} />
          </div>
        </div>

        <div key="global-shots" className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 touch-manipulation active:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Total Shots</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{globalStats.totalShots}</p>
            </div>
            <TrendingUp className="text-purple-600" size={28} />
          </div>
        </div>

        <div key="global-tasks" className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 touch-manipulation active:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Total Tasks</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{globalStats.totalTasks}</p>
              <p className="text-xs text-gray-500 mt-1">
                WIP: {globalStats.wipTasks} | AWF: {globalStats.awfTasks}
              </p>
            </div>
            <Clock className="text-orange-600" size={28} />
          </div>
        </div>

        <div key="global-completion" className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 touch-manipulation active:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Completion</p>
              <p className="text-2xl md:text-3xl font-bold text-green-600">{globalStats.overallCompletion}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {globalStats.completedTasks} / {globalStats.totalTasks}
              </p>
            </div>
            <CheckCircle2 className="text-green-600" size={28} />
          </div>
        </div>
      </div>

      {/* Upcoming Deliveries Widget */}
      <UpcomingDeliveriesWidget />

      {/* Show-wise Breakdown */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Show-wise Progress</h2>

        {dashboardData.map((showData) => (
          <div
            key={showData.show.id}
            className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
          >
            {/* Show Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{showData.show.showName}</h3>
                  <p className="text-sm opacity-90">{showData.show.clientName}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{showData.overallCompletion}%</div>
                  <div className="text-sm opacity-90">Overall Progress</div>
                </div>
              </div>
            </div>

            {/* Show Stats - Mobile Optimized */}
            <div className="p-3 md:p-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div key="total-shots">
                  <p className="text-xs text-gray-600">Total Shots</p>
                  <p className="text-base md:text-lg font-semibold">{showData.totalShots}</p>
                </div>
                <div key="fresh-shots">
                  <p className="text-xs text-gray-600">Fresh Shots</p>
                  <p className="text-base md:text-lg font-semibold text-green-600">{showData.freshShots}</p>
                </div>
                <div key="additional-shots">
                  <p className="text-xs text-gray-600">Additional Shots</p>
                  <p className="text-base md:text-lg font-semibold text-orange-600">{showData.additionalShots}</p>
                </div>
                <div key="tasks-completed">
                  <p className="text-xs text-gray-600">Tasks Completed</p>
                  <p className="text-base md:text-lg font-semibold text-blue-600">
                    {showData.completedTasks} / {showData.totalTasks}
                  </p>
                </div>
              </div>
            </div>

            {/* Department Stats - Mobile Optimized */}
            <div className="p-3 md:p-4">
              <h4 className="font-semibold mb-3 text-sm md:text-base text-gray-700">Department Progress</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {showData.departmentStats.map((dept) => (
                  <div
                    key={dept.department}
                    className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-semibold text-gray-800">{dept.department}</h5>
                      <span className="text-lg font-bold text-blue-600">
                        {dept.completionRate}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${dept.completionRate}%` }}
                      />
                    </div>

                    {/* Status Breakdown */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div key="total">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold ml-1">{dept.total}</span>
                      </div>
                      <div key="done">
                        <span className="text-green-600">Done:</span>
                        <span className="font-semibold ml-1">{dept.completed}</span>
                      </div>
                      <div key="wip">
                        <span className="text-blue-600">WIP:</span>
                        <span className="font-semibold ml-1">{dept.wip}</span>
                      </div>
                      <div key="awf">
                        <span className="text-orange-600">AWF:</span>
                        <span className="font-semibold ml-1">{dept.awf}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {dashboardData.length === 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h3>
          <p className="text-gray-500">Create shows and shots to see dashboard statistics.</p>
        </div>
      )}
    </div>
  );
}
