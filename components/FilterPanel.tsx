'use client';

import { useVFXStore } from '@/lib/store';
import { getUniqueLeads, getUniqueEpisodes, getUniqueSequences, getUniqueTurnovers, formatDate } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks';
import { Filter, X, Search, List, CheckSquare, EyeOff } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface FilterPanelProps {
  detailedView: boolean;
  setDetailedView: (value: boolean) => void;
  hiddenColumns: Set<string>;
  setHiddenColumns: (value: Set<string>) => void;
  showUnhideModal: boolean;
  setShowUnhideModal: (value: boolean) => void;
}

export default function FilterPanel({ 
  detailedView, 
  setDetailedView,
  hiddenColumns,
  setHiddenColumns,
  showUnhideModal,
  setShowUnhideModal
}: FilterPanelProps) {
  const { data: session } = useSession();
  const { shows, filters, setFilters, resetFilters, statusOptions, selectionMode, toggleSelectionMode, savePreferences } = useVFXStore();
  const [isOpen, setIsOpen] = useState(false);
  const [shotSearchInput, setShotSearchInput] = useState('');
  const [showFilterListModal, setShowFilterListModal] = useState(false);
  const [filterListText, setFilterListText] = useState('');
  
  // Toggle column visibility
  const toggleColumnVisibility = (columnKey: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setHiddenColumns(newHidden);
  };
  
  // Check if user has edit permission
  const hasEditPermission = useMemo(() => {
    if (!session?.user) return false;
    const role = (session.user as any).role;
    // Admin, Coordinator, Production Coordinator, or any role with COORDINATOR in name has full edit access
    if (role === 'ADMIN' || 
        role === 'COORDINATOR' || 
        role === 'PRODUCTION COORDINATOR' ||
        role?.toUpperCase().includes('COORDINATOR')) {
      return true;
    }
    // Check if user has edit permission on any show
    return shows.some(show => show.canEdit === true);
  }, [session, shows]);
  
  // Debounce shot search input
  const debouncedShotSearch = useDebounce(shotSearchInput, 300);

  // Save preferences when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      savePreferences();
    }, 1000); // Debounce save by 1 second

    return () => clearTimeout(timer);
  }, [filters, savePreferences]);

  // Get unique leads from all shows
  const uniqueLeads = useMemo(() => getUniqueLeads(shows), [shows]);

  // Get unique episodes from all shows
  const uniqueEpisodes = useMemo(() => getUniqueEpisodes(shows), [shows]);

  // Get unique sequences from all shows
  const uniqueSequences = useMemo(() => getUniqueSequences(shows), [shows]);

  // Get unique turnovers from all shows
  const uniqueTurnovers = useMemo(() => getUniqueTurnovers(shows), [shows]);

  // Apply debounced search
  useEffect(() => {
    if (!debouncedShotSearch.trim()) {
      setFilters({ shotNames: [] });
      return;
    }
    const shotNames = debouncedShotSearch.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setFilters({ shotNames });
  }, [debouncedShotSearch, setFilters]);

  // Keyboard shortcut for Unhide (Ctrl+U)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'u' && hiddenColumns.size > 0) {
        e.preventDefault();
        setShowUnhideModal(true);
      }
      // Ctrl+Q for Filter List
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        setShowFilterListModal(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hiddenColumns, setShowUnhideModal]);

  const hasActiveFilters = 
    (filters?.showIds?.length ?? 0) > 0 ||
    (filters?.departments?.length ?? 0) > 0 ||
    (filters?.statuses?.length ?? 0) > 0 ||
    (filters?.leadNames?.length ?? 0) > 0 ||
    filters?.shotTag !== null ||
    (filters?.episodes?.length ?? 0) > 0 ||
    (filters?.sequences?.length ?? 0) > 0 ||
    (filters?.turnovers?.length ?? 0) > 0 ||
    filters?.dateRange?.from !== null ||
    filters?.dateRange?.to !== null;

  const hasActiveFilterList = (filters?.shotNames?.length ?? 0) > 0;

  // Clear only regular filters (not shot names filter list)
  const handleClearFilters = () => {
    setFilters({ 
      showIds: [],
      departments: [],
      statuses: [],
      leadNames: [],
      shotTag: null,
      episodes: [],
      sequences: [],
      turnovers: [],
      dateRange: { from: null, to: null }
    });
  };

  // Clear only shot names filter list
  const handleClearFilterListOnly = () => {
    setFilterListText('');
    setFilters({ shotNames: [] });
  };

  const handleShotSearch = () => {
    if (!shotSearchInput.trim()) {
      setFilters({ shotNames: [] });
      return;
    }
    // Split by comma and trim whitespace
    const shotNames = shotSearchInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setFilters({ shotNames });
  };
  
  const handleFilterListSubmit = () => {
    if (!filterListText.trim()) {
      setFilters({ shotNames: [] });
      setShowFilterListModal(false);
      return;
    }
    
    // Split by newlines, commas, or both - handle various paste formats
    const shotNames = filterListText
      .split(/[\n,]+/) // Split by newlines or commas
      .map(s => s.trim()) // Trim whitespace
      .filter(s => s.length > 0); // Remove empty entries
    
    setFilters({ shotNames });
    setShowFilterListModal(false);
  };
  
  const handleClearFilterList = () => {
    setFilterListText('');
    setFilters({ shotNames: [] });
    setShowFilterListModal(false);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter size={18} />
          Filters
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </button>

        {/* Clear Filters Button - Show when filters are active */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            title="Clear all filters (except shot list)"
          >
            <X size={16} />
            Clear Filters
          </button>
        )}
        
        {/* Filter List Button */}
        <button
          onClick={() => setShowFilterListModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <List size={18} />
          Filter List
          {hasActiveFilterList && (
            <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
              {filters.shotNames.length}
            </span>
          )}
        </button>

        {/* Clear Filter List Button - Show when filter list is active */}
        {hasActiveFilterList && (
          <button
            onClick={handleClearFilterListOnly}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            title="Clear shot filter list only"
          >
            <X size={16} />
            Clear List
          </button>
        )}

        {/* Selection Mode Toggle - Only show for users with edit permission */}
        {hasEditPermission && (
          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              selectionMode
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <CheckSquare size={18} />
            {selectionMode ? 'Selection Mode ON' : 'Enable Selection'}
          </button>
        )}

        {/* Detailed View Toggle */}
        <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={detailedView}
            onChange={(e) => setDetailedView(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-700">Detailed View</span>
        </label>

        {/* Unhide Columns Button */}
        {hiddenColumns.size > 0 && (
          <button
            onClick={() => setShowUnhideModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
            title="Show hidden columns"
          >
            <EyeOff size={16} />
            Unhide ({hiddenColumns.size})
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Filter Options</h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <X size={12} />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Show Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Show
              </label>
              <select
                multiple
                value={filters?.showIds ?? []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ showIds: selected });
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                size={3}
              >
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.showName}
                  </option>
                ))}
              </select>
            </div>

            {/* Shot Name Search - Multi-shot */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Shot Names
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={shotSearchInput}
                  onChange={(e) => setShotSearchInput(e.target.value)}
                  placeholder="Shot_001, Shot_005"
                  className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                />
                <Search size={12} className="absolute right-2 top-2 text-gray-400" />
              </div>
            </div>

            {/* Status Filter - Multi-select */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {statusOptions.map((status) => (
                  <label key={status.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={(filters?.statuses ?? []).includes(status.statusName)}
                      onChange={(e) => {
                        const currentStatuses = filters?.statuses ?? [];
                        if (e.target.checked) {
                          setFilters({ statuses: [...currentStatuses, status.statusName] });
                        } else {
                          setFilters({ statuses: currentStatuses.filter(s => s !== status.statusName) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{status.statusName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Lead Name Filter - Multi-select */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Lead Names
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {/* Unassigned option - always show first */}
                <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={(filters?.leadNames ?? []).includes('__UNASSIGNED__')}
                    onChange={(e) => {
                      const currentLeadNames = filters?.leadNames ?? [];
                      if (e.target.checked) {
                        setFilters({ leadNames: [...currentLeadNames, '__UNASSIGNED__'] });
                      } else {
                        setFilters({ leadNames: currentLeadNames.filter(l => l !== '__UNASSIGNED__') });
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                  />
                  <span className="text-xs text-gray-700 italic">Unassigned</span>
                </label>
                {uniqueLeads.length > 0 ? (
                  uniqueLeads.map((lead) => (
                    <label key={lead} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={(filters?.leadNames ?? []).includes(lead)}
                        onChange={(e) => {
                          const currentLeadNames = filters?.leadNames ?? [];
                          if (e.target.checked) {
                            setFilters({ leadNames: [...currentLeadNames, lead] });
                          } else {
                            setFilters({ leadNames: currentLeadNames.filter(l => l !== lead) });
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                      />
                      <span className="text-xs text-gray-700">{lead}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 p-1">No leads</p>
                )}
              </div>
            </div>
            {/* Department Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Department
              </label>
              <div className="space-y-1">
                {['Comp', 'Paint', 'Roto', 'MMRA'].map((dept) => (
                  <label key={dept} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={(filters?.departments ?? []).includes(dept)}
                      onChange={(e) => {
                        const currentDepartments = filters?.departments ?? [];
                        if (e.target.checked) {
                          setFilters({ departments: [...currentDepartments, dept] });
                        } else {
                          setFilters({ departments: currentDepartments.filter(d => d !== dept) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{dept}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shot Tag Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Shot Tag
              </label>
              <div className="space-y-1">
                {['Fresh', 'Additional'].map((tag) => (
                  <label key={tag} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="radio"
                      name="shotTag"
                      checked={(filters?.shotTag ?? null) === tag}
                      onChange={() => setFilters({ shotTag: tag })}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{tag}</span>
                  </label>
                ))}
                <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="radio"
                    name="shotTag"
                    checked={(filters?.shotTag ?? null) === null}
                    onChange={() => setFilters({ shotTag: null })}
                    className="border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                  />
                  <span className="text-xs text-gray-700">All</span>
                </label>
              </div>
            </div>

            {/* Turnover Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Turnover (TO)
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {uniqueTurnovers.length > 0 ? (
                  uniqueTurnovers.map((turnover) => (
                    <label key={turnover} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={(filters?.turnovers ?? []).includes(turnover)}
                        onChange={(e) => {
                          const currentTurnovers = filters?.turnovers ?? [];
                          const newTurnovers = e.target.checked
                            ? [...currentTurnovers, turnover]
                            : currentTurnovers.filter(t => t !== turnover);
                          setFilters({ turnovers: newTurnovers });
                        }}
                        className="border-gray-300 text-blue-600 focus:ring-blue-500 rounded w-3 h-3"
                      />
                      <span className="text-xs text-gray-700">{turnover}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 p-1">No turnovers</p>
                )}
              </div>
            </div>

            {/* Episode Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Episode (EP)
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {uniqueEpisodes.length > 0 ? (
                  uniqueEpisodes.map((episode) => (
                    <label key={episode} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={(filters?.episodes ?? []).includes(episode)}
                        onChange={(e) => {
                          const currentEpisodes = filters?.episodes ?? [];
                          const newEpisodes = e.target.checked
                            ? [...currentEpisodes, episode]
                            : currentEpisodes.filter(ep => ep !== episode);
                          setFilters({ episodes: newEpisodes });
                        }}
                        className="border-gray-300 text-blue-600 focus:ring-blue-500 rounded w-3 h-3"
                      />
                      <span className="text-xs text-gray-700">{episode}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 p-1">No episodes</p>
                )}
              </div>
            </div>

            {/* Sequence Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Sequence (SEQ)
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {uniqueSequences.length > 0 ? (
                  uniqueSequences.map((sequence) => (
                    <label key={sequence} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={(filters?.sequences ?? []).includes(sequence)}
                        onChange={(e) => {
                          const currentSequences = filters?.sequences ?? [];
                          const newSequences = e.target.checked
                            ? [...currentSequences, sequence]
                            : currentSequences.filter(s => s !== sequence);
                          setFilters({ sequences: newSequences });
                        }}
                        className="border-gray-300 text-blue-600 focus:ring-blue-500 rounded w-3 h-3"
                      />
                      <span className="text-xs text-gray-700">{sequence}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">No sequences available</p>
                )}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date Range (ETA)
              </label>
              <div className="space-y-1.5">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">From</label>
                  <input
                    type="date"
                    value={formatDate(filters?.dateRange?.from)}
                    onChange={(e) => setFilters({ 
                      dateRange: { 
                        ...(filters?.dateRange ?? { from: null, to: null }), 
                        from: e.target.value || null 
                      } 
                    })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">To</label>
                  <input
                    type="date"
                    value={formatDate(filters?.dateRange?.to)}
                    onChange={(e) => setFilters({ 
                      dateRange: { 
                        ...(filters?.dateRange ?? { from: null, to: null }), 
                        to: e.target.value || null 
                      } 
                    })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filter List Modal */}
      {showFilterListModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFilterListModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Filter by Shot List</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Paste shot names (one per line or comma-separated)
                </p>
              </div>
              <button
                onClick={() => setShowFilterListModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-5">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shot Names
                  {(filters?.shotNames?.length ?? 0) > 0 && (
                    <span className="ml-2 text-sm text-green-600 font-semibold">
                      ({filters.shotNames.length} shots active)
                    </span>
                  )}
                </label>
                <textarea
                  value={filterListText}
                  onChange={(e) => setFilterListText(e.target.value)}
                  placeholder="Paste shot names here...&#10;Example:&#10;ABC_0010&#10;ABC_0020&#10;ABC_0030"
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === 'Enter') {
                      handleFilterListSubmit();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 Tip: Paste from Excel or CSV. Press Ctrl+Enter to apply filter.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClearFilterList}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear & Close
                </button>
                <button
                  onClick={handleFilterListSubmit}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unhide Columns Modal */}
      {showUnhideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Hidden Columns</h3>
              <button
                onClick={() => setShowUnhideModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2">
              {Array.from(hiddenColumns).map(col => (
                <label key={col} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={() => toggleColumnVisibility(col)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 uppercase font-medium">{col}</span>
                </label>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowUnhideModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setHiddenColumns(new Set());
                  setShowUnhideModal(false);
                }}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Unhide All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
