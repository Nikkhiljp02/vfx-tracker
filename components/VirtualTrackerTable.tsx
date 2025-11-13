'use client';

import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { TrackerRow } from '@/lib/types';
import { useMemo } from 'react';

interface VirtualTrackerTableProps {
  rows: TrackerRow[];
  departments: string[];
  rowHeight?: number;
  containerHeight?: number;
  onRowClick?: (row: TrackerRow) => void;
  renderRow: (row: TrackerRow, style: React.CSSProperties) => React.ReactNode;
}

/**
 * Virtual scrolling wrapper for TrackerTable
 * Renders only visible rows for optimal performance with 1000+ shots
 */
export default function VirtualTrackerTable({
  rows,
  departments,
  rowHeight = 60,
  containerHeight = 600,
  onRowClick,
  renderRow,
}: VirtualTrackerTableProps) {
  const { virtualItems, totalHeight, containerRef } = useVirtualScroll(rows, {
    itemHeight: rowHeight,
    containerHeight,
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto border rounded-lg"
      style={{ height: containerHeight }}
    >
      {/* Spacer for scrollbar - represents total table height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Only render visible rows */}
        {virtualItems.map(({ index, start }) => {
          const row = rows[index];
          const style: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${start}px)`,
            height: rowHeight,
          };

          return (
            <div
              key={row.shotId}
              style={style}
              onClick={() => onRowClick?.(row)}
              className="border-b hover:bg-gray-50 transition-colors"
            >
              {renderRow(row, style)}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-500">
          No shots found
        </div>
      )}
    </div>
  );
}

// Performance stats component
export function VirtualScrollStats({ totalRows, visibleRows }: { totalRows: number; visibleRows: number }) {
  const performanceGain = totalRows > 0 ? ((1 - visibleRows / totalRows) * 100).toFixed(1) : 0;
  
  return (
    <div className="text-xs text-gray-500 space-x-4">
      <span>Total: {totalRows} rows</span>
      <span>Rendered: {visibleRows} rows</span>
      <span className="text-green-600 font-medium">
        {performanceGain}% reduction
      </span>
    </div>
  );
}
