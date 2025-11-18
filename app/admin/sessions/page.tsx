"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Shield,
  ChevronLeft,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Activity,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  User,
  Globe,
  X,
} from "lucide-react";

interface SessionData {
  id: string;
  userId: string;
  sessionToken: string;
  expires: string;
  createdAt: string;
  lastActivity: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  isActive: boolean;
  loggedOutAt: string | null;
  loggedOutBy: string | null;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    email: string | null;
  };
  duration: number;
  isExpired: boolean;
  lastActivityMinutes: number;
  status: "active" | "idle" | "expired" | "logged-out";
}

interface LoginHistoryEntry {
  id: string;
  userId: string;
  username: string;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  loginSuccess: boolean;
  failureReason: string | null;
  isSuspicious: boolean;
  suspicionFlags: string | null;
}

export default function SessionManagementPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"sessions" | "history">("sessions");
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    deviceType: "all",
    status: "all",
    suspicious: false,
  });

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN") {
        router.push("/");
        return;
      }
      fetchData();
    }
  }, [status, session, router, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "sessions") {
        const response = await fetch("/api/admin/sessions");
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
        }
      } else {
        const params = new URLSearchParams({
          limit: "100",
          ...(filters.suspicious && { suspicious: "true" }),
        });
        const response = await fetch(`/api/admin/sessions/history?${params}`);
        if (response.ok) {
          const data = await response.json();
          setLoginHistory(data.history || []);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogout = async (sessionId: string, username: string) => {
    if (!confirm(`Force logout ${username}? This will immediately end their session.`)) return;

    try {
      const response = await fetch("/api/admin/sessions/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        alert("Session logged out successfully");
        fetchData();
      } else {
        alert("Failed to logout session");
      }
    } catch (error) {
      console.error("Error logging out session:", error);
      alert("Failed to logout session");
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getBrowserIcon = (browser: string | null) => {
    // Use Globe icon for all browsers since Chrome/Firefox/Safari icons don't exist in lucide-react
    return <Globe className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      idle: "bg-yellow-100 text-yellow-800",
      expired: "bg-gray-100 text-gray-800",
      "logged-out": "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {status}
      </span>
    );
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      filters.search === "" ||
      s.user.username.toLowerCase().includes(filters.search.toLowerCase()) ||
      s.user.firstName.toLowerCase().includes(filters.search.toLowerCase()) ||
      s.user.lastName.toLowerCase().includes(filters.search.toLowerCase()) ||
      s.ipAddress?.includes(filters.search);
    
    const matchesDevice = filters.deviceType === "all" || s.deviceType === filters.deviceType;
    const matchesStatus = filters.status === "all" || s.status === filters.status;

    return matchesSearch && matchesDevice && matchesStatus;
  });

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
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
                  <Shield className="w-8 h-8 mr-3 text-blue-600" />
                  Session Management
                </h1>
                <p className="text-gray-600 mt-1">
                  Monitor active sessions, track login history, and detect suspicious activity
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sessions.filter((s) => s.status === "active").length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Idle Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sessions.filter((s) => s.status === "idle").length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Suspicious Logins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loginHistory.filter((h) => h.isSuspicious).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
              </div>
              <Monitor className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("sessions")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "sessions"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Monitor className="w-4 h-4 inline mr-2" />
                Active Sessions ({sessions.filter((s) => s.isActive && !s.isExpired).length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "history"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Login History ({loginHistory.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <div>
                {/* Filters */}
                <div className="mb-6 flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search users, IP addresses..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <select
                    value={filters.deviceType}
                    onChange={(e) => setFilters({ ...filters, deviceType: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Devices</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="tablet">Tablet</option>
                  </select>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                {/* Sessions Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Device & Browser
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          IP Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Last Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {session.user.firstName} {session.user.lastName}
                                </div>
                                <div className="text-sm text-gray-500">@{session.user.username}</div>
                                <div className="text-xs text-gray-400">{session.user.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getDeviceIcon(session.deviceType)}
                              {getBrowserIcon(session.browser)}
                              <div>
                                <div className="text-sm text-gray-900">
                                  {session.browser || "Unknown"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {session.os || "Unknown"} · {session.deviceType || "desktop"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {session.ipAddress || "Unknown"}
                              </span>
                            </div>
                            {session.location && (
                              <div className="text-xs text-gray-500">{session.location}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(session.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDuration(session.duration)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {session.lastActivityMinutes < 1
                              ? "Just now"
                              : `${session.lastActivityMinutes}m ago`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {session.isActive && !session.isExpired && (
                              <button
                                onClick={() =>
                                  handleForceLogout(
                                    session.id,
                                    session.user.username
                                  )
                                }
                                className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                              >
                                <LogOut className="w-4 h-4" />
                                <span>Logout</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredSessions.length === 0 && (
                  <div className="text-center py-12">
                    <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No sessions found</p>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div>
                {/* Filters */}
                <div className="mb-6 flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.suspicious}
                      onChange={(e) => {
                        setFilters({ ...filters, suspicious: e.target.checked });
                        setTimeout(fetchData, 100);
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Show only suspicious</span>
                  </label>
                </div>

                {/* History Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Login Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Device & Browser
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          IP Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Flags
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loginHistory.map((entry) => (
                        <tr
                          key={entry.id}
                          className={`hover:bg-gray-50 ${
                            entry.isSuspicious ? "bg-red-50" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {entry.username}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(entry.loginAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getDeviceIcon(entry.deviceType)}
                              {getBrowserIcon(entry.browser)}
                              <div>
                                <div className="text-sm text-gray-900">
                                  {entry.browser || "Unknown"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {entry.os || "Unknown"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {entry.ipAddress || "Unknown"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {entry.loginSuccess ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                Success
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {entry.isSuspicious && (
                              <div className="flex items-center space-x-1">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-xs text-red-600">
                                  {entry.suspicionFlags
                                    ? JSON.parse(entry.suspicionFlags).join(", ")
                                    : "Suspicious"}
                                </span>
                              </div>
                            )}
                            {!entry.loginSuccess && entry.failureReason && (
                              <span className="text-xs text-gray-500">
                                {entry.failureReason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {loginHistory.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No login history found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
