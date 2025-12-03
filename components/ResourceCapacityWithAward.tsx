'use client';

import { useState } from 'react';
import { BarChart3, Trophy } from 'lucide-react';
import ResourceCapacityView from './ResourceCapacityView';
import AwardSheetViewOptimized from './AwardSheetViewOptimized';

export default function ResourceCapacityWithAward() {
  const [activePanel, setActivePanel] = useState<'capacity' | 'award'>('capacity');

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Sub-tab Navigation */}
      <div className="flex-none bg-[#0d0d0d] border-b border-[#1a1a1a]">
        <div className="flex">
          <button
            onClick={() => setActivePanel('capacity')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activePanel === 'capacity'
                ? 'bg-[#111111] text-cyan-400 border-cyan-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-[#111111]'
            }`}
          >
            <BarChart3 size={16} className={activePanel === 'capacity' ? 'text-cyan-400' : 'text-gray-600'} />
            Resource Capacity
          </button>
          <button
            onClick={() => setActivePanel('award')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activePanel === 'award'
                ? 'bg-[#111111] text-amber-400 border-amber-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-[#111111]'
            }`}
          >
            <Trophy size={16} className={activePanel === 'award' ? 'text-amber-400' : 'text-gray-600'} />
            Award Sheet
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'capacity' ? (
          <ResourceCapacityView />
        ) : (
          <AwardSheetViewOptimized />
        )}
      </div>
    </div>
  );
}
