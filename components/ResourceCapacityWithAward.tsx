'use client';

import { useState } from 'react';
import ResourceCapacityView from './ResourceCapacityView';
import AwardSheetViewOptimized from './AwardSheetViewOptimized';
import { BarChart3, Trophy } from 'lucide-react';

export default function ResourceCapacityWithAward() {
  const [activeSubTab, setActiveSubTab] = useState<'capacity' | 'award'>('capacity');

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Sub-tab Navigation */}
      <div className="flex-none bg-[#0d0d0d] border-b border-[#1a1a1a]">
        <div className="flex gap-1 p-2">
          <button
            onClick={() => setActiveSubTab('capacity')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              activeSubTab === 'capacity'
                ? 'bg-[#111111] text-cyan-400 border border-[#1a1a1a]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#111111]/50'
            }`}
          >
            <BarChart3 size={16} className={activeSubTab === 'capacity' ? 'text-cyan-400' : 'text-gray-600'} />
            Resource Capacity
          </button>
          <button
            onClick={() => setActiveSubTab('award')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              activeSubTab === 'award'
                ? 'bg-[#111111] text-amber-400 border border-[#1a1a1a]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#111111]/50'
            }`}
          >
            <Trophy size={16} className={activeSubTab === 'award' ? 'text-amber-400' : 'text-gray-600'} />
            Award Sheet
          </button>
        </div>
      </div>

      {/* Sub-tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'capacity' ? (
          <ResourceCapacityView />
        ) : (
          <AwardSheetViewOptimized />
        )}
      </div>
    </div>
  );
}
