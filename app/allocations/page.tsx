import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AllocationListView from '@/components/AllocationListView';

export const metadata: Metadata = {
  title: 'Allocations - VFX Tracker',
  description: 'View resource allocations by artist and shot',
};

export default async function AllocationsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Check if user has ADMIN or RESOURCE role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'RESOURCE') {
    redirect('/');
  }

  return <AllocationListView />;
}
