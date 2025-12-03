'use client';

import { useState, useEffect } from 'react';
import { useVFXStore } from '@/lib/store';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileFilterDrawer({ isOpen, onClose }: MobileFilterDrawerProps) {
  const { shows, filters, setFilters } = useVFXStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['shows']));
  
  // Extract unique values for filters
  const allShows = shows.map(s => s.showName);
  const allEpisodes = [...new Set(shows.flatMap(s => (s.shots || []).map(shot => shot.episode)).filter(Boolean))].sort();
  const allSequences = [...new Set(shows.flatMap(s => (s.shots || []).map(shot => shot.sequence)).filter(Boolean))].sort();
  const allTurnovers = [...new Set(shows.flatMap(s => (s.shots || []).map(shot => shot.turnover)).filter(Boolean))].sort();
  const allDepartments = [...new Set(shows.flatMap(s => {
    try {
      const depts = s.departments ? JSON.parse(s.departments) : [];
      return Array.isArray(depts) ? depts : [];
    } catch {
      return [];
    }
  }))].sort();
  const allStatuses = ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB', 'OMIT', 'HOLD'];
  const allLeads = [...new Set(
    shows.flatMap(s => (s.shots || [])
      .flatMap(shot => (shot.tasks || [])
        .map(task => task.leadName)
        .filter(Boolean)
      )
    )
  )].sort();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleFilter = (key: keyof typeof filters, value: string) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    setFilters({ ...filters, [key]: newValues });
  };

  const clearAllFilters = () => {
    setFilters({
      showIds: [],
      episodes: [],
      sequences: [],
      turnovers: [],
      statuses: [],
      leadNames: [],
      departments: [],
      shotNames: [],
      shotTag: null,
      dateRange: { from: null, to: null },
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.showIds?.length) count += filters.showIds.length;
    if (filters.episodes?.length) count += filters.episodes.length;
    if (filters.sequences?.length) count += filters.sequences.length;
    if (filters.turnovers?.length) count += filters.turnovers.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.leadNames?.length) count += filters.leadNames.length;
    if (filters.departments?.length) count += filters.departments.length;
    if (filters.dateRange?.from || filters.dateRange?.to) count += 1;
    return count;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col md:hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            {getActiveFilterCount() > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                {getActiveFilterCount()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 font-medium px-3 py-1 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Shows Filter */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('shows')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Shows</span>
                {filters.showIds && filters.showIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {filters.showIds.length}
                  </span>
                )}
              </div>
              {expandedSections.has('shows') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('shows') && (
              <div className="px-3 pb-3 space-y-2 max-h-40 overflow-y-auto">
                {shows.map((show) => (
                  <label key={show.id} className="flex items-center gap-2 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.showIds?.includes(show.id)}
                      onChange={() => toggleFilter('showIds', show.id)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{show.showName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Episodes Filter */}
          {allEpisodes.length > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('episodes')}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Episodes</span>
                  {filters.episodes && filters.episodes.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {filters.episodes.length}
                    </span>
                  )}
                </div>
                {expandedSections.has('episodes') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.has('episodes') && (
                <div className="px-3 pb-3 space-y-2 max-h-40 overflow-y-auto">
                  {allEpisodes.map((ep) => (
                    <label key={ep} className="flex items-center gap-2 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.episodes?.includes(ep as string)}
                        onChange={() => toggleFilter('episodes', ep as string)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{ep}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Departments Filter */}
          {allDepartments.length > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('departments')}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Departments</span>
                  {filters.departments && filters.departments.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {filters.departments.length}
                    </span>
                  )}
                </div>
                {expandedSections.has('departments') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.has('departments') && (
                <div className="px-3 pb-3 space-y-2 max-h-40 overflow-y-auto">
                  {allDepartments.map((dept) => (
                    <label key={dept} className="flex items-center gap-2 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.departments?.includes(dept)}
                        onChange={() => toggleFilter('departments', dept)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{dept}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Filter */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('statuses')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Status</span>
                {filters.statuses && filters.statuses.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {filters.statuses.length}
                  </span>
                )}
              </div>
              {expandedSections.has('statuses') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('statuses') && (
              <div className="px-3 pb-3 space-y-2">
                {allStatuses.map((status) => (
                  <label key={status} className="flex items-center gap-2 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.statuses?.includes(status)}
                      onChange={() => toggleFilter('statuses', status)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{status}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Lead Name Filter */}
          {allLeads.length > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('leads')}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Lead Artists</span>
                  {filters.leadNames && filters.leadNames.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {filters.leadNames.length}
                    </span>
                  )}
                </div>
                {expandedSections.has('leads') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.has('leads') && (
                <div className="px-3 pb-3 space-y-2 max-h-40 overflow-y-auto">
                  {allLeads.map((lead) => (
                    <label key={lead} className="flex items-center gap-2 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.leadNames?.includes(lead as string)}
                        onChange={() => toggleFilter('leadNames', lead as string)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{lead}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-white sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:scale-98 transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
