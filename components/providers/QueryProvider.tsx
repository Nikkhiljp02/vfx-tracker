'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is fresh for 30 seconds (increased from 5 min for real-time feel)
            staleTime: 30 * 1000,
            // Keep unused data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests 1 time
            retry: 1,
            // Refetch on window focus to ensure fresh data
            refetchOnWindowFocus: true,
            // Refetch on mount if data is stale
            refetchOnMount: 'always',
            // Refetch on reconnect to sync after offline
            refetchOnReconnect: true,
            // Enable network mode for better offline handling
            networkMode: 'online',
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
            // Enable optimistic updates by default
            onError: (error) => {
              console.error('Mutation error:', error);
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
