'use client';

import { useEffect, useState } from 'react';
import { useVFXStore } from '@/lib/store';
import { useSession } from 'next-auth/react';
import TrackerTable from '@/components/TrackerTable';
import DepartmentView from '@/components/DepartmentView';
import DeliveryView from '@/components/DeliveryView';
import DashboardView from '@/components/DashboardView';
import ResourceForecastView from '@/components/ResourceForecastView';
import ResourceDashboard from '@/components/ResourceDashboard';
import AllocationListView from '@/components/AllocationListView';
import ResourceCapacityView from '@/components/ResourceCapacityView';
import AwardSheetViewOptimized from '@/components/AwardSheetViewOptimized';
import Header from '@/components/Header';
import FilterPanel from '@/components/FilterPanel';
import MobileNav from '@/components/MobileNav';
import MobileFilterDrawer from '@/components/MobileFilterDrawer';
import { ResourceProvider } from '@/lib/resourceContext';
import { LayoutGrid, Layers, BarChart3, Truck, Filter, Users } from 'lucide-react';

export default function Home() {
  const { data: session } = useSession();
  const { fetchAllData, loadPreferences, loading, error } = useVFXStore();
  // Default to non-detailed view (false) for first-time users
  const [detailedView, setDetailedView] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vfx-tracker-detailed-view');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [activeView, setActiveView] = useState<'tracker' | 'department' | 'delivery' | 'dashboard' | 'resource-forecast' | 'award-sheet'>('dashboard');
  const [resourceTab, setResourceTab] = useState<'summary' | 'forecast' | 'allocations' | 'capacity'>('summary');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showUnhideModal, setShowUnhideModal] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Save detailed view preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vfx-tracker-detailed-view', JSON.stringify(detailedView));
    }
  }, [detailedView]);

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
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <Header />
      
      {/* Mobile Filter Button - Floating */}
      {(activeView === 'tracker' || activeView === 'department') && (
        <button
          onClick={() => setMobileFilterOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <Filter size={24} />
        </button>
      )}
      
      <div className="w-full px-2 md:px-4 py-4 md:py-6">
        {/* View Tabs - Desktop only */}
        <div className="mb-4 hidden md:flex gap-2">
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
          {(session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'RESOURCE' ? (
            <>
              <button
                onClick={() => setActiveView('resource-forecast')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                  ${activeView === 'resource-forecast'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }
                `}
              >
                <Users size={18} />
                Resources
              </button>
              <button
                onClick={() => setActiveView('award-sheet')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                  ${activeView === 'award-sheet'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }
                `}
              >
                <LayoutGrid size={18} />
                Award
              </button>
            </>
          ) : null}
        </div>

        {activeView === 'dashboard' ? (
          <DashboardView />
        ) : activeView === 'delivery' ? (
          <DeliveryView />
        ) : activeView === 'award-sheet' ? (
          <AwardSheetViewOptimized />
        ) : activeView === 'resource-forecast' ? (
          <ResourceProvider>
            <div className="h-full flex flex-col bg-gray-900">
              {/* Resource Tabs */}
              <div className="flex-none bg-gray-800 border-b border-gray-700">
                <div className="flex">
                  <button
                    onClick={() => setResourceTab('summary')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      resourceTab === 'summary'
                        ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    📊 Resource Summary
                  </button>
                  <button
                    onClick={() => setResourceTab('forecast')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      resourceTab === 'forecast'
                        ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Resource Forecast
                  </button>
                  <button
                    onClick={() => setResourceTab('allocations')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      resourceTab === 'allocations'
                        ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Allocations
                  </button>
                  <button
                    onClick={() => setResourceTab('capacity')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      resourceTab === 'capacity'
                        ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Resource Capacity
                  </button>
                </div>
              </div>
              {/* Resource Tab Content */}
              <div className="flex-1 overflow-hidden">
                {resourceTab === 'summary' ? (
                  <ResourceDashboard />
                ) : resourceTab === 'forecast' ? (
                  <ResourceForecastView />
                ) : resourceTab === 'allocations' ? (
                  <AllocationListView />
                ) : (
                  <ResourceCapacityView />
                )}
              </div>
            </div>
          </ResourceProvider>
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
      
      {/* Mobile Bottom Navigation */}
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
      
      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer 
        isOpen={mobileFilterOpen} 
        onClose={() => setMobileFilterOpen(false)} 
      />
    </div>
  );
}

