// Real-time subscription hook for VFX Tracker
'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useVFXStore } from './store';
import { queryKeys } from './queries';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();
  const { fetchShows, fetchShots, fetchTasks, fetchAllData } = useVFXStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Create a single channel for all real-time updates
    const channel = supabase
      .channel('db-changes')
      .on('broadcast', { event: 'show-created' }, (payload) => {
        console.log('Show created:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchShows(true);
      })
      .on('broadcast', { event: 'show-updated' }, (payload) => {
        console.log('Show updated:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchShows(true);
      })
      .on('broadcast', { event: 'show-deleted' }, (payload) => {
        console.log('Show deleted:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchShows(true);
      })
      .on('broadcast', { event: 'shot-created' }, (payload) => {
        console.log('Shot created:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.shots() });
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchShots(true);
      })
      .on('broadcast', { event: 'shot-updated' }, (payload) => {
        console.log('Shot updated:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.shots() });
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchShots(true);
      })
      .on('broadcast', { event: 'shot-deleted' }, (payload) => {
        console.log('Shot deleted:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.shots() });
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchShots(true);
      })
      .on('broadcast', { event: 'task-updated' }, (payload) => {
        console.log('Task updated:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchTasks(true);
      })
      .on('broadcast', { event: 'task-deleted' }, (payload) => {
        console.log('Task deleted:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
        queryClient.invalidateQueries({ queryKey: queryKeys.shows });
        fetchTasks(true);
      })
      .on('broadcast', { event: 'feedback-created' }, (payload) => {
        console.log('Feedback created:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
        if (payload.payload?.taskId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
          fetchTasks(true);
        }
        fetchAllData();
      })
      .on('broadcast', { event: 'feedback-updated' }, (payload) => {
        console.log('Feedback updated:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
        if (payload.payload?.taskId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
          fetchTasks(true);
        }
        fetchAllData();
      })
      .on('broadcast', { event: 'feedback-deleted' }, (payload) => {
        console.log('Feedback deleted:', payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
        fetchAllData();
      })
      .on('broadcast', { event: 'data-update' }, (payload) => {
        console.log('Generic data update:', payload);
        queryClient.invalidateQueries();
        fetchAllData();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time updates connected!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time connection error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Real-time connection timed out');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting real-time updates...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchShows, fetchShots, fetchTasks, fetchAllData]);

  return {
    isConnected: channelRef.current !== null,
  };
}
