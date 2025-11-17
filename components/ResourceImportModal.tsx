'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'members' | 'allocations';
}

interface ConflictData {
  row: any;
  existing: any[];
  suggested: any;
  rowNum: number;
}

interface PreviewData {
  valid: any[];
  conflicts: ConflictData[];
  errors: string[];
  warnings: string[];
}

export default function ResourceImportModal({ isOpen, onClose, onSuccess, type }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<'replace' | 'add' | 'skip'>('replace');
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setResult(null);
      setPreview(null);
      setStep('upload');
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');

      const endpoint = type === 'members' 
        ? '/api/resource/members/import'
        : '/api/resource/allocations/import';

      console.log('Analyzing file:', file.name, 'at endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('Analysis response:', response.ok, data);

      if (!response.ok) {
        setError(data.error || 'Analysis failed');
        setPreview(data.preview || null);
        return;
      }

      setPreview(data.preview);
      setStep('preview');
      console.log('Preview data set:', data.preview);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mergeStrategy', mergeStrategy);
      formData.append('preview', 'false');

      const endpoint = type === 'members' 
        ? '/api/resource/members/import'
        : '/api/resource/allocations/import';

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Import failed');
        setResult(data);
        setStep('result');
        return;
      }

      setResult(data);
      setStep('result');
      setTimeout(() => {
        alert(`Successfully imported ${data.imported} ${type}`);
        onSuccess();
        handleClose();
      }, 1000);
    } catch (error: any) {
      setError(error.message || 'Import failed');
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError('');
    setResult(null);
    setPreview(null);
    setStep('upload');
    onClose();
  };

  const downloadTemplate = () => {
    let template: any[] = [];
    
    if (type === 'members') {
      template = [
        {
          'Emp ID': 'EMP001',
          'Emp Name': 'John Doe',
          'Designation': 'Senior Compositor',
          'Reporting To': 'Jane Smith',
          'Department': 'Compositing',
          'Shift': 'Day'
        },
        {
          'Emp ID': 'EMP002',
          'Emp Name': 'Alice Johnson',
          'Designation': 'Junior Animator',
          'Reporting To': 'Bob Wilson',
          'Department': 'Animation',
          'Shift': 'Night'
        }
      ];
    } else {
      template = [
        {
          'Action': 'NEW',
          'Emp ID': 'EMP001',
          'Show Name': 'Project Alpha',
          'Shot Name': 'SH0010',
          'Start Date': '2025-11-18',
          'End Date': '2025-11-22',
          'Total MD': 2.5,
          'Notes': 'Compositing work'
        },
        {
          'Action': 'UPDATE',
          'Emp ID': 'EMP002',
          'Show Name': 'Project Beta',
          'Shot Name': 'SH0050',
          'Start Date': '2025-11-20',
          'End Date': '2025-11-25',
          'Total MD': 3.0,
          'Notes': 'Animation task'
        }
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, type === 'members' ? 'Members' : 'Allocations');
    XLSX.writeFile(workbook, `${type}_template.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            Import {type === 'members' ? 'Resource Members' : 'Allocations'} from Excel
          </h2>
          <div className="flex gap-2 mt-3">
            <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-blue-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-blue-600' : 'bg-gray-700'}`}>1</div>
              <span className="text-sm font-medium">Upload</span>
            </div>
            <div className="flex-1 border-t border-gray-700 mt-4"></div>
            <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-blue-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'preview' ? 'bg-blue-600' : 'bg-gray-700'}`}>2</div>
              <span className="text-sm font-medium">Preview</span>
            </div>
            <div className="flex-1 border-t border-gray-700 mt-4"></div>
            <div className={`flex items-center gap-2 ${step === 'result' ? 'text-blue-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'result' ? 'bg-blue-600' : 'bg-gray-700'}`}>3</div>
              <span className="text-sm font-medium">Result</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">{renderUploadStep()}</div>
          )}
          {step === 'preview' && preview && (
            <div className="space-y-4">{renderPreviewStep()}</div>
          )}
          {step === 'result' && (
            <div className="space-y-4">{renderResultStep()}</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700"
            disabled={loading}
          >
            {step === 'result' && result?.success ? 'Close' : 'Cancel'}
          </button>
          
          <div className="flex gap-3">
            {step === 'preview' && (
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700"
                disabled={loading}
              >
                ← Back
              </button>
            )}
            {step === 'upload' && (
              <button
                onClick={handleAnalyze}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600"
                disabled={!file || loading}
              >
                {loading ? 'Analyzing...' : 'Analyze File →'}
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600"
                disabled={loading || (preview?.errors && preview.errors.length > 0)}
              >
                {loading ? 'Importing...' : `Import ${preview?.valid?.length || 0} Records`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  function renderUploadStep() {
    return (
      <>
        {/* Template Download */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 text-2xl">ℹ️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Excel Template</h3>
              <p className="text-sm text-gray-400 mb-2">
                Download the template to see the required format
              </p>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Download Template
              </button>
            </div>
          </div>
        </div>

        {/* Required Fields Info */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-2">Required Fields:</h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            {type === 'members' ? (
              <>
                <li>Emp ID (unique identifier)</li>
                <li>Emp Name</li>
                <li>Designation</li>
                <li>Department</li>
                <li>Shift (optional, defaults to 'Day')</li>
                <li>Reporting To (optional)</li>
              </>
            ) : (
              <>
                <li><strong>Action</strong> - NEW (add to existing) or UPDATE (replace existing for those dates)</li>
                <li>Emp ID (must exist in database)</li>
                <li>Show Name (optional for leave/idle)</li>
                <li>Shot Name (optional for leave/idle)</li>
                <li>Start Date (YYYY-MM-DD format)</li>
                <li>End Date (YYYY-MM-DD format)</li>
                <li>Total MD (will be divided by days)</li>
                <li>Notes (optional)</li>
              </>
            )}
          </ul>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Excel File
          </label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 border border-gray-700 rounded-lg p-2 bg-gray-800"
          />
          {file && (
            <p className="text-sm text-green-400 mt-2">✓ Selected: {file.name}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">Error</h3>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </>
    );
  }

  function renderPreviewStep() {
    console.log('renderPreviewStep called, preview:', preview);
    if (!preview) return null;

    const totalRecords = preview.valid.length + preview.conflicts.length;
    const hasConflicts = preview.conflicts.length > 0;
    const hasErrors = preview.errors.length > 0;

    return (
      <>
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Rows</div>
            <div className="text-white text-2xl font-bold">{totalRecords}</div>
          </div>
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <div className="text-green-400 text-sm">Valid</div>
            <div className="text-white text-2xl font-bold">{preview.valid.length}</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <div className="text-yellow-400 text-sm">Conflicts</div>
            <div className="text-white text-2xl font-bold">{preview.conflicts.length}</div>
          </div>
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="text-red-400 text-sm">Errors</div>
            <div className="text-white text-2xl font-bold">{preview.errors.length}</div>
          </div>
        </div>

        {/* Errors */}
        {hasErrors && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">⚠️ Validation Errors (Must Fix)</h3>
            <p className="text-sm text-red-300 mb-2">Please fix these errors in your Excel file and re-upload:</p>
            <ul className="list-disc list-inside text-sm text-red-300 space-y-1 max-h-40 overflow-y-auto">
              {preview.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Merge Strategy for Conflicts */}
        {hasConflicts && !hasErrors && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">🔄 Conflict Resolution Strategy</h3>
            <p className="text-sm text-gray-400 mb-3">
              {preview.conflicts.length} row(s) have conflicting dates with existing allocations. Choose how to handle them:
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 bg-gray-900 rounded border border-gray-700 cursor-pointer hover:border-orange-600 transition">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="replace"
                  checked={mergeStrategy === 'replace'}
                  onChange={(e) => setMergeStrategy(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-white">Replace Existing</div>
                  <div className="text-sm text-gray-400">Delete all existing allocations for the member on conflicting dates, then add new ones</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 bg-gray-900 rounded border border-gray-700 cursor-pointer hover:border-green-600 transition">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="add"
                  checked={mergeStrategy === 'add'}
                  onChange={(e) => setMergeStrategy(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-white">Add Alongside</div>
                  <div className="text-sm text-gray-400">Keep existing allocations and add new ones (may cause overallocation)</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 bg-gray-900 rounded border border-gray-700 cursor-pointer hover:border-gray-600 transition">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="skip"
                  checked={mergeStrategy === 'skip'}
                  onChange={(e) => setMergeStrategy(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-white">Skip Conflicts</div>
                  <div className="text-sm text-gray-400">Only import rows without conflicts, skip conflicting ones</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-400 mb-2">⚡ Warnings</h3>
            <ul className="list-disc list-inside text-sm text-yellow-300 space-y-1 max-h-40 overflow-y-auto">
              {preview.warnings.slice(0, 20).map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
              {preview.warnings.length > 20 && (
                <li>... and {preview.warnings.length - 20} more warnings</li>
              )}
            </ul>
          </div>
        )}

        {/* Conflicts Detail */}
        {hasConflicts && !hasErrors && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">Conflict Details (first 10)</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {preview.conflicts.slice(0, 10).map((conflict, idx) => (
                <div key={idx} className="bg-gray-900 border border-yellow-700/50 rounded p-3">
                  <div className="text-sm text-gray-400 mb-2">Row {conflict.rowNum}</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-yellow-400 font-medium mb-1">New Data:</div>
                      <div className="text-gray-300">{conflict.suggested.empId} - {conflict.suggested.showName}</div>
                      <div className="text-gray-400">{conflict.suggested.startDate} to {conflict.suggested.endDate}</div>
                      <div className="text-gray-400">{conflict.suggested.manDays} MD</div>
                    </div>
                    <div>
                      <div className="text-orange-400 font-medium mb-1">Existing ({conflict.existing.length}):</div>
                      {conflict.existing.slice(0, 3).map((ex: any, i: number) => (
                        <div key={i} className="text-gray-400 text-xs">
                          {ex.showName} - {ex.shotName} ({ex.manDays} MD)
                        </div>
                      ))}
                      {conflict.existing.length > 3 && (
                        <div className="text-gray-500 text-xs">+{conflict.existing.length - 3} more</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {preview.conflicts.length > 10 && (
                <div className="text-center text-gray-500 text-sm">
                  ... and {preview.conflicts.length - 10} more conflicts
                </div>
              )}
            </div>
          </div>
        )}

        {/* Valid Rows Preview */}
        {preview.valid.length > 0 && (
          <div className="bg-gray-800 border border-green-700 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">✓ Valid Rows Preview (first 10)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900">
                  <tr className="text-left text-gray-400">
                    <th className="p-2">Emp ID</th>
                    <th className="p-2">Show</th>
                    <th className="p-2">Shot</th>
                    <th className="p-2">Dates</th>
                    <th className="p-2">MD</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {preview.valid.slice(0, 10).map((row: any, idx: number) => (
                    <tr key={idx} className="border-t border-gray-700">
                      <td className="p-2">{row.empId}</td>
                      <td className="p-2">{row.showName || '-'}</td>
                      <td className="p-2">{row.shotName || '-'}</td>
                      <td className="p-2">{row.startDate} to {row.endDate}</td>
                      <td className="p-2">{row.manDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.valid.length > 10 && (
                <div className="text-center text-gray-500 text-sm mt-2">
                  ... and {preview.valid.length - 10} more valid rows
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderResultStep() {
    return (
      <>
        {error && !result && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">❌ Import Failed</h3>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {result?.success && (
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
            <h3 className="font-semibold text-green-400 mb-2 text-xl">✅ Import Successful!</h3>
            <div className="text-sm text-green-300 space-y-1">
              <p><strong>Imported:</strong> {result.imported} out of {result.total} {type}</p>
              {result.conflicts && <p><strong>Conflicts Resolved:</strong> {result.conflicts}</p>}
              {result.skipped && <p><strong>Skipped:</strong> {result.skipped}</p>}
              {result.replaced && <p><strong>Replaced:</strong> {result.replaced}</p>}
            </div>
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-yellow-400 mb-1">Warnings:</h4>
                <ul className="list-disc list-inside text-sm text-yellow-300 space-y-1 max-h-32 overflow-y-auto">
                  {result.warnings.slice(0, 10).map((warning: string, idx: number) => (
                    <li key={idx}>{warning}</li>
                  ))}
                  {result.warnings.length > 10 && (
                    <li>... and {result.warnings.length - 10} more warnings</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {result && !result.success && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">❌ Import Failed</h3>
            <p className="text-sm text-red-300 mb-2">{result.error}</p>
            {result.errors && result.errors.length > 0 && (
              <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                {result.errors.map((err: string, idx: number) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }
}
