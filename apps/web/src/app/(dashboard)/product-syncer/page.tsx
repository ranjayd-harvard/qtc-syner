'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, ArrowLeft, Pencil, Trash2, PackagePlus, ChevronDown, ChevronRight,
  AlertTriangle, Sparkles, X,
} from 'lucide-react';
import { useConnections } from '@/hooks/useConnections';
import { useSchema, useObjects, useRecordCount } from '@/hooks/useExplorer';
import {
  useProductSyncerMappings, useProductSyncerMapping,
  useCreateProductSyncerMapping, useUpdateProductSyncerMapping, useDeleteProductSyncerMapping,
} from '@/hooks/useProductSyncerMappings';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SchemaMapperCanvas, type FieldMapping } from '@/components/mapper/SchemaMapperCanvas';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SyncStats } from '@/components/product-syncer/SyncStats';
import { MatchResults } from '@/components/product-syncer/MatchResults';
import { AnalysisChat } from '@/components/product-syncer/AnalysisChat';
import type { AnalysisResult } from '@/app/api/product-syncer/analyze/route';
import type { ProductSyncerMappingSummary, CreateProductSyncerMappingData } from '@/models/ProductSyncerMapping';

const SF_OBJECT = 'Product2';
const NS_OBJECT = 'item';

type PageMode = 'default' | 'create' | 'edit';

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function MappingRow({
  m, isExpanded, onToggle, onViewData, onEdit, onDelete,
}: {
  m: ProductSyncerMappingSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onViewData: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <TableCell className="text-slate-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </TableCell>
        <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
        <TableCell className="text-slate-700 text-sm">{m.sfConnectionName}</TableCell>
        <TableCell className="text-slate-700 text-sm">{m.nsConnectionName}</TableCell>
        <TableCell className="text-center">
          <Badge variant="secondary">{m.fieldMappings.length}</Badge>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
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
          <TableCell colSpan={6} className="bg-slate-50 p-0">
            <div className="px-6 py-4">
              {m.fieldMappings.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No field mappings defined.</p>
              ) : (
                <table className="w-full max-w-2xl text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th className="pb-2 font-semibold">Salesforce Field (Product2)</th>
                      <th className="pb-2 font-semibold">NetSuite Field (item)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.fieldMappings.map((fm, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 font-mono text-indigo-700">{fm.sourceField}</td>
                        <td className="py-1.5 font-mono text-violet-700">{fm.targetField}</td>
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

export default function ProductSyncerPage() {
  // ── Page mode ─────────────────────────────────────────────────────
  const [pageMode, setPageMode] = useState<PageMode>('default');

  // ── Analysis state ────────────────────────────────────────────────
  const [sfAnalysisConnId, setSfAnalysisConnId] = useState('');
  const [nsAnalysisConnId, setNsAnalysisConnId] = useState('');
  const [nsAnalysisObject, setNsAnalysisObject] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // ── Field mapping CRUD state ───────────────────────────────────────
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [sfConnectionId, setSfConnectionId] = useState('');
  const [nsConnectionId, setNsConnectionId] = useState('');
  const [mappingName, setMappingName] = useState('');
  const [currentMappings, setCurrentMappings] = useState<FieldMapping[]>([]);

  const { data: connections = [], isLoading: loadingConnections } = useConnections();

  // SuiteQL tables that are product-relevant but don't appear in the Record API catalog.
  // These are injected as pinned suggestions because listObjects() uses /record/v1/metadata-catalog/
  // which only returns Record API types (inventoryItem, nonInventoryItem…), never SuiteQL table names.
  const NS_SUITEQL_SUGGESTIONS = [
    { name: 'item', label: 'item — all item types (SuiteQL master table)' },
  ];

  // Record API types that map to Salesforce Product2
  const NS_PRODUCT_API_TYPES = useMemo(() => new Set([
    'inventoryItem', 'nonInventoryItem', 'nonInventorySaleItem',
    'nonInventoryPurchaseItem', 'nonInventoryResaleItem',
    'assemblyItem', 'kitItem', 'serviceItem', 'otherChargeSaleItem',
    'downloadItem', 'giftCertificateItem', 'lotNumberedInventoryItem',
    'serializedInventoryItem',
  ]), []);

  const { data: nsObjectsData, isLoading: loadingNsObjects } = useObjects(nsAnalysisConnId);
  const nsObjectOptions = useMemo(() => {
    const apiObjects = nsObjectsData?.objects ?? [];
    const apiNames = new Set(apiObjects.map((o) => o.name));

    // Pinned SuiteQL tables (not in Record API catalog) — show first with a special badge
    const pinnedOptions = NS_SUITEQL_SUGGESTIONS
      .filter((s) => !apiNames.has(s.name))
      .map((s) => ({
        value: s.name,
        label: s.label,
        suffix: <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">SuiteQL</Badge>,
      }));

    // Record API catalog objects — product-relevant ones sorted first
    const catalogOptions = [...apiObjects]
      .sort((a, b) => {
        const aRel = NS_PRODUCT_API_TYPES.has(a.name);
        const bRel = NS_PRODUCT_API_TYPES.has(b.name);
        if (aRel && !bRel) return -1;
        if (!aRel && bRel) return 1;
        return 0;
      })
      .map((o) => ({
        value: o.name,
        label: o.label || o.name,
        suffix: NS_PRODUCT_API_TYPES.has(o.name)
          ? <Badge className="text-xs bg-blue-100 text-blue-700 border-0">Product</Badge>
          : <Badge variant="outline" className="text-xs capitalize">{o.type}</Badge>,
      }));

    return [...pinnedOptions, ...catalogOptions];
  }, [nsObjectsData, NS_PRODUCT_API_TYPES]);

  // Accurate record counts via dedicated COUNT endpoint (avoids NS SuiteQL totalResults bug)
  const { data: sfCount, isLoading: isLoadingSfCount } = useRecordCount(sfAnalysisConnId, SF_OBJECT);
  const { data: nsCount, isLoading: isLoadingNsCount } = useRecordCount(nsAnalysisConnId, nsAnalysisObject);

  // Schema hooks for the canvas (create/edit mode)
  const { data: sfSchemaData, isLoading: loadingSfSchema, isError: sfSchemaError } = useSchema(
    sfConnectionId, sfConnectionId ? SF_OBJECT : ''
  );
  const { data: nsSchemaData, isLoading: loadingNsSchema, isError: nsSchemaError } = useSchema(
    nsConnectionId, nsConnectionId ? NS_OBJECT : ''
  );

  const { data: mappings = [], isLoading: loadingMappings } = useProductSyncerMappings();
  const { data: editingMapping } = useProductSyncerMapping(editingId);

  const createMutation = useCreateProductSyncerMapping();
  const updateMutation = useUpdateProductSyncerMapping();
  const deleteMutation = useDeleteProductSyncerMapping();

  const sfConnections = connections.filter((c) => c.type === 'salesforce');
  const nsConnections = connections.filter((c) => c.type === 'netsuite');
  const sfConn = connections.find((c) => c.id === sfConnectionId);
  const nsConn = connections.find((c) => c.id === nsConnectionId);

  useEffect(() => {
    if (editingMapping && pageMode === 'edit') {
      setSfConnectionId(editingMapping.sfConnectionId);
      setNsConnectionId(editingMapping.nsConnectionId);
      setMappingName(editingMapping.name);
      setCurrentMappings(editingMapping.fieldMappings);
    }
  }, [editingMapping, pageMode]);

  const handleNewMapping = useCallback(() => {
    setEditingId(undefined);
    setSfConnectionId('');
    setNsConnectionId('');
    setMappingName('');
    setCurrentMappings([]);
    setPageMode('create');
  }, []);

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
      nsConnectionId,
      nsConnectionName: nsConn?.name ?? nsConnectionId,
      fieldMappings: currentMappings,
    };
    if (pageMode === 'edit' && editingId) {
      updateMutation.mutate({ id: editingId, data }, { onSuccess: () => setPageMode('default') });
    } else {
      createMutation.mutate(data, { onSuccess: () => setPageMode('default') });
    }
  }, [pageMode, editingId, mappingName, sfConnectionId, nsConnectionId, currentMappings, sfConn, nsConn, createMutation, updateMutation]);

  const handleAnalysisResult = useCallback((result: AnalysisResult) => {
    setAnalysisResult(result);
  }, []);

  const sfAnalysisOptions = sfConnections.map((c) => ({
    value: c.id, label: c.name,
    suffix: <Badge variant="outline" className="text-xs">Salesforce</Badge>,
  }));
  const nsAnalysisOptions = nsConnections.map((c) => ({
    value: c.id, label: c.name,
    suffix: <Badge variant="outline" className="text-xs">NetSuite</Badge>,
  }));
  const sfConnectionOptions = sfConnections.map((c) => ({
    value: c.id, label: c.name,
    suffix: <Badge variant="outline" className="text-xs">Salesforce</Badge>,
  }));
  const nsConnectionOptions = nsConnections.map((c) => ({
    value: c.id, label: c.name,
    suffix: <Badge variant="outline" className="text-xs">NetSuite</Badge>,
  }));

  const bothAnalysisSelected = !!sfAnalysisConnId && !!nsAnalysisConnId && !!nsAnalysisObject;
  const bothMappingSelected = !!sfConnectionId && !!nsConnectionId;
  const loadingCanvas = bothMappingSelected && (loadingSfSchema || loadingNsSchema);
  const showCanvas = bothMappingSelected && !loadingSfSchema && !loadingNsSchema && !sfSchemaError && !nsSchemaError;
  const canvasKey = `${sfConnectionId}-${nsConnectionId}`;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Create/Edit mode ──────────────────────────────────────────────
  if (pageMode === 'create' || pageMode === 'edit') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Syncer</h1>
            <p className="text-slate-500 text-sm mt-1">
              {pageMode === 'edit' ? 'Edit field mapping' : 'New field mapping — drag fields to connect them'}
            </p>
          </div>
          <Button variant="ghost" onClick={handleCancelMapping} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-sm font-semibold text-slate-700">
                Salesforce <span className="font-mono text-xs text-slate-400 ml-1">· Product2</span>
              </span>
            </div>
            <SearchableSelect
              value={sfConnectionId}
              onValueChange={(v) => { setSfConnectionId(v); setCurrentMappings([]); }}
              options={sfConnectionOptions}
              placeholder={loadingConnections ? 'Loading…' : 'Select Salesforce connection…'}
              searchPlaceholder="Search connections…"
              disabled={loadingConnections}
            />
            {sfConnectionId && !loadingSfSchema && sfSchemaData && (
              <p className="text-xs text-slate-500">{sfSchemaData.fields.length} fields loaded</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-sm font-semibold text-slate-700">
                NetSuite <span className="font-mono text-xs text-slate-400 ml-1">· item</span>
              </span>
            </div>
            <SearchableSelect
              value={nsConnectionId}
              onValueChange={(v) => { setNsConnectionId(v); setCurrentMappings([]); }}
              options={nsConnectionOptions}
              placeholder={loadingConnections ? 'Loading…' : 'Select NetSuite connection…'}
              searchPlaceholder="Search connections…"
              disabled={loadingConnections}
            />
            {nsConnectionId && !loadingNsSchema && nsSchemaData && (
              <p className="text-xs text-slate-500">{nsSchemaData.fields.length} fields loaded</p>
            )}
          </div>
        </div>

        {loadingCanvas && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        )}

        {(sfSchemaError || nsSchemaError) && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <span>Failed to load schema. Verify the connection is active.</span>
          </div>
        )}

        {showCanvas && (
          <SchemaMapperCanvas
            key={canvasKey}
            sourceFields={sfSchemaData?.fields ?? []}
            targetFields={nsSchemaData?.fields ?? []}
            sourceLabel={`${sfConn?.name ?? 'Salesforce'} · Product2`}
            targetLabel={`${nsConn?.name ?? 'NetSuite'} · item`}
            initialMappings={currentMappings}
            onChange={setCurrentMappings}
          />
        )}

        {!bothMappingSelected && !loadingCanvas && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed rounded-lg bg-slate-50">
            <PackagePlus className="w-10 h-10 mb-3 opacity-25" />
            <p className="text-sm">Select a Salesforce and NetSuite connection to load the mapping canvas</p>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
          <label htmlFor="mapping-name" className="text-sm font-medium text-slate-700 flex-shrink-0">
            Mapping name
          </label>
          <Input
            id="mapping-name"
            value={mappingName}
            onChange={(e) => setMappingName(e.target.value)}
            placeholder="e.g. Production Product Sync"
            className="max-w-sm"
          />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={handleCancelMapping}>Cancel</Button>
            <Button onClick={handleSaveMapping} disabled={!mappingName.trim() || !bothMappingSelected || isSaving}>
              {isSaving ? 'Saving…' : pageMode === 'edit' ? 'Update Mapping' : 'Save Mapping'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Default mode ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Syncer</h1>
          <p className="text-slate-500 text-sm mt-1">
            Analyze product data sync between Salesforce Product2 and NetSuite items
          </p>
        </div>
      </div>

      {/* ── Analysis section ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Sync Analysis</h2>
          {bothAnalysisSelected && !chatOpen && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => { setChatOpen(true); setAnalysisResult(null); }}
            >
              <Sparkles className="w-4 h-4" /> Analyze with AI
            </Button>
          )}
          {chatOpen && (
            <Button
              variant="ghost" size="sm" className="gap-1 text-slate-500"
              onClick={() => setChatOpen(false)}
            >
              <X className="w-4 h-4" /> Close chat
            </Button>
          )}
        </div>

        {/* Connection + object pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Salesforce connection · Product2</p>
            <SearchableSelect
              value={sfAnalysisConnId}
              onValueChange={(v) => { setSfAnalysisConnId(v); setAnalysisResult(null); setChatOpen(false); }}
              options={sfAnalysisOptions}
              placeholder={loadingConnections ? 'Loading…' : 'Select Salesforce connection…'}
              searchPlaceholder="Search…"
              disabled={loadingConnections}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">NetSuite connection</p>
            <SearchableSelect
              value={nsAnalysisConnId}
              onValueChange={(v) => {
                setNsAnalysisConnId(v);
                setNsAnalysisObject('');
                setAnalysisResult(null);
                setChatOpen(false);
              }}
              options={nsAnalysisOptions}
              placeholder={loadingConnections ? 'Loading…' : 'Select NetSuite connection…'}
              searchPlaceholder="Search…"
              disabled={loadingConnections}
            />
            {nsAnalysisConnId && (
              <SearchableSelect
                value={nsAnalysisObject}
                onValueChange={(v) => { setNsAnalysisObject(v); setAnalysisResult(null); setChatOpen(false); }}
                options={nsObjectOptions}
                placeholder={loadingNsObjects ? 'Loading objects…' : 'Select NetSuite object…'}
                searchPlaceholder="Search objects…"
                disabled={loadingNsObjects}
              />
            )}
          </div>
        </div>

        {/* Stats — shown once connections are selected */}
        {(sfAnalysisConnId || nsAnalysisConnId) && (
          <SyncStats
            sfTotal={sfCount ?? null}
            nsTotal={nsCount ?? null}
            matchedCount={analysisResult?.matchedCount}
            unmatchedCount={analysisResult?.unmatchedCount}
            isLoadingSf={isLoadingSfCount && !!sfAnalysisConnId}
            isLoadingNs={isLoadingNsCount && !!nsAnalysisConnId}
          />
        )}

        {/* Prompt to start analysis */}
        {bothAnalysisSelected && !chatOpen && !analysisResult && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed rounded-lg bg-slate-50">
            <Sparkles className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">Ready to analyze</p>
            <p className="text-xs mt-0.5">Click &ldquo;Analyze with AI&rdquo; to start the Gemini agent</p>
          </div>
        )}

        {/* Two-column layout when chat is open */}
        {chatOpen && (
          <div className="grid grid-cols-5 gap-4" style={{ minHeight: 520 }}>
            {/* Results — left 3/5 */}
            <div className="col-span-3 flex flex-col justify-center">
              {analysisResult ? (
                <MatchResults result={analysisResult} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Analysis results will appear here</p>
                </div>
              )}
            </div>
            {/* Chat — right 2/5 */}
            <div className="col-span-2">
              <AnalysisChat
                sfConnectionId={sfAnalysisConnId}
                nsConnectionId={nsAnalysisConnId}
                nsObject={nsAnalysisObject}
                onClose={() => setChatOpen(false)}
                onAnalysisResult={handleAnalysisResult}
              />
            </div>
          </div>
        )}

        {/* Results full-width when chat is closed but analysis exists */}
        {!chatOpen && analysisResult && (
          <MatchResults result={analysisResult} />
        )}
      </div>

      {/* ── Field Mappings section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Field Mappings</h2>
          <Button onClick={handleNewMapping} size="sm" variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> New Mapping
          </Button>
        </div>

        {loadingMappings ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
          </div>
        ) : mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed rounded-lg bg-slate-50">
            <PackagePlus className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm font-medium">No field mappings yet</p>
            <p className="text-xs mt-0.5">Define which Salesforce fields map to which NetSuite fields</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Salesforce (Product2)</TableHead>
                  <TableHead>NetSuite (item)</TableHead>
                  <TableHead className="text-center">Fields</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.flatMap((m) => [
                  <MappingRow
                    key={m.id}
                    m={m}
                    isExpanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? undefined : m.id)}
                    onViewData={() => {}}
                    onEdit={() => handleEditMapping(m)}
                    onDelete={() => setDeletingId(m.id)}
                  />,
                ])}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete mapping?</DialogTitle>
            <DialogDescription>
              This will permanently delete the field mapping. This action cannot be undone.
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
