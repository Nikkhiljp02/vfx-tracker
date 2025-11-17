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
      {/* Tab Navigation */}
      <div className="flex-none bg-gray-800 border-b border-gray-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'forecast'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Resource Forecast
          </button>
          <button
            onClick={() => setActiveTab('allocations')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'allocations'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Allocations List
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'capacity'
                ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Resource Capacity
          </button>
        </div>
      </div>

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
