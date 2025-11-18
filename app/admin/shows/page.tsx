"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Folder,
  ChevronLeft,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Layers,
  Tag,
} from "lucide-react";

interface Show {
  id: string;
  showName: string;
  clientName: string | null;
  status: string;
  departments: string;
  createdDate: string;
  _count?: {
    shots: number;
  };
}

interface Department {
  id: string;
  deptName: string;
  isActive: boolean;
  createdDate: string;
}

interface StatusOption {
  id: string;
  statusName: string;
  statusOrder: number;
  isActive: boolean;
  colorCode: string;
  createdDate: string;
}

export default function ShowsManagementPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"shows" | "departments" | "statuses">("shows");
  const [shows, setShows] = useState<Show[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN") {
        router.push("/");
        return;
      }
      fetchData();
    }
  }, [status, session, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [showsRes, deptsRes, statusRes] = await Promise.all([
        fetch("/api/shows"),
        fetch("/api/departments?includeInactive=true"),
        fetch("/api/status-options?includeInactive=true"),
      ]);

      if (showsRes.ok) {
        const showsData = await showsRes.json();
        setShows(Array.isArray(showsData) ? showsData : []);
      }
      if (deptsRes.ok) setDepartments(await deptsRes.json());
      if (statusRes.ok) setStatusOptions(await statusRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShow = async (id: string) => {
    if (!confirm("Are you sure? This will delete all shots and tasks associated with this show.")) return;
    
    try {
      const res = await fetch(`/api/shows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setShows(shows.filter((s) => s.id !== id));
        alert("Show deleted successfully");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete show");
      }
    } catch (error) {
      console.error("Error deleting show:", error);
      alert("Failed to delete show");
    }
  };

  const handleToggleDepartment = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        setDepartments(
          departments.map((d) =>
            d.id === id ? { ...d, isActive: !isActive } : d
          )
        );
      }
    } catch (error) {
      console.error("Error toggling department:", error);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/status-options/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        setStatusOptions(
          statusOptions.map((s) =>
            s.id === id ? { ...s, isActive: !isActive } : s
          )
        );
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

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
                  <Folder className="w-8 h-8 mr-3" />
                  Shows & Configuration
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage shows, departments, and status options
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("shows")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "shows"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Folder className="w-4 h-4 inline mr-2" />
                Shows ({shows.length})
              </button>
              <button
                onClick={() => setActiveTab("departments")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "departments"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Layers className="w-4 h-4 inline mr-2" />
                Departments ({departments.filter(d => d.isActive).length})
              </button>
              <button
                onClick={() => setActiveTab("statuses")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "statuses"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Tag className="w-4 h-4 inline mr-2" />
                Status Options ({statusOptions.filter(s => s.isActive).length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Shows Tab */}
            {activeTab === "shows" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Manage shows from the main application. This view is for monitoring only.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Show Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Departments
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Shots
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {shows.map((show) => (
                        <tr key={show.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {show.showName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {show.clientName || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                show.status === "Active"
                                  ? "bg-green-100 text-green-800"
                                  : show.status === "Completed"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {show.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">
                              {JSON.parse(show.departments).join(", ")}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {show._count?.shots || 0}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {new Date(show.createdDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteShow(show.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Departments Tab */}
            {activeTab === "departments" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Manage department options. Inactive departments won't appear in dropdowns.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className={`border rounded-lg p-4 ${
                        dept.isActive
                          ? "border-gray-200 bg-white"
                          : "border-gray-300 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {dept.isActive ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {dept.deptName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {dept.isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleDepartment(dept.id, dept.isActive)}
                          className={`px-3 py-1 text-xs font-medium rounded ${
                            dept.isActive
                              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {dept.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Options Tab */}
            {activeTab === "statuses" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Manage status workflow options. Inactive statuses won't appear in dropdowns.
                  </p>
                </div>
                <div className="space-y-2">
                  {statusOptions
                    .sort((a, b) => a.statusOrder - b.statusOrder)
                    .map((status) => (
                      <div
                        key={status.id}
                        className={`border rounded-lg p-4 flex items-center justify-between ${
                          status.isActive
                            ? "border-gray-200 bg-white"
                            : "border-gray-300 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: status.colorCode }}
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {status.statusName}
                            </div>
                            <div className="text-xs text-gray-500">
                              Order: {status.statusOrder} · {status.isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleStatus(status.id, status.isActive)}
                          className={`px-3 py-1 text-xs font-medium rounded ${
                            status.isActive
                              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {status.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
