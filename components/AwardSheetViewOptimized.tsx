'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Download, Upload, Plus, X, Trash2, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AwardShot {
  id: string;
  showName: string;
  shotName: string;
  customFields: Record<string, string>;
}

interface CustomColumn {
  id: string;
  name: string;
}

export default function AwardSheetViewOptimized() {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<{ shotId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data with caching - no refetch on tab switch!
  const { data, isLoading } = useQuery({
    queryKey: ['awardSheets'],
    queryFn: async () => {
      const response = await fetch('/api/award-sheet');
      if (!response.ok) throw new Error('Failed to load award sheet');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // KEY: Don't reload when switching tabs
    refetchOnMount: false, // Don't reload on mount if data exists
  });

  const shots = data?.shots || [];

  // Auto-detect columns from data
  const customColumns = useMemo(() => {
    const columnNames = new Set<string>();
    shots.forEach((shot: AwardShot) => {
      Object.keys(shot.customFields || {}).forEach(key => columnNames.add(key));
    });
    return Array.from(columnNames).map((name, idx) => ({ id: `col-${idx}`, name }));
  }, [shots]);

  // Add shot with instant optimistic update
  const addShotMutation = useMutation({
    mutationFn: async (newShot: any) => {
      const res = await fetch('/api/award-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShot),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add shot');
      }
      return res.json();
    },
    onMutate: async (newShot) => {
      await queryClient.cancelQueries({ queryKey: ['awardSheets'] });
      const previous = queryClient.getQueryData(['awardSheets']);
      
      queryClient.setQueryData(['awardSheets'], (old: any) => ({
        ...old,
        shots: [...(old?.shots || []), { ...newShot, id: 'temp-' + Date.now() }],
      }));
      
      return { previous };
    },
    onError: (err: any, _newShot, context: any) => {
      queryClient.setQueryData(['awardSheets'], context.previous);
      toast.error(err.message);
    },
    onSuccess: () => toast.success('Shot added'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['awardSheets'] }),
  });

  // Delete with optimistic update
  const deleteShotMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/award-sheet/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['awardSheets'] });
      const previous = queryClient.getQueryData(['awardSheets']);
      
      queryClient.setQueryData(['awardSheets'], (old: any) => ({
        ...old,
        shots: old?.shots?.filter((s: AwardShot) => s.id !== id) || [],
      }));
      
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      queryClient.setQueryData(['awardSheets'], context.previous);
      toast.error('Failed to delete');
    },
    onSuccess: () => toast.success('Shot deleted'),
  });

  // Update with optimistic update
  const updateShotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/award-sheet/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['awardSheets'] });
      const previous = queryClient.getQueryData(['awardSheets']);
      
      queryClient.setQueryData(['awardSheets'], (old: any) => ({
        ...old,
        shots: old?.shots?.map((s: AwardShot) => s.id === id ? { ...s, ...data } : s) || [],
      }));
      
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(['awardSheets'], context.previous);
      toast.error('Failed to update');
    },
  });

  // Action handlers
  const addShot = () => {
    // Generate unique shot name to prevent upsert from updating existing
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    addShotMutation.mutate({
      showName: 'New Show',
      shotName: `Shot_${randomSuffix}_${timestamp}`,
      customFields: {},
    });
  };

  const deleteShot = (id: string) => {
    if (!confirm('Delete this shot?')) return;
    deleteShotMutation.mutate(id);
  };

  const updateCell = (shotId: string, field: string, value: string) => {
    const shot = shots.find((s: AwardShot) => s.id === shotId);
    if (!shot) return;

    const isCustomField = field !== 'showName' && field !== 'shotName';
    const updatedData = isCustomField
      ? { customFields: { ...shot.customFields, [field]: value } }
      : { [field]: value };

    updateShotMutation.mutate({ id: shotId, data: updatedData });
  };

  const addCustomColumn = () => {
    if (!newColumnName.trim()) return toast.error('Enter column name');
    if (customColumns.some(c => c.name === newColumnName.trim())) {
      return toast.error('Column exists');
    }
    toast.success(`Column "${newColumnName.trim()}" ready`);
    setNewColumnName('');
    setShowAddColumn(false);
  };

  const deleteCustomColumn = (columnName: string) => {
    if (!confirm(`Delete column "${columnName}"?`)) return;
    shots.forEach((shot: AwardShot) => {
      if (shot.customFields[columnName]) {
        const newCustomFields = { ...shot.customFields };
        delete newCustomFields[columnName];
        updateShotMutation.mutate({ id: shot.id, data: { customFields: newCustomFields } });
      }
    });
  };

  const exportToExcel = () => {
    const exportData = shots.map((shot: AwardShot) => {
      const row: any = { 'Show Name': shot.showName, 'Shot Name': shot.shotName };
      customColumns.forEach(col => row[col.name] = shot.customFields[col.name] || '');
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Award Sheet');
    XLSX.writeFile(wb, `award-sheet-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        let imported = 0;
        for (const row of jsonData) {
          const showName = row['Show Name'] || row['showName'];
          const shotName = row['Shot Name'] || row['shotName'];
          if (!showName || !shotName) continue;

          const customFields: Record<string, string> = {};
          Object.keys(row).forEach(key => {
            if (!['Show Name', 'Shot Name', 'showName', 'shotName'].includes(key)) {
              customFields[key] = String(row[key] || '');
            }
          });

          try {
            await fetch('/api/award-sheet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ showName, shotName, customFields }),
            });
            imported++;
          } catch (err) {
            console.error('Failed row:', err);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['awardSheets'] });
        toast.success(`Imported ${imported} shots`);
      } catch (err) {
        toast.error('Import failed');
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleCellEdit = (shotId: string, field: string, currentValue: string) => {
    setEditingCell({ shotId, field });
    setEditValue(currentValue || '');
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    updateCell(editingCell.shotId, editingCell.field, editValue);
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellSave();
    else if (e.key === 'Escape') { setEditingCell(null); setEditValue(''); }
  };

  const filteredShots = useMemo(() => {
    if (!searchQuery) return shots;
    const q = searchQuery.toLowerCase();
    return shots.filter((s: AwardShot) =>
      s.showName.toLowerCase().includes(q) ||
      s.shotName.toLowerCase().includes(q) ||
      Object.values(s.customFields).some(v => String(v).toLowerCase().includes(q))
    );
  }, [shots, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-none bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Award Sheet</h1>
          <div className="flex gap-2">
            <button onClick={addShot} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={18} /> Add Shot
            </button>
            <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download size={18} /> Export
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
              <Upload size={18} /> Import
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg"
          />
          <div className="text-sm text-gray-400 flex items-center">{filteredShots.length} shot(s)</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase w-12">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-[200px]">Show Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-[200px]">Shot Name</th>
                {customColumns.map(col => (
                  <th key={col.id} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-[150px] group">
                    <div className="flex items-center justify-between">
                      <span>{col.name}</span>
                      <button onClick={() => deleteCustomColumn(col.name)} className="opacity-0 group-hover:opacity-100 ml-2 text-red-400 hover:text-red-300">
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center w-20">
                  {showAddColumn ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomColumn()}
                        placeholder="Name"
                        className="px-2 py-1 bg-gray-700 border border-gray-600 text-white rounded text-xs w-32"
                        autoFocus
                      />
                      <button onClick={addCustomColumn} className="text-green-400 hover:text-green-300"><Save size={14} /></button>
                      <button onClick={() => { setShowAddColumn(false); setNewColumnName(''); }} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddColumn(true)} className="text-blue-400 hover:text-blue-300" title="Add column">
                      <Plus size={18} />
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {filteredShots.length === 0 ? (
                <tr><td colSpan={customColumns.length + 4} className="px-4 py-8 text-center text-gray-400">No shots. Click "Add Shot"</td></tr>
              ) : (
                filteredShots.map((shot: AwardShot) => (
                  <tr key={shot.id} className="hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <button onClick={() => deleteShot(shot.id)} className="text-red-400 hover:text-red-300" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {editingCell?.shotId === shot.id && editingCell.field === 'showName' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          className="w-full px-2 py-1 bg-gray-700 border border-blue-500 text-white rounded"
                          autoFocus
                        />
                      ) : (
                        <div onClick={() => handleCellEdit(shot.id, 'showName', shot.showName)} className="cursor-pointer text-white hover:bg-gray-700 px-2 py-1 rounded">
                          {shot.showName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingCell?.shotId === shot.id && editingCell.field === 'shotName' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          className="w-full px-2 py-1 bg-gray-700 border border-blue-500 text-white rounded"
                          autoFocus
                        />
                      ) : (
                        <div onClick={() => handleCellEdit(shot.id, 'shotName', shot.shotName)} className="cursor-pointer text-white hover:bg-gray-700 px-2 py-1 rounded">
                          {shot.shotName}
                        </div>
                      )}
                    </td>
                    {customColumns.map(col => {
                      const value = shot.customFields[col.name] || '';
                      return (
                        <td key={col.id} className="px-4 py-3">
                          {editingCell?.shotId === shot.id && editingCell.field === col.name ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={handleKeyDown}
                              className="w-full px-2 py-1 bg-gray-700 border border-blue-500 text-white rounded"
                              autoFocus
                            />
                          ) : (
                            <div onClick={() => handleCellEdit(shot.id, col.name, value)} className="cursor-pointer text-gray-300 hover:bg-gray-700 px-2 py-1 rounded min-h-[28px]">
                              {value || <span className="text-gray-600 italic">-</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
