'use client';

import { useEffect, useState } from 'react';
import { useVFXStore } from '@/lib/store';
import TrackerTable from '@/components/TrackerTable';
import DepartmentView from '@/components/DepartmentView';
import DeliveryView from '@/components/DeliveryView';
import DashboardView from '@/components/DashboardView';
import Header from '@/components/Header';
import FilterPanel from '@/components/FilterPanel';
import { LayoutGrid, Layers, BarChart3, Truck } from 'lucide-react';

export default function Home() {
  const { fetchAllData, loadPreferences, loading, error } = useVFXStore();
  const [detailedView, setDetailedView] = useState(true);
  const [activeView, setActiveView] = useState<'tracker' | 'department' | 'delivery' | 'dashboard'>('dashboard');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showUnhideModal, setShowUnhideModal] = useState(false);

  useEffect(() => {
    // Load user preferences first, then fetch data
    const initializeApp = async () => {
      await loadPreferences();
      await fetchAllData();
    };
    initializeApp();
  }, [loadPreferences, fetchAllData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading VFX Tracker...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="w-full px-4 py-6">
        {/* View Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeView === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
            `}
          >
            <BarChart3 size={18} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveView('tracker')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeView === 'tracker'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
            `}
          >
            <LayoutGrid size={18} />
            Tracker View
          </button>
          <button
            onClick={() => setActiveView('department')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeView === 'department'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
            `}
          >
            <Layers size={18} />
            Department View
          </button>
          <button
            onClick={() => setActiveView('delivery')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeView === 'delivery'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
            `}
          >
            <Truck size={18} />
            Delivery
          </button>
        </div>

        {activeView === 'dashboard' ? (
          <DashboardView />
        ) : activeView === 'delivery' ? (
          <DeliveryView />
        ) : (
          <>
            <FilterPanel 
              detailedView={detailedView} 
              setDetailedView={setDetailedView}
              hiddenColumns={hiddenColumns}
              setHiddenColumns={setHiddenColumns}
              showUnhideModal={showUnhideModal}
              setShowUnhideModal={setShowUnhideModal}
            />
            
            {activeView === 'tracker' ? (
              <TrackerTable 
                detailedView={detailedView} 
                onToggleDetailedView={() => setDetailedView(!detailedView)}
                hiddenColumns={hiddenColumns}
                setHiddenColumns={setHiddenColumns}
              />
            ) : (
              <DepartmentView detailedView={detailedView} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

