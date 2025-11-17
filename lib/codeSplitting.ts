// Code splitting utilities for lazy loading large components
'use client';

import { ComponentType, lazy, Suspense } from 'react';

// Loading component for suspense fallback
export const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Higher-order component for lazy loading with suspense
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);
  
  return function LazyLoadedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <ComponentLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Preload component helper - call this to start loading before actually rendering
export function preloadComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunc);
  // Trigger the import
  return LazyComponent;
}

// Route-based code splitting helper
export function createRouteComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  loadingMessage?: string
) {
  return lazyLoad(
    importFunc,
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{loadingMessage || 'Loading...'}</p>
      </div>
    </div>
  );
}

// Modal-specific lazy loading (lighter fallback)
export function lazyLoadModal<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  return lazyLoad(
    importFunc,
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Example usage exports for large components
// These can be imported instead of the direct component imports

// Lazy load TrackerTable (2364 lines - largest component)
export const LazyTrackerTable = lazyLoad(
  () => import('@/components/TrackerTable')
);

// Lazy load modals
export const LazyNewShotModal = lazyLoadModal(
  () => import('@/components/NewShotModal')
);

export const LazyNewShowModal = lazyLoadModal(
  () => import('@/components/NewShowModal')
);

export const LazyImportPreviewModal = lazyLoadModal(
  () => import('@/components/ImportPreviewModal')
);

export const LazyActivityLogModal = lazyLoadModal(
  () => import('@/components/ActivityLogModal')
);

export const LazyDeliveryScheduler = lazyLoadModal(
  () => import('@/components/DeliveryScheduler')
);

export const LazySendDeliveryListModal = lazyLoadModal(
  () => import('@/components/SendDeliveryListModal')
);

// Lazy load views
export const LazyDashboardView = lazyLoad(
  () => import('@/components/DashboardView')
);

export const LazyDeliveryView = lazyLoad(
  () => import('@/components/DeliveryView')
);

export const LazyDepartmentView = lazyLoad(
  () => import('@/components/DepartmentView')
);

// Lazy load virtual table (performance-intensive)
export const LazyVirtualTrackerTable = lazyLoad(
  () => import('@/components/VirtualTrackerTable')
);
