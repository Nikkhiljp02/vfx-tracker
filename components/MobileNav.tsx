'use client';

import { LayoutGrid, Layers, Truck, Users, Activity } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface MobileNavProps {
  activeView: 'tracker' | 'department' | 'delivery' | 'dashboard' | 'feedback';
  onViewChange: (view: 'tracker' | 'department' | 'delivery' | 'dashboard' | 'feedback') => void;
}

export default function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user as any;
  const showResourceForecast = user?.role === 'ADMIN' || user?.role === 'RESOURCE';

  const navItems = [
    { id: 'dashboard' as const, icon: Activity, label: 'Dashboard' },
    { id: 'tracker' as const, icon: LayoutGrid, label: 'Tracker' },
    { id: 'department' as const, icon: Layers, label: 'Depts' },
    { id: 'delivery' as const, icon: Truck, label: 'Delivery' },
    { id: 'feedback' as const, icon: Activity, label: 'Feedback' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className={`grid h-16 ${showResourceForecast ? 'grid-cols-6' : 'grid-cols-5'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`
                flex flex-col items-center justify-center gap-1 transition-colors
                ${isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Icon size={22} strokeWidth={2} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
        {showResourceForecast && (
          <button
            onClick={() => router.push('/resource-forecast')}
            className="flex flex-col items-center justify-center gap-1 transition-colors text-gray-600 hover:bg-gray-50"
          >
            <Users size={22} strokeWidth={2} />
            <span className="text-xs font-medium">Resource</span>
          </button>
        )}
      </div>
    </nav>
  );
}
