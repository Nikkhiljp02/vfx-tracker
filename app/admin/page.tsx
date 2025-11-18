"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Users,
  Activity,
  Database,
  Settings,
  BarChart3,
  Shield,
  FileText,
  Folder,
  Layers,
  Clock,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Server,
  HardDrive,
  Cpu,
} from "lucide-react";

interface DashboardStats {
  users: {
    total: number;
    active: number;
    admins: number;
    inactive: number;
  };
  shows: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
  };
  shots: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  tasks: {
    total: number;
    yts: number;
    wip: number;
    completed: number;
  };
  resources: {
    total: number;
    active: number;
    allocated: number;
    available: number;
  };
  system: {
    uptime: string;
    dbSize: string;
    lastBackup: string;
    apiCalls: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    user: string;
    timestamp: string;
    entity: string;
  }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN") {
        router.push("/");
        return;
      }
      fetchDashboardStats();
    }
  }, [status, session, router]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch("/api/admin/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  const adminSections = [
    {
      title: "User Management",
      description: "Manage users, roles, and permissions",
      icon: Users,
      href: "/admin/users",
      color: "bg-blue-500",
      stat: stats?.users.total || 0,
      statLabel: "Total Users",
    },
    {
      title: "Shows & Projects",
      description: "Manage shows, departments, and status options",
      icon: Folder,
      href: "/admin/shows",
      color: "bg-purple-500",
      stat: stats?.shows.total || 0,
      statLabel: "Active Shows",
    },
    {
      title: "Activity Logs",
      description: "View and search all system activities",
      icon: Activity,
      href: "/admin/logs",
      color: "bg-green-500",
      stat: stats?.recentActivity.length || 0,
      statLabel: "Recent Activities",
    },
    {
      title: "Analytics & Reports",
      description: "View system analytics and generate reports",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "bg-orange-500",
      stat: stats?.shots.thisWeek || 0,
      statLabel: "Shots This Week",
    },
    {
      title: "Permissions Manager",
      description: "Configure role-based permissions",
      icon: Shield,
      href: "/admin/permissions",
      color: "bg-red-500",
      stat: "7",
      statLabel: "Roles",
    },
    {
      title: "Session Management",
      description: "Monitor sessions and detect suspicious activity",
      icon: Activity,
      href: "/admin/sessions",
      color: "bg-purple-500",
      stat: stats?.users.active || 0,
      statLabel: "Active Sessions",
    },
    {
      title: "System Settings",
      description: "Configure email, database, and integrations",
      icon: Settings,
      href: "/admin/settings",
      color: "bg-gray-600",
      stat: "Active",
      statLabel: "System Status",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">System administration and management</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Users Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm text-green-600 font-medium">
                {stats?.users.active || 0} Active
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.users.total || 0}
            </div>
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats?.users.admins || 0} Admins · {stats?.users.inactive || 0} Inactive
            </div>
          </div>

          {/* Shows Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Folder className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm text-green-600 font-medium">
                {stats?.shows.active || 0} Active
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.shows.total || 0}
            </div>
            <div className="text-sm text-gray-600">Total Shows</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats?.shows.completed || 0} Completed · {stats?.shows.onHold || 0} On Hold
            </div>
          </div>

          {/* Shots Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Layers className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm text-blue-600 font-medium">
                +{stats?.shots.today || 0} Today
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.shots.total || 0}
            </div>
            <div className="text-sm text-gray-600">Total Shots</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats?.shots.thisWeek || 0} This Week · {stats?.shots.thisMonth || 0} This Month
            </div>
          </div>

          {/* Resources Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-sm text-green-600 font-medium">
                {stats?.resources.active || 0} Active
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.resources.total || 0}
            </div>
            <div className="text-sm text-gray-600">Resource Members</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats?.resources.allocated || 0} Allocated · {stats?.resources.available || 0} Available
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Server className="w-5 h-5 mr-2" />
            System Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <div className="text-sm font-semibold text-green-600">Operational</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="text-sm font-semibold text-gray-900">
                  {stats?.system.uptime || "99.9%"}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded">
                <HardDrive className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Database</div>
                <div className="text-sm font-semibold text-gray-900">
                  {stats?.system.dbSize || "125 MB"}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded">
                <Cpu className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">API Calls (Today)</div>
                <div className="text-sm font-semibold text-gray-900">
                  {stats?.system.apiCalls?.toLocaleString() || "12,345"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Sections Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Administration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 ${section.color} rounded-lg group-hover:scale-110 transition-transform`}>
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{section.stat}</div>
                    <div className="text-xs text-gray-500">{section.statLabel}</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {section.title}
                </h3>
                <p className="text-sm text-gray-600">{section.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Recent Activity
            </h2>
            <Link
              href="/admin/logs"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{activity.user}</span> {activity.action}{" "}
                        <span className="font-medium">{activity.entity}</span>
                      </div>
                      <div className="text-xs text-gray-500">{activity.timestamp}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
