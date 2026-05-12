'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft, Pencil, Trash2, GitMerge, AlertTriangle } from 'lucide-react';
import { useConnections } from '@/hooks/useConnections';
import { useSchema } from '@/hooks/useExplorer';
import { ConnectionObjectPicker } from '@/components/explorer/ConnectionObjectPicker';
import {
  useMultiLevelMappings,
  useMultiLevelMapping,
  useCreateMultiLevelMapping,
  useUpdateMultiLevelMapping,
  useDeleteMultiLevelMapping,
} from '@/hooks/useMultiLevelMappings';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ObjectTypeBadge } from '@/components/explorer/ObjectTypeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { MultiLevelCanvas, type MultiLevelMappings } from '@/components/mapper/MultiLevelCanvas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MultiLevelMappingSummary, CreateMultiLevelMappingData } from '@/models/MultiLevelMapping';

type Mode = 'list' | 'create' | 'edit';

interface LevelState {
  connectionId: string;
  object: string;
}

const EMPTY_LEVEL: LevelState = { connectionId: '', object: '' };
const EMPTY_MAPPINGS: MultiLevelMappings = { l1ToL2: [], l2ToL3: [] };

export default function MultiMapperPage() {
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);

  const [l1, setL1] = useState<LevelState>(EMPTY_LEVEL);
  const [l2, setL2] = useState<LevelState>(EMPTY_LEVEL);
  const [l3, setL3] = useState<LevelState>(EMPTY_LEVEL);
  const [mappingName, setMappingName] = useState('');
  const [currentMappings, setCurrentMappings] = useState<MultiLevelMappings>(EMPTY_MAPPINGS);

  const { data: connections = [], isLoading: loadingConnections } = useConnections();

  const { data: l1Schema, isLoading: loadingL1Schema, isError: l1SchemaError } =
    useSchema(l1.connectionId, l1.object);
  const { data: l2Schema, isLoading: loadingL2Schema, isError: l2SchemaError } =
    useSchema(l2.connectionId, l2.object);
  const { data: l3Schema, isLoading: loadingL3Schema, isError: l3SchemaError } =
    useSchema(l3.connectionId, l3.object);

  const { data: mappings = [], isLoading: loadingMappings } = useMultiLevelMappings();
  const { data: editingMapping } = useMultiLevelMapping(editingId);

  const createMutation = useCreateMultiLevelMapping();
  const updateMutation = useUpdateMultiLevelMapping();
  const deleteMutation = useDeleteMultiLevelMapping();

  useEffect(() => {
    if (editingMapping && mode === 'edit') {
      setL1({ connectionId: editingMapping.level1.connectionId, object: editingMapping.level1.object });
      setL2({ connectionId: editingMapping.level2.connectionId, object: editingMapping.level2.object });
      setL3({ connectionId: editingMapping.level3.connectionId, object: editingMapping.level3.object });
      setMappingName(editingMapping.name);
      setCurrentMappings({
        l1ToL2: editingMapping.l1ToL2Mappings,
        l2ToL3: editingMapping.l2ToL3Mappings,
      });
    }
  }, [editingMapping, mode]);

  const handleNew = useCallback(() => {
    setEditingId(undefined);
    setL1(EMPTY_LEVEL);
    setL2(EMPTY_LEVEL);
    setL3(EMPTY_LEVEL);
    setMappingName('');
    setCurrentMappings(EMPTY_MAPPINGS);
    setMode('create');
  }, []);

  const handleEdit = useCallback((m: MultiLevelMappingSummary) => {
    setEditingId(m.id);
    setMode('edit');
  }, []);

  const handleCancel = useCallback(() => {
    setMode('list');
    setEditingId(undefined);
  }, []);

  const handleSave = useCallback(() => {
    const findName = (id: string) => connections.find((c) => c.id === id)?.name ?? id;
    const data: CreateMultiLevelMappingData = {
      name: mappingName,
      level1: { connectionId: l1.connectionId, connectionName: findName(l1.connectionId), object: l1.object },
      level2: { connectionId: l2.connectionId, connectionName: findName(l2.connectionId), object: l2.object },
      level3: { connectionId: l3.connectionId, connectionName: findName(l3.connectionId), object: l3.object },
      l1ToL2Mappings: currentMappings.l1ToL2,
      l2ToL3Mappings: currentMappings.l2ToL3,
    };
    if (mode === 'edit' && editingId) {
      updateMutation.mutate({ id: editingId, data }, { onSuccess: () => setMode('list') });
    } else {
      createMutation.mutate(data, { onSuccess: () => setMode('list') });
    }
  }, [mode, editingId, mappingName, l1, l2, l3, currentMappings, connections, createMutation, updateMutation]);


  const allObjectsSelected = !!l1.object && !!l2.object && !!l3.object;
  const loadingCanvas =
    allObjectsSelected && (loadingL1Schema || loadingL2Schema || loadingL3Schema);
  const hasSchemaError = l1SchemaError || l2SchemaError || l3SchemaError;
  const showCanvas = allObjectsSelected && !loadingCanvas && !hasSchemaError;

  const canvasKey = `${l1.connectionId}-${l1.object}-${l2.connectionId}-${l2.object}-${l3.connectionId}-${l3.object}`;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const levelLabel = (level: LevelState) => {
    const conn = connections.find((c) => c.id === level.connectionId);
    return conn ? `${conn.name} · ${level.object}` : level.object;
  };

  const LEVELS = [
    {
      num: 1, state: l1, color: 'bg-indigo-500',
      onConnectionChange: (v: string) => { setL1({ connectionId: v, object: '' }); setCurrentMappings(EMPTY_MAPPINGS); },
      onObjectChange: (v: string) => { setL1((s) => ({ ...s, object: v })); setCurrentMappings(EMPTY_MAPPINGS); },
    },
    {
      num: 2, state: l2, color: 'bg-emerald-500',
      onConnectionChange: (v: string) => { setL2({ connectionId: v, object: '' }); setCurrentMappings(EMPTY_MAPPINGS); },
      onObjectChange: (v: string) => { setL2((s) => ({ ...s, object: v })); setCurrentMappings(EMPTY_MAPPINGS); },
    },
    {
      num: 3, state: l3, color: 'bg-violet-500',
      onConnectionChange: (v: string) => { setL3({ connectionId: v, object: '' }); setCurrentMappings(EMPTY_MAPPINGS); },
      onObjectChange: (v: string) => { setL3((s) => ({ ...s, object: v })); setCurrentMappings(EMPTY_MAPPINGS); },
    },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Multi-level Mapping</h1>
          <p className="text-slate-500 text-sm mt-1">
            Map fields across three connection levels — L1→L2 and L2→L3
          </p>
        </div>
        {mode === 'list' ? (
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" /> New Mapping
          </Button>
        ) : (
          <Button variant="ghost" onClick={handleCancel} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to list
          </Button>
        )}
      </div>

      {/* ── LIST MODE ── */}
      {mode === 'list' && (
        <>
          {loadingMappings ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : mappings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <GitMerge className="w-12 h-12 mb-3 opacity-25" />
              <p className="text-sm font-medium">No multi-level mappings yet</p>
              <p className="text-xs mt-1">Click &ldquo;New Mapping&rdquo; to get started</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Level 1</TableHead>
                    <TableHead>Level 2</TableHead>
                    <TableHead>Level 3</TableHead>
                    <TableHead className="text-center">L1→L2</TableHead>
                    <TableHead className="text-center">L2→L3</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                      <TableCell>
                        <span className="text-slate-700 text-xs">{m.level1.connectionName}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-mono text-xs text-slate-600">{m.level1.object}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-700 text-xs">{m.level2.connectionName}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-mono text-xs text-slate-600">{m.level2.object}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-700 text-xs">{m.level3.connectionName}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-mono text-xs text-slate-600">{m.level3.object}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{m.l1ToL2Mappings.length}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{m.l2ToL3Mappings.length}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(m)}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeletingId(m.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* ── CREATE / EDIT MODE ── */}
      {mode !== 'list' && (
        <>
          {/* Level selectors — 3 columns */}
          <div className="grid grid-cols-3 gap-4">
            {LEVELS.map((lvl) => (
              <ConnectionObjectPicker
                key={lvl.num}
                label={`Level ${lvl.num}`}
                dotColorClass={lvl.color}
                connectionId={lvl.state.connectionId}
                selectedObject={lvl.state.object}
                connections={connections}
                loadingConnections={loadingConnections}
                onConnectionChange={lvl.onConnectionChange}
                onObjectChange={lvl.onObjectChange}
              />
            ))}
          </div>

          {/* Divider with flow hint */}
          {allObjectsSelected && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex-1 border-t border-slate-200" />
              <span>drag handles to connect fields · indigo edges = L1→L2 · violet edges = L2→L3</span>
              <span className="flex-1 border-t border-slate-200" />
            </div>
          )}

          {/* Canvas area */}
          {loadingCanvas && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          )}

          {hasSchemaError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <span>Failed to load schema for one or more levels. Check that the connection is active.</span>
            </div>
          )}

          {showCanvas && (
            <MultiLevelCanvas
              key={canvasKey}
              l1Fields={l1Schema?.fields ?? []}
              l2Fields={l2Schema?.fields ?? []}
              l3Fields={l3Schema?.fields ?? []}
              l1Label={levelLabel(l1)}
              l2Label={levelLabel(l2)}
              l3Label={levelLabel(l3)}
              initialMappings={currentMappings}
              onChange={setCurrentMappings}
            />
          )}

          {!allObjectsSelected && !loadingCanvas && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed rounded-lg bg-slate-50">
              <GitMerge className="w-10 h-10 mb-3 opacity-25" />
              <p className="text-sm">Select a connection and object for all three levels</p>
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
            <label htmlFor="mapping-name" className="text-sm font-medium text-slate-700 flex-shrink-0">
              Mapping name
            </label>
            <Input
              id="mapping-name"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              placeholder="e.g. SF Accounts → NetSuite Entities → Redshift accounts"
              className="max-w-md"
            />
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!mappingName.trim() || !allObjectsSelected || isSaving}
              >
                {isSaving ? 'Saving…' : mode === 'edit' ? 'Update Mapping' : 'Save Mapping'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete mapping?</DialogTitle>
            <DialogDescription>
              This will permanently delete the multi-level mapping. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(undefined)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId) {
                  deleteMutation.mutate(deletingId);
                  setDeletingId(undefined);
                }
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
