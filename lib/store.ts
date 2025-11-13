import { create } from 'zustand';
import { Show, Shot, Task, StatusOption, Department, TrackerFilters } from './types';
import { fetchWithCache, cacheKeys, cacheConfigs, invalidateEntityCache } from './cache';

interface UserPreferences {
  tableColumns: string[];
  filterState: TrackerFilters;
  sortState: { field: string; direction: 'asc' | 'desc' } | null;
  theme: string;
}

interface VFXStore {
  // Data
  shows: Show[];
  shots: Shot[];
  tasks: Task[];
  statusOptions: StatusOption[];
  departments: Department[];
  
  // Filters
  filters: TrackerFilters;
  
  // User preferences
  preferences: UserPreferences | null;
  
  // Selection state for bulk operations
  selectionMode: boolean;
  selectedShotIds: Set<string>;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Pagination state
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  
  // Actions
  setShows: (shows: Show[]) => void;
  setShots: (shots: Shot[]) => void;
  setTasks: (tasks: Task[]) => void;
  setStatusOptions: (statusOptions: StatusOption[]) => void;
  setDepartments: (departments: Department[]) => void;
  setFilters: (filters: Partial<TrackerFilters>) => void;
  resetFilters: () => void;
  setPreferences: (preferences: UserPreferences) => void;
  savePreferences: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  // Selection actions
  toggleSelectionMode: () => void;
  toggleShotSelection: (shotId: string) => void;
  selectAllShots: (shotIds: string[]) => void;
  clearSelection: () => void;
  
  // Fetch data
  fetchAllData: () => Promise<void>;
  fetchShows: (forceRefresh?: boolean) => Promise<void>;
  fetchShots: (forceRefresh?: boolean, page?: number, limit?: number) => Promise<void>;
  fetchTasks: (forceRefresh?: boolean) => Promise<void>;
  fetchStatusOptions: (forceRefresh?: boolean) => Promise<void>;
  fetchDepartments: (forceRefresh?: boolean) => Promise<void>;
  
  // Cache invalidation
  invalidateCache: (entityType: 'show' | 'shot' | 'task', entityId?: string) => void;
}

const initialFilters: TrackerFilters = {
  showIds: [],
  departments: [],
  statuses: [],
  leadNames: [],
  shotTag: null,
  shotNames: [],
  episodes: [],
  sequences: [],
  turnovers: [],
  dateRange: {
    from: null,
    to: null,
  },
};

export const useVFXStore = create<VFXStore>((set, get) => ({
  // Initial state
  shows: [],
  shots: [],
  tasks: [],
  statusOptions: [],
  departments: [],
  filters: initialFilters,
  preferences: null,
  selectionMode: false,
  selectedShotIds: new Set<string>(),
  loading: false,
  error: null,
  currentPage: 1,
  pageSize: 50,
  totalPages: 0,
  totalItems: 0,

  // Setters
  setShows: (shows) => set({ shows }),
  setShots: (shots) => set({ shots }),
  setTasks: (tasks) => set({ tasks }),
  setStatusOptions: (statusOptions) => set({ statusOptions }),
  setDepartments: (departments) => set({ departments }),
  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => set({ filters: initialFilters }),
  setPreferences: (preferences) => set({ preferences }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  // Pagination setters
  setPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),

  // Selection actions
  toggleSelectionMode: () => set((state) => ({ 
    selectionMode: !state.selectionMode,
    selectedShotIds: new Set<string>() // Clear selection when toggling mode
  })),
  
  toggleShotSelection: (shotId) => set((state) => {
    const newSelection = new Set(state.selectedShotIds);
    if (newSelection.has(shotId)) {
      newSelection.delete(shotId);
    } else {
      newSelection.add(shotId);
    }
    return { selectedShotIds: newSelection };
  }),
  
  selectAllShots: (shotIds) => set({ selectedShotIds: new Set(shotIds) }),
  
  clearSelection: () => set({ selectedShotIds: new Set<string>() }),
  
  // Cache invalidation
  invalidateCache: (entityType, entityId) => {
    invalidateEntityCache(entityType, entityId);
  },

  // Fetch functions with caching
  fetchAllData: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchShows(),
        get().fetchShots(),
        get().fetchTasks(),
        get().fetchStatusOptions(),
        get().fetchDepartments(),
      ]);
    } catch (error) {
      set({ error: 'Failed to fetch data' });
      console.error('Error fetching all data:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchShows: async (forceRefresh = false) => {
    try {
      const shows = await fetchWithCache(
        cacheKeys.shows(),
        async () => {
          const response = await fetch('/api/shows');
          if (!response.ok) throw new Error('Failed to fetch shows');
          return response.json();
        },
        { ...cacheConfigs.standard, forceRefresh }
      );
      set({ shows });
    } catch (error) {
      console.error('Error fetching shows:', error);
      throw error;
    }
  },

  fetchShots: async (forceRefresh = false, page?: number, limit?: number) => {
    try {
      const currentPage = page || get().currentPage;
      const currentLimit = limit || get().pageSize;
      
      const result = await fetchWithCache(
        cacheKeys.shots(undefined, currentPage, currentLimit),
        async () => {
          const url = new URL('/api/shots', window.location.origin);
          url.searchParams.set('page', currentPage.toString());
          url.searchParams.set('limit', currentLimit.toString());
          
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch shots');
          return response.json();
        },
        { ...cacheConfigs.realtime, forceRefresh }
      );
      
      // Handle paginated response
      if (result.pagination) {
        set({ 
          shots: result.data,
          currentPage: result.pagination.currentPage,
          totalPages: result.pagination.totalPages,
          totalItems: result.pagination.totalItems,
        });
      } else {
        // Fallback for non-paginated response
        set({ shots: result });
      }
    } catch (error) {
      console.error('Error fetching shots:', error);
      throw error;
    }
  },

  fetchTasks: async (forceRefresh = false) => {
    try {
      const tasks = await fetchWithCache(
        cacheKeys.tasks(),
        async () => {
          const response = await fetch('/api/tasks');
          if (!response.ok) throw new Error('Failed to fetch tasks');
          return response.json();
        },
        { ...cacheConfigs.realtime, forceRefresh }
      );
      set({ tasks });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  fetchStatusOptions: async (forceRefresh = false) => {
    try {
      const statusOptions = await fetchWithCache(
        cacheKeys.statusOptions(),
        async () => {
          const response = await fetch('/api/status-options');
          if (!response.ok) throw new Error('Failed to fetch status options');
          return response.json();
        },
        { ...cacheConfigs.longLived, forceRefresh }
      );
      set({ statusOptions });
    } catch (error) {
      console.error('Error fetching status options:', error);
      throw error;
    }
  },

  fetchDepartments: async (forceRefresh = false) => {
    try {
      const departments = await fetchWithCache(
        cacheKeys.departments(),
        async () => {
          const response = await fetch('/api/departments');
          if (!response.ok) throw new Error('Failed to fetch departments');
          return response.json();
        },
        { ...cacheConfigs.longLived, forceRefresh }
      );
      set({ departments });
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
  },

  // User preferences
  loadPreferences: async () => {
    try {
      const response = await fetch('/api/preferences');
      if (!response.ok) return; // No preferences yet
      
      const data = await response.json();
      const preferences: UserPreferences = {
        tableColumns: data.tableColumns ? JSON.parse(data.tableColumns) : [],
        filterState: data.filterState ? JSON.parse(data.filterState) : initialFilters,
        sortState: data.sortState ? JSON.parse(data.sortState) : null,
        theme: data.theme || 'light',
      };
      
      set({ preferences, filters: preferences.filterState });
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  },

  savePreferences: async () => {
    try {
      const state = get();
      const preferences = {
        tableColumns: state.preferences?.tableColumns || [],
        filterState: state.filters,
        sortState: state.preferences?.sortState || null,
        theme: state.preferences?.theme || 'light',
      };

      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) throw new Error('Failed to save preferences');
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  },
}));

// Export as useStore for convenience
export const useStore = useVFXStore;
