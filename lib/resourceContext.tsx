'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ResourceMember {
  id: string;
  empId: string;
  empName: string;
  designation: string;
  department: string;
  shift: string;
  isActive: boolean;
}

interface ResourceAllocation {
  id: string;
  resourceId: string;
  allocationDate: string;
  showName: string;
  shotName: string;
  manDays: number;
  isWeekendWorking: boolean;
  isLeave: boolean;
}

interface ResourceContextType {
  members: ResourceMember[];
  allocations: ResourceAllocation[];
  loading: boolean;
  refreshTrigger: number;
  setMembers: (members: ResourceMember[]) => void;
  setAllocations: (allocations: ResourceAllocation[]) => void;
  setLoading: (loading: boolean) => void;
  triggerRefresh: () => void;
}

const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export function ResourceProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<ResourceMember[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <ResourceContext.Provider
      value={{
        members,
        allocations,
        loading,
        refreshTrigger,
        setMembers,
        setAllocations,
        setLoading,
        triggerRefresh,
      }}
    >
      {children}
    </ResourceContext.Provider>
  );
}

export function useResourceContext() {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error('useResourceContext must be used within a ResourceProvider');
  }
  return context;
}
