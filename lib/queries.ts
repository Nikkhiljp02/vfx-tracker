// Optimized React Query hooks for VFX Tracker
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from './toast';

// Query keys for cache management
export const queryKeys = {
  shows: ['shows'],
  shots: (showId?: string) => ['shots', showId].filter(Boolean),
  tasks: (shotId?: string) => ['tasks', shotId].filter(Boolean),
  feedbacks: ['feedbacks'],
  statusOptions: ['statusOptions'],
  departments: ['departments'],
  activityLogs: (params?: any) => ['activityLogs', params].filter(Boolean),
};

// Hook for fetching shows
export function useShows() {
  return useQuery({
    queryKey: queryKeys.shows,
    queryFn: async () => {
      const res = await fetch('/api/shows');
      if (!res.ok) throw new Error('Failed to fetch shows');
      return res.json();
    },
    staleTime: 60 * 1000, // Fresh for 1 minute
  });
}

// Hook for fetching shots
export function useShots(showId?: string) {
  return useQuery({
    queryKey: queryKeys.shots(showId),
    queryFn: async () => {
      const url = showId ? `/api/shots?showId=${showId}` : '/api/shots';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch shots');
      return res.json();
    },
    staleTime: 30 * 1000, // Fresh for 30 seconds
  });
}

// Hook for updating task status with optimistic updates
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    // Optimistic update - UI updates immediately
    onMutate: async ({ taskId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks() });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(queryKeys.tasks());

      // Optimistically update cache
      queryClient.setQueriesData({ queryKey: queryKeys.tasks() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((task: any) =>
            task.id === taskId ? { ...task, status } : task
          );
        }
        return old;
      });

      return { previousTasks };
    },
    // On error, rollback
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks(), context.previousTasks);
      }
      showError('Failed to update status');
    },
    // On success, invalidate to refetch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows });
      showSuccess('Status updated successfully');
    },
  });
}

// Hook for bulk task updates with optimistic updates
export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskIds, updates }: { taskIds: string[]; updates: any }) => {
      const res = await fetch('/api/tasks/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, updates }),
      });
      if (!res.ok) throw new Error('Failed to update tasks');
      return res.json();
    },
    onMutate: async ({ taskIds, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks() });
      const previousTasks = queryClient.getQueryData(queryKeys.tasks());

      queryClient.setQueriesData({ queryKey: queryKeys.tasks() }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((task: any) =>
          taskIds.includes(task.id) ? { ...task, ...updates } : task
        );
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks(), context.previousTasks);
      }
      showError('Failed to update tasks');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows });
      showSuccess(`${data.updated || 0} tasks updated successfully`);
    },
  });
}

// Hook for creating feedback with optimistic update
export function useCreateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: any) => {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      if (!res.ok) throw new Error('Failed to create feedback');
      return res.json();
    },
    onMutate: async (newFeedback) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedbacks });
      const previousFeedbacks = queryClient.getQueryData(queryKeys.feedbacks);

      // Add temporary feedback to cache
      queryClient.setQueryData(queryKeys.feedbacks, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [{ ...newFeedback, id: 'temp-' + Date.now() }, ...old];
      });

      return { previousFeedbacks };
    },
    onError: (err, variables, context) => {
      if (context?.previousFeedbacks) {
        queryClient.setQueryData(queryKeys.feedbacks, context.previousFeedbacks);
      }
      showError('Failed to create feedback');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      showSuccess('Feedback created successfully');
    },
  });
}

// Hook for updating feedback
export function useUpdateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/feedbacks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update feedback');
      return res.json();
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedbacks });
      const previousFeedbacks = queryClient.getQueryData(queryKeys.feedbacks);

      queryClient.setQueryData(queryKeys.feedbacks, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((feedback: any) =>
          feedback.id === id ? { ...feedback, ...updates } : feedback
        );
      });

      return { previousFeedbacks };
    },
    onError: (err, variables, context) => {
      if (context?.previousFeedbacks) {
        queryClient.setQueryData(queryKeys.feedbacks, context.previousFeedbacks);
      }
      showError('Failed to update feedback');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      showSuccess('Feedback updated successfully');
    },
  });
}

// Hook for deleting feedback
export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/feedbacks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete feedback');
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedbacks });
      const previousFeedbacks = queryClient.getQueryData(queryKeys.feedbacks);

      queryClient.setQueryData(queryKeys.feedbacks, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter((feedback: any) => feedback.id !== id);
      });

      return { previousFeedbacks };
    },
    onError: (err, variables, context) => {
      if (context?.previousFeedbacks) {
        queryClient.setQueryData(queryKeys.feedbacks, context.previousFeedbacks);
      }
      showError('Failed to delete feedback');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
      showSuccess('Feedback deleted successfully');
    },
  });
}

// Hook for fetching feedbacks
export function useFeedbacks() {
  return useQuery({
    queryKey: queryKeys.feedbacks,
    queryFn: async () => {
      const res = await fetch('/api/feedbacks');
      if (!res.ok) throw new Error('Failed to fetch feedbacks');
      return res.json();
    },
    staleTime: 30 * 1000, // Fresh for 30 seconds
  });
}

// Hook for fetching status options
export function useStatusOptions() {
  return useQuery({
    queryKey: queryKeys.statusOptions,
    queryFn: async () => {
      const res = await fetch('/api/status-options');
      if (!res.ok) throw new Error('Failed to fetch status options');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes (rarely changes)
  });
}

// Hook for fetching departments
export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: async () => {
      const res = await fetch('/api/departments');
      if (!res.ok) throw new Error('Failed to fetch departments');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes (rarely changes)
  });
}
