'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ResourceForecastView from '@/components/ResourceForecastView';
import AllocationListView from '@/components/AllocationListView';
import ResourceDashboard from '@/components/ResourceDashboard';
import ResourceCapacityView from '@/components/ResourceCapacityView';

export default function ResourceForecastPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'forecast' | 'allocations' | 'capacity'>('dashboard');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/login');
      return;
    }

    const user = session.user as any;
    
    // Only ADMIN and RESOURCE roles can access
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user as any;
  if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Tab Navigation - Mobile Optimized */}
      <div className="flex-none bg-gray-800 border-b border-gray-700">
        <div className="flex overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-shrink-0 px-4 md:px-6 py-3 text-xs md:text-sm font-medium transition-colors touch-manipulation ${
              activeTab === 'dashboard'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white active:bg-gray-700'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex-shrink-0 px-4 md:px-6 py-3 text-xs md:text-sm font-medium transition-colors touch-manipulation whitespace-nowrap ${
              activeTab === 'forecast'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white active:bg-gray-700'
            }`}
          >
            Resource Forecast
          </button>
          <button
            onClick={() => setActiveTab('allocations')}
            className={`flex-shrink-0 px-4 md:px-6 py-3 text-xs md:text-sm font-medium transition-colors touch-manipulation ${
              activeTab === 'allocations'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white active:bg-gray-700'
            }`}
          >
            Allocations List
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`flex-shrink-0 px-4 md:px-6 py-3 text-xs md:text-sm font-medium transition-colors touch-manipulation whitespace-nowrap ${
              activeTab === 'capacity'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white active:bg-gray-700'
            }`}
          >
            Resource Capacity
          </button>
        </div>
      </div>

      {/* Hide scrollbar on mobile tabs */}
      <style jsx>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' ? (
          <ResourceDashboard />
        ) : activeTab === 'forecast' ? (
          <ResourceForecastView />
        ) : activeTab === 'allocations' ? (
          <AllocationListView />
        ) : (
          <ResourceCapacityView />
        )}
      </div>
    </div>
  );
}
