'use client';

import { Plus, Download, Upload, FileSpreadsheet, RefreshCw, Settings, History, ChevronRight, ChevronLeft, User, LogOut, Users } from 'lucide-react';
import { useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useVFXStore } from '@/lib/store';
import { useKeyboardShortcut } from '@/lib/hooks';
import { exportToExcel, downloadTemplate, parseExcelFile, validateImportData, validateUpdateData } from '@/lib/excel';
import NewShowModal from './NewShowModal';
import NewShotModal from './NewShotModal';
import StatusManagementModal from './StatusManagementModal';
import ImportPreviewModal from './ImportPreviewModal';
import ActivityLogModal from './ActivityLogModal';
import NotificationBell from './NotificationBell';

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const { shows, shots, tasks, setShows } = useVFXStore();
  const [showNewShow, setShowNewShow] = useState(false);
  const [showNewShot, setShowNewShot] = useState(false);
  const [showStatusManagement, setShowStatusManagement] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(true);
  const [importChanges, setImportChanges] = useState<any[]>([]);
  const [importData, setImportData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateInputRef = useRef<HTMLInputElement>(null);
  const ingestInputRef = useRef<HTMLInputElement>(null);

  const user = session?.user as any;
  const userPermissions = user?.permissions || [];
  
  // Check if user has any edit permission
  const hasEditPermission = user?.role === 'ADMIN' || user?.role === 'COORDINATOR' || 
    shows.some(show => show.canEdit === true);

  // Individual permission checks (role OR custom permission)
  const canImport = hasEditPermission || userPermissions.includes('shots.import');
  const canUpdate = hasEditPermission || userPermissions.includes('shots.update');
  const canCreateShot = hasEditPermission || userPermissions.includes('shots.create');
  const canCreateShow = user?.role === 'ADMIN' || user?.role === 'COORDINATOR' || userPermissions.includes('shows.create');
  const canManageStatuses = user?.role === 'ADMIN' || user?.role === 'COORDINATOR' || userPermissions.includes('admin.statuses');

  // Keyboard shortcuts
  useKeyboardShortcut('n', () => setShowNewShot(true), true); // Ctrl+N for new shot
  useKeyboardShortcut('e', () => handleExport(), true); // Ctrl+E for export
  useKeyboardShortcut('i', () => setShowImportModal(true), true); // Ctrl+I for import modal
  useKeyboardShortcut('l', () => setShowActivityLog(true), true); // Ctrl+L for activity log

  const handleDownloadIngestTemplate = () => {
    // Create template for shot ingest
    const XLSX = require('xlsx');
    
    const templateData = [
      {
        'Show Name': 'Example Show',
        'Shot Name': '100_010_0010',
        'EP': 'EP01',
        'SEQ': 'SQ010',
        'TO': 'TO01',
        'Shot Tag': 'Fresh',
        'Scope of Work': 'CG Environment with character integration',
        'Department': 'Comp',
        'Is Internal': 'No',
        'Status': 'YTS',
        'Lead Name': 'John Doe',
        'Bid (MDs)': 2,
        'Internal ETA': '2025-11-15',
        'Client ETA': '2025-11-20'
      },
      {
        'Show Name': 'Example Show',
        'Shot Name': '100_010_0010',
        'EP': 'EP01',
        'SEQ': 'SQ010',
        'TO': 'TO01',
        'Shot Tag': 'Fresh',
        'Scope of Work': 'CG Environment with character integration',
        'Department': 'Paint',
        'Is Internal': 'Yes',
        'Status': 'YTS',
        'Lead Name': 'Jane Smith',
        'Bid (MDs)': 1,
        'Internal ETA': '2025-11-13',
        'Client ETA': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shot Ingest Template');

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Show Name
      { wch: 15 }, // Shot Name
      { wch: 8 },  // EP
      { wch: 8 },  // SEQ
      { wch: 8 },  // TO
      { wch: 10 }, // Shot Tag
      { wch: 40 }, // Scope of Work
      { wch: 12 }, // Department
      { wch: 12 }, // Is Internal
      { wch: 12 }, // Status
      { wch: 15 }, // Lead Name
      { wch: 10 }, // Bid (MDs)
      { wch: 15 }, // Internal ETA
      { wch: 15 }  // Client ETA
    ];

    XLSX.writeFile(wb, 'VFX_Shot_Ingest_Template.xlsx');
  };

  const handleShotIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await parseExcelFile(file);
      const { valid, errors, shows: importedShows } = validateImportData(data);

      if (!valid) {
        alert(`Import errors:\n${errors.join('\n')}`);
        setImporting(false);
        return;
      }

      // Helper function to convert Excel date serial number to ISO date string
      const convertExcelDate = (value: any): string | null => {
        if (!value) return null;
        
        // If it's already a string in YYYY-MM-DD format, convert to ISO datetime
        if (typeof value === 'string') {
          const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}$/);
          if (dateMatch) return `${value}T00:00:00.000Z`;
        }
        
        // If it's a number (Excel serial date), convert it
        if (typeof value === 'number') {
          // Excel dates start from 1900-01-01 (serial 1)
          // JavaScript Date starts from 1970-01-01
          const excelEpoch = new Date(1899, 11, 30); // Excel epoch (Dec 30, 1899)
          const jsDate = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
          return jsDate.toISOString();
        }
        
        // Try to parse as date
        try {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        } catch (e) {
          // Invalid date
        }
        
        return null;
      };

      // Create new shots and tasks
      let successCount = 0;
      let errorCount = 0;
      const errorMessages: string[] = [];

      for (const showData of importedShows) {
        // Find existing show or skip
        const existingShow = shows.find(s => s.showName === showData.showName);
        
        if (!existingShow) {
          errorMessages.push(`Show "${showData.showName}" not found. Please create the show first.`);
          errorCount += showData.shots.length;
          continue;
        }

        for (const shotData of showData.shots) {
          // Check if shot already exists
          const existingShot = shots.find(
            s => s.showId === existingShow.id && s.shotName === shotData.shotName
          );

          if (existingShot) {
            errorMessages.push(`Shot "${shotData.shotName}" already exists in show "${showData.showName}". Skipped.`);
            errorCount++;
            continue;
          }

          try {
            // Create shot with tasks, converting dates properly
            const response = await fetch('/api/shots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                showId: existingShow.id,
                shotName: shotData.shotName,
                episode: shotData.episode || null,
                sequence: shotData.sequence || null,
                turnover: shotData.turnover || null,
                shotTag: shotData.shotTag,
                scopeOfWork: shotData.scopeOfWork,
                tasks: shotData.tasks.map((task: any) => ({
                  department: task.department,
                  isInternal: task.isInternal,
                  status: task.status,
                  leadName: task.leadName || '',
                  bidMds: task.bidMds || 0,
                  internalEta: convertExcelDate(task.internalEta),
                  clientEta: convertExcelDate(task.clientEta),
                })),
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              const errorData = await response.json();
              errorMessages.push(`Failed to create shot "${shotData.shotName}": ${errorData.error}`);
              errorCount++;
            }
          } catch (error) {
            errorMessages.push(`Error creating shot "${shotData.shotName}": ${error}`);
            errorCount++;
          }
        }
      }

      // Fetch updated shows to refresh the table instantly
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);

      let message = `Shot Ingest Complete!\n\nSuccessfully created: ${successCount} shots`;
      if (errorCount > 0) {
        message += `\nFailed: ${errorCount} shots\n\n${errorMessages.slice(0, 10).join('\n')}`;
        if (errorMessages.length > 10) {
          message += `\n... and ${errorMessages.length - 10} more errors`;
        }
      }
      alert(message);
      
    } catch (error) {
      console.error('Error during shot ingest:', error);
      alert('Failed to ingest shots. Please check the file format.');
    } finally {
      setImporting(false);
      setShowImportModal(false);
      if (ingestInputRef.current) {
        ingestInputRef.current.value = '';
      }
    }
  };

  const handleExport = () => {
    exportToExcel(shows);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await parseExcelFile(file);
      const { valid, errors, shows: importedShows } = validateImportData(data);

      if (!valid) {
        alert(`Import errors:\n${errors.join('\n')}`);
        setImporting(false);
        return;
      }

      // Analyze changes for preview
      const changes: any[] = [];
      
      console.log('Starting change detection...');
      console.log('Shows in store:', shows.length);
      console.log('Shots in store:', shots.length);
      console.log('Tasks in store:', tasks.length);
      console.log('Imported shows:', importedShows.length);
      
      for (const showData of importedShows) {
        const existingShow = shows.find(s => s.showName === showData.showName);
        console.log(`Checking show: ${showData.showName}, found: ${!!existingShow}`);
        
        if (!existingShow) continue;
        
        for (const shotData of showData.shots) {
          const existingShot = shots.find(
            s => s.showId === existingShow?.id && s.shotName === shotData.shotName
          );
          console.log(`  Checking shot: ${shotData.shotName}, found: ${!!existingShot}`);
          
          if (!existingShot) continue;
          
          for (const taskData of shotData.tasks) {
            const existingTask = tasks.find(
              t => t.shotId === existingShot?.id && 
                   t.department === taskData.department && 
                   t.isInternal === taskData.isInternal
            );
            
            console.log(`    Checking task: ${taskData.department} (Internal: ${taskData.isInternal}), found: ${!!existingTask}`);

            if (existingTask) {
              // Track changes
              const fieldChanges: any[] = [];
              
              if (taskData.status !== existingTask.status) {
                fieldChanges.push({ field: 'Status', oldValue: existingTask.status, newValue: taskData.status });
              }
              if (taskData.leadName !== existingTask.leadName) {
                fieldChanges.push({ field: 'Lead', oldValue: existingTask.leadName, newValue: taskData.leadName });
              }
              if (taskData.bidMds !== existingTask.bidMds) {
                fieldChanges.push({ field: 'Bid (MDs)', oldValue: existingTask.bidMds, newValue: taskData.bidMds });
              }
              
              const oldInternalEta = existingTask.internalEta ? new Date(existingTask.internalEta).toISOString().split('T')[0] : null;
              const newInternalEta = taskData.internalEta ? new Date(taskData.internalEta).toISOString().split('T')[0] : null;
              if (oldInternalEta !== newInternalEta) {
                fieldChanges.push({ field: 'Internal ETA', oldValue: oldInternalEta, newValue: newInternalEta });
              }
              
              const oldClientEta = existingTask.clientEta ? new Date(existingTask.clientEta).toISOString().split('T')[0] : null;
              const newClientEta = taskData.clientEta ? new Date(taskData.clientEta).toISOString().split('T')[0] : null;
              if (oldClientEta !== newClientEta) {
                fieldChanges.push({ field: 'Client ETA', oldValue: oldClientEta, newValue: newClientEta });
              }

              if (fieldChanges.length > 0) {
                console.log(`      Found ${fieldChanges.length} changes for ${taskData.department}`);
                changes.push({
                  show: showData.showName,
                  shot: shotData.shotName,
                  tag: shotData.shotTag,
                  department: taskData.department,
                  isInternal: taskData.isInternal,
                  changes: fieldChanges,
                  taskId: existingTask.id,
                  shotId: existingShot?.id,
                  updateData: taskData,
                });
              }
            }
          }
        }
      }

      console.log(`Total changes detected: ${changes.length}`);
      
      if (changes.length === 0) {
        alert('No changes detected. The data in the Excel file matches the current database.');
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setImportData(importedShows);
      setImportChanges(changes);
      setShowImportPreview(true);
    } catch (error) {
      console.error('Error parsing import file:', error);
      alert('Failed to parse Excel file. Please check the format.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async (updateExisting: boolean) => {
    try {
      if (updateExisting) {
        // Update existing records
        let successCount = 0;
        let failCount = 0;

        for (const change of importChanges) {
          try {
            const response = await fetch(`/api/tasks/${change.taskId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(change.updateData),
            });

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error('Error updating task:', error);
            failCount++;
          }
        }

        alert(`Update complete!\nSuccessful: ${successCount}\nFailed: ${failCount}`);
      } else {
        // Create new records (original behavior)
        for (const showData of importData) {
          const showResponse = await fetch('/api/shows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              showName: showData.showName,
              clientName: showData.clientName,
              departments: showData.departments,
            }),
          });

          if (!showResponse.ok) {
            throw new Error(`Failed to create show: ${showData.showName}`);
          }

          const newShow = await showResponse.json();

          for (const shotData of showData.shots) {
            const shotResponse = await fetch('/api/shots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                showId: newShow.id,
                shotName: shotData.shotName,
                shotTag: shotData.shotTag,
                scopeOfWork: shotData.scopeOfWork,
                tasks: shotData.tasks,
              }),
            });

            if (!shotResponse.ok) {
              console.error(`Failed to create shot: ${shotData.shotName}`);
            }
          }
        }
        alert('Import successful!');
      }

      // Fetch updated shows to refresh the table instantly
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
      setShowImportPreview(false);
      setImportChanges([]);
      setImportData(null);
    } catch (error) {
      console.error('Error during import:', error);
      alert('Import failed. Please check the console for details.');
    }
  };

  const handleBulkUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUpdating(true);
    try {
      const data = await parseExcelFile(file);
      const { valid, errors, updates } = validateUpdateData(data, shows);

      if (!valid) {
        alert(`Update validation errors:\n${errors.join('\n')}`);
        setUpdating(false);
        return;
      }

      if (updates.length === 0) {
        alert('No updates found in the file.');
        setUpdating(false);
        return;
      }

      // Confirm with user
      const confirmed = confirm(
        `Found ${updates.length} updates to apply.\n\nThis will update existing shots and tasks. Continue?`
      );

      if (!confirmed) {
        setUpdating(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // Apply updates
      for (const update of updates) {
        try {
          if (update.taskId) {
            // Update task
            const response = await fetch(`/api/tasks/${update.taskId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(update.updateData),
            });

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } else if (update.shotId) {
            // Update shot
            const response = await fetch(`/api/shots/${update.shotId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(update.updateData),
            });

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          }
        } catch (error) {
          console.error('Update error:', error);
          failCount++;
        }
      }

      alert(
        `Bulk update complete!\n\nSuccessful: ${successCount}\nFailed: ${failCount}`
      );
      // Fetch updated shows to refresh the table instantly
      const showsRes = await fetch('/api/shows');
      const showsData = await showsRes.json();
      setShows(showsData);
    } catch (error) {
      console.error('Bulk update error:', error);
      alert(`Bulk update failed: ${error}`);
    } finally {
      setUpdating(false);
      if (updateInputRef.current) {
        updateInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="w-full px-2 md:px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">VFX TRACKER</h1>
              <p className="text-xs md:text-sm text-gray-500 hidden sm:block">Production Coordination System</p>
            </div>
            
            <div className="flex gap-2 md:gap-3 items-center">
              {/* Notification Bell */}
              <NotificationBell />
              
              {/* User Menu */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <User size={16} className="md:w-[18px] md:h-[18px]" />
                    <span className="text-xs md:text-sm font-medium hidden sm:inline">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-xs text-gray-500 hidden md:inline">({user.role})</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                        <p className="text-xs text-gray-500 mt-1">{user.role}</p>
                      </div>
                      
                      {user.role === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            router.push('/admin');
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Settings size={16} />
                          Admin Panel
                        </button>
                      )}
                      
                      <div className="px-4 py-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          {hasEditPermission ? '✏️ Edit Access' : '👁️ View Only'}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Toggle Button */}
              <button
                onClick={() => setButtonsVisible(!buttonsVisible)}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                title={buttonsVisible ? "Hide buttons" : "Show buttons"}
              >
                {buttonsVisible ? <ChevronRight size={18} className="md:w-5 md:h-5" /> : <ChevronLeft size={18} className="md:w-5 md:h-5" />}
              </button>
              
              {/* Animated buttons container - Hidden on mobile */}
              <div className={`hidden md:flex gap-3 overflow-hidden transition-all duration-300 ${
                buttonsVisible ? 'max-w-[2000px] opacity-100' : 'max-w-0 opacity-0'
              }`}>
                {/* Template and Export - Always visible */}
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all whitespace-nowrap animate-slideInFromLeft"
                  style={{ animationDelay: '0ms' }}
                  title="Download Excel Template"
                >
                  <FileSpreadsheet size={18} />
                  Template
                </button>

                <button
                  onClick={handleExport}
                  disabled={shows.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 group relative whitespace-nowrap animate-slideInFromLeft"
                  style={{ animationDelay: '50ms' }}
                  title="Export to Excel (Ctrl+E)"
                >
                  <Download size={18} />
                  Export
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Export to Excel (Ctrl+E)
                  </span>
                </button>

                {/* Edit-only buttons - Hidden for view-only users */}
                {canImport && (
                  <>
                    <button
                      onClick={() => setShowImportModal(true)}
                      disabled={importing}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 whitespace-nowrap animate-slideInFromLeft"
                      style={{ animationDelay: '100ms' }}
                      title="Import Data (Ctrl+I)"
                    >
                      <Upload size={18} />
                      {importing ? 'Importing...' : 'Import'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </>
                )}

                {canUpdate && (
                  <>
                    <button
                      onClick={() => updateInputRef.current?.click()}
                      disabled={updating || shows.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 group relative whitespace-nowrap animate-slideInFromLeft"
                      style={{ animationDelay: '150ms' }}
                      title="Bulk Update Existing Data from Excel"
                    >
                      <RefreshCw size={18} className={updating ? 'animate-spin' : ''} />
                      {updating ? 'Updating...' : 'Update'}
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Bulk update from Excel
                      </span>
                    </button>
                    <input
                      ref={updateInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkUpdate}
                      className="hidden"
                    />
                  </>
                )}
                
                {/* Activity Log - Always visible */}
                <button
                  onClick={() => setShowActivityLog(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all group relative whitespace-nowrap animate-slideInFromLeft"
                  style={{ animationDelay: '200ms' }}
                  title="Activity Log (Ctrl+L)"
                >
                  <History size={18} />
                  Activity Log
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    View change history & undo (Ctrl+L)
                  </span>
                </button>

                {/* Admin/Coordinator only buttons */}
                {canManageStatuses && (
                  <button
                    onClick={() => setShowStatusManagement(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all group relative whitespace-nowrap animate-slideInFromLeft"
                    style={{ animationDelay: '250ms' }}
                    title="Manage Status Options"
                  >
                    <Settings size={18} />
                    Statuses
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Manage status options
                    </span>
                  </button>
                )}
                
                {canCreateShow && (
                  <button
                    onClick={() => setShowNewShow(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all group relative whitespace-nowrap animate-slideInFromLeft"
                    style={{ animationDelay: '300ms' }}
                  >
                    <Plus size={18} />
                    New Show
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Create new show
                    </span>
                  </button>
                )}
                
                {/* Edit permission required for New Shot */}
                {canCreateShot && (
                  <button
                    onClick={() => setShowNewShot(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all group relative whitespace-nowrap animate-slideInFromLeft"
                    style={{ animationDelay: '350ms' }}
                    title="New Shot (Ctrl+N)"
                  >
                    <Plus size={18} />
                    New Shot
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Create new shot (Ctrl+N)
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {showNewShow && <NewShowModal onClose={() => setShowNewShow(false)} />}
      {showNewShot && <NewShotModal onClose={() => setShowNewShot(false)} />}
      {showStatusManagement && (
        <StatusManagementModal
          isOpen={showStatusManagement}
          onClose={() => setShowStatusManagement(false)}
          onUpdate={async () => {
            // Fetch updated shows to refresh the table instantly
            const showsRes = await fetch('/api/shows');
            const showsData = await showsRes.json();
            setShows(showsData);
          }}
        />
      )}
      {showImportPreview && (
        <ImportPreviewModal
          isOpen={showImportPreview}
          onClose={() => {
            setShowImportPreview(false);
            setImportChanges([]);
            setImportData(null);
          }}
          changes={importChanges}
          onConfirm={handleConfirmImport}
        />
      )}
      
      {/* Import Options Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Import Data</h2>
            <p className="text-gray-600 mb-6">Choose an import option:</p>
            
            <div className="space-y-4">
              {/* Shot Ingest Option */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Shot Ingest</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add new shots with tasks in bulk. Download the template, fill it in, and import.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadIngestTemplate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Download size={16} />
                    Download Template
                  </button>
                  <button
                    onClick={() => ingestInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Upload size={16} />
                    Ingest Shots
                  </button>
                </div>
              </div>
              
              {/* Update Data Option */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-orange-500 transition-colors">
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Update Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Bulk update existing shots and tasks. Export first, make changes, then import.
                </p>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    updateInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <RefreshCw size={16} />
                  Update Existing Data
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setShowImportModal(false)}
              className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        className="hidden"
      />
      <input
        ref={updateInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleBulkUpdate}
        className="hidden"
      />
      <input
        ref={ingestInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleShotIngest}
        className="hidden"
      />

      {/* Activity Log Modal */}
      <ActivityLogModal 
        isOpen={showActivityLog}
        onClose={() => setShowActivityLog(false)}
      />
    </>
  );
}
