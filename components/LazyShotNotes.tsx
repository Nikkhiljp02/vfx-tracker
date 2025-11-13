'use client';

import { useLazyLoad } from '@/hooks/useLazyLoad';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ShotNote {
  id: string;
  content: string;
  userName: string;
  createdDate: Date;
  mentions?: any[];
  attachments?: any[];
}

interface LazyShotNotesProps {
  shotId: string;
}

/**
 * Lazy-loaded shot notes panel with infinite scroll
 * Only loads notes as user scrolls down
 */
export default function LazyShotNotes({ shotId }: LazyShotNotesProps) {
  const [notes, setNotes] = useState<ShotNote[]>([]);

  const {
    data,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    observerRef,
  } = useLazyLoad<ShotNote>({
    fetcher: async (cursor) => {
      const url = new URL(`/api/shot-notes/${shotId}/paginated`, window.location.origin);
      if (cursor) url.searchParams.set('cursor', cursor);
      url.searchParams.set('limit', '20');

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load notes');

      const result = await response.json();
      
      return {
        data: result.data || [],
        nextCursor: result.pagination?.currentPage 
          ? (result.pagination.currentPage + 1).toString() 
          : null,
        hasMore: result.pagination?.hasNextPage || false,
      };
    },
    threshold: 100, // Load more when 100px from bottom
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shot Notes</h3>
        <button
          onClick={refresh}
          className="text-sm text-blue-600 hover:text-blue-700"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {data.map((note) => (
          <div key={note.id} className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-start justify-between mb-2">
              <span className="font-medium text-sm">{note.userName}</span>
              <span className="text-xs text-gray-500">
                {new Date(note.createdDate).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
            
            {note.mentions && note.mentions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {note.mentions.map((mention, idx) => (
                  <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    @{mention.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-600">Loading notes...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Failed to load notes: {error.message}
          </div>
        )}

        {/* Intersection observer target for infinite scroll */}
        {hasMore && !isLoading && (
          <div ref={observerRef} className="h-10" />
        )}

        {/* End of list indicator */}
        {!hasMore && data.length > 0 && (
          <div className="text-center text-sm text-gray-500 py-4">
            No more notes
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No notes yet. Be the first to add one!
          </div>
        )}
      </div>
    </div>
  );
}
