'use client';

import { useVFXStore } from '@/lib/store';
import { useMemo, useState } from 'react';
import { Calendar, Filter, X, AlertCircle, CheckCircle, Clock, Download, Search, Mail } from 'lucide-react';
import { formatDisplayDate } from '@/lib/utils';
import * as XLSX from 'xlsx';
import SendDeliveryListModal from './SendDeliveryListModal';
import { useSession } from 'next-auth/react';
import { showError } from '@/lib/toast';
import { matchesShotName } from '@/lib/searchUtils';

type DeliveryType = 'internalEta' | 'clientEta';
type DateFilter = 'all' | 'today' | 'thisWeek' | 'overdue' | 'custom';

export default function DeliveryView() {
  const { shows, statusOptions } = useVFXStore();
  const { data: session } = useSession();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [deliveryTypes, setDeliveryTypes] = useState<DeliveryType[]>(['internalEta', 'clientEta']);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSendDeliveryModal, setShowSendDeliveryModal] = useState(false);
  
  // Additional filters
  const [selectedShows, setSelectedShows] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]); // Internal/Main filter

  // Check if user has permission to send deliveries (ADMIN or COORDINATOR only)
  const canSendDelivery = useMemo(() => {
    if (!session?.user) return false;
    const role = (session.user as any).role;
    const permissions = (session.user as any).permissions || [];
    
    // Check role-based permission
    if (role === 'ADMIN' || role === 'COORDINATOR') return true;
    
    // Check custom permission
    return permissions.includes('deliveries.send');
  }, [session]);

  // Get all departments
  const allDepartments = useMemo(() => {
    const depts = new Set<string>();
    shows.forEach(show => {
      try {
        const departments = typeof show.departments === 'string' 
          ? JSON.parse(show.departments) 
          : show.departments;
        if (Array.isArray(departments)) {
          departments.forEach(dept => depts.add(dept));
        }
      } catch (e) {
        console.error('Error parsing departments:', e);
      }
    });
    return Array.from(depts).sort();
  }, [shows]);

  // Get unique leads
  const allLeads = useMemo(() => {
    const leads = new Set<string>();
    shows.forEach(show => {
      show.shots?.forEach(shot => {
        shot.tasks?.forEach(task => {
          if (task.leadName) leads.add(task.leadName);
        });
      });
    });
    return Array.from(leads).sort();
  }, [shows]);

  // Helper function to check if date matches filter
  const matchesDateFilter = (date: Date | null, deliveryType: DeliveryType) => {
    if (!date) return false;
    if (!deliveryTypes.includes(deliveryType)) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today':
        return dateToCheck.getTime() === today.getTime();
      
      case 'thisWeek': {
        const weekFromNow = new Date(today);
        weekFromNow.setDate(today.getDate() + 7);
        return dateToCheck >= today && dateToCheck <= weekFromNow;
      }
      
      case 'overdue':
        return dateToCheck < today;
      
      case 'custom':
        if (!customDateFrom && !customDateTo) return true;
        if (customDateFrom && customDateTo) {
          const from = new Date(customDateFrom);
          from.setHours(0, 0, 0, 0);
          const to = new Date(customDateTo);
          to.setHours(23, 59, 59, 999);
          return dateToCheck >= from && dateToCheck <= to;
        }
        if (customDateFrom) {
          const from = new Date(customDateFrom);
          from.setHours(0, 0, 0, 0);
          return dateToCheck >= from;
        }
        if (customDateTo) {
          const to = new Date(customDateTo);
          to.setHours(23, 59, 59, 999);
          return dateToCheck <= to;
        }
        return true;
      
      case 'all':
      default:
        return true;
    }
  };

  // Build delivery items
  const deliveryItems = useMemo(() => {
    const items: any[] = [];

    shows.forEach(show => {
      // Apply show filter
      if (selectedShows.length > 0 && !selectedShows.includes(show.id)) {
        return;
      }

      show.shots?.forEach(shot => {
        // Apply tag filter
        if (selectedTags.length > 0 && !selectedTags.includes(shot.shotTag)) {
          return;
        }

        shot.tasks?.forEach(task => {
          // Apply department filter
          if (selectedDepartment !== 'ALL' && task.department !== selectedDepartment) {
            return;
          }

          // Apply status filter
          if (selectedStatuses.length > 0 && !selectedStatuses.includes(task.status)) {
            return;
          }

          // Apply lead filter
          if (selectedLeads.length > 0 && task.leadName && !selectedLeads.includes(task.leadName)) {
            return;
          }

          // Apply type filter (Internal/Main)
          const taskType = task.isInternal ? 'Internal' : 'Main';
          if (selectedTypes.length > 0 && !selectedTypes.includes(taskType)) {
            return;
          }

          // Check if task has any matching delivery dates
          const hasInternalEta = task.internalEta && matchesDateFilter(new Date(task.internalEta), 'internalEta');
          const hasClientEta = task.clientEta && matchesDateFilter(new Date(task.clientEta), 'clientEta');

          if (hasInternalEta || hasClientEta) {
            items.push({
              id: task.id,
              showName: show.showName,
              shotName: shot.shotName,
              shotTag: shot.shotTag,
              department: task.department,
              isInternal: task.isInternal,
              status: task.status,
              leadName: task.leadName,
              internalEta: task.internalEta,
              clientEta: task.clientEta,
              deliveredDate: task.deliveredDate,
              deliveredVersion: task.deliveredVersion,
            });
          }
        });
      });
    });

    // Sort by earliest delivery date
    return items.sort((a, b) => {
      const aDate = new Date(a.internalEta || a.clientEta || '9999-12-31');
      const bDate = new Date(b.internalEta || b.clientEta || '9999-12-31');
      return aDate.getTime() - bDate.getTime();
    });
  }, [shows, selectedDepartment, deliveryTypes, dateFilter, customDateFrom, customDateTo, selectedShows, selectedStatuses, selectedLeads, selectedTags, selectedTypes]);

  // Apply search filter to delivery items
  const filteredDeliveryItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return deliveryItems;
    }

    const query = searchQuery.toLowerCase().trim();
    return deliveryItems.filter(item => {
      return (
        item.showName.toLowerCase().includes(query) ||
        matchesShotName(item.shotName, query) ||
        item.shotTag.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query) ||
        (item.leadName && item.leadName.toLowerCase().includes(query)) ||
        item.status.toLowerCase().includes(query) ||
        (item.isInternal ? 'internal' : 'main').includes(query)
      );
    });
  }, [deliveryItems, searchQuery]);

  // Export delivery report to Excel
  const handleExportDeliveries = () => {
    if (filteredDeliveryItems.length === 0) {
      alert('No deliveries to export!');
      return;
    }

    // Prepare data for export
    const exportData = filteredDeliveryItems.map(item => {
      const row: any = {
        'Show': item.showName,
        'Shot': item.shotName,
        'Tag': item.shotTag,
        'Type': item.isInternal ? 'Internal' : 'Main',
        'Department': item.department,
        'Lead': item.leadName || '-',
        'Status': item.status,
      };

      // Add ETA columns based on selected delivery types
      if (deliveryTypes.includes('internalEta')) {
        row['Internal ETA'] = item.internalEta ? formatDisplayDate(item.internalEta) : '-';
      }
      if (deliveryTypes.includes('clientEta')) {
        row['Client ETA'] = item.clientEta ? formatDisplayDate(item.clientEta) : '-';
      }

      // Add delivered info
      row['Delivered Date'] = item.deliveredDate ? formatDisplayDate(item.deliveredDate) : '-';
      row['Delivered Version'] = item.deliveredVersion || '-';

      return row;
    });

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deliveries');

    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(exportData[0] || {}).map(key => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map(row => String(row[key] || '').length)
      );
      return { wch: Math.min(maxLen + 2, maxWidth) };
    });
    ws['!cols'] = colWidths;

    // Generate filename with timestamp and filters
    const timestamp = new Date().toISOString().slice(0, 10);
    const deptSuffix = selectedDepartment !== 'ALL' ? `_${selectedDepartment}` : '';
    const dateSuffix = dateFilter !== 'all' ? `_${dateFilter}` : '';
    const filename = `Delivery_Report_${timestamp}${deptSuffix}${dateSuffix}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };

  // Handle send delivery list click
  const handleSendDeliveryClick = () => {
    if (!canSendDelivery) {
      showError('You do not have permission to send delivery lists. Only Admins and Coordinators can send deliveries.');
      return;
    }
    setShowSendDeliveryModal(true);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.statusName === status);
    return option?.colorCode || '#6B7280';
  };

  // Check if date is overdue
  const isOverdue = (date: Date | string | null) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  // Check if date is today
  const isToday = (date: Date | string | null) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() === today.getTime();
  };

  // Get delivery urgency
  const getDeliveryUrgency = (internalEta: any, clientEta: any) => {
    const dates = [internalEta, clientEta].filter(d => d).map(d => new Date(d));
    if (dates.length === 0) return null;
    
    const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
    
    if (isOverdue(earliestDate)) return 'overdue';
    if (isToday(earliestDate)) return 'today';
    
    const daysUntil = Math.floor((earliestDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) return 'urgent';
    if (daysUntil <= 7) return 'soon';
    return 'normal';
  };

  const hasActiveFilters = selectedShows.length > 0 || selectedStatuses.length > 0 || 
                          selectedLeads.length > 0 || selectedTags.length > 0 || 
                          selectedTypes.length > 0 || dateFilter !== 'all' || deliveryTypes.length < 2;

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Delivery Tracker</h2>
          <p className="text-sm text-gray-600">Track deliveries by ETA dates</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export button */}
          <button
            onClick={handleExportDeliveries}
            disabled={filteredDeliveryItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export Report
          </button>

          {/* Send Delivery List button */}
          <button
            onClick={handleSendDeliveryClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              canSendDelivery
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
            }`}
            title={canSendDelivery ? 'Send delivery list' : 'No permission - Admin/Coordinator only'}
          >
            <Mail size={18} />
            Send Delivery List
          </button>

          {/* Department selector */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Departments</option>
            {allDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Filter button */}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter size={18} />
            Filters
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                Active
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by shot, show, lead, status, department, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Filter Options</h3>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSelectedShows([]);
                  setSelectedStatuses([]);
                  setSelectedLeads([]);
                  setSelectedTags([]);
                  setSelectedTypes([]);
                  setDateFilter('all');
                  setDeliveryTypes(['internalEta', 'clientEta']);
                  setCustomDateFrom('');
                  setCustomDateTo('');
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <X size={12} />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Delivery Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Delivery Type
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={deliveryTypes.includes('internalEta')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDeliveryTypes([...deliveryTypes, 'internalEta']);
                      } else {
                        setDeliveryTypes(deliveryTypes.filter(t => t !== 'internalEta'));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                  />
                  <span className="text-xs text-gray-700">Internal ETA</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={deliveryTypes.includes('clientEta')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDeliveryTypes([...deliveryTypes, 'clientEta']);
                      } else {
                        setDeliveryTypes(deliveryTypes.filter(t => t !== 'clientEta'));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                  />
                  <span className="text-xs text-gray-700">Client ETA</span>
                </label>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="space-y-1">
                {(['all', 'today', 'thisWeek', 'overdue', 'custom'] as DateFilter[]).map(filter => (
                  <label key={filter} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="radio"
                      name="dateFilter"
                      checked={dateFilter === filter}
                      onChange={() => setDateFilter(filter)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700 capitalize">
                      {filter === 'thisWeek' ? 'This Week' : filter}
                    </span>
                  </label>
                ))}
              </div>
              
              {dateFilter === 'custom' && (
                <div className="mt-1.5 space-y-1.5">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    placeholder="From"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    placeholder="To"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Show Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Shows
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {shows.map(show => (
                  <label key={show.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedShows.includes(show.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedShows([...selectedShows, show.id]);
                        } else {
                          setSelectedShows(selectedShows.filter(id => id !== show.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{show.showName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {statusOptions.filter(opt => opt.isActive).map(status => (
                  <label key={status.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status.statusName)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStatuses([...selectedStatuses, status.statusName]);
                        } else {
                          setSelectedStatuses(selectedStatuses.filter(s => s !== status.statusName));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{status.statusName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Lead Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Lead Name
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto border border-gray-300 rounded-md p-1.5">
                {allLeads.map(lead => (
                  <label key={lead} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeads([...selectedLeads, lead]);
                        } else {
                          setSelectedLeads(selectedLeads.filter(l => l !== lead));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{lead}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type Filter (Internal/Main) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="space-y-1">
                {['Internal', 'Main'].map(type => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTypes([...selectedTypes, type]);
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tag Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tag
              </label>
              <div className="space-y-1">
                {['Fresh', 'Additional'].map(tag => (
                  <label key={tag} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTags([...selectedTags, tag]);
                        } else {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs text-gray-700">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Overdue</p>
              <p className="text-2xl font-bold text-red-900">
                {filteredDeliveryItems.filter(item => getDeliveryUrgency(item.internalEta, item.clientEta) === 'overdue').length}
              </p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>

        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Due Today</p>
              <p className="text-2xl font-bold text-orange-900">
                {filteredDeliveryItems.filter(item => getDeliveryUrgency(item.internalEta, item.clientEta) === 'today').length}
              </p>
            </div>
            <Clock className="text-orange-500" size={32} />
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">This Week</p>
              <p className="text-2xl font-bold text-yellow-900">
                {filteredDeliveryItems.filter(item => ['urgent', 'soon'].includes(getDeliveryUrgency(item.internalEta, item.clientEta) || '')).length}
              </p>
            </div>
            <Calendar className="text-yellow-500" size={32} />
          </div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Total Deliveries</p>
              <p className="text-2xl font-bold text-green-900">{filteredDeliveryItems.length}</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
      </div>

      {/* Delivery Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Show</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Shot</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tag</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                {deliveryTypes.includes('internalEta') && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Internal ETA</th>
                )}
                {deliveryTypes.includes('clientEta') && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Client ETA</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Delivered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDeliveryItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    {searchQuery ? 'No deliveries found matching your search' : 'No deliveries found for the selected filters'}
                  </td>
                </tr>
              ) : (
                filteredDeliveryItems.map((item) => {
                  const urgency = getDeliveryUrgency(item.internalEta, item.clientEta);
                  const rowClass = urgency === 'overdue' ? 'bg-red-50' : 
                                   urgency === 'today' ? 'bg-orange-50' : 
                                   urgency === 'urgent' ? 'bg-yellow-50' : '';
                  
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${rowClass}`}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.showName}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.shotName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.shotTag === 'Fresh' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {item.shotTag}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {item.isInternal ? 'Internal' : 'Main'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.leadName || '-'}</td>
                      <td className="px-4 py-3">
                        <span 
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: getStatusColor(item.status) }}
                        >
                          {item.status}
                        </span>
                      </td>
                      {deliveryTypes.includes('internalEta') && (
                        <td className="px-4 py-3 text-sm">
                          {item.internalEta ? (
                            <div className={`${isOverdue(item.internalEta) ? 'text-red-600 font-semibold' : isToday(item.internalEta) ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}>
                              {formatDisplayDate(item.internalEta)}
                              {isOverdue(item.internalEta) && <span className="ml-1">⚠️</span>}
                              {isToday(item.internalEta) && <span className="ml-1">🔔</span>}
                            </div>
                          ) : '-'}
                        </td>
                      )}
                      {deliveryTypes.includes('clientEta') && (
                        <td className="px-4 py-3 text-sm">
                          {item.clientEta ? (
                            <div className={`${isOverdue(item.clientEta) ? 'text-red-600 font-semibold' : isToday(item.clientEta) ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}>
                              {formatDisplayDate(item.clientEta)}
                              {isOverdue(item.clientEta) && <span className="ml-1">⚠️</span>}
                              {isToday(item.clientEta) && <span className="ml-1">🔔</span>}
                            </div>
                          ) : '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">
                        {item.deliveredDate ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-green-500" />
                            <span className="text-green-700">{formatDisplayDate(item.deliveredDate)}</span>
                            {item.deliveredVersion && (
                              <span className="text-xs text-gray-500">({item.deliveredVersion})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Delivery List Modal */}
      {showSendDeliveryModal && (
        <SendDeliveryListModal onClose={() => setShowSendDeliveryModal(false)} />
      )}
    </div>
  );
}
