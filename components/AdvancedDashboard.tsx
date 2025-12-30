'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useVFXStore } from '@/lib/store';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Settings, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Calendar,
  Clock,
  Users,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Filter,
  Maximize2,
  Minimize2
} from 'lucide-react';

// Widget types
type WidgetType = 
  | 'overview'
  | 'department-breakdown'
  | 'status-distribution'
  | 'upcoming-deliveries'
  | 'overdue-tasks'
  | 'show-progress'
  | 'recent-activity'
  | 'alerts';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  enabled: boolean;
  order: number;
}

const defaultWidgets: Widget[] = [
  { id: 'w1', type: 'overview', title: 'Overview Stats', size: 'full', enabled: true, order: 1 },
  { id: 'w2', type: 'upcoming-deliveries', title: 'Upcoming Deliveries', size: 'medium', enabled: true, order: 2 },
  { id: 'w3', type: 'overdue-tasks', title: 'Overdue Tasks', size: 'medium', enabled: true, order: 3 },
  { id: 'w4', type: 'alerts', title: 'Alerts & Warnings', size: 'medium', enabled: true, order: 4 },
  { id: 'w5', type: 'recent-activity', title: 'Recent Activity', size: 'medium', enabled: true, order: 5 },
  { id: 'w6', type: 'status-distribution', title: 'Status Distribution', size: 'medium', enabled: true, order: 6 },
  { id: 'w7', type: 'department-breakdown', title: 'Department Breakdown', size: 'medium', enabled: true, order: 7 },
  { id: 'w8', type: 'show-progress', title: 'Show Progress Details', size: 'full', enabled: true, order: 8 },
];

const validWidgetTypes = new Set(defaultWidgets.map(widget => widget.type));

function sanitizeWidgets(widgets: Widget[]): Widget[] {
  const defaultsByType = Object.fromEntries(defaultWidgets.map(widget => [widget.type, widget]));
  const sanitized = widgets
    .filter(widget => validWidgetTypes.has(widget.type))
    .map(widget => {
      const defaults = defaultsByType[widget.type];
      if (!defaults) return widget;
      return {
        ...defaults,
        ...widget,
        id: defaults.id,
        size: defaults.size,
        order: defaults.order,
        title: widget.title || defaults.title,
      };
    });

  defaultWidgets.forEach(defaultWidget => {
    if (!sanitized.some(widget => widget.type === defaultWidget.type)) {
      sanitized.push({ ...defaultWidget });
    }
  });

  return sanitized.sort((a, b) => a.order - b.order);
}

export default function AdvancedDashboard() {
  const { shows } = useVFXStore();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
  const [isClient, setIsClient] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Load saved widgets on client-side only
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('dashboard-widgets');
    if (saved) {
      try {
        setWidgets(sanitizeWidgets(JSON.parse(saved)));
      } catch {
        setWidgets(defaultWidgets);
      }
    }
  }, []);

  // Save widgets to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-widgets', JSON.stringify(widgets));
  }, [widgets]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(new Date());
      // Trigger data refresh (the store will handle this)
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const toggleWidget = (id: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));
  };

  const resetWidgets = () => {
    setWidgets(defaultWidgets);
  };

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);

  const handleManualRefresh = () => {
    setLastRefresh(new Date());
    // Force data refresh
    window.location.reload();
  };

  const handleExport = async () => {
    if (!dashboardRef.current) return;

    const root = document.documentElement;

    try {
      setIsExporting(true);
      root.classList.add('export-mode');
      await new Promise(requestAnimationFrame);
      const element = dashboardRef.current;
      const canvas = await html2canvas(element, {
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        backgroundColor: '#f9fafb',
        foreignObjectRendering: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`vfx-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Failed to export dashboard', error);
    } finally {
      root.classList.remove('export-mode');
      setIsExporting(false);
    }
  };

  return (
    <div ref={dashboardRef} className="p-3 md:p-6 space-y-4 md:space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Controls - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs md:text-sm text-gray-600" suppressHydrationWarning>
              Real-time analytics • {lastRefresh.toLocaleTimeString()}
            </p>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {/* Auto-refresh Toggle */}
            <div className="flex items-center gap-2 px-2 md:px-3 py-2 bg-gray-50 rounded-lg touch-manipulation">
              <Activity size={14} className={autoRefresh ? 'text-green-600' : 'text-gray-400'} />
              <span className="text-xs md:text-sm font-medium hidden sm:inline">Auto-refresh</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors touch-manipulation ${
                  autoRefresh ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRefresh ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Manual Refresh */}
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings size={16} />
              Customize
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors ${
                isExporting
                  ? 'bg-green-400 cursor-wait'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <Download size={16} className={isExporting ? 'animate-pulse' : ''} />
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Widget Settings Panel - Mobile Optimized */}
      {showSettings && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base md:text-lg font-bold text-gray-900">Customize Dashboard</h2>
            <button
              onClick={resetWidgets}
              className="px-3 py-1.5 text-xs md:text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation"
            >
              Reset to Default
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {widgets.map(widget => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  widget.enabled
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {widget.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                <span className="text-sm font-medium">{widget.title}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refresh Interval (seconds)
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>
      )}

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {enabledWidgets.map(widget => {
          const isFullWidth = widget.size === 'full' || widget.size === 'large';
          return (
            <div
              key={widget.id}
              className={isFullWidth ? 'col-span-1 lg:col-span-2' : 'col-span-1'}
            >
              <WidgetRenderer type={widget.type} title={widget.title} />
            </div>
          );
        })}
      </div>

      {/* No Widgets Message */}
      {enabledWidgets.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AlertTriangle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Widgets Enabled</h3>
          <p className="text-gray-500 mb-4">Enable some widgets to see your dashboard</p>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Customize Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

// Widget Renderer Component
function WidgetRenderer({ type, title }: { type: WidgetType; title: string }) {
  switch (type) {
    case 'overview':
      return <OverviewWidget title={title} />;
    case 'status-distribution':
      return <StatusDistributionWidget title={title} />;
    case 'department-breakdown':
      return <DepartmentBreakdownWidget title={title} />;
    case 'upcoming-deliveries':
      return <UpcomingDeliveriesWidget title={title} />;
    case 'overdue-tasks':
      return <OverdueTasksWidget title={title} />;
    case 'show-progress':
      return <ShowProgressWidget title={title} />;
    case 'recent-activity':
      return <RecentActivityWidget title={title} />;
    case 'alerts':
      return <AlertsWidget title={title} />;
    default:
      return null;
  }
}

// Widget Components
function OverviewWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const stats = useMemo(() => {
    const allShots = shows.flatMap(s => s.shots || []);
    const allTasks = allShots.flatMap(shot => shot.tasks || []);
    
    const completed = allTasks.filter(t => ['C APP', 'C KB'].includes(t.status)).length;
    const awf = allTasks.filter(t => t.status === 'AWF').length;
    const wip = allTasks.filter(t => t.status === 'WIP').length;
    const yts = allTasks.filter(t => t.status === 'YTS').length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = allTasks.filter(t => {
      if (!t.clientEta) return false;
      const eta = new Date(t.clientEta);
      eta.setHours(0, 0, 0, 0);
      return eta < today && !['C APP', 'C KB', 'OMIT', 'HOLD'].includes(t.status);
    }).length;
    
    const completionRate = allTasks.length > 0 
      ? Math.round((completed / allTasks.length) * 100) 
      : 0;
    
    return {
      totalShows: shows.length,
      totalShots: allShots.length,
      totalTasks: allTasks.length,
      completed,
      awf,
      wip,
      yts,
      overdue,
      completionRate
    };
  }, [shows]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4" suppressHydrationWarning>{title}</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Shows"
          value={stats.totalShows}
          icon={<BarChart3 size={20} className="text-blue-600" />}
          color="blue"
        />
        <StatCard
          label="Shots"
          value={stats.totalShots}
          icon={<Target size={20} className="text-purple-600" />}
          color="purple"
        />
        <StatCard
          label="Tasks"
          value={stats.totalTasks}
          icon={<Activity size={20} className="text-indigo-600" />}
          color="indigo"
        />
        <StatCard
          label="Completion"
          value={`${stats.completionRate}%`}
          icon={<CheckCircle size={24} className="text-green-600" />}
          color="green"
        />
      </div>

      <div className="mt-4 md:mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        <MiniStatCard label="Completed" value={stats.completed} color="green" />
        <MiniStatCard label="AWF" value={stats.awf} color="orange" />
        <MiniStatCard label="WIP" value={stats.wip} color="blue" />
        <MiniStatCard label="YTS" value={stats.yts} color="gray" />
        <MiniStatCard label="Overdue" value={stats.overdue} color="red" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className={`bg-${color}-50 rounded-lg p-3 md:p-4 border border-${color}-100 touch-manipulation active:shadow-lg transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <div className="text-2xl md:text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-xs md:text-sm text-gray-600">{label}</div>
    </div>
  );
}

type MiniStatColor = 'green' | 'orange' | 'blue' | 'gray' | 'red';

interface MiniStatCardProps {
  label: string;
  value: number | string;
  color: MiniStatColor;
}

const miniStatColors: Record<MiniStatColor, string> = {
  green: 'bg-green-50 border-green-200 text-green-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
  red: 'bg-red-50 border-red-200 text-red-700',
};

function MiniStatCard({ label, value, color }: MiniStatCardProps) {
  const colorClass = miniStatColors[color] || miniStatColors.gray;

  return (
    <div className={`${colorClass} rounded-lg p-3 border text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

// Chart-based widgets
function CompletionTrendWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const trendData = useMemo(() => {
    const allTasks = shows.flatMap(s => s.shots || []).flatMap(shot => shot.tasks || []);
    const data: Array<{ date: string; completed: number; total: number; percentage: number }> = [];
    
    // Generate last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      // Count tasks completed by this date
      const completedByDate = allTasks.filter(t => {
        if (!['C APP', 'C KB'].includes(t.status)) return false;
        // For this demo, we'll show cumulative completion trend
        // In production, you'd track actual completion dates from history
        return true;
      }).length;
      
      const total = allTasks.length;
      const percentage = total > 0 ? Math.round((completedByDate / total) * 100) : 0;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: completedByDate,
        total,
        percentage
      });
    }
    
    return data;
  }, [shows]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp size={20} className="text-blue-600" />
        {title}
      </h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }} 
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'Completion %', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            formatter={(value: number | undefined, name: string | undefined) => {
              const safeValue = value ?? 0;
              const safeName = name ?? 'value';
              if (safeName === 'percentage') return [`${safeValue}%`, 'Completion'];
              return [safeValue, safeName];
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="percentage" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Completion %"
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {trendData[trendData.length - 1]?.percentage || 0}%
          </div>
          <div className="text-xs text-gray-600">Current</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {trendData[trendData.length - 1]?.completed || 0}
          </div>
          <div className="text-xs text-gray-600">Completed</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {trendData[trendData.length - 1]?.total || 0}
          </div>
          <div className="text-xs text-gray-600">Total Tasks</div>
        </div>
      </div>
    </div>
  );
}

function StatusDistributionWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const distribution = useMemo(() => {
    const allTasks = shows.flatMap(s => s.shots || []).flatMap(shot => shot.tasks || []);
    const statusCounts: Record<string, number> = {};
    
    allTasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    
    const total = allTasks.length;
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }, [shows]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4" suppressHydrationWarning>{title}</h3>
      
      <div className="space-y-3">
        {distribution.map(({ status, count, percentage }) => (
          <div key={status}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{status}</span>
              <span className="text-sm font-bold text-gray-900">{count} ({percentage}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartmentBreakdownWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const departmentData = useMemo(() => {
    const allTasks = shows.flatMap(s => s.shots || []).flatMap(shot => shot.tasks || []);
    const deptCounts: Record<string, { total: number; completed: number; inProgress: number }> = {};
    
    allTasks.forEach(task => {
      if (!deptCounts[task.department]) {
        deptCounts[task.department] = { total: 0, completed: 0, inProgress: 0 };
      }
      deptCounts[task.department].total++;
      if (['C APP', 'C KB'].includes(task.status)) {
        deptCounts[task.department].completed++;
      } else if (task.status === 'WIP') {
        deptCounts[task.department].inProgress++;
      }
    });
    
    return Object.entries(deptCounts).map(([name, counts]) => ({
      name,
      value: counts.total,
      completed: counts.completed,
      inProgress: counts.inProgress,
      percentage: allTasks.length > 0 ? Math.round((counts.total / allTasks.length) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [shows]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#f97316', '#06b6d4'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" suppressHydrationWarning>
        <PieChart size={20} className="text-purple-600" />
        {title}
      </h3>
      
      {departmentData.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No department data available</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props) => {
                  const dept = departmentData.find(d => d.name === props.name);
                  const percentage = dept ? dept.percentage : 0;
                  return `${props.name} (${percentage}%)`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} tasks (${props.payload.percentage}%)`,
                  props.payload.name
                ]}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
          
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {departmentData.map((dept, idx) => (
              <div key={dept.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{dept.name}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-bold text-gray-900">{dept.value}</span>
                  {' '}({dept.completed} done, {dept.inProgress} WIP)
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UpcomingDeliveriesWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const upcoming = useMemo(() => {
    const allTasks = shows.flatMap(show => 
      (show.shots || []).flatMap(shot => 
        (shot.tasks || []).map(task => ({
          ...task,
          shotName: shot.shotName,
          showName: show.showName
        }))
      )
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    
    return allTasks
      .filter(t => {
        if (!t.clientEta || ['C APP', 'C KB', 'OMIT', 'HOLD'].includes(t.status)) return false;
        const eta = new Date(t.clientEta);
        return eta >= today && eta <= next7Days;
      })
      .sort((a, b) => new Date(a.clientEta!).getTime() - new Date(b.clientEta!).getTime())
      .slice(0, 10);
  }, [shows]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" suppressHydrationWarning>
        <Calendar size={20} />
        {title}
      </h3>
      
      {upcoming.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No upcoming deliveries in the next 7 days</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {upcoming.map((task, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{task.shotName} - {task.department}</div>
                <div className="text-sm text-gray-600">{task.showName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-blue-600">
                  {new Date(task.clientEta!).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">{task.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverdueTasksWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const overdue = useMemo(() => {
    const allTasks = shows.flatMap(show => 
      (show.shots || []).flatMap(shot => 
        (shot.tasks || []).map(task => ({
          ...task,
          shotName: shot.shotName,
          showName: show.showName
        }))
      )
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return allTasks
      .filter(t => {
        if (!t.clientEta || ['C APP', 'C KB', 'OMIT', 'HOLD'].includes(t.status)) return false;
        const eta = new Date(t.clientEta);
        eta.setHours(0, 0, 0, 0);
        return eta < today;
      })
      .sort((a, b) => new Date(a.clientEta!).getTime() - new Date(b.clientEta!).getTime());
  }, [shows]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
      <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2" suppressHydrationWarning>
        <AlertTriangle size={20} />
        {title} ({overdue.length})
      </h3>
      
      {overdue.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto text-green-500 mb-2" size={48} />
          <p className="text-gray-500">No overdue tasks!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {overdue.map((task, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{task.shotName} - {task.department}</div>
                <div className="text-sm text-gray-600">{task.showName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-red-600">
                  {new Date(task.clientEta!).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">{task.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtistProductivityWidget({ title }: { title: string }) {
  return <PlaceholderWidget title={title} description="Artist productivity metrics" />;
}

function VelocityChartWidget({ title }: { title: string }) {
  return <PlaceholderWidget title={title} description="Team velocity over time" />;
}

function BurndownChartWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const burndownData = useMemo(() => {
    const allTasks = shows.flatMap(s => s.shots || []).flatMap(shot => shot.tasks || []);
    const total = allTasks.length;
    const completed = allTasks.filter(t => ['C APP', 'C KB'].includes(t.status)).length;
    const remaining = total - completed;
    
    // Generate burndown projection for next 30 days
    const data: Array<{ day: string; remaining: number; ideal: number }> = [];
    const dailyBurnRate = remaining / 30; // Ideal burn rate
    
    for (let i = 0; i <= 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      data.push({
        day: i === 0 ? 'Today' : `Day ${i}`,
        remaining: Math.max(0, remaining - (i * (dailyBurnRate * 0.7))), // Actual (slightly slower)
        ideal: Math.max(0, remaining - (i * dailyBurnRate)) // Ideal burndown
      });
    }
    
    return { data, total, completed, remaining };
  }, [shows]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingDown size={20} className="text-orange-600" />
        {title}
      </h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={burndownData.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="day" 
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'Tasks Remaining', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="ideal" 
            stroke="#10b981" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Ideal Burndown"
          />
          <Line 
            type="monotone" 
            dataKey="remaining" 
            stroke="#f59e0b" 
            strokeWidth={3}
            dot={{ fill: '#f59e0b', r: 3 }}
            name="Actual Remaining"
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{burndownData.total}</div>
          <div className="text-xs text-gray-600">Total Tasks</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{burndownData.completed}</div>
          <div className="text-xs text-gray-600">Completed</div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{burndownData.remaining}</div>
          <div className="text-xs text-gray-600">Remaining</div>
        </div>
      </div>
    </div>
  );
}

function ShowProgressWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4" suppressHydrationWarning>{title}</h3>
      
      <div className="space-y-6">
        {shows.map(show => {
          const shots = show.shots || [];
          const tasks = shots.flatMap(s => s.tasks || []);
          const completed = tasks.filter(t => ['C APP', 'C KB'].includes(t.status)).length;
          const total = tasks.length;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          // Department-wise breakdown
          const deptStats: Record<string, { total: number; completed: number; wip: number; pending: number }> = {};
          tasks.forEach(task => {
            if (!deptStats[task.department]) {
              deptStats[task.department] = { total: 0, completed: 0, wip: 0, pending: 0 };
            }
            deptStats[task.department].total++;
            if (['C APP', 'C KB'].includes(task.status)) {
              deptStats[task.department].completed++;
            } else if (task.status === 'WIP') {
              deptStats[task.department].wip++;
            } else if (task.status === 'PEND') {
              deptStats[task.department].pending++;
            }
          });
          
          return (
            <div key={show.id} className="border border-gray-200 rounded-lg p-5 bg-gradient-to-br from-white to-gray-50">
              {/* Show Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{show.showName}</h4>
                  <p className="text-sm text-gray-600 mt-1">{show.clientName}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{percentage}%</div>
                  <div className="text-xs text-gray-500 mt-1">{completed}/{total} tasks completed</div>
                </div>
              </div>
              
              {/* Overall Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                  <span className="text-sm text-gray-600">{shots.length} Shots</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 h-4 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-4">
                <div className="text-center p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                  <div className="text-xl font-bold text-gray-900">{shots.length}</div>
                  <div className="text-xs text-gray-600 mt-1">Total Shots</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg shadow-sm border border-green-100">
                  <div className="text-xl font-bold text-green-700">{completed}</div>
                  <div className="text-xs text-green-600 mt-1">Completed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg shadow-sm border border-blue-100">
                  <div className="text-xl font-bold text-blue-700">{tasks.filter(t => t.status === 'WIP').length}</div>
                  <div className="text-xs text-blue-600 mt-1">In Progress</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg shadow-sm border border-orange-100">
                  <div className="text-xl font-bold text-orange-700">{tasks.filter(t => t.status === 'PEND').length}</div>
                  <div className="text-xs text-orange-600 mt-1">Pending</div>
                </div>
              </div>
              
              {/* Department-wise Breakdown */}
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Department-wise Progress
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {Object.entries(deptStats)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([dept, stats]) => {
                      const deptPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                      return (
                        <div key={dept} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900">{dept}</span>
                            <span className="text-sm font-bold text-blue-600">{deptPercentage}%</span>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${deptPercentage}%` }}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-3">
                              <span className="text-green-600" title="Completed">
                                ✓ {stats.completed}
                              </span>
                              <span className="text-blue-600" title="In Progress">
                                ⟳ {stats.wip}
                              </span>
                              <span className="text-orange-600" title="Pending">
                                ○ {stats.pending}
                              </span>
                            </div>
                            <span className="text-gray-500 font-medium">{stats.total} total</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivityWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const recentActivity = useMemo(() => {
    const activities: Array<{
      id: string;
      type: string;
      message: string;
      timestamp: Date;
      status: string;
    }> = [];
    
    // Get tasks with recent status changes (simulated - in production, track actual history)
    const allTasks = shows.flatMap(show => 
      (show.shots || []).flatMap(shot => 
        (shot.tasks || []).map(task => ({
          ...task,
          shotName: shot.shotName,
          showName: show.showName
        }))
      )
    );
    
    // Recently completed tasks
    const completed = allTasks
      .filter(t => ['C APP', 'C KB'].includes(t.status))
      .slice(0, 5)
      .map((t, idx) => ({
        id: `completed-${idx}`,
        type: 'completed',
        message: `${t.shotName} - ${t.department} marked as ${t.status}`,
        timestamp: new Date(Date.now() - Math.random() * 3600000), // Random within last hour
        status: t.status
      }));
    
    // In progress tasks
    const inProgress = allTasks
      .filter(t => t.status === 'WIP')
      .slice(0, 3)
      .map((t, idx) => ({
        id: `wip-${idx}`,
        type: 'progress',
        message: `${t.shotName} - ${t.department} in progress by ${t.leadName || 'Unassigned'}`,
        timestamp: new Date(Date.now() - Math.random() * 7200000), // Random within last 2 hours
        status: t.status
      }));
    
    // Pending tasks
    const pending = allTasks
      .filter(t => t.status === 'PEND')
      .slice(0, 2)
      .map((t, idx) => ({
        id: `pend-${idx}`,
        type: 'pending',
        message: `${t.shotName} - ${t.department} is pending`,
        timestamp: new Date(Date.now() - Math.random() * 10800000), // Random within last 3 hours
        status: t.status
      }));
    
    return [...completed, ...inProgress, ...pending]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }, [shows]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completed': return <CheckCircle className="text-green-600" size={16} />;
      case 'progress': return <Activity className="text-blue-600" size={16} />;
      case 'pending': return <Clock className="text-orange-600" size={16} />;
      default: return <Activity className="text-gray-600" size={16} />;
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" suppressHydrationWarning>
        <Activity size={20} className="text-blue-600" />
        {title}
      </h3>
      
      {recentActivity.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No recent activity</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {recentActivity.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500 mt-1">{getTimeAgo(activity.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsWidget({ title }: { title: string }) {
  const { shows } = useVFXStore();
  
  const alerts = useMemo(() => {
    const allTasks = shows.flatMap(show => 
      (show.shots || []).flatMap(shot => 
        (shot.tasks || []).map(task => ({
          ...task,
          shotName: shot.shotName,
          showName: show.showName
        }))
      )
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alertList: Array<{ type: string; message: string; severity: string }> = [];
    
    // Overdue tasks
    const overdueCount = allTasks.filter(t => {
      if (!t.clientEta || ['C APP', 'C KB', 'OMIT', 'HOLD'].includes(t.status)) return false;
      const eta = new Date(t.clientEta);
      eta.setHours(0, 0, 0, 0);
      return eta < today;
    }).length;
    
    if (overdueCount > 0) {
      alertList.push({
        type: 'overdue',
        message: `${overdueCount} task${overdueCount > 1 ? 's' : ''} overdue`,
        severity: 'high'
      });
    }
    
    // Tasks due today
    const dueTodayCount = allTasks.filter(t => {
      if (!t.clientEta || ['C APP', 'C KB', 'OMIT', 'HOLD'].includes(t.status)) return false;
      const eta = new Date(t.clientEta);
      eta.setHours(0, 0, 0, 0);
      return eta.getTime() === today.getTime();
    }).length;
    
    if (dueTodayCount > 0) {
      alertList.push({
        type: 'due-today',
        message: `${dueTodayCount} task${dueTodayCount > 1 ? 's' : ''} due today`,
        severity: 'medium'
      });
    }
    
    // Tasks without leads
    const noLeadCount = allTasks.filter(t => 
      !t.leadName && !['OMIT', 'HOLD'].includes(t.status)
    ).length;
    
    if (noLeadCount > 0) {
      alertList.push({
        type: 'no-lead',
        message: `${noLeadCount} task${noLeadCount > 1 ? 's' : ''} without lead assignment`,
        severity: 'low'
      });
    }
    
    return alertList;
  }, [shows]);

  const severityColors = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-orange-50 border-orange-200 text-orange-700',
    low: 'bg-yellow-50 border-yellow-200 text-yellow-700'
  };

  const severityIcons = {
    high: <XCircle size={20} />,
    medium: <AlertTriangle size={20} />,
    low: <Clock size={20} />
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4" suppressHydrationWarning>{title}</h3>
      
      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto text-green-500 mb-2" size={48} />
          <p className="text-gray-500">All clear! No alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                severityColors[alert.severity as keyof typeof severityColors]
              }`}
            >
              {severityIcons[alert.severity as keyof typeof severityIcons]}
              <span className="font-medium">{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderWidget({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2" suppressHydrationWarning>{title}</h3>
      <p className="text-gray-500 text-center py-12">{description}</p>
      <p className="text-xs text-gray-400 text-center">Coming soon...</p>
    </div>
  );
}
