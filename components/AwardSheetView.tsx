'use client';

import { useState, useEffect } from 'react';
import { Download, Upload, Plus, X, Trash2, Edit2, Save } from 'lucide-react';
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

export default function AwardSheetView() {
  const [shots, setShots] = useState<AwardShot[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ shotId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAwardSheet();
  }, []);

  const loadAwardSheet = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/award-sheet');
      if (!response.ok) throw new Error('Failed to load award sheet');
      const data = await response.json();
      
      setShots(data.shots || []);
      
      // Extract unique custom column names from all shots
      const columnNames = new Set<string>();
      data.shots?.forEach((shot: AwardShot) => {
        Object.keys(shot.customFields || {}).forEach(key => columnNames.add(key));
      });
      
      setCustomColumns(Array.from(columnNames).map((name, idx) => ({
        id: `col-${idx}`,
        name,
      })));
    } catch (error) {
      console.error('Error loading award sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const addShot = async () => {
    const newShot = {
      showName: 'New Show',
      shotName: 'New Shot',
      customFields: {},
    };

    try {
      const response = await fetch('/api/award-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShot),
      });

      if (!response.ok) throw new Error('Failed to add shot');
      
      await loadAwardSheet();
    } catch (error) {
      console.error('Error adding shot:', error);
      alert('Failed to add shot. It may already exist.');
    }
  };

  const deleteShot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shot?')) return;

    try {
      const response = await fetch(`/api/award-sheet/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete shot');
      
      await loadAwardSheet();
    } catch (error) {
      console.error('Error deleting shot:', error);
      alert('Failed to delete shot');
    }
  };

  const updateCell = async (shotId: string, field: string, value: string) => {
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;

    const isCustomField = field !== 'showName' && field !== 'shotName';
    
    const updatedShot = {
      ...shot,
      ...(isCustomField 
        ? { customFields: { ...shot.customFields, [field]: value } }
        : { [field]: value }
      ),
    };

    try {
      const response = await fetch(`/api/award-sheet/${shotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedShot),
      });

      if (!response.ok) throw new Error('Failed to update shot');
      
      await loadAwardSheet();
    } catch (error) {
      console.error('Error updating shot:', error);
      alert('Failed to update shot');
    }
  };

  const addCustomColumn = () => {
    if (!newColumnName.trim()) {
      alert('Please enter a column name');
      return;
    }

    if (customColumns.some(col => col.name === newColumnName.trim())) {
      alert('Column already exists');
      return;
    }

    setCustomColumns(prev => [
      ...prev,
      { id: `col-${Date.now()}`, name: newColumnName.trim() }
    ]);
    
    setNewColumnName('');
    setShowAddColumn(false);
  };

  const deleteCustomColumn = (columnName: string) => {
    if (!confirm(`Delete column "${columnName}"? This will remove all data in this column.`)) return;
    
    setCustomColumns(prev => prev.filter(col => col.name !== columnName));
    
    // Remove from all shots
    setShots(prev => prev.map(shot => {
      const newCustomFields = { ...shot.customFields };
      delete newCustomFields[columnName];
      return { ...shot, customFields: newCustomFields };
    }));
  };

  const exportToExcel = () => {
    const exportData = shots.map(shot => {
      const row: any = {
        'Show Name': shot.showName,
        'Shot Name': shot.shotName,
      };
      
      customColumns.forEach(col => {
        row[col.name] = shot.customFields[col.name] || '';
      });
      
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Award Sheet');
    
    XLSX.writeFile(workbook, `award-sheet-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Import shots
        for (const row of jsonData) {
          const showName = row['Show Name'] || row['showName'];
          const shotName = row['Shot Name'] || row['shotName'];
          
          if (!showName || !shotName) continue;

          const customFields: Record<string, string> = {};
          Object.keys(row).forEach(key => {
            if (key !== 'Show Name' && key !== 'Shot Name' && key !== 'showName' && key !== 'shotName') {
              customFields[key] = String(row[key] || '');
            }
          });

          await fetch('/api/award-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ showName, shotName, customFields }),
          });
        }

        await loadAwardSheet();
        alert('Import successful!');
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import file');
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleCellEdit = (shotId: string, field: string, currentValue: string) => {
    setEditingCell({ shotId, field });
    setEditValue(currentValue || '');
  };

  const handleCellSave = async () => {
    if (!editingCell) return;
    
    await updateCell(editingCell.shotId, editingCell.field, editValue);
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const filteredShots = shots.filter(shot => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      shot.showName.toLowerCase().includes(query) ||
      shot.shotName.toLowerCase().includes(query) ||
      Object.values(shot.customFields).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  });

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-none bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Award Sheet</h1>
          <div className="flex gap-2">
            <button
              onClick={addShot}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Shot
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download size={18} />
              Export
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
              <Upload size={18} />
              Import
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shows, shots, or any field..."
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg placeholder-gray-400"
          />
          <div className="text-sm text-gray-400 flex items-center">
            {filteredShots.length} shot(s)
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading award sheet...</div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase w-12">
                  Actions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-[200px]">
                  Show Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-[200px]">
                  Shot Name
                </th>
                {customColumns.map(col => (
                  <th key={col.id} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-[150px] group">
                    <div className="flex items-center justify-between">
                      <span>{col.name}</span>
                      <button
                        onClick={() => deleteCustomColumn(col.name)}
                        className="opacity-0 group-hover:opacity-100 ml-2 text-red-400 hover:text-red-300"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase w-20">
                  {showAddColumn ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomColumn()}
                        placeholder="Column name"
                        className="px-2 py-1 bg-gray-700 border border-gray-600 text-white rounded text-xs w-32"
                        autoFocus
                      />
                      <button onClick={addCustomColumn} className="text-green-400 hover:text-green-300">
                        <Save size={14} />
                      </button>
                      <button onClick={() => { setShowAddColumn(false); setNewColumnName(''); }} className="text-red-400 hover:text-red-300">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddColumn(true)}
                      className="text-blue-400 hover:text-blue-300"
                      title="Add custom column"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {filteredShots.length === 0 ? (
                <tr>
                  <td colSpan={customColumns.length + 4} className="px-4 py-8 text-center text-gray-400">
                    No shots in award sheet. Click "Add Shot" to get started.
                  </td>
                </tr>
              ) : (
                filteredShots.map(shot => (
                  <tr key={shot.id} className="hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteShot(shot.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete shot"
                      >
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
                        <div
                          onClick={() => handleCellEdit(shot.id, 'showName', shot.showName)}
                          className="cursor-pointer text-white hover:bg-gray-700 px-2 py-1 rounded"
                        >
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
                        <div
                          onClick={() => handleCellEdit(shot.id, 'shotName', shot.shotName)}
                          className="cursor-pointer text-white hover:bg-gray-700 px-2 py-1 rounded"
                        >
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
                            <div
                              onClick={() => handleCellEdit(shot.id, col.name, value)}
                              className="cursor-pointer text-gray-300 hover:bg-gray-700 px-2 py-1 rounded min-h-[28px]"
                            >
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
