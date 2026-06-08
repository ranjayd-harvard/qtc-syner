'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, ArrowLeft, Pencil, Trash2, PackagePlus, ChevronDown, ChevronRight,
  Play, AlertTriangle, Loader2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnections } from '@/hooks/useConnections';
import { useSchema, useObjects, useQueryMutation } from '@/hooks/useExplorer';
import {
  useProductSyncerMappings, useProductSyncerMapping,
  useCreateProductSyncerMapping, useUpdateProductSyncerMapping, useDeleteProductSyncerMapping,
} from '@/hooks/useProductSyncerMappings';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ColumnPairPicker } from '@/components/product-syncer/ColumnPairPicker';
import type { ColumnPair } from '@/components/product-syncer/ColumnPairPicker';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { QueryResponse } from '@/types/connector';
import type { FieldMeta } from '@/types/connector';
import type { ProductSyncerMappingSummary, CreateProductSyncerMappingData } from '@/models/ProductSyncerMapping';

type PageMode = 'default' | 'create' | 'edit';
type SfDataMode = 'object' | 'soql';
type NsDataMode = 'object' | 'suiteql';

const SF_PINNED_OBJECTS = [
  { name: 'Product2',       label: 'Product2 — product catalog' },
  { name: 'PricebookEntry', label: 'PricebookEntry — pricebook line items' },
  { name: 'Pricebook2',     label: 'Pricebook2 — price books' },
];

const NS_SUITEQL_SUGGESTIONS = [
  { name: 'item', label: 'item — all item types (SuiteQL master table)' },
];

const NS_PRODUCT_API_TYPES = new Set([
  'inventoryItem', 'nonInventoryItem', 'nonInventorySaleItem',
  'nonInventoryPurchaseItem', 'nonInventoryResaleItem',
  'assemblyItem', 'kitItem', 'serviceItem', 'otherChargeSaleItem',
  'downloadItem', 'giftCertificateItem', 'lotNumberedInventoryItem',
  'serializedInventoryItem',
]);

// ── Query preview table ────────────────────────────────────────────────────────

function QueryPreview({ result }: { result: QueryResponse }) {
  const preview = result.rows.slice(0, 5);
  const hasRows = preview.length > 0;
  return (
    <div className="rounded-md border border-slate-200 overflow-hidden text-xs">
      <div className="overflow-x-auto max-h-44">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {result.columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-mono font-semibold text-slate-600 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasRows ? preview.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {result.columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap max-w-[180px] truncate">
                    {row[col] == null ? <span className="text-slate-300 italic">null</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={result.columns.length || 1} className="px-3 py-4 text-center text-slate-400 italic">
                  Query is valid — 0 records match the current filter. Column names parsed from SELECT clause.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-slate-500">
        Showing {preview.length} of {result.total.toLocaleString()} records · {result.columns.length} columns
      </div>
    </div>
  );
}

// ── Mode toggle ────────────────────────────────────────────────────────────────

function ModeToggle<T extends string>({
  value, options, onChange, color = 'indigo',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  color?: 'indigo' | 'violet';
}) {
  const activeClass = color === 'indigo'
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-violet-50 text-violet-700 border-violet-200';

  return (
    <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-xs">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 font-medium transition-colors',
            i > 0 && 'border-l border-slate-200',
            value === opt.value ? activeClass : 'text-slate-500 hover:bg-slate-50 bg-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Mapping list row ───────────────────────────────────────────────────────────

function MappingRow({
  m, isExpanded, onToggle, onSyncData, onEdit, onDelete,
}: {
  m: ProductSyncerMappingSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onSyncData: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sfSource = m.sfDataMode === 'soql'
    ? <Badge className="text-xs bg-indigo-100 text-indigo-700 border-0">SOQL</Badge>
    : <span className="text-indigo-600">{m.sfObject}</span>;

  const nsSource = m.nsDataMode === 'suiteql'
    ? <Badge className="text-xs bg-violet-100 text-violet-700 border-0">SuiteQL</Badge>
    : <span className="text-violet-600">{m.nsObject}</span>;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <TableCell className="text-slate-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </TableCell>
        <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
        <TableCell className="text-slate-700 text-sm">{m.sfConnectionName}</TableCell>
        <TableCell className="text-slate-700 text-sm">{m.nsConnectionName}</TableCell>
        <TableCell className="text-slate-500 text-sm font-mono">
          {sfSource}{' → '}{nsSource}
        </TableCell>
        <TableCell className="text-center">
          <Badge variant="secondary">{m.fieldMappings.length}</Badge>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={onSyncData}
            >
              <Play className="w-3 h-3" /> Sync Data
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={onEdit} title="Edit mapping"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete} title="Delete mapping"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-slate-50 p-0">
            <div className="px-6 py-4 space-y-4">
              {m.sfDataMode === 'soql' && m.sfQuery && (
                <div>
                  <p className="text-xs font-semibold text-indigo-700 mb-1">SOQL Query</p>
                  <pre className="text-xs font-mono bg-indigo-50 border border-indigo-100 rounded p-2 text-indigo-900 whitespace-pre-wrap">{m.sfQuery}</pre>
                </div>
              )}
              {m.nsDataMode === 'suiteql' && m.nsQuery && (
                <div>
                  <p className="text-xs font-semibold text-violet-700 mb-1">SuiteQL Query</p>
                  <pre className="text-xs font-mono bg-violet-50 border border-violet-100 rounded p-2 text-violet-900 whitespace-pre-wrap">{m.nsQuery}</pre>
                </div>
              )}
              {m.fieldMappings.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No column pairs defined.</p>
              ) : (
                <table className="w-full max-w-2xl text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th className="pb-2 font-semibold">Salesforce Field(s)</th>
                      <th className="pb-2 w-14" />
                      <th className="pb-2 font-semibold">NetSuite Field(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.fieldMappings.map((fm, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 font-mono text-indigo-700">{fm.sourceFields.join(' + ')}</td>
                        <td className="py-1.5 text-center">
                          {fm.condition && fm.condition !== 'AND' && (
                            <Badge className="text-xs bg-slate-100 text-slate-600 border-0">{fm.condition}</Badge>
                          )}
                        </td>
                        <td className="py-1.5 font-mono text-violet-700">{fm.targetFields.join(' + ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Query input with validate ──────────────────────────────────────────────────

function QueryInput({
  connectionId,
  value,
  onChange,
  onValidated,
  placeholder,
  color,
  label,
}: {
  connectionId: string;
  value: string;
  onChange: (q: string) => void;
  onValidated: (result: QueryResponse | null) => void;
  placeholder: string;
  color: 'indigo' | 'violet';
  label: string;
}) {
  const mutation = useQueryMutation(connectionId);

  const handleChange = (q: string) => {
    onChange(q);
    mutation.reset();
    onValidated(null);
  };

  const handleValidate = () => {
    mutation.mutate(
      { query: value, page: 1, pageSize: 5 },
      { onSuccess: (result: QueryResponse) => onValidated(result) },
    );
  };

  const btnClass = color === 'indigo'
    ? 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
    : 'text-violet-600 border-violet-200 hover:bg-violet-50';

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!value.trim() || mutation.isPending}
          onClick={handleValidate}
          className={cn('gap-1.5 h-7 text-xs', btnClass)}
        >
          {mutation.isPending
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Play className="w-3 h-3" />}
          {mutation.isPending ? 'Validating…' : 'Validate Query'}
        </Button>

        {mutation.data && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {mutation.data.columns.length} columns · {mutation.data.total.toLocaleString()} records
          </span>
        )}
      </div>

      {mutation.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
          <span>{(mutation.error as Error).message}</span>
        </div>
      )}

      {mutation.data && mutation.data.columns.length > 0 && (
        <QueryPreview result={mutation.data} />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProductSyncerPage() {
  const router = useRouter();
  const [pageMode, setPageMode] = useState<PageMode>('default');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);

  // Form state
  const [sfConnectionId, setSfConnectionId] = useState('');
  const [sfDataMode, setSfDataMode] = useState<SfDataMode>('object');
  const [sfObject, setSfObject] = useState('');
  const [sfQuery, setSfQuery] = useState('');
  const [sfValidatedResult, setSfValidatedResult] = useState<QueryResponse | null>(null);
  const [nsConnectionId, setNsConnectionId] = useState('');
  const [nsDataMode, setNsDataMode] = useState<NsDataMode>('object');
  const [nsObject, setNsObject] = useState('');
  const [nsQuery, setNsQuery] = useState('');
  const [nsValidatedResult, setNsValidatedResult] = useState<QueryResponse | null>(null);
  const [mappingName, setMappingName] = useState('');
  const [columnPairs, setColumnPairs] = useState<ColumnPair[]>([]);

  const { data: connections = [], isLoading: loadingConnections } = useConnections();
  const { data: mappings = [], isLoading: loadingMappings } = useProductSyncerMappings();
  const { data: editingMapping } = useProductSyncerMapping(editingId);

  const createMutation = useCreateProductSyncerMapping();
  const updateMutation = useUpdateProductSyncerMapping();
  const deleteMutation = useDeleteProductSyncerMapping();

  const sfConnections = connections.filter((c) => c.type === 'salesforce');
  const nsConnections = connections.filter((c) => c.type === 'netsuite');
  const sfConn = connections.find((c) => c.id === sfConnectionId);
  const nsConn = connections.find((c) => c.id === nsConnectionId);

  // SF object options
  const { data: sfObjectsData, isLoading: loadingSfObjects } = useObjects(sfConnectionId);
  const sfObjectOptions = useMemo(() => {
    const sfPinnedNames = new Set(SF_PINNED_OBJECTS.map((s) => s.name));
    const apiObjects = sfObjectsData?.objects ?? [];
    const pinnedOptions = SF_PINNED_OBJECTS.map((s) => ({
      value: s.name, label: s.label,
      suffix: <Badge className="text-xs bg-indigo-100 text-indigo-700 border-0">Pinned</Badge>,
    }));
    const catalogOptions = apiObjects
      .filter((o) => !sfPinnedNames.has(o.name))
      .map((o) => ({
        value: o.name, label: o.label || o.name,
        suffix: <Badge variant="outline" className="text-xs capitalize">{o.type}</Badge>,
      }));
    return [...pinnedOptions, ...catalogOptions];
  }, [sfObjectsData]);

  // NS object options
  const { data: nsObjectsData, isLoading: loadingNsObjects } = useObjects(nsConnectionId);
  const nsObjectOptions = useMemo(() => {
    const apiObjects = nsObjectsData?.objects ?? [];
    const apiNames = new Set(apiObjects.map((o) => o.name));
    const pinnedOptions = NS_SUITEQL_SUGGESTIONS
      .filter((s) => !apiNames.has(s.name))
      .map((s) => ({
        value: s.name, label: s.label,
        suffix: <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">SuiteQL</Badge>,
      }));
    const catalogOptions = [...apiObjects]
      .sort((a, b) => {
        const aRel = NS_PRODUCT_API_TYPES.has(a.name);
        const bRel = NS_PRODUCT_API_TYPES.has(b.name);
        if (aRel && !bRel) return -1;
        if (!aRel && bRel) return 1;
        return 0;
      })
      .map((o) => ({
        value: o.name, label: o.label || o.name,
        suffix: NS_PRODUCT_API_TYPES.has(o.name)
          ? <Badge className="text-xs bg-blue-100 text-blue-700 border-0">Product</Badge>
          : <Badge variant="outline" className="text-xs capitalize">{o.type}</Badge>,
      }));
    return [...pinnedOptions, ...catalogOptions];
  }, [nsObjectsData]);

  // Schemas — only fetched in object mode
  const sfSchemaObject = sfDataMode === 'object' && sfConnectionId && sfObject ? sfObject : '';
  const nsSchemaObject = nsDataMode === 'object' && nsConnectionId && nsObject ? nsObject : '';
  const { data: sfSchemaData, isLoading: loadingSfSchema, isError: sfSchemaError } = useSchema(sfConnectionId, sfSchemaObject);
  const { data: nsSchemaData, isLoading: loadingNsSchema, isError: nsSchemaError } = useSchema(nsConnectionId, nsSchemaObject);

  // Convert validated query columns → FieldMeta for the column picker
  const sfQueryFields: FieldMeta[] = (sfValidatedResult?.columns ?? []).map((col) => ({
    name: col, label: col, type: 'unknown', nullable: true, isPrimary: false,
  }));
  const nsQueryFields: FieldMeta[] = (nsValidatedResult?.columns ?? []).map((col) => ({
    name: col, label: col, type: 'unknown', nullable: true, isPrimary: false,
  }));

  // Fields passed to picker: schema fields in object mode, validated query columns in query mode
  const sfPickerFields = sfDataMode === 'object' ? (sfSchemaData?.fields ?? []) : sfQueryFields;
  const nsPickerFields = nsDataMode === 'object' ? (nsSchemaData?.fields ?? []) : nsQueryFields;

  // Free-text inputs only when in query mode and not yet validated
  const sfFreeText = sfDataMode === 'soql' && sfQueryFields.length === 0;
  const nsFreeText = nsDataMode === 'suiteql' && nsQueryFields.length === 0;

  // Readiness: when to show the column pair picker.
  // In query mode: show as soon as connection + query text exist (free-text inputs).
  // Validation is optional — it upgrades the inputs to searchable dropdowns, not a gate.
  const sfPickerReady = sfDataMode === 'object'
    ? (!!sfObject && !loadingSfSchema && !sfSchemaError && !!sfSchemaData)
    : (!!sfConnectionId && !!sfQuery.trim());
  const nsPickerReady = nsDataMode === 'object'
    ? (!!nsObject && !loadingNsSchema && !nsSchemaError && !!nsSchemaData)
    : (!!nsConnectionId && !!nsQuery.trim());
  const columnPickerReady = !!sfConnectionId && !!nsConnectionId && sfPickerReady && nsPickerReady;

  // For save button validation
  const sfReady = !!sfConnectionId && (sfDataMode === 'soql' ? !!sfQuery.trim() : !!sfObject);
  const nsReady = !!nsConnectionId && (nsDataMode === 'suiteql' ? !!nsQuery.trim() : !!nsObject);
  const bothSelected = sfReady && nsReady;

  const sfSchemaNeeded = sfDataMode === 'object' && !!sfSchemaObject;
  const nsSchemaNeeded = nsDataMode === 'object' && !!nsSchemaObject;
  const schemasLoading = bothSelected && (
    (sfSchemaNeeded && loadingSfSchema) || (nsSchemaNeeded && loadingNsSchema)
  );
  const hasSchemaError = (sfSchemaNeeded && sfSchemaError) || (nsSchemaNeeded && nsSchemaError);

  const validPairs = columnPairs.filter((p) => p.sfFields.length > 0 && p.nsFields.length > 0);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Column picker labels
  const sfPickerLabel = sfDataMode === 'soql' ? 'Salesforce column (from SOQL)' : `Salesforce · ${sfObject || 'field'}`;
  const nsPickerLabel = nsDataMode === 'suiteql' ? 'NetSuite column (from SuiteQL)' : `NetSuite · ${nsObject || 'field'}`;

  // Populate form when editing
  useEffect(() => {
    if (editingMapping && pageMode === 'edit') {
      setSfConnectionId(editingMapping.sfConnectionId);
      setSfDataMode(editingMapping.sfDataMode);
      setSfObject(editingMapping.sfObject);
      setSfQuery(editingMapping.sfQuery ?? '');
      setSfValidatedResult(null);
      setNsConnectionId(editingMapping.nsConnectionId);
      setNsDataMode(editingMapping.nsDataMode);
      setNsObject(editingMapping.nsObject);
      setNsQuery(editingMapping.nsQuery ?? '');
      setNsValidatedResult(null);
      setMappingName(editingMapping.name);
      setColumnPairs(
        editingMapping.fieldMappings.map((fm) => ({
          sfFields: fm.sourceFields,
          nsFields: fm.targetFields,
          condition: fm.condition ?? 'AND',
        }))
      );
    }
  }, [editingMapping, pageMode]);

  const resetForm = useCallback(() => {
    setSfConnectionId('');
    setSfDataMode('object');
    setSfObject('');
    setSfQuery('');
    setSfValidatedResult(null);
    setNsConnectionId('');
    setNsDataMode('object');
    setNsObject('');
    setNsQuery('');
    setNsValidatedResult(null);
    setMappingName('');
    setColumnPairs([]);
  }, []);

  const handleNewMapping = useCallback(() => {
    setEditingId(undefined);
    resetForm();
    setPageMode('create');
  }, [resetForm]);

  const handleEditMapping = useCallback((m: ProductSyncerMappingSummary) => {
    setEditingId(m.id);
    setPageMode('edit');
  }, []);

  const handleCancelMapping = useCallback(() => {
    setPageMode('default');
    setEditingId(undefined);
  }, []);

  const handleSaveMapping = useCallback(() => {
    const data: CreateProductSyncerMappingData = {
      name: mappingName,
      sfConnectionId,
      sfConnectionName: sfConn?.name ?? sfConnectionId,
      sfDataMode,
      sfObject: sfDataMode === 'object' ? sfObject : '',
      sfQuery: sfDataMode === 'soql' ? sfQuery : undefined,
      nsConnectionId,
      nsConnectionName: nsConn?.name ?? nsConnectionId,
      nsDataMode,
      nsObject: nsDataMode === 'object' ? nsObject : '',
      nsQuery: nsDataMode === 'suiteql' ? nsQuery : undefined,
      // Only send complete pairs — incomplete ones fail Zod min(1) validation on the server
      fieldMappings: columnPairs
        .filter((p) => p.sfFields.length > 0 && p.nsFields.length > 0)
        .map((p) => ({ sourceFields: p.sfFields, targetFields: p.nsFields, condition: p.condition })),
    };
    if (pageMode === 'edit' && editingId) {
      updateMutation.mutate({ id: editingId, data }, { onSuccess: () => setPageMode('default') });
    } else {
      createMutation.mutate(data, { onSuccess: () => setPageMode('default') });
    }
  }, [
    pageMode, editingId, mappingName,
    sfConnectionId, sfDataMode, sfObject, sfQuery,
    nsConnectionId, nsDataMode, nsObject, nsQuery,
    columnPairs, sfConn, nsConn, createMutation, updateMutation,
  ]);

  const sfConnectionOptions = sfConnections.map((c) => ({
    value: c.id, label: c.name,
    suffix: <Badge variant="outline" className="text-xs">Salesforce</Badge>,
  }));
  const nsConnectionOptions = nsConnections.map((c) => ({
    value: c.id, label: c.name,
    suffix: <Badge variant="outline" className="text-xs">NetSuite</Badge>,
  }));

  // ── Create / Edit mode ────────────────────────────────────────────────────

  if (pageMode === 'create' || pageMode === 'edit') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Syncer</h1>
            <p className="text-slate-500 text-sm mt-1">
              {pageMode === 'edit' ? 'Edit column mapping' : 'New column mapping — select connections and define field pairs to compare'}
            </p>
          </div>
          <Button variant="ghost" onClick={handleCancelMapping} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>

        {/* Connections + data source */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Connections & Data Source</h2>
          <div className="grid grid-cols-2 gap-6">

            {/* ── Salesforce ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-sm font-semibold text-slate-700">Salesforce</span>
                </div>
                {sfConnectionId && (
                  <ModeToggle<SfDataMode>
                    value={sfDataMode}
                    options={[
                      { value: 'object', label: 'Select Object' },
                      { value: 'soql', label: 'SOQL Query' },
                    ]}
                    onChange={(v) => {
                      setSfDataMode(v);
                      setSfObject('');
                      setSfQuery('');
                      setSfValidatedResult(null);
                      setColumnPairs([]);
                    }}
                    color="indigo"
                  />
                )}
              </div>

              <SearchableSelect
                value={sfConnectionId}
                onValueChange={(v) => {
                  setSfConnectionId(v);
                  setSfObject('');
                  setSfQuery('');
                  setSfValidatedResult(null);
                  setColumnPairs([]);
                }}
                options={sfConnectionOptions}
                placeholder={loadingConnections ? 'Loading…' : 'Select Salesforce connection…'}
                searchPlaceholder="Search connections…"
                disabled={loadingConnections}
              />

              {sfConnectionId && sfDataMode === 'object' && (
                <>
                  <SearchableSelect
                    value={sfObject}
                    onValueChange={(v) => { setSfObject(v); setColumnPairs([]); }}
                    options={sfObjectOptions}
                    placeholder={loadingSfObjects ? 'Loading objects…' : 'Select Salesforce object…'}
                    searchPlaceholder="Search objects…"
                    disabled={loadingSfObjects}
                  />
                  {sfObject && !loadingSfSchema && sfSchemaData && (
                    <p className="text-xs text-slate-500">{sfSchemaData.fields.length} fields available</p>
                  )}
                </>
              )}

              {sfConnectionId && sfDataMode === 'soql' && (
                <QueryInput
                  connectionId={sfConnectionId}
                  value={sfQuery}
                  onChange={(q) => { setSfQuery(q); setColumnPairs([]); }}
                  onValidated={setSfValidatedResult}
                  placeholder={'SELECT Id, Name, ProductCode\nFROM Product2\nWHERE IsActive = true'}
                  color="indigo"
                  label="SOQL"
                />
              )}
            </div>

            {/* ── NetSuite ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  <span className="text-sm font-semibold text-slate-700">NetSuite</span>
                </div>
                {nsConnectionId && (
                  <ModeToggle<NsDataMode>
                    value={nsDataMode}
                    options={[
                      { value: 'object', label: 'Select Object' },
                      { value: 'suiteql', label: 'SuiteQL Query' },
                    ]}
                    onChange={(v) => {
                      setNsDataMode(v);
                      setNsObject('');
                      setNsQuery('');
                      setNsValidatedResult(null);
                      setColumnPairs([]);
                    }}
                    color="violet"
                  />
                )}
              </div>

              <SearchableSelect
                value={nsConnectionId}
                onValueChange={(v) => {
                  setNsConnectionId(v);
                  setNsObject('');
                  setNsQuery('');
                  setNsValidatedResult(null);
                  setColumnPairs([]);
                }}
                options={nsConnectionOptions}
                placeholder={loadingConnections ? 'Loading…' : 'Select NetSuite connection…'}
                searchPlaceholder="Search connections…"
                disabled={loadingConnections}
              />

              {nsConnectionId && nsDataMode === 'object' && (
                <>
                  <SearchableSelect
                    value={nsObject}
                    onValueChange={(v) => { setNsObject(v); setColumnPairs([]); }}
                    options={nsObjectOptions}
                    placeholder={loadingNsObjects ? 'Loading objects…' : 'Select NetSuite object…'}
                    searchPlaceholder="Search objects…"
                    disabled={loadingNsObjects}
                  />
                  {nsObject && !loadingNsSchema && nsSchemaData && (
                    <p className="text-xs text-slate-500">{nsSchemaData.fields.length} fields available</p>
                  )}
                </>
              )}

              {nsConnectionId && nsDataMode === 'suiteql' && (
                <QueryInput
                  connectionId={nsConnectionId}
                  value={nsQuery}
                  onChange={(q) => { setNsQuery(q); setColumnPairs([]); }}
                  onValidated={setNsValidatedResult}
                  placeholder={"SELECT item.id, item.itemid, item.displayname\nFROM item\nWHERE item.isinactive = 'F'"}
                  color="violet"
                  label="SuiteQL"
                />
              )}
            </div>
          </div>
        </div>

        {/* Column pair picker */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Column pairs</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {sfFreeText || nsFreeText
                ? 'Type column names as they appear in query results. Validate the query above to switch to a searchable dropdown.'
                : 'Each pair defines which SF field is compared against which NS field when syncing.'}
            </p>
          </div>

          {!bothSelected && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed rounded-lg bg-slate-50">
              <PackagePlus className="w-8 h-8 mb-2 opacity-25" />
              <p className="text-sm">Configure both connections and data sources above</p>
            </div>
          )}

          {bothSelected && !columnPickerReady && !schemasLoading && !hasSchemaError && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed rounded-lg bg-slate-50">
              <PackagePlus className="w-8 h-8 mb-2 opacity-25" />
              <p className="text-sm">Select an object to load the schema</p>
            </div>
          )}

          {schemasLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          )}

          {hasSchemaError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <span>Failed to load schema. Verify the connection is active.</span>
            </div>
          )}

          {columnPickerReady && (
            <ColumnPairPicker
              sfFields={sfPickerFields}
              nsFields={nsPickerFields}
              sfFreeText={sfFreeText}
              nsFreeText={nsFreeText}
              sfLabel={sfPickerLabel}
              nsLabel={nsPickerLabel}
              pairs={columnPairs}
              onChange={setColumnPairs}
            />
          )}
        </div>

        {/* Name + Save */}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
          <label htmlFor="mapping-name" className="text-sm font-medium text-slate-700 flex-shrink-0">
            Mapping name
          </label>
          <Input
            id="mapping-name"
            value={mappingName}
            onChange={(e) => setMappingName(e.target.value)}
            placeholder="e.g. Production SF → NS Product Sync"
            className="max-w-sm"
          />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={handleCancelMapping}>Cancel</Button>
            <Button
              onClick={handleSaveMapping}
              disabled={!mappingName.trim() || !bothSelected || validPairs.length === 0 || isSaving}
            >
              {isSaving ? 'Saving…' : pageMode === 'edit' ? 'Update Mapping' : 'Save Mapping'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Default mode ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Syncer</h1>
          <p className="text-slate-500 text-sm mt-1">
            Compare Salesforce Product2 and NetSuite items field-by-field using saved column mappings
          </p>
        </div>
        <Button onClick={handleNewMapping} size="sm" variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> New Mapping
        </Button>
      </div>

      {loadingMappings ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </div>
      ) : mappings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed rounded-lg bg-slate-50">
          <PackagePlus className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No mappings yet</p>
          <p className="text-xs mt-0.5">Create a mapping to start comparing SF and NS product data</p>
          <Button onClick={handleNewMapping} size="sm" variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> New Mapping
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>Salesforce</TableHead>
                <TableHead>NetSuite</TableHead>
                <TableHead>Data Source</TableHead>
                <TableHead className="text-center">Pairs</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.flatMap((m) => [
                <MappingRow
                  key={m.id}
                  m={m}
                  isExpanded={expandedId === m.id}
                  onToggle={() => setExpandedId(expandedId === m.id ? undefined : m.id)}
                  onSyncData={() => router.push(`/product-syncer/${m.id}/data`)}
                  onEdit={() => handleEditMapping(m)}
                  onDelete={() => setDeletingId(m.id)}
                />,
              ])}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete mapping?</DialogTitle>
            <DialogDescription>
              This will permanently delete the column mapping. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(undefined)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId) { deleteMutation.mutate(deletingId); setDeletingId(undefined); }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
