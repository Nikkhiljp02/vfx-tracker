'use client';

import { usePaginatedLoad } from '@/hooks/useLazyLoad';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  actionType: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  userName?: string;
  timestamp: Date;
}

interface PaginatedActivityLogsProps {
  entityType?: string;
  entityId?: string;
  searchQuery?: string;
}

/**
 * Paginated activity logs with page controls
 * Demonstrates offset-based pagination UI
 */
export default function PaginatedActivityLogs({
  entityType,
  entityId,
  searchQuery,
}: PaginatedActivityLogsProps) {
  const {
    data: logs,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    refresh,
  } = usePaginatedLoad<ActivityLog>({
    fetcher: async (page, limit) => {
      const url = new URL('/api/activity-logs/paginated', window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', limit.toString());
      if (entityType) url.searchParams.set('entityType', entityType);
      if (entityId) url.searchParams.set('entityId', entityId);
      if (searchQuery) url.searchParams.set('search', searchQuery);

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load activity logs');

      return response.json();
    },
    pageSize: 50,
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {logs.length > 0 ? ((currentPage - 1) * 50 + 1) : 0} - {Math.min(currentPage * 50, totalItems)} of {totalItems} logs
        </span>
        <button
          onClick={refresh}
          className="text-blue-600 hover:text-blue-700"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {/* Logs table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{log.userName || 'System'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    log.actionType === 'CREATE' ? 'bg-green-100 text-green-800' :
                    log.actionType === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {log.actionType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {log.entityType}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{log.fieldName || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  {log.oldValue && log.newValue ? (
                    <div className="space-y-1">
                      <div className="text-red-600">
                        <span className="font-medium">Old:</span> {log.oldValue.slice(0, 30)}
                      </div>
                      <div className="text-green-600">
                        <span className="font-medium">New:</span> {log.newValue.slice(0, 30)}
                      </div>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Loading state */}
        {isLoading && (
          <div className="p-8 text-center text-gray-500">
            Loading activity logs...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && logs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No activity logs found
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-sm">
            Error: {error.message}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>

        <div className="flex items-center gap-2">
          {/* First page */}
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1 || isLoading}
            className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous page */}
          <button
            onClick={previousPage}
            disabled={currentPage === 1 || isLoading}
            className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  disabled={isLoading}
                  className={`px-3 py-1 rounded border text-sm ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next page */}
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages || isLoading}
            className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last page */}
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages || isLoading}
            className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
