'use client';

import { useVFXStore } from '@/lib/store';
import { useMemo } from 'react';
import { Calendar, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { formatDisplayDate } from '@/lib/utils';

export default function UpcomingDeliveriesWidget() {
  const { shows, statusOptions } = useVFXStore();

  // Get upcoming deliveries (next 7 days)
  const upcomingDeliveries = useMemo(() => {
    const items: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    shows.forEach(show => {
      show.shots?.forEach(shot => {
        shot.tasks?.forEach(task => {
          const dates: { date: Date; type: 'internal' | 'client' }[] = [];
          
          if (task.internalEta) {
            const date = new Date(task.internalEta);
            date.setHours(0, 0, 0, 0);
            if (date >= today && date <= weekFromNow) {
              dates.push({ date, type: 'internal' });
            }
          }
          
          if (task.clientEta) {
            const date = new Date(task.clientEta);
            date.setHours(0, 0, 0, 0);
            if (date >= today && date <= weekFromNow) {
              dates.push({ date, type: 'client' });
            }
          }

          dates.forEach(({ date, type }) => {
            items.push({
              id: `${task.id}-${type}`,
              showName: show.showName,
              shotName: shot.shotName,
              department: task.department,
              status: task.status,
              leadName: task.leadName,
              etaDate: date,
              etaType: type,
              isDelivered: !!task.deliveredDate,
            });
          });
        });
      });
    });

    return items.sort((a, b) => a.etaDate.getTime() - b.etaDate.getTime()).slice(0, 10);
  }, [shows]);

  // Count overdue deliveries
  const overdueCount = useMemo(() => {
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    shows.forEach(show => {
      show.shots?.forEach(shot => {
        shot.tasks?.forEach(task => {
          if (!task.deliveredDate) {
            if (task.internalEta) {
              const date = new Date(task.internalEta);
              date.setHours(0, 0, 0, 0);
              if (date < today) count++;
            }
            if (task.clientEta) {
              const date = new Date(task.clientEta);
              date.setHours(0, 0, 0, 0);
              if (date < today) count++;
            }
          }
        });
      });
    });

    return count;
  }, [shows]);

  // Count today's deliveries
  const todayCount = useMemo(() => {
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    shows.forEach(show => {
      show.shots?.forEach(shot => {
        shot.tasks?.forEach(task => {
          if (!task.deliveredDate) {
            if (task.internalEta) {
              const date = new Date(task.internalEta);
              date.setHours(0, 0, 0, 0);
              if (date.getTime() === today.getTime()) count++;
            }
            if (task.clientEta) {
              const date = new Date(task.clientEta);
              date.setHours(0, 0, 0, 0);
              if (date.getTime() === today.getTime()) count++;
            }
          }
        });
      });
    });

    return count;
  }, [shows]);

  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.statusName === status);
    return option?.colorCode || '#6B7280';
  };

  const isToday = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() === today.getTime();
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return Math.floor((checkDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Deliveries</h3>
        <Calendar className="text-blue-500" size={24} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <div>
              <p className="text-xs text-red-600">Overdue</p>
              <p className="text-xl font-bold text-red-900">{overdueCount}</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-orange-500" />
            <div>
              <p className="text-xs text-orange-600">Today</p>
              <p className="text-xl font-bold text-orange-900">{todayCount}</p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            <div>
              <p className="text-xs text-blue-600">This Week</p>
              <p className="text-xl font-bold text-blue-900">{upcomingDeliveries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {upcomingDeliveries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar size={48} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No upcoming deliveries this week</p>
          </div>
        ) : (
          upcomingDeliveries.map((item) => {
            const daysUntil = getDaysUntil(item.etaDate);
            const isUrgent = isToday(item.etaDate);
            
            return (
              <div 
                key={item.id} 
                className={`p-3 border rounded-lg transition-all hover:shadow-md ${
                  isUrgent ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {item.shotName}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-600">{item.department}</span>
                      {item.isDelivered && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-green-600 font-medium">✓ Delivered</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                      <span className="font-medium">{item.showName}</span>
                      {item.leadName && (
                        <>
                          <span>•</span>
                          <span>{item.leadName}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: getStatusColor(item.status) }}
                      >
                        {item.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.etaType === 'internal' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.etaType === 'internal' ? 'Internal' : 'Client'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right ml-3">
                    <div className={`text-sm font-semibold ${
                      isUrgent ? 'text-orange-700' : 'text-gray-900'
                    }`}>
                      {formatDisplayDate(item.etaDate)}
                    </div>
                    <div className={`text-xs ${
                      isUrgent ? 'text-orange-600 font-medium' : 'text-gray-500'
                    }`}>
                      {daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
