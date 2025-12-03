'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ResourceForecastView from '@/components/ResourceForecastView';
import AllocationListView from '@/components/AllocationListView';
import ResourceDashboard from '@/components/ResourceDashboard';
import ResourceCapacityView from '@/components/ResourceCapacityView';
import AwardSheetViewOptimized from '@/components/AwardSheetViewOptimized';
import { LayoutDashboard, CalendarDays, ListTodo, BarChart3, Trophy } from 'lucide-react';

export default function ResourceForecastPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'forecast' | 'allocations' | 'capacity' | 'award'>('dashboard');

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
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent animate-spin"></div>
          <div className="text-gray-400 font-medium">Loading Resource Module...</div>
        </div>
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

  const tabs = [
    { id: 'dashboard', label: 'Summary', icon: LayoutDashboard, shortLabel: 'Summary' },
    { id: 'forecast', label: 'Resource Forecast', icon: CalendarDays, shortLabel: 'Forecast' },
    { id: 'allocations', label: 'Allocations', icon: ListTodo, shortLabel: 'Allocations' },
    { id: 'capacity', label: 'Resource Capacity', icon: BarChart3, shortLabel: 'Capacity' },
    { id: 'award', label: 'Award Sheet', icon: Trophy, shortLabel: 'Award' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Professional Tab Navigation */}
      <div className="flex-none bg-[#111111] border-b border-[#1a1a1a]">
        <div className="flex overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 md:px-6 py-3.5 text-xs md:text-sm font-medium transition-all duration-200 touch-manipulation border-b-2 ${
                  isActive
                    ? 'bg-[#0a0a0a] text-cyan-400 border-cyan-500'
                    : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-[#151515]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-cyan-400' : 'text-gray-600'} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
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
        ) : activeTab === 'capacity' ? (
          <ResourceCapacityView />
        ) : (
          <AwardSheetViewOptimized />
        )}
      </div>
    </div>
  );
}
