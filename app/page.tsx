'use client';

import { useEffect, useState } from 'react';
import { useVFXStore } from '@/lib/store';
import { useSession } from 'next-auth/react';
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates';
import TrackerTable from '@/components/TrackerTable';
import DepartmentView from '@/components/DepartmentView';
import DeliveryView from '@/components/DeliveryView';
import AdvancedDashboard from '@/components/AdvancedDashboard';
import FeedbackView from '@/components/FeedbackView';
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
import { FeedbackModalProvider, useFeedbackModal } from '@/lib/feedbackModalContext';
import { LayoutGrid, Layers, Truck, Filter, Users, Activity, X } from 'lucide-react';

export default function Home() {
  const { data: session } = useSession();
  const { fetchAllData, loadPreferences, loading, error } = useVFXStore();
  
  // Enable real-time updates via Supabase broadcasts
  useRealtimeUpdates();
  // Default to non-detailed view (false) for first-time users
  const [detailedView, setDetailedView] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vfx-tracker-detailed-view');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [activeView, setActiveView] = useState<'tracker' | 'department' | 'delivery' | 'dashboard' | 'feedback' | 'resource-forecast' | 'award-sheet'>('dashboard');
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
    // Load preferences and data in parallel for faster initialization
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadPreferences(),
          fetchAllData()
        ]);
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    initializeApp();
  }, [loadPreferences, fetchAllData]);

  // Show skeleton UI instead of blocking the entire page
  // Note: Individual components will show their own loading states

  // Show error as toast notification (handled by components)
  useEffect(() => {
    if (error) {
      console.error('VFX Tracker Error:', error);
    }
  }, [error]);

  return (
    <FeedbackModalProvider>
      <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
        <Header />
      
      {/* Show subtle loading indicator if data is loading */}
      {loading && (
        <div className="fixed top-16 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse">
          Loading data...
        </div>
      )}
      
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
            <Activity size={18} />
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
          <button
            onClick={() => setActiveView('feedback')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeView === 'feedback'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }
            `}
          >
            <Activity size={18} />
            Feedback
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
          <AdvancedDashboard />
        ) : activeView === 'delivery' ? (
          <DeliveryView />
        ) : activeView === 'feedback' ? (
          <FeedbackView />
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
      
      {/* Feedback Modal */}
      <FeedbackModalComponent />
    </FeedbackModalProvider>
  );
}

// Feedback Modal Component
function FeedbackModalComponent() {
  const { isOpen, closeFeedbackModal, prefilledData } = useFeedbackModal();
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4" 
      onClick={closeFeedbackModal}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">Add Feedback</h2>
          <button 
            onClick={closeFeedbackModal}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
        <div className="overflow-auto max-h-[calc(90vh-80px)]">
          <FeedbackView prefilledData={prefilledData || undefined} />
        </div>
      </div>
    </div>
  );
}

