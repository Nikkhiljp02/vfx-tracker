// Performance monitoring utilities
'use client';

// Performance metrics interface
export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    // Observe long tasks (tasks taking > 50ms)
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn('[Performance] Long task detected:', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // Long tasks not supported in all browsers
      }

      // Observe layout shifts
      try {
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const clsEntry = entry as any;
            if (clsEntry.hadRecentInput) continue;
            
            console.warn('[Performance] Layout shift detected:', {
              value: clsEntry.value,
              sources: clsEntry.sources,
            });
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        // Layout shift not supported in all browsers
      }
    }
  }

  // Start measuring a metric
  start(name: string, metadata?: Record<string, any>) {
    const startTime = performance.now();
    this.metrics.set(name, {
      name,
      startTime,
      duration: 0,
      endTime: 0,
      metadata,
    });
    
    // Use Performance API mark
    performance.mark(`${name}-start`);
  }

  // End measuring a metric
  end(name: string): PerformanceMetric | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`[Performance] Metric "${name}" was not started`);
      return null;
    }

    const endTime = performance.now();
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;

    // Use Performance API measure
    performance.mark(`${name}-end`);
    try {
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch (e) {
      // Marks might not exist
    }

    // Log slow operations (> 100ms)
    if (metric.duration > 100) {
      console.warn(`[Performance] Slow operation detected: ${name}`, {
        duration: `${metric.duration.toFixed(2)}ms`,
        metadata: metric.metadata,
      });
    }

    return metric;
  }

  // Get a metric
  get(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  // Get all metrics
  getAll(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  // Clear all metrics
  clear() {
    this.metrics.clear();
    if (typeof performance !== 'undefined') {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  // Get Core Web Vitals
  getCoreWebVitals(): Promise<{
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  }> {
    return new Promise((resolve) => {
      const vitals: any = {};

      // Get navigation timing
      if (typeof performance !== 'undefined' && performance.timing) {
        const timing = performance.timing;
        vitals.ttfb = timing.responseStart - timing.requestStart;
      }

      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        vitals.fcp = fcpEntry.startTime;
      }

      // For LCP, FID, CLS, we need to use web-vitals library
      // This is a placeholder - implement with actual web-vitals package
      resolve(vitals);
    });
  }

  // Cleanup observers
  disconnect() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Create singleton instance
export const perfMonitor = new PerformanceMonitor();

// Helper hook for React components
export function usePerformanceMetric(name: string, metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  const metricName = `${name}-${Date.now()}`;
  
  // Start on mount
  perfMonitor.start(metricName, metadata);

  // Return cleanup function
  return () => {
    perfMonitor.end(metricName);
  };
}

// Measure component render time
export function measureRender(componentName: string) {
  return function <P extends object>(Component: React.ComponentType<P>) {
    return function MeasuredComponent(props: P) {
      const renderStart = performance.now();
      
      const result = Component(props);
      
      const renderEnd = performance.now();
      const duration = renderEnd - renderStart;
      
      if (duration > 16) { // Slower than 60fps
        console.warn(`[Performance] Slow render: ${componentName}`, {
          duration: `${duration.toFixed(2)}ms`,
        });
      }
      
      return result;
    };
  };
}

// Measure async operations
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  perfMonitor.start(name, metadata);
  try {
    const result = await operation();
    perfMonitor.end(name);
    return result;
  } catch (error) {
    perfMonitor.end(name);
    throw error;
  }
}

// Log performance summary
export function logPerformanceSummary() {
  const metrics = perfMonitor.getAll();
  
  if (metrics.length === 0) {
    console.log('[Performance] No metrics recorded');
    return;
  }

  console.group('[Performance] Summary');
  
  const sorted = metrics.sort((a, b) => b.duration - a.duration);
  sorted.forEach((metric) => {
    console.log(
      `${metric.name}: ${metric.duration.toFixed(2)}ms`,
      metric.metadata || ''
    );
  });
  
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const avgDuration = totalDuration / metrics.length;
  
  console.log(`\nTotal: ${totalDuration.toFixed(2)}ms`);
  console.log(`Average: ${avgDuration.toFixed(2)}ms`);
  console.log(`Count: ${metrics.length}`);
  
  console.groupEnd();
}

// Export for development debugging
if (typeof window !== 'undefined') {
  (window as any).__perfMonitor = perfMonitor;
  (window as any).__logPerformance = logPerformanceSummary;
}
