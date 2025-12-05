'use client';

import { useState, useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, subDays, subMonths } from 'date-fns';
import { toast } from 'react-hot-toast';

// Glass morphism card
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-slate-800/40 backdrop-blur-lg border border-slate-700/50 rounded-lg shadow-xl ${className}`}>
    {children}
  </div>
);

// Skeleton loader
const SkeletonLoader = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`}></div>
);

// Empty state
const EmptyState = ({ icon, title, description, action }: { icon: string; title: string; description: string; action?: () => void }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-6xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-400 text-center max-w-md mb-4">{description}</p>
    {action && (
      <button onClick={action} className="px-6 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500">
        Get Started
      </button>
    )}
  </div>
);

interface ReportMetric {
  id: string;
  name: string;
  type: 'count' | 'sum' | 'average' | 'percentage';
  category: 'shows' | 'shots' | 'tasks' | 'resources' | 'deliveries';
  description: string;
}

interface ReportFilter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: string | number | [number, number];
}

interface DateRange {
  type: 'custom' | 'last7days' | 'last30days' | 'last3months' | 'thisMonth' | 'lastMonth';
  startDate?: Date;
  endDate?: Date;
}

interface SavedReport {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  filters: ReportFilter[];
  dateRange: DateRange;
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients: string[];
  };
  createdAt: Date;
  lastRun?: Date;
}

// Sortable metric item
function SortableMetricItem({ metric, onRemove }: { metric: ReportMetric; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: metric.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-slate-700/50 border border-slate-600 rounded group hover:border-cyan-500"
    >
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <div>
          <div className="text-white font-medium">{metric.name}</div>
          <div className="text-xs text-slate-400">{metric.description}</div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

export default function CustomReportsBuilder() {
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<ReportMetric[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ type: 'last30days' });
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedule, setSchedule] = useState({
    enabled: false,
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    recipients: ['']
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Available metrics
  const availableMetrics: ReportMetric[] = [
    { id: 'm1', name: 'Total Shows', type: 'count', category: 'shows', description: 'Count of active shows' },
    { id: 'm2', name: 'Total Shots', type: 'count', category: 'shots', description: 'Count of all shots' },
    { id: 'm3', name: 'Completed Tasks', type: 'count', category: 'tasks', description: 'Tasks marked as complete' },
    { id: 'm4', name: 'Active Artists', type: 'count', category: 'resources', description: 'Active team members' },
    { id: 'm5', name: 'Total Man-Days', type: 'sum', category: 'resources', description: 'Sum of allocated man-days' },
    { id: 'm6', name: 'Utilization Rate', type: 'percentage', category: 'resources', description: 'Resource utilization %' },
    { id: 'm7', name: 'On-Time Delivery Rate', type: 'percentage', category: 'deliveries', description: 'Deliveries on schedule' },
    { id: 'm8', name: 'Avg Shot Duration', type: 'average', category: 'shots', description: 'Average frames per shot' },
    { id: 'm9', name: 'Task Completion Rate', type: 'percentage', category: 'tasks', description: 'Completed vs total tasks' },
    { id: 'm10', name: 'Department Workload', type: 'sum', category: 'tasks', description: 'Tasks by department' },
  ];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedMetrics((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addMetric = (metric: ReportMetric) => {
    if (!selectedMetrics.find(m => m.id === metric.id)) {
      setSelectedMetrics([...selectedMetrics, metric]);
      toast.success(`Added ${metric.name}`);
    }
  };

  const removeMetric = (metricId: string) => {
    setSelectedMetrics(selectedMetrics.filter(m => m.id !== metricId));
  };

  const addFilter = () => {
    setFilters([...filters, {
      id: `f${Date.now()}`,
      field: '',
      operator: 'equals',
      value: ''
    }]);
  };

  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const calculateDateRange = (range: DateRange) => {
    const now = new Date();
    switch (range.type) {
      case 'last7days':
        return { start: subDays(now, 7), end: now };
      case 'last30days':
        return { start: subDays(now, 30), end: now };
      case 'last3months':
        return { start: subMonths(now, 3), end: now };
      case 'thisMonth':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { 
          start: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
          end: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
        };
      case 'custom':
        return { start: range.startDate || now, end: range.endDate || now };
    }
  };

  const saveReport = async () => {
    if (!reportName) {
      toast.error('Please enter a report name');
      return;
    }

    if (selectedMetrics.length === 0) {
      toast.error('Please select at least one metric');
      return;
    }

    const newReport: SavedReport = {
      id: `r${Date.now()}`,
      name: reportName,
      description: reportDescription,
      metrics: selectedMetrics.map(m => m.id),
      filters,
      dateRange,
      schedule: schedule.enabled ? schedule : undefined,
      createdAt: new Date()
    };

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport)
      });

      if (response.ok) {
        setSavedReports([...savedReports, newReport]);
        toast.success('Report saved successfully!');
        resetForm();
      }
    } catch (error) {
      toast.error('Failed to save report');
    }
  };

  const exportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    if (selectedMetrics.length === 0) {
      toast.error('Please select metrics to export');
      return;
    }

    toast.success(`Exporting as ${format.toUpperCase()}...`);

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: selectedMetrics.map(m => m.id),
          filters,
          dateRange,
          format
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
        a.click();
        toast.success('Export completed!');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const runReport = async (reportId: string) => {
    toast.success('Running report...');
    // Implementation for running saved report
  };

  const deleteReport = (reportId: string) => {
    setSavedReports(savedReports.filter(r => r.id !== reportId));
    toast.success('Report deleted');
  };

  const resetForm = () => {
    setReportName('');
    setReportDescription('');
    setSelectedMetrics([]);
    setFilters([]);
    setDateRange({ type: 'last30days' });
    setSchedule({ enabled: false, frequency: 'weekly', time: '09:00', recipients: [''] });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Custom Reports Builder</h1>
          <p className="text-slate-400 mt-1">Design, schedule, and export custom analytics reports</p>
        </div>
        <button
          onClick={resetForm}
          className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
        >
          Reset Form
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Builder Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Details */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">📋 Report Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Report Name *</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Monthly Production Summary"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Description</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Brief description of this report..."
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </GlassCard>

          {/* Selected Metrics (Drag & Drop) */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">📊 Selected Metrics (Drag to Reorder)</h3>
            {selectedMetrics.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selectedMetrics.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {selectedMetrics.map(metric => (
                      <SortableMetricItem
                        key={metric.id}
                        metric={metric}
                        onRemove={() => removeMetric(metric.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <EmptyState
                icon="📊"
                title="No Metrics Selected"
                description="Choose metrics from the available list to build your report"
              />
            )}
          </GlassCard>

          {/* Filters */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">🔍 Filters</h3>
              <button
                onClick={addFilter}
                className="px-3 py-1 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-500"
              >
                + Add Filter
              </button>
            </div>
            {filters.length > 0 ? (
              <div className="space-y-3">
                {filters.map(filter => (
                  <div key={filter.id} className="flex gap-2">
                    <select
                      value={filter.field}
                      onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none text-sm"
                    >
                      <option value="">Select Field</option>
                      <option value="showName">Show Name</option>
                      <option value="department">Department</option>
                      <option value="status">Status</option>
                      <option value="artist">Artist</option>
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(filter.id, { operator: e.target.value as any })}
                      className="px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none text-sm"
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater">Greater Than</option>
                      <option value="less">Less Than</option>
                    </select>
                    <input
                      type="text"
                      value={filter.value as string}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none text-sm"
                    />
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No filters applied</p>
            )}
          </GlassCard>

          {/* Date Range */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">📅 Date Range</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['last7days', 'last30days', 'last3months', 'thisMonth', 'lastMonth', 'custom'].map(type => (
                <button
                  key={type}
                  onClick={() => setDateRange({ type: type as any })}
                  className={`px-4 py-2 rounded text-sm ${
                    dateRange.type === type
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {type === 'last7days' ? 'Last 7 Days' :
                   type === 'last30days' ? 'Last 30 Days' :
                   type === 'last3months' ? 'Last 3 Months' :
                   type === 'thisMonth' ? 'This Month' :
                   type === 'lastMonth' ? 'Last Month' : 'Custom'}
                </button>
              ))}
            </div>
            {dateRange.type === 'custom' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Start Date</label>
                  <input
                    type="date"
                    onChange={(e) => setDateRange({ ...dateRange, startDate: new Date(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">End Date</label>
                  <input
                    type="date"
                    onChange={(e) => setDateRange({ ...dateRange, endDate: new Date(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={saveReport}
              className="px-6 py-3 bg-cyan-600 text-white rounded hover:bg-cyan-500 font-medium"
            >
              💾 Save Report
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded hover:bg-purple-500 font-medium"
            >
              📅 Schedule
            </button>
            <button
              onClick={() => exportReport('excel')}
              className="px-6 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-500 font-medium"
            >
              📊 Export Excel
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-500 font-medium"
            >
              📄 Export PDF
            </button>
            <button
              onClick={() => exportReport('csv')}
              className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-500 font-medium"
            >
              📋 Export CSV
            </button>
          </div>
        </div>

        {/* Available Metrics Sidebar */}
        <div className="space-y-6">
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">📌 Available Metrics</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {availableMetrics.map(metric => (
                <button
                  key={metric.id}
                  onClick={() => addMetric(metric)}
                  disabled={selectedMetrics.some(m => m.id === metric.id)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedMetrics.some(m => m.id === metric.id)
                      ? 'bg-slate-700/30 border-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-slate-700/50 border-slate-600 hover:border-cyan-500 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{metric.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{metric.description}</div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-slate-600 text-slate-300 rounded">{metric.category}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-600 text-slate-300 rounded">{metric.type}</span>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Saved Reports */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">💾 Saved Reports</h3>
            {savedReports.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {savedReports.map(report => (
                  <div key={report.id} className="p-3 bg-slate-700/50 border border-slate-600 rounded">
                    <div className="font-medium text-white text-sm">{report.name}</div>
                    {report.description && (
                      <div className="text-xs text-slate-400 mt-1">{report.description}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => runReport(report.id)}
                        className="text-xs px-2 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-500"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No saved reports yet</p>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">📅 Schedule Report</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-white">Enable Scheduled Delivery</label>
              </div>
              {schedule.enabled && (
                <>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Frequency</label>
                    <select
                      value={schedule.frequency}
                      onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Time</label>
                    <input
                      type="time"
                      value={schedule.time}
                      onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Email Recipients</label>
                    {schedule.recipients.map((recipient, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input
                          type="email"
                          value={recipient}
                          onChange={(e) => {
                            const newRecipients = [...schedule.recipients];
                            newRecipients[idx] = e.target.value;
                            setSchedule({ ...schedule, recipients: newRecipients });
                          }}
                          placeholder="email@example.com"
                          className="flex-1 px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
                        />
                        {idx === schedule.recipients.length - 1 && (
                          <button
                            onClick={() => setSchedule({ ...schedule, recipients: [...schedule.recipients, ''] })}
                            className="px-3 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500"
                          >
                            +
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    toast.success('Schedule saved!');
                  }}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
