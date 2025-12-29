'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

// ============================================
// RESOURCE MEMBERS HOOKS
// ============================================

export function useResourceMembers(department?: string, shift?: string, isActive = true) {
  return useQuery({
    queryKey: ['resourceMembers', department, shift, isActive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (department && department !== 'all') params.set('department', department);
      if (shift && shift !== 'all') params.set('shift', shift);
      params.set('isActive', String(isActive));
      
      const res = await fetch(`/api/resource/members?${params}`);
      if (!res.ok) throw new Error('Failed to fetch members');
      const allMembers = await res.json();
      
      // Filter to show only Artists in Resource Forecast (exclude Leads, Supervisors, Production)
      const artistsOnly = allMembers.filter((member: any) => member.employeeType === 'Artist');
      return artistsOnly;
    },
    staleTime: 30 * 1000, // 30 seconds - quick refresh for updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useAddResourceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberData: any) => {
      const res = await fetch('/api/resource/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData),
      });
      if (!res.ok) throw new Error('Failed to add member');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Member added successfully');
      // Invalidate ALL resourceMembers queries (all variations)
      queryClient.invalidateQueries({ queryKey: ['resourceMembers'] });
      queryClient.invalidateQueries({ queryKey: ['resourceForecast'] });
    },
    onError: () => {
      toast.error('Failed to add member');
    },
  });
}

export function useUpdateResourceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/resource/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update member');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Member updated successfully');
      // Invalidate ALL resourceMembers queries immediately
      queryClient.invalidateQueries({ queryKey: ['resourceMembers'] });
      queryClient.invalidateQueries({ queryKey: ['resourceForecast'] });
      // Force refetch
      queryClient.refetchQueries({ queryKey: ['resourceMembers'] });
    },
    onError: () => {
      toast.error('Failed to update member');
    },
  });
}

// ============================================
// RESOURCE ALLOCATIONS HOOKS
// ============================================

export function useResourceAllocations(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['resourceAllocations', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const res = await fetch(`/api/resource/allocations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch allocations');
      return res.json();
    },
  });
}

export function useAddAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (allocationData: any) => {
      const res = await fetch('/api/resource/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocationData),
      });
      if (!res.ok) throw new Error('Failed to add allocation');
      return res.json();
    },
    onMutate: async (newAllocation) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ['resourceAllocations'] });

      // Snapshot
      const previousAllocations = queryClient.getQueryData(['resourceAllocations']);

      // Optimistic update - add to all allocation queries
      queryClient.setQueriesData(
        { queryKey: ['resourceAllocations'] },
        (old: any) => {
          return old ? [...old, { ...newAllocation, id: 'temp-' + Date.now() }] : [newAllocation];
        }
      );

      return { previousAllocations };
    },
    onError: (err, newAllocation, context: any) => {
      queryClient.setQueryData(['resourceAllocations'], context.previousAllocations);
      toast.error('Failed to add allocation');
    },
    onSuccess: () => {
      toast.success('Allocation added');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
    },
  });
}

export function useUpdateAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/resource/allocations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update allocation');
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['resourceAllocations'] });
      
      const previousAllocations = queryClient.getQueryData(['resourceAllocations']);

      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: ['resourceAllocations'] },
        (old: any) => {
          if (!old) return old;
          return old.map((alloc: any) =>
            alloc.id === id ? { ...alloc, ...data } : alloc
          );
        }
      );

      return { previousAllocations };
    },
    onError: (err, variables, context: any) => {
      queryClient.setQueryData(['resourceAllocations'], context.previousAllocations);
      toast.error('Failed to update allocation');
    },
    onSuccess: () => {
      toast.success('Allocation updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
    },
  });
}

export function useDeleteAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resource/allocations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete allocation');
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['resourceAllocations'] });
      
      const previousAllocations = queryClient.getQueryData(['resourceAllocations']);

      // Optimistic removal
      queryClient.setQueriesData(
        { queryKey: ['resourceAllocations'] },
        (old: any) => {
          if (!old) return old;
          return old.filter((alloc: any) => alloc.id !== id);
        }
      );

      return { previousAllocations };
    },
    onError: (err, id, context: any) => {
      queryClient.setQueryData(['resourceAllocations'], context.previousAllocations);
      toast.error('Failed to delete allocation');
    },
    onSuccess: () => {
      toast.success('Allocation deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
    },
  });
}

// ============================================
// AWARD SHEET HOOKS
// ============================================

export function useAwardSheets(showName?: string, limit = 50, skip = 0) {
  return useQuery({
    queryKey: ['awardSheets', showName, limit, skip],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showName) params.set('showName', showName);
      params.set('limit', limit.toString());
      params.set('skip', skip.toString());
      
      const res = await fetch(`/api/award-sheet?${params}`);
      if (!res.ok) throw new Error('Failed to fetch award sheets');
      return res.json();
    },
  });
}

export function useAddAwardSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sheetData: any) => {
      const res = await fetch('/api/award-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add award sheet');
      }
      return res.json();
    },
    onMutate: async (newSheet) => {
      await queryClient.cancelQueries({ queryKey: ['awardSheets'] });
      
      const previousSheets = queryClient.getQueryData(['awardSheets']);

      // Optimistic add
      queryClient.setQueriesData(
        { queryKey: ['awardSheets'] },
        (old: any) => {
          if (!old) return { shots: [newSheet], total: 1, hasMore: false };
          return {
            ...old,
            shots: [{ ...newSheet, id: 'temp-' + Date.now() }, ...old.shots],
            total: old.total + 1,
          };
        }
      );

      return { previousSheets };
    },
    onError: (err: any, newSheet, context: any) => {
      queryClient.setQueryData(['awardSheets'], context.previousSheets);
      toast.error(err.message || 'Failed to add shot');
    },
    onSuccess: () => {
      toast.success('Shot added successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['awardSheets'] });
    },
  });
}

// ============================================
// SHOWS HOOKS
// ============================================

export function useShows() {
  return useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      const res = await fetch('/api/shows');
      if (!res.ok) throw new Error('Failed to fetch shows');
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (shows don't change often)
    refetchOnWindowFocus: false,
  });
}

// ============================================
// COMBINED RESOURCE FORECAST HOOK
// ============================================

export function useResourceForecast(params: {
  department?: string;
  shift?: string;
  startDate: string;
  endDate: string;
}) {
  const { department, shift, startDate, endDate } = params;
  
  // Fetch members and allocations in parallel
  const membersQuery = useResourceMembers(department, shift, true);
  const allocationsQuery = useResourceAllocations(startDate, endDate);

  return {
    members: membersQuery.data || [],
    allocations: allocationsQuery.data || [],
    isLoading: membersQuery.isLoading || allocationsQuery.isLoading,
    error: membersQuery.error || allocationsQuery.error,
    refetch: () => {
      membersQuery.refetch();
      allocationsQuery.refetch();
    },
  };
}

// ============================================
// BULK ALLOCATION OPERATIONS
// ============================================

export function useBulkAddAllocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (allocations: any[]) => {
      const results = await Promise.all(
        allocations.map(alloc =>
          fetch('/api/resource/allocations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alloc),
          }).then(r => r.json())
        )
      );
      return results;
    },
    onMutate: async (newAllocations) => {
      await queryClient.cancelQueries({ queryKey: ['resourceAllocations'] });
      const previous = queryClient.getQueryData(['resourceAllocations']);

      queryClient.setQueriesData(
        { queryKey: ['resourceAllocations'] },
        (old: any) => [...(old || []), ...newAllocations]
      );

      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(['resourceAllocations'], context.previous);
      toast.error('Bulk operation failed');
    },
    onSuccess: (data) => {
      toast.success(`Added ${data.length} allocations`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
    },
  });
}

export function useBulkUpdateAllocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; data: any }[]) => {
      const results = await Promise.all(
        updates.map(({ id, data }) =>
          fetch(`/api/resource/allocations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }).then(r => r.json())
        )
      );
      return results;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['resourceAllocations'] });
      const previous = queryClient.getQueryData(['resourceAllocations']);

      queryClient.setQueriesData(
        { queryKey: ['resourceAllocations'] },
        (old: any) => {
          if (!old) return old;
          return old.map((alloc: any) => {
            const update = updates.find(u => u.id === alloc.id);
            return update ? { ...alloc, ...update.data } : alloc;
          });
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(['resourceAllocations'], context.previous);
      toast.error('Bulk update failed');
    },
    onSuccess: (data) => {
      toast.success(`Updated ${data.length} allocations`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
    },
  });
}
