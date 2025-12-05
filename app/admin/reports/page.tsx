'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CustomReportsBuilder from '@/components/CustomReportsBuilder';

export default function ReportsBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/login');
      return;
    }

    const user = session.user as any;
    
    // Only ADMIN and COORDINATOR roles can access
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR' && !user.role?.toUpperCase().includes('COORDINATOR')) {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-400 font-medium">Loading Reports Builder...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user as any;
  if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR' && !user.role?.toUpperCase().includes('COORDINATOR')) {
    return null;
  }

  return (
    <div className="h-screen bg-[#0a0a0a] overflow-auto">
      <CustomReportsBuilder />
    </div>
  );
}
