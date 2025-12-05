"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users, Plus, Trash2, Edit, Upload, Download, Search, Filter, X } from "lucide-react";
import toast from "react-hot-toast";

interface RosterMember {
  id: string;
  empId: string;
  empName: string;
  designation: string;
  reportingTo: string | null;
  department: string;
  shift: string;
  employeeType: string;
  isActive: boolean;
}

export default function RosterManagement() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RosterMember | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterEmployeeType, setFilterEmployeeType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    empId: "",
    empName: "",
    designation: "",
    reportingTo: "",
    department: "Roto",
    shift: "Day",
    employeeType: "Artist",
    isActive: true,
  });

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN" && user?.role !== "COORDINATOR") {
        router.push("/");
        return;
      }
      fetchMembers();
    }
  }, [status, session, router]);

  useEffect(() => {
    // Apply filters
    let filtered = [...members];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.empName.toLowerCase().includes(query) ||
        m.empId.toLowerCase().includes(query) ||
        m.designation.toLowerCase().includes(query)
      );
    }

    if (filterDepartment !== "all") {
      filtered = filtered.filter(m => m.department === filterDepartment);
    }

    if (filterEmployeeType !== "all") {
      filtered = filtered.filter(m => m.employeeType === filterEmployeeType);
    }

    if (filterActive !== "all") {
      filtered = filtered.filter(m =>
        filterActive === "active" ? m.isActive : !m.isActive
      );
    }

    setFilteredMembers(filtered);
  }, [members, searchQuery, filterDepartment, filterEmployeeType, filterActive]);

  const fetchMembers = async () => {
    try {
      const response = await fetch("/api/resource/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      } else {
        toast.error("Failed to fetch roster members");
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Error loading roster");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const response = await fetch("/api/resource/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Member added successfully!");
        await fetchMembers();
        setShowAddModal(false);
        resetForm();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add member");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Error adding member");
    }
  };

  const handleEdit = async () => {
    if (!selectedMember) return;

    try {
      const response = await fetch(`/api/resource/members/${selectedMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Member updated successfully!");
        await fetchMembers();
        setShowEditModal(false);
        setSelectedMember(null);
        resetForm();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update member");
      }
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Error updating member");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this member? This will also delete all their allocations.")) return;

    try {
      const response = await fetch(`/api/resource/members/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Member deleted successfully!");
        await fetchMembers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete member");
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      toast.error("Error deleting member");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMembers.size === 0) {
      toast.error("No members selected");
      return;
    }

    if (!confirm(`Delete ${selectedMembers.size} selected members? This will also delete all their allocations.`)) return;

    try {
      const response = await fetch("/api/resource/members/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedMembers) }),
      });

      if (response.ok) {
        toast.success(`${selectedMembers.size} members deleted successfully!`);
        setSelectedMembers(new Set());
        await fetchMembers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete members");
      }
    } catch (error) {
      console.error("Error bulk deleting:", error);
      toast.error("Error deleting members");
    }
  };

  const openEditModal = (member: RosterMember) => {
    setSelectedMember(member);
    setFormData({
      empId: member.empId,
      empName: member.empName,
      designation: member.designation,
      reportingTo: member.reportingTo || "",
      department: member.department,
      shift: member.shift,
      employeeType: member.employeeType,
      isActive: member.isActive,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      empId: "",
      empName: "",
      designation: "",
      reportingTo: "",
      department: "Roto",
      shift: "Day",
      employeeType: "Artist",
      isActive: true,
    });
  };

  const toggleMemberSelection = (id: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMembers(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const uniqueDepartments = Array.from(new Set(members.map(m => m.department))).sort();
  const uniqueEmployeeTypes = Array.from(new Set(members.map(m => m.employeeType))).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="text-white">Loading roster...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-[#111111] border-b border-[#1a1a1a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-cyan-500" size={28} />
              Employee Roster
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage all employees - Artists, Leads, Supervisors, Production
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedMembers.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Trash2 size={16} />
                Delete Selected ({selectedMembers.size})
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={16} />
              Add Member
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none bg-[#111111] border-b border-[#1a1a1a] px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, designation..."
              className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Departments</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Employee Type Filter */}
          <select
            value={filterEmployeeType}
            onChange={(e) => setFilterEmployeeType(e.target.value)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Types</option>
            {uniqueEmployeeTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {/* Active Filter */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <div className="text-gray-500 text-sm">
            Showing {filteredMembers.length} of {members.length} members
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-[#111111] sticky top-0 z-10">
            <tr className="border-b border-[#1a1a1a]">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Designation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Reporting To</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Shift</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id} className="border-b border-[#1a1a1a] hover:bg-[#151515] transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(member.id)}
                    onChange={() => toggleMemberSelection(member.id)}
                    className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-mono">{member.empId}</td>
                <td className="px-4 py-3 text-sm text-white font-medium">{member.empName}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{member.designation}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{member.reportingTo || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    member.department === "Roto" ? "bg-purple-500/20 text-purple-400" :
                    member.department === "Paint" ? "bg-blue-500/20 text-blue-400" :
                    member.department === "Comp" ? "bg-emerald-500/20 text-emerald-400" :
                    member.department === "MMRA" ? "bg-amber-500/20 text-amber-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {member.department}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">{member.shift}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    member.employeeType === "Artist" ? "bg-cyan-500/20 text-cyan-400" :
                    member.employeeType === "Lead" ? "bg-indigo-500/20 text-indigo-400" :
                    member.employeeType === "Supervisor" ? "bg-rose-500/20 text-rose-400" :
                    "bg-orange-500/20 text-orange-400"
                  }`}>
                    {member.employeeType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    member.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(member)}
                      className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} className="text-cyan-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No members found matching your filters.
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#111111] rounded-lg border border-[#2a2a2a] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Add New Member</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Employee ID *</label>
                <input
                  type="text"
                  value={formData.empId}
                  onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                  placeholder="EMP001"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.empName}
                  onChange={(e) => setFormData({ ...formData, empName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Designation *</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Senior Artist"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reporting To</label>
                <input
                  type="text"
                  value={formData.reportingTo}
                  onChange={(e) => setFormData({ ...formData, reportingTo: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Manager Name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Roto">Roto</option>
                  <option value="Paint">Paint</option>
                  <option value="Comp">Comp</option>
                  <option value="MMRA">MMRA</option>
                  <option value="Production">Production</option>
                  <option value="Management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shift *</label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Day">Day</option>
                  <option value="Night">Night</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Employee Type *</label>
                <select
                  value={formData.employeeType}
                  onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Artist">Artist</option>
                  <option value="Lead">Lead</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Production">Production</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <label htmlFor="isActive" className="text-sm text-gray-400">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - Same structure as Add Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-[#111111] rounded-lg border border-[#2a2a2a] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Edit Member</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Employee ID *</label>
                <input
                  type="text"
                  value={formData.empId}
                  onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.empName}
                  onChange={(e) => setFormData({ ...formData, empName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Designation *</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reporting To</label>
                <input
                  type="text"
                  value={formData.reportingTo}
                  onChange={(e) => setFormData({ ...formData, reportingTo: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Roto">Roto</option>
                  <option value="Paint">Paint</option>
                  <option value="Comp">Comp</option>
                  <option value="MMRA">MMRA</option>
                  <option value="Production">Production</option>
                  <option value="Management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shift *</label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Day">Day</option>
                  <option value="Night">Night</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Employee Type *</label>
                <select
                  value={formData.employeeType}
                  onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Artist">Artist</option>
                  <option value="Lead">Lead</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Production">Production</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <label htmlFor="isActiveEdit" className="text-sm text-gray-400">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowEditModal(false); setSelectedMember(null); resetForm(); }}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
