"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  BarChart3,
  ChevronLeft,
  TrendingUp,
  Users,
  Folder,
  Layers,
  Calendar,
  Download,
} from "lucide-react";

interface AnalyticsData {
  userActivity: Array<{ date: string; count: number }>;
  shotProgress: Array<{ status: string; count: number }>;
  departmentWorkload: Array<{ department: string; tasks: number }>;
  topUsers: Array<{ user: string; actions: number }>;
  completionTrends: Array<{ week: string; completed: number }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN") {
        router.push("/");
        return;
      }
      fetchAnalytics();
    }
  }, [status, session, dateRange, router]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?days=${dateRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <BarChart3 className="w-8 h-8 mr-3" />
                  Analytics & Reports
                </h1>
                <p className="text-gray-600 mt-1">System usage and performance metrics</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.topUsers?.reduce((sum, u) => sum + u.actions, 0) || 0}
            </div>
            <div className="text-sm text-gray-600">Total Actions</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Layers className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.shotProgress?.reduce((sum, s) => sum + s.count, 0) || 0}
            </div>
            <div className="text-sm text-gray-600">Active Shots</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Folder className="w-6 h-6 text-purple-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.departmentWorkload?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Active Departments</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics?.completionTrends?.reduce((sum, c) => sum + c.completed, 0) || 0}
            </div>
            <div className="text-sm text-gray-600">Completed Tasks</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Shot Progress Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Shot Status Distribution</h3>
            <div className="space-y-3">
              {analytics?.shotProgress?.map((item) => (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{item.status}</span>
                    <span className="text-sm font-medium text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (item.count /
                            (analytics?.shotProgress?.reduce((sum, s) => sum + s.count, 0) || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Workload */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Workload</h3>
            <div className="space-y-3">
              {analytics?.departmentWorkload?.map((item) => (
                <div key={item.department}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{item.department}</span>
                    <span className="text-sm font-medium text-gray-900">{item.tasks} tasks</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (item.tasks /
                            (analytics?.departmentWorkload?.reduce(
                              (sum, d) => sum + d.tasks,
                              0
                            ) || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Users & Completion Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Active Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Active Users</h3>
            <div className="space-y-3">
              {analytics?.topUsers?.slice(0, 10).map((user, index) => (
                <div
                  key={user.user}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{user.user}</span>
                  </div>
                  <span className="text-sm text-gray-600">{user.actions} actions</span>
                </div>
              ))}
            </div>
          </div>

          {/* Completion Trends */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Completion Trends</h3>
            <div className="space-y-3">
              {analytics?.completionTrends?.map((trend) => (
                <div key={trend.week}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{trend.week}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {trend.completed} completed
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (trend.completed /
                            Math.max(
                              ...(analytics?.completionTrends?.map((t) => t.completed) || [1])
                            )) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Advanced charts and visualizations can be implemented using
            libraries like Chart.js, Recharts, or D3.js. This is a simplified view showing the
            data structure.
          </p>
        </div>
      </div>
    </div>
  );
}
