import { useState, useEffect, useRef, useMemo } from 'react';

export interface VirtualScrollConfig {
  itemHeight: number; // Fixed height per row
  containerHeight: number; // Visible container height
  overscan?: number; // Number of extra items to render above/below viewport
}

export interface VirtualScrollResult {
  virtualItems: { index: number; start: number; end: number }[];
  totalHeight: number;
  scrollToIndex: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useVirtualScroll<T>(
  items: T[],
  config: VirtualScrollConfig
): VirtualScrollResult {
  const { itemHeight, containerHeight, overscan = 3 } = config;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate which items should be visible
  const virtualItems = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + visibleCount
    );

    // Add overscan
    const overscanStart = Math.max(0, startIndex - overscan);
    const overscanEnd = Math.min(items.length - 1, endIndex + overscan);

    const virtualItems = [];
    for (let i = overscanStart; i <= overscanEnd; i++) {
      virtualItems.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight,
      });
    }

    return virtualItems;
  }, [items.length, scrollTop, itemHeight, containerHeight, overscan]);

  // Total height for scrollbar
  const totalHeight = items.length * itemHeight;

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const offset = index * itemHeight;
    container.scrollTo({
      top: offset,
      behavior: 'smooth',
    });
  };

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerRef,
  };
}

// Hook for dynamic row heights (more complex)
export interface DynamicVirtualScrollConfig {
  estimatedItemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useDynamicVirtualScroll<T>(
  items: T[],
  config: DynamicVirtualScrollConfig
): VirtualScrollResult {
  const { estimatedItemHeight, containerHeight, overscan = 3 } = config;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementsRef = useRef<Map<number, number>>(new Map());

  // Get or estimate height for an item
  const getItemHeight = (index: number): number => {
    return measurementsRef.current.get(index) || estimatedItemHeight;
  };

  // Calculate positions
  const { virtualItems, totalHeight } = useMemo(() => {
    let currentOffset = 0;
    const positions = new Map<number, { start: number; end: number }>();

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      positions.set(i, {
        start: currentOffset,
        end: currentOffset + height,
      });
      currentOffset += height;
    }

    // Find visible range
    const visibleItems = [];
    for (let i = 0; i < items.length; i++) {
      const pos = positions.get(i)!;
      if (pos.end >= scrollTop - overscan * estimatedItemHeight &&
          pos.start <= scrollTop + containerHeight + overscan * estimatedItemHeight) {
        visibleItems.push({
          index: i,
          start: pos.start,
          end: pos.end,
        });
      }
    }

    return {
      virtualItems: visibleItems,
      totalHeight: currentOffset,
    };
  }, [items.length, scrollTop, containerHeight, overscan, estimatedItemHeight]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToIndex = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }

    container.scrollTo({
      top: offset,
      behavior: 'smooth',
    });
  };

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerRef,
  };
}
