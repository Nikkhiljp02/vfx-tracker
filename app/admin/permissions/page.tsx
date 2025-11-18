"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Shield,
  ChevronLeft,
  Users,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
} from "lucide-react";

type Permission = {
  id: string;
  name: string;
  description: string;
  category: string;
};

type Role = {
  name: string;
  description: string;
  color: string;
};

type PermissionMatrix = {
  [role: string]: {
    [permission: string]: boolean;
  };
};

export default function PermissionsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const roles: Role[] = [
    { name: "ADMIN", description: "Full system access", color: "red" },
    { name: "SHOW_SUPERVISOR", description: "Show-level management", color: "purple" },
    { name: "SHOT_SUPERVISOR", description: "Shot coordination", color: "blue" },
    { name: "ARTIST", description: "Shot work", color: "green" },
    { name: "PRODUCTION", description: "Production tracking", color: "yellow" },
    { name: "COORDINATOR", description: "Coordination tasks", color: "orange" },
    { name: "VIEWER", description: "Read-only access", color: "gray" },
  ];

  const categories = [
    "all",
    "Shows",
    "Shots",
    "Tasks",
    "Users",
    "Deliveries",
    "Resources",
    "Settings",
  ];

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN") {
        router.push("/");
        return;
      }
      loadPermissions();
    }
  }, [status, session, router]);

  const loadPermissions = async () => {
    try {
      const response = await fetch("/api/admin/permissions");
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions);
        setMatrix(data.matrix);
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (role: string, permissionId: string) => {
    const currentValue = matrix[role]?.[permissionId] || false;
    
    // Optimistic update
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionId]: !currentValue,
      },
    }));

    try {
      const response = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          permissionId,
          enabled: !currentValue,
        }),
      });

      if (!response.ok) {
        // Revert on error
        setMatrix((prev) => ({
          ...prev,
          [role]: {
            ...prev[role],
            [permissionId]: currentValue,
          },
        }));
        alert("Failed to update permission");
      }
    } catch (error) {
      console.error("Error updating permission:", error);
      // Revert on error
      setMatrix((prev) => ({
        ...prev,
        [role]: {
          ...prev[role],
          [permissionId]: currentValue,
        },
      }));
    }
  };

  const getRoleColor = (role: string) => {
    const roleObj = roles.find((r) => r.name === role);
    return roleObj?.color || "gray";
  };

  const filteredPermissions =
    selectedCategory === "all"
      ? permissions
      : permissions.filter((p) => p.category === selectedCategory);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading permissions...</div>
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
                  <Shield className="w-8 h-8 mr-3" />
                  Permissions Manager
                </h1>
                <p className="text-gray-600 mt-1">Configure role-based permissions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Role Legend */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Roles
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {roles.map((role) => (
              <div key={role.name} className="flex flex-col">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium text-center bg-${role.color}-100 text-${role.color}-800`}
                >
                  {role.name}
                </span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  {role.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  selectedCategory === category
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.name}
                      className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex flex-col items-center">
                        <span>{role.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPermissions.map((permission, idx) => (
                  <tr key={permission.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="sticky left-0 z-10 bg-inherit px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {permission.name}
                        </div>
                        <div className="text-xs text-gray-500">{permission.description}</div>
                      </div>
                    </td>
                    {roles.map((role) => {
                      const hasPermission = matrix[role.name]?.[permission.id] || false;
                      const isAdmin = role.name === "ADMIN";
                      
                      return (
                        <td key={role.name} className="px-3 py-4 text-center">
                          {isAdmin ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <button
                              onClick={() => togglePermission(role.name, permission.id)}
                              className="mx-auto block transition-colors hover:scale-110"
                            >
                              {hasPermission ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> ADMIN role has all permissions by default and cannot be modified. Click on checkmarks/crosses to toggle permissions for other roles. Changes are saved immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
