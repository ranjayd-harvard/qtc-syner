'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Play, PlayCircle, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, Sparkles, Loader2, ArrowRight, Download, Search, X, Brain,
  Upload, RefreshCw, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { EntitySyncerMappingSummary, FieldMappingEntry } from '@/models/EntitySyncerMapping';
import type { PairResult } from '@/lib/entity-syncer-compute';
import { computeFuzzy } from '@/lib/fuzzy-match';
import type { FuzzyResult } from '@/lib/fuzzy-match';
import type { UpsertResult } from '@/lib/connector-client';

// ── Types ──────────────────────────────────────────────────────────────────────

type PairProgress = {
  sf: { page: number; count: number } | null;
  ns: { page: number; count: number } | null;
  computing: boolean;
};

type PairState =
  | { status: 'idle' }
  | { status: 'loading'; progress: PairProgress }
  | { status: 'done'; result: PairResult }
  | { status: 'error'; error: string };

type ExplainState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; explanation: string }
  | { status: 'error'; error: string };

type FuzzyState =
  | { status: 'idle' }
  | { status: 'done'; result: FuzzyResult };

// ── NS record types available for writes ───────────────────────────────────────

const NS_WRITE_TYPES = [
  { value: 'inventoryItem',             label: 'Inventory Item' },
  { value: 'nonInventoryItem',          label: 'Non-Inventory Item' },
  { value: 'nonInventorySaleItem',      label: 'Non-Inventory Sale Item' },
  { value: 'nonInventoryPurchaseItem',  label: 'Non-Inventory Purchase Item' },
  { value: 'nonInventoryResaleItem',    label: 'Non-Inventory Resale Item' },
  { value: 'assemblyItem',             label: 'Assembly / Bill of Materials' },
  { value: 'kitItem',                  label: 'Kit / Package Item' },
  { value: 'serviceItem',              label: 'Service Item' },
  { value: 'otherChargeSaleItem',      label: 'Other Charge Sale Item' },
  { value: 'downloadItem',             label: 'Download Item' },
  { value: 'giftCertificateItem',      label: 'Gift Certificate Item' },
  { value: 'lotNumberedInventoryItem', label: 'Lot-Numbered Inventory Item' },
  { value: 'serializedInventoryItem',  label: 'Serialized Inventory Item' },
  { value: 'customer',                 label: 'Customer' },
  { value: 'contact',                  label: 'Contact' },
  { value: 'vendor',                   label: 'Vendor' },
  { value: 'employee',                 label: 'Employee' },
];

// ── Field transformation helpers ──────────────────────────────────────────────

function transformRecords(
  sourceRecords: Record<string, unknown>[],
  direction: 'sf-to-ns' | 'ns-to-sf',
  mappingPairs: FieldMappingEntry[],
): Record<string, unknown>[] {
  return sourceRecords.map((src) => {
    const out: Record<string, unknown> = {};
    for (const pair of mappingPairs) {
      if (direction === 'sf-to-ns') {
        const val = pair.sourceFields.length === 1
          ? src[pair.sourceFields[0]]
          : pair.sourceFields.map((f) => String(src[f] ?? '')).join(' ');
        if (val !== undefined && val !== null) {
          pair.targetFields.forEach((f) => { out[f] = val; });
        }
      } else {
        const val = pair.targetFields.length === 1
          ? src[pair.targetFields[0]]
          : pair.targetFields.map((f) => String(src[f] ?? '')).join(' ');
        if (val !== undefined && val !== null) {
          pair.sourceFields.forEach((f) => { out[f] = val; });
        }
      }
    }
    return out;
  });
}

// ── Sync dialog ────────────────────────────────────────────────────────────────

type SyncMode = 'create' | 'update' | 'upsert';

type SyncDialogState =
  | { phase: 'config' }
  | { phase: 'syncing' }
  | { phase: 'done'; result: UpsertResult }
  | { phase: 'error'; error: string };

function SyncDialog({
  open,
  onClose,
  direction,
  sourceRecords,
  sfConnectionId,
  nsConnectionId,
  sfObject,
  nsObject,
  mappingPairs,
}: {
  open: boolean;
  onClose: () => void;
  direction: 'sf-to-ns' | 'ns-to-sf';
  sourceRecords: Record<string, unknown>[];
  sfConnectionId: string;
  nsConnectionId: string;
  sfObject: string;
  nsObject: string;
  mappingPairs: FieldMappingEntry[];
}) {
  const isToNs = direction === 'sf-to-ns';
  const [nsWriteType, setNsWriteType] = useState(() => {
    const match = NS_WRITE_TYPES.find((t) => t.value === nsObject);
    return match ? nsObject : 'inventoryItem';
  });
  const [syncMode, setSyncMode] = useState<SyncMode>('create');
  const [externalIdField, setExternalIdField] = useState('');
  const [defaultFields, setDefaultFields] = useState<{ key: string; value: string }[]>([]);
  const [state, setState] = useState<SyncDialogState>({ phase: 'config' });

  // Reset on open
  useEffect(() => {
    if (open) { setState({ phase: 'config' }); }
  }, [open]);

  const targetConnectionId = isToNs ? nsConnectionId : sfConnectionId;
  const targetObjectName = isToNs ? nsWriteType : sfObject;

  const transformedRecords = transformRecords(sourceRecords, direction, mappingPairs);

  // Parse default field values: JSON strings become objects, everything else stays as string
  const parsedDefaults = defaultFields.reduce<Record<string, unknown>>((acc, { key, value }) => {
    if (!key.trim()) return acc;
    try { acc[key.trim()] = JSON.parse(value); }
    catch { acc[key.trim()] = value; }
    return acc;
  }, {});

  // Merge defaults first so that mapped fields take precedence
  const finalRecords = transformedRecords.map((rec) => ({ ...parsedDefaults, ...rec }));

  const execute = useCallback(async () => {
    setState({ phase: 'syncing' });
    try {
      const res = await fetch('/api/entity-syncer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetConnectionId,
          targetObjectName,
          records: finalRecords,
          mode: syncMode,
          externalIdField: syncMode === 'upsert' ? externalIdField : undefined,
        }),
      });
      const data = await res.json() as UpsertResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setState({ phase: 'done', result: data });
    } catch (err) {
      setState({ phase: 'error', error: String(err) });
    }
  }, [targetConnectionId, targetObjectName, finalRecords, syncMode, externalIdField]);

  const fieldPreview = mappingPairs.slice(0, 6);
  const extraPairs = mappingPairs.length - 6;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {isToNs ? 'Sync to NetSuite' : 'Sync to Salesforce'}
          </DialogTitle>
          <DialogDescription>
            {sourceRecords.length.toLocaleString()} record{sourceRecords.length !== 1 ? 's' : ''} will be written to the target system using the mapped fields.
          </DialogDescription>
        </DialogHeader>

        {state.phase === 'config' && (
          <div className="space-y-4 py-1">
            {/* NS record type picker */}
            {isToNs && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">NetSuite record type</label>
                <select
                  value={nsWriteType}
                  onChange={(e) => setNsWriteType(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {NS_WRITE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Mode */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Sync mode</label>
              <div className="flex gap-2">
                {(['create', 'upsert', 'update'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSyncMode(m)}
                    className={`flex-1 py-1.5 text-xs rounded border font-medium transition-colors ${
                      syncMode === m
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'create' ? 'Create new' : m === 'upsert' ? 'Upsert' : 'Update existing'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {syncMode === 'create' && 'Inserts all records as new entries — will error if a record already exists.'}
                {syncMode === 'upsert' && 'Creates new records or updates existing ones matched by an external ID field.'}
                {syncMode === 'update' && 'Updates existing records only — requires an id field in each record.'}
              </p>
            </div>

            {/* External ID field for upsert */}
            {syncMode === 'upsert' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">External ID field (on target)</label>
                <Input
                  value={externalIdField}
                  onChange={(e) => setExternalIdField(e.target.value)}
                  placeholder={isToNs ? 'e.g. externalId' : 'e.g. ExternalId__c'}
                  className="text-xs h-8"
                />
              </div>
            )}

            {/* Field mapping preview */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700">Field mapping</p>
              <div className="rounded border border-slate-100 divide-y divide-slate-100 text-xs">
                {fieldPreview.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="font-mono text-indigo-600">{pair.sourceFields.join(' + ')}</span>
                    <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    <span className="font-mono text-violet-600">{pair.targetFields.join(' + ')}</span>
                  </div>
                ))}
                {extraPairs > 0 && (
                  <div className="px-3 py-1 text-slate-400 italic">+{extraPairs} more pairs</div>
                )}
              </div>
            </div>

            {/* Default field values */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Default field values</p>
                <button
                  type="button"
                  onClick={() => setDefaultFields((prev) => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-3 h-3" /> Add field
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Hardcode values for required target fields not present in source data.
                Use JSON for reference fields, e.g. <code className="font-mono bg-slate-100 px-1 rounded">{`{"id":"2"}`}</code>
              </p>
              {defaultFields.length === 0 ? (
                <p className="text-xs text-slate-300 italic">None — add one if the target requires fields your source does not have (e.g. Terms, Currency).</p>
              ) : (
                <div className="space-y-1.5">
                  {defaultFields.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        value={f.key}
                        onChange={(e) => setDefaultFields((prev) => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                        placeholder="fieldName"
                        className="text-xs h-7 font-mono flex-1 min-w-0"
                      />
                      <span className="text-slate-300 text-xs flex-shrink-0">=</span>
                      <Input
                        value={f.value}
                        onChange={(e) => setDefaultFields((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        placeholder={`value or {"id":"2"}`}
                        className="text-xs h-7 font-mono flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => setDefaultFields((prev) => prev.filter((_, j) => j !== i))}
                        className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {state.phase === 'syncing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-600">Syncing {sourceRecords.length.toLocaleString()} records…</p>
            <p className="text-xs text-slate-400">This may take a moment</p>
          </div>
        )}

        {state.phase === 'done' && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{state.result.created}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Created</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{state.result.updated}</p>
                <p className="text-xs text-blue-600 mt-0.5">Updated</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{state.result.failed}</p>
                <p className="text-xs text-red-600 mt-0.5">Failed</p>
              </div>
            </div>

            {state.result.failed > 0 && (
              <div className="rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-800 space-y-1 max-h-40 overflow-y-auto">
                <p className="font-semibold mb-1">Errors:</p>
                {state.result.results
                  .filter((r) => !r.success)
                  .slice(0, 20)
                  .map((r, i) => (
                    <div key={i} className="font-mono">
                      Record #{r.index + 1}: {r.error}
                    </div>
                  ))}
                {state.result.failed > 20 && (
                  <p className="text-red-500">…and {state.result.failed - 20} more</p>
                )}
              </div>
            )}
          </div>
        )}

        {state.phase === 'error' && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
            <span>{state.error}</span>
          </div>
        )}

        <DialogFooter>
          {state.phase === 'config' && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={execute}
                disabled={isToNs ? !nsWriteType : !sfObject || (syncMode === 'upsert' && !externalIdField)}
                className="gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Sync {sourceRecords.length.toLocaleString()} records
              </Button>
            </>
          )}
          {state.phase === 'syncing' && (
            <Button variant="outline" disabled>Syncing…</Button>
          )}
          {(state.phase === 'done' || state.phase === 'error') && (
            <>
              <Button variant="outline" onClick={() => setState({ phase: 'config' })}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToCsv(obj: Record<string, unknown>): string {
  return Object.values(obj)
    .map((v) => {
      const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    })
    .join(',');
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(rowToCsv).join('\n');
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function previewKeys(record: Record<string, unknown>, matchField: string): string[] {
  const priority = [matchField, 'Name', 'name', 'ProductCode', 'itemid', 'displayName', 'Id', 'id'];
  const seen = new Set<string>();
  const unique = priority.filter((k) => { if (seen.has(k)) return false; seen.add(k); return true; });
  const keys = Object.keys(record).filter((k) => record[k] != null && String(record[k]).trim() !== '');
  const ordered = [...unique.filter((k) => keys.includes(k)), ...keys.filter((k) => !seen.has(k))];
  return ordered.slice(0, 5);
}

// ── Pair result table ──────────────────────────────────────────────────────────

type UnmatchedTab = 'unmatched-sf' | 'unmatched-ns';

const INITIAL_DISPLAY = 200;

function UnmatchedPanel({
  rows,
  displayKeys,
  allKeys,
  accentColor,
  emptyMessage,
  onExport,
  onSync,
  syncLabel,
}: {
  rows: Record<string, unknown>[];
  displayKeys: string[];
  allKeys: string[];
  accentColor: 'indigo' | 'amber' | 'violet';
  emptyMessage: string;
  onExport: () => void;
  onSync?: (selectedRecords: Record<string, unknown>[]) => void;
  syncLabel?: string;
}) {
  const [filter, setFilter] = useState('');
  const [groupByCol, setGroupByCol] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Only reset when a real re-run happens (rows reference changes)
  useEffect(() => {
    setFilter('');
    setGroupByCol('');
    setExpandedGroups(new Set());
    setDisplayCount(INITIAL_DISPLAY);
  }, [rows]);

  // Reset selection when filter or groupBy changes
  useEffect(() => { setSelectedIndices(new Set()); }, [filter, groupByCol, rows]);

  const headClass = accentColor === 'indigo'
    ? 'text-indigo-700 bg-indigo-50/50'
    : accentColor === 'amber'
      ? 'text-amber-700 bg-amber-50/50'
      : 'text-violet-700 bg-violet-50/50';

  const accentRing = accentColor === 'indigo'
    ? 'focus:ring-indigo-400'
    : accentColor === 'amber'
      ? 'focus:ring-amber-400'
      : 'focus:ring-violet-400';

  const syncBtnClass = accentColor === 'amber'
    ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
    : 'text-violet-700 border-violet-200 hover:bg-violet-50';

  const syncBadgeClass = accentColor === 'amber'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-violet-100 text-violet-700';

  const checkboxClass = accentColor === 'amber'
    ? 'text-amber-600 focus:ring-amber-400'
    : 'text-violet-600 focus:ring-violet-400';

  // Filter across all keys
  const filtered = filter
    ? rows.filter((row) =>
        allKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : rows;

  // Build row-reference → filtered-index map (used by grouped view)
  const filteredIndexMap = new Map<Record<string, unknown>, number>();
  filtered.forEach((row, i) => filteredIndexMap.set(row, i));

  // Group filtered rows
  const groups: [string, Record<string, unknown>[]][] | null = groupByCol
    ? Object.entries(
        filtered.reduce<Record<string, Record<string, unknown>[]>>((acc, row) => {
          const key = String(row[groupByCol] ?? '(empty)');
          (acc[key] ??= []).push(row);
          return acc;
        }, {})
      ).sort((a, b) => b[1].length - a[1].length)
    : null;

  // In flat view the selectable set is capped at displayCount
  const visibleCount = groups ? filtered.length : Math.min(displayCount, filtered.length);
  const allVisibleSelected = visibleCount > 0 && selectedIndices.size === visibleCount &&
    Array.from({ length: visibleCount }, (_, i) => i).every((i) => selectedIndices.has(i));
  const someVisibleSelected = selectedIndices.size > 0 && !allVisibleSelected;

  // Sync header checkbox indeterminate state
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleRow = (i: number) =>
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const toggleAll = () =>
    setSelectedIndices(
      allVisibleSelected
        ? new Set()
        : new Set(Array.from({ length: visibleCount }, (_, i) => i))
    );

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const expandAll = () => groups && setExpandedGroups(new Set(groups.map(([k]) => k)));
  const collapseAll = () => setExpandedGroups(new Set());

  const handleSync = () => {
    if (!onSync) return;
    const selectedRows = filtered.filter((_, i) => selectedIndices.has(i));
    onSync(selectedRows);
  };

  if (rows.length === 0) {
    return <p className="text-center py-6 text-emerald-600 text-xs">{emptyMessage}</p>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex-wrap">
        {/* Filter input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows…"
            className={`pl-6 pr-6 h-7 w-48 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 ${accentRing}`}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {filter && (
          <span className="text-xs text-slate-500 font-medium">
            {filtered.length} / {rows.length} rows
          </span>
        )}

        {/* Group by */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-xs text-slate-500 flex-shrink-0">Group by</span>
          <select
            value={groupByCol}
            onChange={(e) => { setGroupByCol(e.target.value); setExpandedGroups(new Set()); }}
            className="h-7 text-xs border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 max-w-[160px]"
          >
            <option value="">None</option>
            {allKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Group expand/collapse controls */}
        {groups && (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">{groups.length} groups</Badge>
            <button onClick={expandAll} className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">expand all</button>
            <span className="text-slate-300">·</span>
            <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">collapse all</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Selection count hint */}
          {onSync && selectedIndices.size === 0 && (
            <span className="text-xs text-slate-400">Check rows to select for sync</span>
          )}
          {onSync && selectedIndices.size > 0 && (
            <>
              <span className="text-xs text-slate-500 font-medium">{selectedIndices.size} selected</span>
              <button
                onClick={() => setSelectedIndices(new Set())}
                className="text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
              >
                clear
              </button>
            </>
          )}

          {/* Sync button */}
          {onSync && (
            <Button
              variant="outline" size="sm"
              className={`h-6 gap-1 text-xs disabled:opacity-40 ${syncBtnClass}`}
              disabled={selectedIndices.size === 0}
              title={selectedIndices.size === 0 ? 'Select rows below to enable' : undefined}
              onClick={handleSync}
            >
              <Upload className="w-3 h-3" />
              {syncLabel ?? 'Sync'}
              {selectedIndices.size > 0 && (
                <Badge className={`ml-0.5 text-xs border-0 px-1 ${syncBadgeClass}`}>
                  {selectedIndices.size}
                </Badge>
              )}
            </Button>
          )}

          <Button variant="outline" size="sm" className="h-6 gap-1 text-xs" onClick={onExport}>
            <Download className="w-3 h-3" /> CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <p className="text-center py-6 text-slate-400 text-xs italic">No rows match the filter.</p>
      ) : groups ? (
        /* ── Grouped view: all filtered rows, no display cap ── */
        <div>
          {groups.map(([groupValue, groupRows]) => (
            <div key={groupValue} className="border-b border-slate-100 last:border-0">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 text-left"
                onClick={() => toggleGroup(groupValue)}
              >
                {expandedGroups.has(groupValue)
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                <span className="font-mono text-slate-800 truncate max-w-xs">{groupValue}</span>
                <Badge variant="secondary" className="ml-1 text-xs flex-shrink-0">
                  {groupRows.length.toLocaleString()}
                </Badge>
              </button>

              {expandedGroups.has(groupValue) && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {onSync && <TableHead className="w-8 px-3" />}
                        {displayKeys.map((k) => (
                          <TableHead key={k} className={`text-xs ${headClass}`}>{k}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupRows.map((row, i) => {
                        const filteredIdx = filteredIndexMap.get(row) ?? -1;
                        const isSelected = filteredIdx >= 0 && selectedIndices.has(filteredIdx);
                        return (
                          <TableRow
                            key={i}
                            className={`transition-colors ${onSync ? 'cursor-pointer' : ''} ${isSelected ? 'bg-slate-50/80' : 'hover:bg-slate-50'}`}
                            onClick={() => onSync && filteredIdx >= 0 && toggleRow(filteredIdx)}
                          >
                            {onSync && (
                              <TableCell className="px-3 py-1.5 w-8" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => filteredIdx >= 0 && toggleRow(filteredIdx)}
                                  className={`rounded border-slate-300 cursor-pointer ${checkboxClass}`}
                                />
                              </TableCell>
                            )}
                            {displayKeys.map((k) => (
                              <TableCell key={k} className="text-xs py-1.5 max-w-[200px] truncate font-mono">
                                {String(row[k] ?? '—')}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── Flat view: client-side display cap with load-more ── */
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {onSync && (
                    <TableHead className="w-8 px-3">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        className={`rounded border-slate-300 cursor-pointer ${checkboxClass}`}
                        title={allVisibleSelected ? 'Deselect all' : 'Select all visible rows'}
                      />
                    </TableHead>
                  )}
                  {displayKeys.map((k) => (
                    <TableHead key={k} className={`text-xs ${headClass}`}>{k}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, displayCount).map((row, i) => {
                  const isSelected = selectedIndices.has(i);
                  return (
                    <TableRow
                      key={i}
                      className={`transition-colors ${onSync ? 'cursor-pointer' : ''} ${isSelected ? 'bg-slate-50/80' : 'hover:bg-slate-50'}`}
                      onClick={() => onSync && toggleRow(i)}
                    >
                      {onSync && (
                        <TableCell className="px-3 py-1.5 w-8" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(i)}
                            className={`rounded border-slate-300 cursor-pointer ${checkboxClass}`}
                          />
                        </TableCell>
                      )}
                      {displayKeys.map((k) => (
                        <TableCell key={k} className="text-xs py-1.5 max-w-[200px] truncate">
                          {String(row[k] ?? '—')}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {displayCount < filtered.length && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs flex-wrap">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-slate-600">
                Showing <strong>{Math.min(displayCount, filtered.length).toLocaleString()}</strong> of <strong>{filtered.length.toLocaleString()}</strong> rows.
              </span>
              <button onClick={() => setDisplayCount(1_000)} className="text-indigo-600 hover:underline font-medium">1,000</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => setDisplayCount(5_000)} className="text-indigo-600 hover:underline font-medium">5,000</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => setDisplayCount(Infinity)} className="text-indigo-600 hover:underline font-medium">
                All ({filtered.length.toLocaleString()})
              </button>
              <span className="text-slate-400 ml-1">— or use Group by to see all rows organised by column</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PairResultTable({
  result,
  onSyncSfToNs,
  onSyncNsToSf,
  onUpdateNsFromSf,
  onUpdateSfFromNs,
}: {
  result: PairResult;
  onSyncSfToNs?: (records: Record<string, unknown>[]) => void;
  onSyncNsToSf?: (records: Record<string, unknown>[]) => void;
  onUpdateNsFromSf?: (sfRecords: Record<string, unknown>[], nsRecords: Record<string, unknown>[]) => void;
  onUpdateSfFromNs?: (sfRecords: Record<string, unknown>[], nsRecords: Record<string, unknown>[]) => void;
}) {
  const [tab, setTab] = useState<'matched' | UnmatchedTab>('matched');
  const [matchFilter, setMatchFilter] = useState('');
  const [selectedMatchedIndices, setSelectedMatchedIndices] = useState<Set<number>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const sfPrimaryField = result.sfMatchFields[0] ?? '';
  const nsPrimaryField = result.nsMatchFields[0] ?? '';

  const sfKeys = result.matchedPairs.length > 0
    ? previewKeys(result.matchedPairs[0].sfRecord, sfPrimaryField)
    : previewKeys(result.unmatchedSfRecords[0] ?? {}, sfPrimaryField);

  const nsKeys = result.matchedPairs.length > 0
    ? previewKeys(result.matchedPairs[0].nsRecord, nsPrimaryField)
    : previewKeys(result.unmatchedNsRecords[0] ?? {}, nsPrimaryField);

  // All keys from each side (for group-by selector)
  const allSfKeys = result.unmatchedSfRecords[0]
    ? Object.keys(result.unmatchedSfRecords[0])
    : sfKeys;
  const allNsKeys = result.unmatchedNsRecords[0]
    ? Object.keys(result.unmatchedNsRecords[0])
    : nsKeys;

  // Filtered matched pairs
  const filteredMatched = matchFilter
    ? result.matchedPairs.filter(({ sfRecord, nsRecord }) =>
        [...sfKeys, ...nsKeys].some((k) =>
          String((sfRecord[k] ?? nsRecord[k]) ?? '').toLowerCase().includes(matchFilter.toLowerCase())
        )
      )
    : result.matchedPairs;

  // Selection helpers
  const allSelected = filteredMatched.length > 0 && selectedMatchedIndices.size === filteredMatched.length;
  const someSelected = selectedMatchedIndices.size > 0 && !allSelected;
  const selectedPairs = filteredMatched.filter((_, i) => selectedMatchedIndices.has(i));

  // Reset selection when filter or tab changes
  useEffect(() => { setSelectedMatchedIndices(new Set()); }, [matchFilter, tab]);

  // Sync indeterminate state on header checkbox
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleRow = (i: number) =>
    setSelectedMatchedIndices((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const toggleAll = () =>
    setSelectedMatchedIndices(
      allSelected ? new Set() : new Set(filteredMatched.map((_, i) => i))
    );

  return (
    <div className="rounded border border-slate-200 overflow-hidden text-sm">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3">
        <button
          className={`py-2 px-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'matched' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('matched')}
        >
          Matched <Badge variant="secondary" className="ml-1 text-xs">{result.matchedCount}</Badge>
        </button>
        <button
          className={`py-2 px-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'unmatched-sf' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('unmatched-sf')}
        >
          Unmatched in SF <Badge variant="secondary" className="ml-1 text-xs bg-amber-100 text-amber-700">{result.unmatchedSfCount}</Badge>
        </button>
        <button
          className={`py-2 px-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'unmatched-ns' ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('unmatched-ns')}
        >
          Unmatched in NS <Badge variant="secondary" className="ml-1 text-xs bg-violet-100 text-violet-700">{result.unmatchedNsCount}</Badge>
        </button>
        <div className="ml-auto flex items-center gap-1.5 py-1">
          {tab === 'matched' && result.matchedPairs.length > 0 && (
            <>
              {selectedMatchedIndices.size > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                  {selectedMatchedIndices.size} selected
                </span>
              )}
              {onUpdateNsFromSf && (
                <Button
                  variant="outline" size="sm"
                  disabled={selectedMatchedIndices.size === 0}
                  className="h-6 gap-1 text-xs text-violet-700 border-violet-200 hover:bg-violet-50 disabled:opacity-40"
                  title={selectedMatchedIndices.size === 0 ? 'Select rows below to enable' : undefined}
                  onClick={() => onUpdateNsFromSf(
                    selectedPairs.map((p) => p.sfRecord),
                    selectedPairs.map((p) => p.nsRecord),
                  )}
                >
                  <Upload className="w-3 h-3" />
                  Update NS from SF
                  {selectedMatchedIndices.size > 0 && (
                    <Badge className="ml-0.5 text-xs bg-violet-100 text-violet-700 border-0 px-1">
                      {selectedMatchedIndices.size}
                    </Badge>
                  )}
                </Button>
              )}
              {onUpdateSfFromNs && (
                <Button
                  variant="outline" size="sm"
                  disabled={selectedMatchedIndices.size === 0}
                  className="h-6 gap-1 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 disabled:opacity-40"
                  title={selectedMatchedIndices.size === 0 ? 'Select rows below to enable' : undefined}
                  onClick={() => onUpdateSfFromNs(
                    selectedPairs.map((p) => p.sfRecord),
                    selectedPairs.map((p) => p.nsRecord),
                  )}
                >
                  <Upload className="w-3 h-3" />
                  Update SF from NS
                  {selectedMatchedIndices.size > 0 && (
                    <Badge className="ml-0.5 text-xs bg-indigo-100 text-indigo-700 border-0 px-1">
                      {selectedMatchedIndices.size}
                    </Badge>
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-6 gap-1 text-xs"
                onClick={() => exportCsv(result.matchedPairs.map(({ sfRecord, nsRecord }) => {
                  const out: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(sfRecord)) out[`sf_${k}`] = v;
                  for (const [k, v] of Object.entries(nsRecord)) out[`ns_${k}`] = v;
                  return out;
                }), 'matched.csv')}>
                <Download className="w-3 h-3" /> CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Matched tab ── */}
      {tab === 'matched' && (
        result.matchedPairs.length === 0 ? (
          <p className="text-center py-6 text-slate-400 text-xs italic">No matched records.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input
                  value={matchFilter}
                  onChange={(e) => setMatchFilter(e.target.value)}
                  placeholder="Filter rows…"
                  className="pl-6 pr-6 h-7 w-48 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                {matchFilter && (
                  <button onClick={() => setMatchFilter('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {matchFilter && (
                <span className="text-xs text-slate-500">{filteredMatched.length} / {result.matchedPairs.length} rows</span>
              )}
              {selectedMatchedIndices.size === 0 && (
                <span className="text-xs text-slate-400 ml-1">Check rows to select for sync</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 px-3">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
                        title={allSelected ? 'Deselect all' : 'Select all visible rows'}
                      />
                    </TableHead>
                    {sfKeys.map((k) => (
                      <TableHead key={`sf-${k}`} className="text-indigo-700 bg-indigo-50/50 text-xs">SF · {k}</TableHead>
                    ))}
                    {nsKeys.map((k) => (
                      <TableHead key={`ns-${k}`} className="text-violet-700 bg-violet-50/50 text-xs">NS · {k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatched.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={sfKeys.length + nsKeys.length + 1} className="text-center py-6 text-slate-400 text-xs italic">
                        No rows match the filter.
                      </TableCell>
                    </TableRow>
                  ) : filteredMatched.map(({ sfRecord, nsRecord }, i) => {
                    const isSelected = selectedMatchedIndices.has(i);
                    return (
                      <TableRow
                        key={i}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleRow(i)}
                      >
                        <TableCell className="px-3 py-1.5 w-8" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(i)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
                          />
                        </TableCell>
                        {sfKeys.map((k) => (
                          <TableCell key={`sf-${k}`} className="text-xs py-1.5 bg-indigo-50/20 max-w-[180px] truncate">{String(sfRecord[k] ?? '—')}</TableCell>
                        ))}
                        {nsKeys.map((k) => (
                          <TableCell key={`ns-${k}`} className="text-xs py-1.5 bg-violet-50/20 max-w-[180px] truncate">{String(nsRecord[k] ?? '—')}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {result.matchedCount > 200 && (
              <p className="text-xs text-slate-400 text-center py-1.5 border-t border-slate-100">
                Showing first 200 of {result.matchedCount.toLocaleString()} rows — export CSV for full dataset
              </p>
            )}
          </>
        )
      )}

      {/* ── Unmatched tabs ── */}
      {tab === 'unmatched-sf' && (
        <UnmatchedPanel
          rows={result.unmatchedSfRecords}
          displayKeys={sfKeys}
          allKeys={allSfKeys}
          accentColor="amber"
          emptyMessage="All SF records are matched in NS."
          onExport={() => exportCsv(result.unmatchedSfRecords, 'unmatched_sf.csv')}
          onSync={onSyncSfToNs}
          syncLabel="Insert into NS"
        />
      )}
      {tab === 'unmatched-ns' && (
        <UnmatchedPanel
          rows={result.unmatchedNsRecords}
          displayKeys={nsKeys}
          allKeys={allNsKeys}
          accentColor="violet"
          emptyMessage="All NS records are matched in SF."
          onExport={() => exportCsv(result.unmatchedNsRecords, 'unmatched_ns.csv')}
          onSync={onSyncNsToSf}
          syncLabel="Insert into SF"
        />
      )}
    </div>
  );
}

// ── AI explanation panel ──────────────────────────────────────────────────────

function ExplainPanel({
  sfFields, nsFields, nsObject, result, aiLabel,
}: {
  sfFields: string[];
  nsFields: string[];
  nsObject: string;
  result: PairResult;
  aiLabel: string;
}) {
  const [state, setState] = useState<ExplainState>({ status: 'idle' });

  const runExplain = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/entity-syncer/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfFields,
          nsFields,
          nsObject,
          matchedCount: result.matchedCount,
          unmatchedCount: result.unmatchedSfCount,
          unmatchedSfSample: result.unmatchedSfRecords.slice(0, 20),
          nsSample: result.unmatchedNsRecords.slice(0, 20),
        }),
      });
      const data = await res.json() as { explanation?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Explain failed');
      setState({ status: 'done', explanation: data.explanation! });
    } catch (err) {
      setState({ status: 'error', error: String(err) });
    }
  }, [sfFields, nsFields, nsObject, result]);

  if (state.status === 'idle') {
    return (
      <Button
        variant="outline" size="sm"
        className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
        onClick={runExplain}
      >
        <Sparkles className="w-3.5 h-3.5" /> Analyze with {aiLabel}
      </Button>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{aiLabel} is analyzing mismatches…</span>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-red-600">{state.error}</p>
        <Button variant="ghost" size="sm" onClick={runExplain} className="text-xs">Retry</Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-indigo-800">{aiLabel} Analysis</span>
        <Button variant="ghost" size="sm" className="ml-auto text-xs h-6" onClick={runExplain}>Re-run</Button>
      </div>
      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
        {state.explanation}
      </div>
    </div>
  );
}

// ── Fuzzy match panel ──────────────────────────────────────────────────────────

function FuzzyPanel({
  sfFields, nsFields, exactResult,
}: {
  sfFields: string[];
  nsFields: string[];
  exactResult: PairResult;
}) {
  const [state, setState] = useState<FuzzyState>({ status: 'idle' });
  const [threshold, setThreshold] = useState(0.7);

  // Fuzzy matching operates on a single field; use the first field of each side
  const sfField = sfFields[0] ?? '';
  const nsField = nsFields[0] ?? '';
  const isComposite = sfFields.length > 1 || nsFields.length > 1;

  const run = useCallback(() => {
    const result = computeFuzzy(
      exactResult.unmatchedSfRecords,
      exactResult.unmatchedNsRecords,
      sfField,
      nsField,
      threshold,
    );
    setState({ status: 'done', result });
  }, [exactResult, sfField, nsField, threshold]);

  const scoreColor = (score: number) =>
    score >= 0.9 ? 'text-emerald-700 bg-emerald-50' :
    score >= 0.75 ? 'text-amber-700 bg-amber-50' :
    'text-slate-600 bg-slate-100';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">Fuzzy Matches</span>
        <span className="text-xs text-slate-400">across unmatched records</span>
        {state.status === 'done' && (
          <Badge variant="secondary" className="ml-1">{state.result.fuzzyCount}</Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Threshold
            <select
              value={threshold}
              onChange={(e) => { setThreshold(Number(e.target.value)); setState({ status: 'idle' }); }}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white"
            >
              <option value={0.5}>50%</option>
              <option value={0.6}>60%</option>
              <option value={0.7}>70%</option>
              <option value={0.8}>80%</option>
              <option value={0.9}>90%</option>
            </select>
          </label>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={run}>
            <Play className="w-3 h-3" />
            {state.status === 'done' ? 'Re-run' : 'Run Fuzzy'}
          </Button>
        </div>
      </div>

      {state.status === 'idle' && (
        <div className="px-4 py-8 text-center text-xs text-slate-400">
          Fuzzy matching finds near-matches in unmatched records using normalisation + edit distance.
          {isComposite && (
            <span className="block mt-1 italic">
              Composite pair — fuzzy matching uses the first field on each side ({sfField} ↔ {nsField}).
            </span>
          )}
          {!isComposite && <> Click <strong>Run Fuzzy</strong> to analyse.</>}
          {isComposite && <> Click <strong>Run Fuzzy</strong> to analyse on primary fields.</>}
        </div>
      )}

      {state.status === 'done' && state.result.fuzzyCount === 0 && (
        <p className="px-4 py-6 text-center text-xs text-slate-400">
          No fuzzy matches found above {Math.round(threshold * 100)}% similarity.
        </p>
      )}

      {state.status === 'done' && state.result.fuzzyCount > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="text-indigo-700 bg-indigo-50/50 text-xs">SF · {sfFields.join(' + ')}</TableHead>
                <TableHead className="text-violet-700 bg-violet-50/50 text-xs">NS · {nsFields.join(' + ')}</TableHead>
                <TableHead className="text-xs text-center w-20">Score</TableHead>
                <TableHead className="text-xs w-28">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.result.fuzzyPairs.map((pair, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs py-1.5 font-mono text-indigo-700 bg-indigo-50/20 max-w-[200px] truncate">
                    {pair.sfValue || '—'}
                  </TableCell>
                  <TableCell className="text-xs py-1.5 font-mono text-violet-700 bg-violet-50/20 max-w-[200px] truncate">
                    {pair.nsValue || '—'}
                  </TableCell>
                  <TableCell className="text-center py-1.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${scoreColor(pair.score)}`}>
                      {Math.round(pair.score * 100)}%
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    {pair.matchType === 'normalized' ? (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">Normalised</Badge>
                    ) : (
                      <Badge className="text-xs bg-blue-100 text-blue-700 border-0">Similar</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {state.result.fuzzyCount > 200 && (
            <p className="text-xs text-slate-400 text-center py-1.5 border-t border-slate-100">
              Showing top 200 matches by score
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI advanced match panel ────────────────────────────────────────────────────

interface AiMatch {
  sfRecord: Record<string, unknown>;
  nsRecord: Record<string, unknown>;
  confidence: number;
  reasons: string[];
}

type AiMatchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; matches: AiMatch[]; sfSampleSize: number; nsSampleSize: number }
  | { status: 'error'; error: string };

function confidenceCfg(score: number): { label: string; color: string } {
  if (score >= 0.9) return { label: 'Very High', color: 'bg-emerald-100 text-emerald-700' };
  if (score >= 0.7) return { label: 'High', color: 'bg-blue-100 text-blue-700' };
  return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
}

function RecordPreview({
  record,
  priorityFields,
  accentColor,
}: {
  record: Record<string, unknown>;
  priorityFields: string[];
  accentColor: 'indigo' | 'violet';
}) {
  const knownPriority = [
    ...priorityFields,
    'Name', 'name', 'ProductCode', 'itemid', 'displayName', 'displayname', 'Description', 'Id', 'id',
  ];
  const seen = new Set<string>();
  const uniquePriority = knownPriority.filter((k) => { if (seen.has(k)) return false; seen.add(k); return true; });
  const populated = Object.keys(record).filter((k) => record[k] != null && String(record[k]).trim() !== '');
  const displayKeys = [
    ...uniquePriority.filter((k) => populated.includes(k)),
    ...populated.filter((k) => !seen.has(k)),
  ].slice(0, 4);

  const bgClass = accentColor === 'indigo' ? 'bg-indigo-50 border-indigo-100' : 'bg-violet-50 border-violet-100';
  const valClass = accentColor === 'indigo' ? 'text-indigo-700' : 'text-violet-700';

  return (
    <div className={`rounded border p-2.5 text-xs space-y-1 ${bgClass}`}>
      {displayKeys.map((k) => (
        <div key={k} className="flex gap-2 min-w-0">
          <span className="text-slate-400 flex-shrink-0 font-medium min-w-0 truncate max-w-[80px]">{k}</span>
          <span className={`font-mono truncate flex-1 min-w-0 ${valClass}`}>{String(record[k])}</span>
        </div>
      ))}
    </div>
  );
}

function AiMatchPanel({
  unmatchedSfRecords,
  unmatchedNsRecords,
  sfMatchFields,
  nsMatchFields,
  aiLabel,
}: {
  unmatchedSfRecords: Record<string, unknown>[];
  unmatchedNsRecords: Record<string, unknown>[];
  sfMatchFields: string[];
  nsMatchFields: string[];
  aiLabel: string;
}) {
  const [state, setState] = useState<AiMatchState>({ status: 'idle' });
  const [sampleSize, setSampleSize] = useState(50);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const canRun = unmatchedSfRecords.length > 0 && unmatchedNsRecords.length > 0;

  const run = useCallback(async () => {
    if (!canRun) return;
    setState({ status: 'loading' });
    setExpandedIdx(null);
    try {
      const res = await fetch('/api/entity-syncer/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfRecords: unmatchedSfRecords,
          nsRecords: unmatchedNsRecords,
          sfSampleSize: sampleSize,
          nsSampleSize: sampleSize,
        }),
      });
      const data = await res.json() as {
        matches?: AiMatch[];
        sfSampleSize?: number;
        nsSampleSize?: number;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? 'AI match failed');
      setState({
        status: 'done',
        matches: data.matches ?? [],
        sfSampleSize: data.sfSampleSize ?? sampleSize,
        nsSampleSize: data.nsSampleSize ?? sampleSize,
      });
    } catch (err) {
      setState({ status: 'error', error: String(err) });
    }
  }, [canRun, unmatchedSfRecords, unmatchedNsRecords, sampleSize]);

  return (
    <div className="rounded-lg border border-purple-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-purple-100 bg-purple-50/40">
        <Brain className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-slate-700">AI Advanced Match</span>
        <span className="text-xs text-slate-400">semantic matching across unmatched records</span>
        {state.status === 'done' && (
          <Badge className="ml-1 text-xs bg-purple-100 text-purple-700 border-0">
            {state.matches.length} suggestion{state.matches.length !== 1 ? 's' : ''}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Sample
            <select
              value={sampleSize}
              onChange={(e) => {
                setSampleSize(Number(e.target.value));
                if (state.status === 'done') setState({ status: 'idle' });
              }}
              className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white"
              disabled={state.status === 'loading'}
            >
              <option value={25}>25 / side</option>
              <option value={50}>50 / side</option>
              <option value={100}>100 / side</option>
            </select>
          </label>
          {canRun && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
              onClick={run}
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
              ) : (
                <><Brain className="w-3 h-3" /> {state.status === 'done' ? 'Re-run' : 'Find Matches'}</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      {!canRun && (
        <p className="px-4 py-8 text-center text-xs text-slate-400">
          No unmatched records on both sides — run exact matching first.
        </p>
      )}

      {canRun && state.status === 'idle' && (
        <div className="px-4 py-8 text-center text-xs text-slate-400 space-y-1">
          <p>{aiLabel} analyzes unmatched records from both systems and identifies likely matches despite differing field values, naming conventions, or ID formats.</p>
          <p className="text-slate-300">
            {unmatchedSfRecords.length.toLocaleString()} unmatched SF · {unmatchedNsRecords.length.toLocaleString()} unmatched NS
            {(unmatchedSfRecords.length > sampleSize || unmatchedNsRecords.length > sampleSize) && (
              <> · will analyze top {sampleSize} per side</>
            )}
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center gap-2 px-4 py-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 flex-1">{state.error}</p>
          <Button variant="ghost" size="sm" onClick={run} className="text-xs">Retry</Button>
        </div>
      )}

      {state.status === 'done' && state.matches.length === 0 && (
        <p className="px-4 py-8 text-center text-xs text-slate-400">
          No likely matches found — the unmatched records from both systems appear to be distinct entities.
        </p>
      )}

      {state.status === 'done' && state.matches.length > 0 && (
        <div>
          {/* Sample coverage warning */}
          {(unmatchedSfRecords.length > state.sfSampleSize || unmatchedNsRecords.length > state.nsSampleSize) && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Analyzed {state.sfSampleSize} of {unmatchedSfRecords.length.toLocaleString()} SF records and{' '}
              {state.nsSampleSize} of {unmatchedNsRecords.length.toLocaleString()} NS records — increase sample size to cover more.
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_1fr] gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Salesforce</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Confidence</span>
            <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">NetSuite</span>
          </div>

          {/* Match cards */}
          <div className="divide-y divide-slate-100">
            {state.matches.map((match, idx) => {
              const cfg = confidenceCfg(match.confidence);
              const isExpanded = expandedIdx === idx;
              return (
                <div key={idx} className="px-4 py-3 hover:bg-slate-50/60 transition-colors">
                  {/* Records + score */}
                  <div className="grid grid-cols-[1fr_80px_1fr] gap-3 items-start">
                    <RecordPreview record={match.sfRecord} priorityFields={sfMatchFields} accentColor="indigo" />
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold tabular-nums ${cfg.color}`}>
                        {Math.round(match.confidence * 100)}%
                      </span>
                      <span className={`text-xs font-medium ${cfg.color.split(' ')[1]}`}>{cfg.label}</span>
                    </div>
                    <RecordPreview record={match.nsRecord} priorityFields={nsMatchFields} accentColor="violet" />
                  </div>

                  {/* Reasons */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {match.reasons.map((r, ri) => (
                      <span
                        key={ri}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                      >
                        <span className="text-slate-400">·</span> {r}
                      </span>
                    ))}
                  </div>

                  {/* Expand toggle */}
                  <button
                    className="mt-1.5 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    {isExpanded ? 'Hide full records' : 'Inspect full records'}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 mb-1">Salesforce record</p>
                        <pre className="text-xs font-mono bg-indigo-50 border border-indigo-100 rounded p-2 text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-52">
                          {JSON.stringify(match.sfRecord, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-violet-700 mb-1">NetSuite record</p>
                        <pre className="text-xs font-mono bg-violet-50 border border-violet-100 rounded p-2 text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-52">
                          {JSON.stringify(match.nsRecord, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Match percentage helpers ───────────────────────────────────────────────────

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function MatchPctBadge({ value }: { value: number }) {
  const color =
    value >= 70 ? 'bg-emerald-100 text-emerald-700' :
    value >= 30 ? 'bg-amber-100 text-amber-700' :
    'bg-rose-100 text-rose-700';
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums ${color}`}>
      {value.toFixed(1)}%
    </span>
  );
}

// ── Pair card ──────────────────────────────────────────────────────────────────

type SyncTarget =
  | { direction: 'sf-to-ns'; records: Record<string, unknown>[] }
  | { direction: 'ns-to-sf'; records: Record<string, unknown>[] };

function PairCard({
  sfFields, nsFields, condition, sfObject, nsObject, sfConnectionId, nsConnectionId,
  mappingPairs, state, onRun, aiLabel,
}: {
  sfFields: string[];
  nsFields: string[];
  condition?: 'AND' | 'OR';
  sfObject: string;
  nsObject: string;
  sfConnectionId: string;
  nsConnectionId: string;
  mappingPairs: FieldMappingEntry[];
  state: PairState;
  onRun: () => void;
  aiLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [syncTarget, setSyncTarget] = useState<SyncTarget | null>(null);

  const isDone = state.status === 'done';
  const sfLabel = sfFields.join(' + ');
  const nsLabel = nsFields.join(' + ');
  const isComposite = sfFields.length > 1 || nsFields.length > 1;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 disabled:opacity-40"
          onClick={() => isDone && setExpanded((v) => !v)}
          disabled={!isDone}
        >
          {isDone && expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-mono text-sm font-medium text-indigo-700">{sfLabel}</span>
          <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="font-mono text-sm font-medium text-violet-700">{nsLabel}</span>
          {isComposite && condition === 'OR' && (
            <Badge className="text-xs bg-amber-100 text-amber-700 border-0 flex-shrink-0">OR</Badge>
          )}
        </div>

        {state.status === 'idle' && (
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={onRun}>
            <Play className="w-3 h-3" /> Run
          </Button>
        )}
        {state.status === 'loading' && (
          <div className="flex flex-col gap-0.5 text-xs min-w-0">
            {(['sf', 'ns'] as const).map((side) => {
              const info = state.progress[side];
              return (
                <div key={side} className="flex items-center gap-1.5 text-slate-500">
                  <Loader2 className={`w-3 h-3 animate-spin flex-shrink-0 ${side === 'sf' ? 'text-indigo-400' : 'text-violet-400'}`} />
                  <span className={`font-medium ${side === 'sf' ? 'text-indigo-600' : 'text-violet-600'}`}>
                    {side === 'sf' ? 'SF' : 'NS'}
                  </span>
                  {info
                    ? <span>page {info.page} · {info.count.toLocaleString()} records</span>
                    : <span className="text-slate-400">starting…</span>
                  }
                </div>
              );
            })}
            {state.progress.computing && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-500 flex-shrink-0" />
                <span>Computing matches…</span>
              </div>
            )}
          </div>
        )}
        {state.status === 'done' && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {state.result.matchedCount.toLocaleString()} matched
              <MatchPctBadge value={pct(state.result.matchedCount, state.result.sfTotal)} />
            </span>
            <span className="text-slate-200">|</span>
            <span className="flex items-center gap-1 text-xs text-amber-700 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {state.result.unmatchedSfCount.toLocaleString()} SF only
              <span className="text-amber-400/70 text-xs tabular-nums">
                ({pct(state.result.unmatchedSfCount, state.result.sfTotal).toFixed(1)}%)
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-violet-700 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {state.result.unmatchedNsCount.toLocaleString()} NS only
              <span className="text-violet-400/70 text-xs tabular-nums">
                ({pct(state.result.unmatchedNsCount, state.result.nsTotal).toFixed(1)}%)
              </span>
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-600" onClick={onRun}>
              <Play className="w-3 h-3 mr-1" /> Re-run
            </Button>
          </div>
        )}
        {state.status === 'error' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 truncate max-w-[200px]">{state.error}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRun}>Retry</Button>
          </div>
        )}
      </div>

      {/* Expanded: records + Fuzzy + AI Match + Gemini */}
      {isDone && expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 space-y-4">
          <PairResultTable
            result={state.result}
            onSyncSfToNs={(records) => setSyncTarget({ direction: 'sf-to-ns', records })}
            onSyncNsToSf={(records) => setSyncTarget({ direction: 'ns-to-sf', records })}
            onUpdateNsFromSf={(sfRecords) => setSyncTarget({ direction: 'sf-to-ns', records: sfRecords })}
            onUpdateSfFromNs={(_sfRecords, nsRecords) => setSyncTarget({ direction: 'ns-to-sf', records: nsRecords })}
          />
          {syncTarget && (
            <SyncDialog
              open={!!syncTarget}
              onClose={() => setSyncTarget(null)}
              direction={syncTarget.direction}
              sourceRecords={syncTarget.records}
              sfConnectionId={sfConnectionId}
              nsConnectionId={nsConnectionId}
              sfObject={sfObject}
              nsObject={nsObject}
              mappingPairs={mappingPairs}
            />
          )}
          <FuzzyPanel
            sfFields={sfFields}
            nsFields={nsFields}
            exactResult={state.result}
          />
          <AiMatchPanel
            unmatchedSfRecords={state.result.unmatchedSfRecords}
            unmatchedNsRecords={state.result.unmatchedNsRecords}
            sfMatchFields={sfFields}
            nsMatchFields={nsFields}
            aiLabel={aiLabel}
          />
          <ExplainPanel
            sfFields={sfFields}
            nsFields={nsFields}
            nsObject={nsObject}
            result={state.result}
            aiLabel={aiLabel}
          />
        </div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function SyncDataView({ mapping, aiProvider }: { mapping: EntitySyncerMappingSummary; aiProvider: string }) {
  const aiLabelS: Record<string, string> = { gemini: 'Gemini', claude: 'Claude', openai: 'ChatGPT' };
  const aiLabel = aiLabelS[aiProvider] ?? 'AI';
  const [pairStates, setPairStates] = useState<PairState[]>(
    () => mapping.fieldMappings.map(() => ({ status: 'idle' as const }))
  );
  const [runningAll, setRunningAll] = useState(false);

  // Filters — applied on next run, not retroactively
  const [sfFilter, setSfFilter] = useState('');
  const [nsFilter, setNsFilter] = useState('');
  const [sfLimitRaw, setSfLimitRaw] = useState('');
  const [nsLimitRaw, setNsLimitRaw] = useState('');
  const sfLimit = sfLimitRaw ? Number(sfLimitRaw) : undefined;
  const nsLimit = nsLimitRaw ? Number(nsLimitRaw) : undefined;

  const setProgress = useCallback((index: number, update: Partial<PairProgress>) => {
    setPairStates((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (cur.status !== 'loading') return prev;
      next[index] = { status: 'loading', progress: { ...cur.progress, ...update } };
      return next;
    });
  }, []);

  const runPair = useCallback(async (index: number) => {
    const pair = mapping.fieldMappings[index];
    setPairStates((prev) => {
      const next = [...prev];
      next[index] = { status: 'loading', progress: { sf: null, ns: null, computing: false } };
      return next;
    });
    try {
      const res = await fetch('/api/entity-syncer/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfConnectionId: mapping.sfConnectionId,
          sfDataMode: mapping.sfDataMode,
          sfObject: mapping.sfObject,
          sfQuery: mapping.sfQuery,
          nsConnectionId: mapping.nsConnectionId,
          nsDataMode: mapping.nsDataMode,
          nsObject: mapping.nsObject,
          nsQuery: mapping.nsQuery,
          sfFields: pair.sourceFields,
          nsFields: pair.targetFields,
          condition: pair.condition,
          // Filters only apply in object mode (query mode uses the saved query's own WHERE)
          ...(sfFilter && mapping.sfDataMode === 'object' ? { sfFilter } : {}),
          ...(nsFilter && mapping.nsDataMode === 'object' ? { nsFilter } : {}),
          ...(sfLimit ? { sfLimit } : {}),
          ...(nsLimit ? { nsLimit } : {}),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

          if (event.type === 'progress') {
            const phase = event.phase as 'sf' | 'ns';
            setProgress(index, {
              [phase]: { page: event.page as number, count: event.count as number },
            });
          } else if (event.type === 'computing') {
            setProgress(index, { computing: true });
          } else if (event.type === 'result') {
            setPairStates((prev) => {
              const next = [...prev];
              next[index] = { status: 'done', result: event.data as PairResult };
              return next;
            });
          } else if (event.type === 'error') {
            throw new Error(event.error as string);
          }
        }
      }
    } catch (err) {
      setPairStates((prev) => {
        const next = [...prev];
        next[index] = { status: 'error', error: String(err) };
        return next;
      });
    }
  }, [mapping, setProgress, sfFilter, nsFilter, sfLimit, nsLimit]);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    await Promise.all(mapping.fieldMappings.map((_, i) => runPair(i)));
    setRunningAll(false);
  }, [mapping, runPair]);

  const doneCount = pairStates.filter((s) => s.status === 'done').length;
  const totalPairs = mapping.fieldMappings.length;

  // Aggregate stats across all completed pairs
  const donePairs = pairStates.filter((s): s is Extract<PairState, { status: 'done' }> => s.status === 'done');
  const aggMatched = donePairs.reduce((sum, s) => sum + s.result.matchedCount, 0);
  const aggSfTotal = donePairs.reduce((sum, s) => sum + s.result.sfTotal, 0);
  const aggNsTotal = donePairs.reduce((sum, s) => sum + s.result.nsTotal, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/entity-syncer">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{mapping.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              <span className="text-indigo-700 font-medium">{mapping.sfConnectionName}</span>
              {' · '}
              {mapping.sfDataMode === 'soql'
                ? <span className="font-mono text-indigo-500 text-xs bg-indigo-50 px-1.5 py-0.5 rounded">SOQL</span>
                : <span className="font-mono text-slate-600">{mapping.sfObject}</span>}
              {' '}
              <ArrowRight className="inline w-3 h-3 text-slate-400" />
              {' '}
              <span className="text-violet-700 font-medium">{mapping.nsConnectionName}</span>
              {' · '}
              {mapping.nsDataMode === 'suiteql'
                ? <span className="font-mono text-violet-500 text-xs bg-violet-50 px-1.5 py-0.5 rounded">SuiteQL</span>
                : <span className="font-mono text-slate-600">{mapping.nsObject}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {doneCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{doneCount}/{totalPairs} pairs run</span>
              {donePairs.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="text-xs text-slate-500">Overall</span>
                  <span className="text-xs font-semibold text-slate-400">·</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    {aggMatched.toLocaleString()} matched
                    <MatchPctBadge value={pct(aggMatched, aggSfTotal)} />
                  </span>
                  <span className="text-xs font-semibold text-slate-300">·</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {aggSfTotal.toLocaleString()} SF · {aggNsTotal.toLocaleString()} NS
                  </span>
                </div>
              )}
            </div>
          )}
          <Button
            onClick={runAll}
            disabled={runningAll}
            className="gap-2"
          >
            {runningAll
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Running all…</>
              : <><PlayCircle className="w-4 h-4" /> Run All</>
            }
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          <span className="text-xs text-slate-400">Applied on next run — leave blank to fetch all records</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {/* SF side */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
              Salesforce · {mapping.sfDataMode === 'soql' ? 'SOQL Query' : mapping.sfObject}
            </p>
            {mapping.sfDataMode === 'soql' ? (
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Saved query (WHERE clause filters applied inside query)</label>
                <pre className="text-xs font-mono bg-indigo-50 border border-indigo-100 rounded p-2 text-indigo-900 whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {mapping.sfQuery}
                </pre>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-slate-500">WHERE clause</label>
                <Input
                  value={sfFilter}
                  onChange={(e) => setSfFilter(e.target.value)}
                  placeholder="e.g. IsActive = true AND ProductCode != null"
                  className="text-xs font-mono h-8"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 flex-shrink-0">Max records</label>
              <Input
                type="number"
                min={1}
                value={sfLimitRaw}
                onChange={(e) => setSfLimitRaw(e.target.value)}
                placeholder="All"
                className="text-xs h-8 w-28"
              />
              {sfLimitRaw && (
                <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setSfLimitRaw('')}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* NS side */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
              NetSuite · {mapping.nsDataMode === 'suiteql' ? 'SuiteQL Query' : mapping.nsObject}
            </p>
            {mapping.nsDataMode === 'suiteql' ? (
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Saved query (WHERE clause filters applied inside query)</label>
                <pre className="text-xs font-mono bg-violet-50 border border-violet-100 rounded p-2 text-violet-900 whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {mapping.nsQuery}
                </pre>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-slate-500">WHERE clause</label>
                <Input
                  value={nsFilter}
                  onChange={(e) => setNsFilter(e.target.value)}
                  placeholder="e.g. isinactive = 'F' AND itemtype = 'InvtPart'"
                  className="text-xs font-mono h-8"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 flex-shrink-0">Max records</label>
              <Input
                type="number"
                min={1}
                value={nsLimitRaw}
                onChange={(e) => setNsLimitRaw(e.target.value)}
                placeholder="All"
                className="text-xs h-8 w-28"
              />
              {nsLimitRaw && (
                <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setNsLimitRaw('')}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active filter badges */}
        {(sfFilter || nsFilter || sfLimitRaw || nsLimitRaw) && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
            {sfFilter && mapping.sfDataMode === 'object' && (
              <Badge variant="secondary" className="text-xs font-mono gap-1">
                SF WHERE: {sfFilter}
                <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => setSfFilter('')}>×</button>
              </Badge>
            )}
            {sfLimitRaw && (
              <Badge variant="secondary" className="text-xs gap-1">
                SF max {Number(sfLimitRaw).toLocaleString()}
                <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => setSfLimitRaw('')}>×</button>
              </Badge>
            )}
            {nsFilter && mapping.nsDataMode === 'object' && (
              <Badge variant="secondary" className="text-xs font-mono gap-1">
                NS WHERE: {nsFilter}
                <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => setNsFilter('')}>×</button>
              </Badge>
            )}
            {nsLimitRaw && (
              <Badge variant="secondary" className="text-xs gap-1">
                NS max {Number(nsLimitRaw).toLocaleString()}
                <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => setNsLimitRaw('')}>×</button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Pair cards */}
      {totalPairs === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed rounded-lg bg-slate-50">
          <p className="text-sm font-medium">No column pairs in this mapping</p>
          <p className="text-xs mt-0.5">
            <Link href={`/entity-syncer`} className="text-indigo-600 hover:underline">Edit the mapping</Link>
            {' '}to add column pairs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mapping.fieldMappings.map((pair, i) => (
            <PairCard
              key={i}
              sfFields={pair.sourceFields}
              nsFields={pair.targetFields}
              condition={pair.condition}
              sfObject={mapping.sfObject}
              nsObject={mapping.nsObject}
              sfConnectionId={mapping.sfConnectionId}
              nsConnectionId={mapping.nsConnectionId}
              mappingPairs={mapping.fieldMappings}
              state={pairStates[i]}
              onRun={() => runPair(i)}
              aiLabel={aiLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
