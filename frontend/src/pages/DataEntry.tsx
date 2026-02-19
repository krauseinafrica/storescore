import { useEffect, useState, useCallback, useRef } from 'react';
import { getOrgId } from '../utils/org';
import { getStores } from '../api/walks';
import {
  createDataPoint,
  uploadDataPointsCSV,
} from '../api/integrations';
import type { Store } from '../types';

type Tab = 'manual' | 'csv';

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function ManualEntryContent() {
  const orgId = getOrgId();
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoadingStores(true);
    getStores(orgId)
      .then(setStores)
      .catch(() => {})
      .finally(() => setLoadingStores(false));
  }, [orgId]);

  return <ManualEntryForm orgId={orgId} stores={stores} loadingStores={loadingStores} />;
}

export function CSVImportContent() {
  const orgId = getOrgId();
  return <CSVImportForm orgId={orgId} />;
}

export default function DataEntry() {
  const orgId = getOrgId();
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoadingStores(true);
    getStores(orgId)
      .then(setStores)
      .catch(() => {})
      .finally(() => setLoadingStores(false));
  }, [orgId]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Data Entry</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter store metrics manually or import data from CSV files.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex gap-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'csv'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            CSV Import
          </button>
        </nav>
      </div>

      {activeTab === 'manual' ? (
        <ManualEntryForm orgId={orgId} stores={stores} loadingStores={loadingStores} />
      ) : (
        <CSVImportForm orgId={orgId} />
      )}
    </div>
  );
}

/* ---------- Manual Entry ---------- */

interface ManualEntryFormProps {
  orgId: string;
  stores: Store[];
  loadingStores: boolean;
}

function ManualEntryForm({ orgId, stores, loadingStores }: ManualEntryFormProps) {
  const [storeId, setStoreId] = useState('');
  const [metric, setMetric] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!storeId) {
      setError('Please select a store.');
      return;
    }
    if (!metric.trim()) {
      setError('Metric name is required.');
      return;
    }
    if (!value.trim()) {
      setError('Value is required.');
      return;
    }
    if (!date) {
      setError('Date is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await createDataPoint(orgId, {
        store: storeId,
        metric: metric.trim(),
        value: value.trim(),
        date,
        source: 'manual',
      });
      setSuccess(`Data point "${metric.trim()}" saved successfully for ${date}.`);
      setMetric('');
      setValue('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, unknown> } };
      if (axiosErr.response?.data) {
        const data = axiosErr.response.data;
        const detail = data.detail || data.message || data.error;
        setError(typeof detail === 'string' ? detail : 'Failed to save data point. Please try again.');
      } else {
        setError('Failed to save data point. Please check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Manual Data Entry</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter individual data points for a specific store and metric.
      </p>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="manual-store" className="block text-sm font-medium text-gray-700 mb-1.5">
            Store <span className="text-red-500">*</span>
          </label>
          <select
            id="manual-store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            disabled={loadingStores}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white disabled:bg-gray-100"
          >
            <option value="">
              {loadingStores ? 'Loading stores...' : 'Select a store'}
            </option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} {store.store_number ? `(#${store.store_number})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="manual-metric" className="block text-sm font-medium text-gray-700 mb-1.5">
              Metric Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="manual-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Monthly Sales, Customer Count"
            />
          </div>

          <div>
            <label htmlFor="manual-value" className="block text-sm font-medium text-gray-700 mb-1.5">
              Value <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="manual-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., 15000, 4.5, High"
            />
          </div>
        </div>

        <div>
          <label htmlFor="manual-date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="manual-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Data Point'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- CSV Import ---------- */

interface CSVImportFormProps {
  orgId: string;
}

interface CSVPreview {
  headers: string[];
  rows: string[][];
}

const EXPECTED_COLUMNS = ['store', 'metric', 'value', 'date'];

function CSVImportForm({ orgId }: CSVImportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const parseCSV = useCallback((text: string): CSVPreview => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1, Math.min(6, lines.length)).map(parseLine);
    return { headers, rows };
  }, []);

  const autoMapColumns = useCallback(
    (headers: string[]) => {
      const mapping: Record<string, number> = {};
      const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

      for (const col of EXPECTED_COLUMNS) {
        const exactIdx = lowerHeaders.indexOf(col);
        if (exactIdx !== -1) {
          mapping[col] = exactIdx;
          continue;
        }
        const partialIdx = lowerHeaders.findIndex((h) => h.includes(col));
        if (partialIdx !== -1) {
          mapping[col] = partialIdx;
        }
      }

      setColumnMapping(mapping);
    },
    []
  );

  const handleFile = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      setSuccess('');
      setError('');
      setPreview(null);

      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file.');
        setFile(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          setError('Could not read file.');
          return;
        }
        const parsed = parseCSV(text);
        if (parsed.headers.length === 0) {
          setError('CSV file appears to be empty.');
          return;
        }
        setPreview(parsed);
        autoMapColumns(parsed.headers);
      };
      reader.onerror = () => {
        setError('Failed to read the file.');
      };
      reader.readAsText(selectedFile);
    },
    [parseCSV, autoMapColumns]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!orgId || !file || uploading) return;

    const missingCols = EXPECTED_COLUMNS.filter((col) => columnMapping[col] === undefined);
    if (missingCols.length > 0) {
      setError(`Please map all required columns: ${missingCols.join(', ')}`);
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const result = await uploadDataPointsCSV(orgId, file, columnMapping);
      setSuccess(
        `Successfully imported ${result.created} data point${result.created !== 1 ? 's' : ''}.` +
          (result.errors.length > 0
            ? ` ${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} had errors.`
            : '')
      );
      if (result.errors.length > 0) {
        setError(`Row errors: ${result.errors.slice(0, 5).join('; ')}${result.errors.length > 5 ? '...' : ''}`);
      }
      setFile(null);
      setPreview(null);
      setColumnMapping({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, unknown> } };
      if (axiosErr.response?.data) {
        const data = axiosErr.response.data;
        const detail = data.detail || data.message || data.error;
        setError(typeof detail === 'string' ? detail : 'Failed to upload CSV. Please check the file and try again.');
      } else {
        setError('Failed to upload CSV. Please check your connection.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setColumnMapping({});
    setError('');
    setSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">CSV Import</h2>
        <p className="text-sm text-gray-500 mb-6">
          Upload a CSV file containing store metrics. Map columns to the required fields before importing.
        </p>

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              dragging
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-gray-700 mb-1">
              Drop your CSV file here, or click to browse
            </p>
            <p className="text-xs text-gray-400">
              Supports .csv files with headers in the first row
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* File info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file?.name}</p>
                  <p className="text-xs text-gray-500">
                    {preview.headers.length} columns, {preview.rows.length}+ data rows
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                Remove
              </button>
            </div>

            {/* Column Mapping */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Column Mapping</h3>
              <p className="text-xs text-gray-500 mb-4">
                Map each required field to a column in your CSV file.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EXPECTED_COLUMNS.map((col) => (
                  <div key={col}>
                    <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                      {col} column <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={columnMapping[col] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColumnMapping((prev) => {
                          const next = { ...prev };
                          if (val === '') {
                            delete next[col];
                          } else {
                            next[col] = parseInt(val, 10);
                          }
                          return next;
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    >
                      <option value="">-- Select column --</option>
                      {preview.headers.map((header, idx) => (
                        <option key={idx} value={idx}>
                          {header || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Data Preview (first {preview.rows.length} rows)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {header || `Col ${idx + 1}`}
                          {Object.entries(columnMapping).map(([field, colIdx]) =>
                            colIdx === idx ? (
                              <span
                                key={field}
                                className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 text-primary-700 uppercase"
                              >
                                {field}
                              </span>
                            ) : null
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Data
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={uploading}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
