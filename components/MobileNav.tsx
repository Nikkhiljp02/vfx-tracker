'use client';

import { LayoutGrid, Layers, Truck, BarChart3 } from 'lucide-react';

interface MobileNavProps {
  activeView: 'tracker' | 'department' | 'delivery' | 'dashboard';
  onViewChange: (view: 'tracker' | 'department' | 'delivery' | 'dashboard') => void;
}

export default function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const navItems = [
    { id: 'dashboard' as const, icon: BarChart3, label: 'Dashboard' },
    { id: 'tracker' as const, icon: LayoutGrid, label: 'Tracker' },
    { id: 'department' as const, icon: Layers, label: 'Depts' },
    { id: 'delivery' as const, icon: Truck, label: 'Delivery' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="grid grid-cols-4 h-16">
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
      </div>
    </nav>
  );
}
