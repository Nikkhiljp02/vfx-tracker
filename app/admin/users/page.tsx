"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  showAccess: Array<{
    show: {
      id: string;
      showName: string;
    };
  }>;
  permissions: Array<{
    permission: {
      id: string;
      name: string;
      category: string;
    };
  }>;
}

interface Show {
  id: string;
  showName: string;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string;
  action: string;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "VIEWER",
    password: "",
    showIds: [] as string[],
    customPermissions: [] as Array<{ permissionId: string; granted: boolean }>,
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
  }, [status, session]);

  const fetchData = async () => {
    try {
      const [usersRes, showsRes, permsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/shows"),
        fetch("/api/permissions"),
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (showsRes.ok) setShows(await showsRes.json());
      if (permsRes.ok) {
        const data = await permsRes.json();
        setPermissions(data.all);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      role: "VIEWER",
      password: "",
      showIds: [],
      customPermissions: [],
    });
    setEditingUser(null);
    setIsAddUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email || "",
      role: user.role,
      password: "",
      showIds: user.showAccess.map((sa) => sa.show.id),
      customPermissions: user.permissions.map((p) => ({
        permissionId: p.permission.id,
        granted: true,
      })),
    });
    setEditingUser(user);
    setIsAddUserModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      // Close modal immediately for better UX
      setIsAddUserModalOpen(false);

      // Start fetch in background
      const responsePromise = fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      // Refresh data in background (don't wait)
      fetchData();

      // Check response after UI has updated
      const res = await responsePromise;
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to save user");
        // Refresh again to show correct state
        fetchData();
      } else {
        // Success - refresh to ensure consistency
        fetchData();
      }
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to save user");
      fetchData();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      // Optimistically remove from UI
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to delete user");
        // Revert by fetching fresh data
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
      // Revert by fetching fresh data
      fetchData();
    }
  };

  const toggleShowAccess = (showId: string) => {
    setFormData((prev) => ({
      ...prev,
      showIds: prev.showIds.includes(showId)
        ? prev.showIds.filter((id) => id !== showId)
        : [...prev.showIds, showId],
    }));
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => {
      const existing = prev.customPermissions.find((p) => p.permissionId === permissionId);
      if (existing) {
        return {
          ...prev,
          customPermissions: prev.customPermissions.filter((p) => p.permissionId !== permissionId),
        };
      } else {
        return {
          ...prev,
          customPermissions: [...prev.customPermissions, { permissionId, granted: true }],
        };
      }
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-800",
    COORDINATOR: "bg-blue-100 text-blue-800",
    MANAGER: "bg-purple-100 text-purple-800",
    PRODUCER: "bg-green-100 text-green-800",
    DEPARTMENT: "bg-yellow-100 text-yellow-800",
    VIEWER: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
          </div>
          <button
            onClick={handleAddUser}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Add User
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Show Access
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {user.showAccess.length > 0
                        ? user.showAccess.map((sa) => sa.show.showName).join(", ")
                        : "No shows assigned"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">
                {editingUser ? "Edit User" : "Add New User"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username (auto-generated)
                  </label>
                  <input
                    type="text"
                    value={`${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`.replace(/\s+/g, "")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {!editingUser && "*"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={!editingUser}
                    placeholder={editingUser ? "Leave blank to keep current password" : ""}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="DEPARTMENT">Department</option>
                    <option value="PRODUCER">Producer</option>
                    <option value="MANAGER">Manager</option>
                    <option value="COORDINATOR">Coordinator</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Show Access
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {shows.map((show) => (
                      <label key={show.id} className="flex items-center space-x-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.showIds.includes(show.id)}
                          onChange={() => toggleShowAccess(show.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{show.showName}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Permissions (optional)
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {permissions.map((perm) => (
                      <label key={perm.id} className="flex items-center space-x-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.customPermissions.some((p) => p.permissionId === perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">
                          {perm.name} - {perm.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddUserModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingUser ? "Update User" : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
