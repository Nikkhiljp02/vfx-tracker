'use client';

import { useState } from 'react';
import { useVFXStore } from '@/lib/store';
import VirtualTrackerTable from '@/components/VirtualTrackerTable';
import LazyShotNotes from '@/components/LazyShotNotes';
import PaginatedActivityLogs from '@/components/PaginatedActivityLogs';
import { VirtualScrollStats } from '@/components/VirtualTrackerTable';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { transformToTrackerRows } from '@/lib/utils';
import { memoryCache } from '@/lib/cache';
import { clearServiceWorkerCache } from '@/lib/serviceWorker';
import { Zap, Database, Layers, Infinity, Trash2, RefreshCw } from 'lucide-react';

/**
 * Performance Testing & Demo Page
 * Demonstrates all optimization features
 */
export default function PerformanceDemoPage() {
  const { shows, fetchShots, fetchShows } = useVFXStore();
  const [activeTab, setActiveTab] = useState<'virtual' | 'lazy' | 'paginated' | 'cache'>('virtual');
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const trackerRows = transformToTrackerRows(shows);

  // Virtual scroll stats
  const { virtualItems } = useVirtualScroll(trackerRows, {
    itemHeight: 60,
    containerHeight: 600,
    overscan: 5,
  });

  const handleClearCache = () => {
    memoryCache.clear();
    clearServiceWorkerCache();
    alert('All caches cleared! Refresh to see effect.');
  };

  const handleForceRefresh = async () => {
    await fetchShots(true);
    await fetchShows(true);
    alert('Data refreshed from server!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Zap className="w-8 h-8 text-yellow-500" />
                Performance Demo
              </h1>
              <p className="text-gray-600 mt-2">
                Testing Database Optimization, Virtual Scrolling, Lazy Loading & Advanced Caching
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleForceRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Force Refresh
              </button>
              <button
                onClick={handleClearCache}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Cache
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Total Shots</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{trackerRows.length}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Rendered Rows</div>
              <div className="text-2xl font-bold text-green-900 mt-1">{virtualItems.length}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">DOM Reduction</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">
                {trackerRows.length > 0 
                  ? ((1 - virtualItems.length / trackerRows.length) * 100).toFixed(0)
                  : 0}%
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-600 font-medium">Cache Size</div>
              <div className="text-2xl font-bold text-orange-900 mt-1">{memoryCache.size()} items</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('virtual')}
                className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                  activeTab === 'virtual'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Layers className="w-4 h-4" />
                Virtual Scrolling
              </button>
              <button
                onClick={() => setActiveTab('lazy')}
                className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                  activeTab === 'lazy'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Infinity className="w-4 h-4" />
                Lazy Loading
              </button>
              <button
                onClick={() => setActiveTab('paginated')}
                className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                  activeTab === 'paginated'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="w-4 h-4" />
                Pagination
              </button>
              <button
                onClick={() => setActiveTab('cache')}
                className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${
                  activeTab === 'cache'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Zap className="w-4 h-4" />
                Cache Info
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'virtual' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Virtual Scrolling Demo</h2>
                  <VirtualScrollStats
                    totalRows={trackerRows.length}
                    visibleRows={virtualItems.length}
                  />
                </div>
                <p className="text-gray-600">
                  Only {virtualItems.length} rows are rendered out of {trackerRows.length} total. 
                  Scroll to see smooth performance even with 1000+ rows.
                </p>
                
                <VirtualTrackerTable
                  rows={trackerRows}
                  departments={[]}
                  rowHeight={60}
                  containerHeight={500}
                  onRowClick={(row) => console.log('Clicked:', row)}
                  renderRow={(row) => (
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{row.showName}</div>
                        <div className="text-sm text-gray-500">{row.shotName}</div>
                      </div>
                      <div className="text-sm text-gray-600">{row.shotTag}</div>
                      <div className="text-sm font-medium text-blue-600">{Object.keys(row.tasks).length} tasks</div>
                    </div>
                  )}
                />
              </div>
            )}

            {activeTab === 'lazy' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Lazy Loading Demo</h2>
                <p className="text-gray-600">
                  Notes load automatically as you scroll. Only loads what you see, when you see it.
                </p>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Select a shot to view notes:</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-2">
                      {trackerRows.slice(0, 20).map((row) => (
                        <button
                          key={row.shotId}
                          onClick={() => setSelectedShotId(row.shotId)}
                          className={`w-full text-left px-3 py-2 rounded border ${
                            selectedShotId === row.shotId
                              ? 'bg-blue-50 border-blue-300'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{row.shotName}</div>
                          <div className="text-xs text-gray-500">{row.showName}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    {selectedShotId ? (
                      <LazyShotNotes shotId={selectedShotId} />
                    ) : (
                      <div className="h-96 flex items-center justify-center text-gray-500 border rounded-lg">
                        Select a shot to view its notes
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'paginated' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Pagination Demo</h2>
                <p className="text-gray-600">
                  Activity logs use traditional pagination with page controls. 
                  Only loads one page at a time for optimal performance.
                </p>
                
                <PaginatedActivityLogs />
              </div>
            )}

            {activeTab === 'cache' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Cache Information</h2>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3">Memory Cache</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cache Size:</span>
                        <span className="font-medium">{memoryCache.size()} entries</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Strategy:</span>
                        <span className="font-medium">Stale-While-Revalidate</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Default TTL:</span>
                        <span className="font-medium">5 minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3">Service Worker</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium">
                          {typeof navigator !== 'undefined' && 'serviceWorker' in navigator
                            ? 'Supported'
                            : 'Not Supported'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Offline Mode:</span>
                        <span className="font-medium">Enabled</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cache Strategy:</span>
                        <span className="font-medium">Network First</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <h3 className="font-medium mb-2 text-blue-900">Cache Strategies</h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex justify-between">
                      <span>Realtime Data (Tasks, Shots):</span>
                      <span className="font-medium">30s TTL</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Standard Data (Shows, Lists):</span>
                      <span className="font-medium">5min TTL</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Long-lived (Status, Departments):</span>
                      <span className="font-medium">30min TTL</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
