'use client';

import { useState, useMemo, useEffect } from 'react';
import { Download, Upload, Search, X, Filter, Plus, Trash2, Edit2, Save, Calendar, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { showSuccess, showError, showLoading, dismissToast } from '@/lib/toast';
import { matchesShotName } from '@/lib/searchUtils';
import { formatDisplayDate } from '@/lib/utils';
import { useVFXStore } from '@/lib/store';

interface Feedback {
  id: string;
  showName: string;
  shotName: string;
  shotTag: string;
  version: string;
  department: string;
  leadName: string | null;
  status: string;
  feedbackNotes: string | null;
  feedbackDate: Date;
  taskId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrefilledData {
  showName?: string;
  shotName?: string;
  shotTag?: string;
  version?: string;
  department?: string;
  status?: string;
  taskId?: string;
}

interface FeedbackViewProps {
  prefilledData?: PrefilledData;
}

interface ShotSuggestion {
  shotName: string;
  showName: string;
  showId: string;
}

export default function FeedbackView({ prefilledData }: FeedbackViewProps) {
  const { shows, shots, fetchShows, fetchShots } = useVFXStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Feedback>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    showName: '',
    shotName: '',
    shotTag: 'Fresh',
    version: '',
    department: '',
    status: 'C KB',
    feedbackNotes: '',
    feedbackDate: new Date().toISOString().split('T')[0],
    taskId: '',
  });

  // Autocomplete states
  const [shotNameInput, setShotNameInput] = useState('');
  const [showNameInput, setShowNameInput] = useState('');
  const [showShotDropdown, setShowShotDropdown] = useState(false);
  const [showShowDropdown, setShowShowDropdown] = useState(false);
  const [selectedShotIndex, setSelectedShotIndex] = useState(-1);

  // Multiple shot selection (for future)
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedShots, setSelectedShots] = useState<Set<string>>(new Set());

  // Filters
  const [selectedShows, setSelectedShows] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Load data only once when feedbacks array is empty
  useEffect(() => {
    if (!dataLoaded && feedbacks.length === 0) {
      loadFeedbacks();
    }
  }, [dataLoaded, feedbacks.length]);

  // Load shows and shots data from store
  useEffect(() => {
    if (shows.length === 0) {
      fetchShows();
    }
    if (shots.length === 0) {
      fetchShots();
    }
  }, []);

  // Handle prefilled data - auto-open modal with prefilled values
  useEffect(() => {
    if (prefilledData) {
      setNewFeedback({
        showName: prefilledData.showName || '',
        shotName: prefilledData.shotName || '',
        shotTag: prefilledData.shotTag || 'Fresh',
        version: prefilledData.version || '',
        department: prefilledData.department || '',
        status: prefilledData.status || 'C KB',
        feedbackNotes: '',
        feedbackDate: new Date().toISOString().split('T')[0],
        taskId: prefilledData.taskId || '',
      });
      setShotNameInput(prefilledData.shotName || '');
      setShowNameInput(prefilledData.showName || '');
      setShowAddModal(true);
    }
  }, [prefilledData]);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/feedbacks');
      if (!response.ok) throw new Error('Failed to load feedbacks');
      const data = await response.json();
      setFeedbacks(data);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      showError('Failed to load feedbacks');
    } finally {
      setLoading(false);
    }
  };

  // Get shot suggestions based on input
  const shotSuggestions = useMemo((): ShotSuggestion[] => {
    if (!shotNameInput.trim()) return [];
    
    const query = shotNameInput.toLowerCase();
    return shots
      .filter(shot => shot.shotName.toLowerCase().includes(query))
      .slice(0, 10)
      .map(shot => {
        const show = shows.find(s => s.id === shot.showId);
        return {
          shotName: shot.shotName,
          showName: show?.showName || '',
          showId: shot.showId,
        };
      });
  }, [shotNameInput, shots, shows]);

  // Get show suggestions
  const showSuggestions = useMemo(() => {
    if (!showNameInput.trim()) return shows;
    const query = showNameInput.toLowerCase();
    return shows.filter(show => show.showName.toLowerCase().includes(query));
  }, [showNameInput, shows]);

  // Handle shot name input change with autocomplete
  const handleShotNameChange = (value: string) => {
    setShotNameInput(value);
    setShowShotDropdown(true);
    setSelectedShotIndex(-1);
    setNewFeedback({ ...newFeedback, shotName: value });
  };

  // Handle show name input change with autocomplete
  const handleShowNameChange = (value: string) => {
    setShowNameInput(value);
    setShowShowDropdown(true);
    setNewFeedback({ ...newFeedback, showName: value });
  };

  // Select shot from dropdown
  const selectShotSuggestion = (suggestion: ShotSuggestion) => {
    setShotNameInput(suggestion.shotName);
    setShowNameInput(suggestion.showName);
    setNewFeedback({
      ...newFeedback,
      shotName: suggestion.shotName,
      showName: suggestion.showName,
    });
    setShowShotDropdown(false);
    setSelectedShotIndex(-1);
  };

  // Select show from dropdown
  const selectShowSuggestion = (showName: string) => {
    setShowNameInput(showName);
    setNewFeedback({ ...newFeedback, showName });
    setShowShowDropdown(false);
  };

  // Handle keyboard navigation in shot dropdown
  const handleShotKeyDown = (e: React.KeyboardEvent) => {
    if (!showShotDropdown || shotSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedShotIndex(prev => 
        prev < shotSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedShotIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedShotIndex >= 0) {
      e.preventDefault();
      selectShotSuggestion(shotSuggestions[selectedShotIndex]);
    } else if (e.key === 'Escape') {
      setShowShotDropdown(false);
      setSelectedShotIndex(-1);
    }
  };

  // Toggle shot selection for multi-select
  const toggleShotSelection = (shotName: string) => {
    const newSelected = new Set(selectedShots);
    if (newSelected.has(shotName)) {
      newSelected.delete(shotName);
    } else {
      newSelected.add(shotName);
    }
    setSelectedShots(newSelected);
  };

  // Get unique values for filters
  const uniqueShows = useMemo(() => {
    const shows = new Set(feedbacks.map(f => f.showName));
    return Array.from(shows).sort();
  }, [feedbacks]);

  const uniqueLeads = useMemo(() => {
    const leads = new Set(feedbacks.map(f => f.leadName).filter(Boolean));
    return Array.from(leads).sort() as string[];
  }, [feedbacks]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(feedbacks.map(f => f.department));
    return Array.from(depts).sort();
  }, [feedbacks]);

  const uniqueTags = useMemo(() => {
    const tags = new Set(feedbacks.map(f => f.shotTag));
    return Array.from(tags).sort();
  }, [feedbacks]);

  // Filter feedbacks
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(feedback => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          feedback.showName.toLowerCase().includes(query) ||
          matchesShotName(feedback.shotName, query) ||
          feedback.department.toLowerCase().includes(query) ||
          (feedback.leadName && feedback.leadName.toLowerCase().includes(query)) ||
          feedback.version.toLowerCase().includes(query) ||
          feedback.shotTag.toLowerCase().includes(query) ||
          feedback.status.toLowerCase().includes(query);
        
        if (!matchesSearch) return false;
      }

      // Show filter
      if (selectedShows.length > 0 && !selectedShows.includes(feedback.showName)) {
        return false;
      }

      // Lead filter
      if (selectedLeads.length > 0) {
        const hasUnassignedFilter = selectedLeads.includes('__UNASSIGNED__');
        const otherLeadNames = selectedLeads.filter(l => l !== '__UNASSIGNED__');
        
        // Check for unassigned match
        const matchesUnassigned = hasUnassignedFilter && !feedback.leadName;
        // Check for specific lead name match
        const matchesLeadName = otherLeadNames.length > 0 && feedback.leadName && otherLeadNames.includes(feedback.leadName);
        
        if (!matchesUnassigned && !matchesLeadName) {
          return false;
        }
      }

      // Department filter
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(feedback.department)) {
        return false;
      }

      // Tag filter
      if (selectedTags.length > 0 && !selectedTags.includes(feedback.shotTag)) {
        return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(feedback.status)) {
        return false;
      }

      // Date filter
      if (dateFrom) {
        const feedbackDate = new Date(feedback.feedbackDate);
        const fromDate = new Date(dateFrom);
        if (feedbackDate < fromDate) return false;
      }

      if (dateTo) {
        const feedbackDate = new Date(feedback.feedbackDate);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (feedbackDate > toDate) return false;
      }

      return true;
    });
  }, [feedbacks, searchQuery, selectedShows, selectedLeads, selectedDepartments, selectedTags, selectedStatuses, dateFrom, dateTo]);

  const handleExport = () => {
    if (filteredFeedbacks.length === 0) {
      showError('No feedbacks to export');
      return;
    }

    const exportData = filteredFeedbacks.map(f => ({
      'Show': f.showName,
      'Shot': f.shotName,
      'Tag': f.shotTag,
      'Version': f.version,
      'Department': f.department,
      'Lead': f.leadName || '',
      'Status': f.status,
      'Feedback Notes': f.feedbackNotes || '',
      'Feedback Date': formatDisplayDate(f.feedbackDate),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Feedbacks');

    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(exportData[0] || {}).map(key => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map(row => String(row[key as keyof typeof row] || '').length)
      );
      return { wch: Math.min(maxLen + 2, maxWidth) };
    });
    ws['!cols'] = colWidths;

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Feedback_Report_${timestamp}.xlsx`);
    showSuccess('Feedbacks exported successfully');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = showLoading('Importing feedbacks...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const feedbacksToImport = jsonData.map((row: any) => ({
        showName: row['Show']?.toString().trim() || '',
        shotName: row['Shot']?.toString().trim() || '',
        shotTag: row['Tag']?.toString().trim() || 'Fresh',
        version: row['Version']?.toString().trim() || '',
        department: row['Department']?.toString().trim() || '',
        status: row['Status']?.toString().trim() || 'C KB',
        feedbackNotes: row['Feedback Notes']?.toString().trim() || '',
        feedbackDate: row['Feedback Date'] || new Date().toISOString().split('T')[0],
      }));

      const response = await fetch('/api/feedbacks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbacks: feedbacksToImport }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      dismissToast(toastId);
      
      if (result.errors.length > 0) {
        showError(`Import completed with ${result.errors.length} errors. Check console for details.`);
        console.error('Import errors:', result.errors);
      } else {
        showSuccess(`Import successful! Created: ${result.created}, Updated: ${result.updated}`);
      }

      await loadFeedbacks();
    } catch (error: any) {
      dismissToast(toastId);
      console.error('Import error:', error);
      showError(error.message || 'Failed to import feedbacks');
    }

    e.target.value = '';
  };

  const handleAddFeedback = async () => {
    if (!newFeedback.showName || !newFeedback.shotName || !newFeedback.version || !newFeedback.department) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeedback),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add feedback');
      }

      showSuccess('Feedback added successfully');
      setShowAddModal(false);
      setNewFeedback({
        showName: '',
        shotName: '',
        shotTag: 'Fresh',
        version: '',
        department: '',
        status: 'C KB',
        feedbackNotes: '',
        feedbackDate: new Date().toISOString().split('T')[0],
        taskId: '',
      });
      setShotNameInput('');
      setShowNameInput('');
      setSelectedShots(new Set());
      setMultiSelectMode(false);
      await loadFeedbacks();
    } catch (error: any) {
      console.error('Error adding feedback:', error);
      showError(error.message || 'Failed to add feedback');
    }
  };

  const handleEdit = (feedback: Feedback) => {
    setEditingId(feedback.id);
    setEditingData({
      status: feedback.status,
      feedbackNotes: feedback.feedbackNotes,
      version: feedback.version,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const response = await fetch(`/api/feedbacks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update feedback');
      }

      showSuccess('Feedback updated successfully');
      setEditingId(null);
      setEditingData({});
      await loadFeedbacks();
    } catch (error: any) {
      console.error('Error updating feedback:', error);
      showError(error.message || 'Failed to update feedback');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      const response = await fetch(`/api/feedbacks/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete feedback');

      showSuccess('Feedback deleted successfully');
      await loadFeedbacks();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      showError('Failed to delete feedback');
    }
  };

  const clearAllFilters = () => {
    setSelectedShows([]);
    setSelectedLeads([]);
    setSelectedDepartments([]);
    setSelectedTags([]);
    setSelectedStatuses([]);
    setDateFrom('');
    setDateTo('');
  };

  const activeFiltersCount = 
    selectedShows.length + 
    selectedLeads.length + 
    selectedDepartments.length + 
    selectedTags.length + 
    selectedStatuses.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-200 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Client Feedback</h1>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add </span>Feedback
            </button>
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors touch-manipulation"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <label className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors cursor-pointer touch-manipulation">
              <Upload size={18} />
              <span className="hidden sm:inline">Import</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Search and Filter Bar - Mobile Optimized */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feedback..."
              className="w-full pl-10 pr-10 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 touch-manipulation"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 text-sm rounded-lg border transition-colors touch-manipulation ${
              showFilterPanel || activeFiltersCount > 0
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel - Mobile Optimized */}
        {showFilterPanel && (
          <div className="mt-4 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {/* Show Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Show</label>
                <select
                  multiple
                  value={selectedShows}
                  onChange={(e) => setSelectedShows(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  size={3}
                >
                  {uniqueShows.map(show => (
                    <option key={show} value={show}>{show}</option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  multiple
                  value={selectedDepartments}
                  onChange={(e) => setSelectedDepartments(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  size={3}
                >
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Lead Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead</label>
                <select
                  multiple
                  value={selectedLeads}
                  onChange={(e) => setSelectedLeads(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  size={4}
                >
                  <option value="__UNASSIGNED__" className="italic">Unassigned</option>
                  {uniqueLeads.map(lead => (
                    <option key={lead} value={lead}>{lead}</option>
                  ))}
                </select>
              </div>

              {/* Tag Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                <select
                  multiple
                  value={selectedTags}
                  onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  size={3}
                >
                  {uniqueTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  multiple
                  value={selectedStatuses}
                  onChange={(e) => setSelectedStatuses(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  size={3}
                >
                  <option value="C APP">C APP</option>
                  <option value="C KB">C KB</option>
                  <option value="AWF">AWF</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading feedbacks...</div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {feedbacks.length === 0 
                ? 'No feedbacks yet. Click "Add Feedback" to get started.' 
                : 'No feedbacks match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Show</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredFeedbacks.map((feedback) => (
                    <tr key={feedback.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{feedback.showName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{feedback.shotName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          feedback.shotTag === 'Fresh' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {feedback.shotTag}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === feedback.id ? (
                          <input
                            type="text"
                            value={editingData.version || ''}
                            onChange={(e) => setEditingData({ ...editingData, version: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="font-mono text-gray-900">{feedback.version}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{feedback.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{feedback.leadName || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === feedback.id ? (
                          <select
                            value={editingData.status || ''}
                            onChange={(e) => setEditingData({ ...editingData, status: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="C APP">C APP</option>
                            <option value="C KB">C KB</option>
                            <option value="AWF">AWF</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            feedback.status === 'C APP' 
                              ? 'bg-green-100 text-green-800'
                              : feedback.status === 'C KB'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {feedback.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingId === feedback.id ? (
                          <textarea
                            value={editingData.feedbackNotes || ''}
                            onChange={(e) => setEditingData({ ...editingData, feedbackNotes: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            rows={2}
                          />
                        ) : (
                          <span className="text-gray-700">{feedback.feedbackNotes || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDisplayDate(feedback.feedbackDate)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {editingId === feedback.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(feedback.id)}
                                className="text-green-600 hover:text-green-800"
                                title="Save"
                              >
                                <Save size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingData({});
                                }}
                                className="text-gray-600 hover:text-gray-800"
                                title="Cancel"
                              >
                                <X size={18} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(feedback)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(feedback.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredFeedbacks.length} of {feedbacks.length} feedbacks
        </div>
      </div>

      {/* Add Feedback Modal - Mobile Optimized */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Add Feedback</h2>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setShotNameInput('');
                    setShowNameInput('');
                    setShowShotDropdown(false);
                    setShowShowDropdown(false);
                  }} 
                  className="text-gray-400 hover:text-gray-600 active:text-gray-800 touch-manipulation p-2"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {/* Show Name with Autocomplete Dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Show Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={showNameInput}
                        onChange={(e) => handleShowNameChange(e.target.value)}
                        onFocus={() => setShowShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowShowDropdown(false), 200)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Type to search shows..."
                      />
                      <ChevronDown 
                        size={16} 
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                    </div>
                    {showShowDropdown && showSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {showSuggestions.map((show) => (
                          <button
                            key={show.id}
                            type="button"
                            onClick={() => selectShowSuggestion(show.showName)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{show.showName}</div>
                            {show.clientName && (
                              <div className="text-xs text-gray-500">{show.clientName}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shot Name with Autocomplete */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shot Name *</label>
                    <input
                      type="text"
                      value={shotNameInput}
                      onChange={(e) => handleShotNameChange(e.target.value)}
                      onKeyDown={handleShotKeyDown}
                      onFocus={() => shotNameInput && setShowShotDropdown(true)}
                      onBlur={() => setTimeout(() => setShowShotDropdown(false), 200)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Type to search shots..."
                    />
                    {showShotDropdown && shotSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {shotSuggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.shotName}-${suggestion.showId}`}
                            type="button"
                            onClick={() => selectShotSuggestion(suggestion)}
                            className={`w-full text-left px-3 py-2 border-b last:border-b-0 focus:outline-none ${
                              index === selectedShotIndex 
                                ? 'bg-blue-100' 
                                : 'hover:bg-blue-50'
                            }`}
                          >
                            <div className="font-medium text-gray-900">{suggestion.shotName}</div>
                            <div className="text-xs text-gray-500">{suggestion.showName}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tag *</label>
                    <select
                      value={newFeedback.shotTag}
                      onChange={(e) => setNewFeedback({ ...newFeedback, shotTag: e.target.value })}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    >
                      <option value="Fresh">Fresh</option>
                      <option value="Additional">Additional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Version *</label>
                    <input
                      type="text"
                      value={newFeedback.version}
                      onChange={(e) => setNewFeedback({ ...newFeedback, version: e.target.value })}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                      placeholder="e.g., v001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                    <input
                      type="text"
                      value={newFeedback.department}
                      onChange={(e) => setNewFeedback({ ...newFeedback, department: e.target.value })}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                      placeholder="e.g., Comp"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                    <select
                      value={newFeedback.status}
                      onChange={(e) => setNewFeedback({ ...newFeedback, status: e.target.value })}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    >
                      <option value="C KB">C KB</option>
                      <option value="AWF">AWF</option>
                      <option value="C APP">C APP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Date</label>
                    <input
                      type="date"
                      value={newFeedback.feedbackDate}
                      onChange={(e) => setNewFeedback({ ...newFeedback, feedbackDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Notes</label>
                  <textarea
                    value={newFeedback.feedbackNotes}
                    onChange={(e) => setNewFeedback({ ...newFeedback, feedbackNotes: e.target.value })}
                    className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    rows={4}
                    placeholder="Enter feedback details..."
                  />
                </div>

                {/* Multiple Shot Selection (Future Feature - Currently Disabled) */}
                {false && multiSelectMode && (
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Select Multiple Shots</label>
                      <button
                        type="button"
                        onClick={() => {
                          setMultiSelectMode(false);
                          setSelectedShots(new Set());
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear Selection
                      </button>
                    </div>
                    <div className="space-y-1">
                      {shots.slice(0, 20).map((shot) => {
                        const show = shows.find(s => s.id === shot.showId);
                        return (
                          <label
                            key={shot.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedShots.has(shot.shotName)}
                              onChange={() => toggleShotSelection(shot.shotName)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-900">{shot.shotName}</span>
                            <span className="text-xs text-gray-500">({show?.showName})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>Note:</strong> Lead name will be auto-detected based on the show, shot, tag, and department.
                  Status updates will sync across all views (Tracker, Department, Delivery, Dashboard).
                  {shotSuggestions.length > 0 && shotNameInput && (
                    <div className="mt-2">
                      <strong>Tip:</strong> Press ↑↓ arrows to navigate suggestions, Enter to select, Esc to close.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 md:gap-3 mt-6">
                <button
                  onClick={handleAddFeedback}
                  className="flex-1 px-4 py-2.5 md:py-2 bg-blue-600 text-white text-sm md:text-base rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium touch-manipulation"
                >
                  Add Feedback
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShotNameInput('');
                    setShowNameInput('');
                    setShowShotDropdown(false);
                    setShowShowDropdown(false);
                    setSelectedShots(new Set());
                    setMultiSelectMode(false);
                  }}
                  className="px-4 py-2.5 md:py-2 bg-gray-200 text-gray-700 text-sm md:text-base rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
