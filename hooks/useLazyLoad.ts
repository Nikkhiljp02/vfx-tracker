import { useState, useEffect, useCallback, useRef } from 'react';

export interface LazyLoadConfig<T> {
  fetcher: (cursor?: string) => Promise<{ data: T[]; nextCursor: string | null; hasMore: boolean }>;
  initialData?: T[];
  enabled?: boolean;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
}

export interface LazyLoadResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  observerRef: React.RefObject<HTMLDivElement | null>;
}

export function useLazyLoad<T>(config: LazyLoadConfig<T>): LazyLoadResult<T> {
  const { fetcher, initialData = [], enabled = true, threshold = 200 } = config;
  
  const [data, setData] = useState<T[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  
  const observerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingRef.current || !hasMore) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher(cursor || undefined);
      
      setData(prev => [...prev, ...result.data]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err as Error);
      console.error('Lazy load error:', err);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [enabled, hasMore, cursor, fetcher]);

  const refresh = useCallback(async () => {
    setData([]);
    setCursor(null);
    setHasMore(true);
    isLoadingRef.current = false;
    await loadMore();
  }, [loadMore]);

  // Intersection Observer for auto-loading
  useEffect(() => {
    if (!enabled || !observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingRef.current) {
          loadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    );

    observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [enabled, hasMore, loadMore, threshold]);

  return {
    data,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    observerRef,
  };
}

// Hook for paginated data with manual page controls
export interface PaginatedLoadConfig<T> {
  fetcher: (page: number, limit: number) => Promise<{
    data: T[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
  }>;
  initialPage?: number;
  pageSize?: number;
  enabled?: boolean;
}

export interface PaginatedLoadResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePaginatedLoad<T>(config: PaginatedLoadConfig<T>): PaginatedLoadResult<T> {
  const { fetcher, initialPage = 1, pageSize = 50, enabled = true } = config;
  
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const loadPage = useCallback(async (page: number) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher(page, pageSize);
      
      setData(result.data);
      setCurrentPage(result.currentPage);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
    } catch (err) {
      setError(err as Error);
      console.error('Paginated load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fetcher, pageSize]);

  const goToPage = useCallback(async (page: number) => {
    await loadPage(page);
  }, [loadPage]);

  const nextPage = useCallback(async () => {
    if (currentPage < totalPages) {
      await loadPage(currentPage + 1);
    }
  }, [currentPage, totalPages, loadPage]);

  const previousPage = useCallback(async () => {
    if (currentPage > 1) {
      await loadPage(currentPage - 1);
    }
  }, [currentPage, loadPage]);

  const refresh = useCallback(async () => {
    await loadPage(currentPage);
  }, [currentPage, loadPage]);

  // Load initial page
  useEffect(() => {
    if (enabled) {
      loadPage(currentPage);
    }
  }, [enabled]); // Only on mount

  return {
    data,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    refresh,
  };
}
