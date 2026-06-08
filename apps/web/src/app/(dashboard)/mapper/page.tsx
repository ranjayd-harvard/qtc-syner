'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft, Pencil, Trash2, Workflow, AlertTriangle } from 'lucide-react';
import { useConnections } from '@/hooks/useConnections';
import { useSchema } from '@/hooks/useExplorer';
import { ConnectionObjectPicker } from '@/components/explorer/ConnectionObjectPicker';
import {
  useSchemaMappings,
  useSchemaMapping,
  useCreateSchemaMapping,
  useUpdateSchemaMapping,
  useDeleteSchemaMapping,
} from '@/hooks/useSchemaMappings';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ObjectTypeBadge } from '@/components/explorer/ObjectTypeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { SchemaMapperCanvas, type FieldMapping } from '@/components/mapper/SchemaMapperCanvas';
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
import type { SchemaMappingSummary, CreateSchemaMappingData } from '@/models/SchemaMapping';

type Mode = 'list' | 'create' | 'edit';

export default function SchemaMapperPage() {
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);

  const [sourceConnectionId, setSourceConnectionId] = useState('');
  const [sourceObject, setSourceObject] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [targetObject, setTargetObject] = useState('');
  const [mappingName, setMappingName] = useState('');
  const [currentMappings, setCurrentMappings] = useState<FieldMapping[]>([]);

  const { data: connections = [], isLoading: loadingConnections } = useConnections();
  const {
    data: sourceSchemaData,
    isLoading: loadingSourceSchema,
    isError: sourceSchemaError,
  } = useSchema(sourceConnectionId, sourceObject);
  const {
    data: targetSchemaData,
    isLoading: loadingTargetSchema,
    isError: targetSchemaError,
  } = useSchema(targetConnectionId, targetObject);
  const { data: mappings = [], isLoading: loadingMappings } = useSchemaMappings();
  const { data: editingMapping } = useSchemaMapping(editingId);

  const createMutation = useCreateSchemaMapping();
  const updateMutation = useUpdateSchemaMapping();
  const deleteMutation = useDeleteSchemaMapping();

  useEffect(() => {
    if (editingMapping && mode === 'edit') {
      setSourceConnectionId(editingMapping.sourceConnectionId);
      setSourceObject(editingMapping.sourceObject);
      setTargetConnectionId(editingMapping.targetConnectionId);
      setTargetObject(editingMapping.targetObject);
      setMappingName(editingMapping.name);
      // Convert model-level entries (sourceFields[], targetFields[]) to canvas edges (single fields)
      setCurrentMappings(editingMapping.fieldMappings.map((fm) => ({
        sourceField: fm.sourceFields[0] ?? '',
        targetField: fm.targetFields[0] ?? '',
      })));
    }
  }, [editingMapping, mode]);

  const handleNew = useCallback(() => {
    setEditingId(undefined);
    setSourceConnectionId('');
    setSourceObject('');
    setTargetConnectionId('');
    setTargetObject('');
    setMappingName('');
    setCurrentMappings([]);
    setMode('create');
  }, []);

  const handleEdit = useCallback((mapping: SchemaMappingSummary) => {
    setEditingId(mapping.id);
    setMode('edit');
  }, []);

  const handleCancel = useCallback(() => {
    setMode('list');
    setEditingId(undefined);
  }, []);

  const handleSave = useCallback(() => {
    const sourceConn = connections.find((c) => c.id === sourceConnectionId);
    const targetConn = connections.find((c) => c.id === targetConnectionId);
    const data: CreateSchemaMappingData = {
      name: mappingName,
      sourceConnectionId,
      sourceConnectionName: sourceConn?.name ?? sourceConnectionId,
      sourceObject,
      targetConnectionId,
      targetConnectionName: targetConn?.name ?? targetConnectionId,
      targetObject,
      // Canvas uses 1:1 edges; wrap each in single-element arrays for the model
      fieldMappings: currentMappings.map((m) => ({
        sourceFields: [m.sourceField],
        targetFields: [m.targetField],
      })),
    };
    if (mode === 'edit' && editingId) {
      updateMutation.mutate({ id: editingId, data }, { onSuccess: () => setMode('list') });
    } else {
      createMutation.mutate(data, { onSuccess: () => setMode('list') });
    }
  }, [
    mode, editingId, mappingName, sourceConnectionId, sourceObject,
    targetConnectionId, targetObject, currentMappings, connections,
    createMutation, updateMutation,
  ]);


  const bothObjectsSelected = !!sourceObject && !!targetObject;
  const loadingCanvas = bothObjectsSelected && (loadingSourceSchema || loadingTargetSchema);
  const showCanvas =
    bothObjectsSelected && !loadingSourceSchema && !loadingTargetSchema &&
    !sourceSchemaError && !targetSchemaError;

  const sourceConn = connections.find((c) => c.id === sourceConnectionId);
  const targetConn = connections.find((c) => c.id === targetConnectionId);
  const canvasKey = `${sourceConnectionId}-${sourceObject}-${targetConnectionId}-${targetObject}`;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schema Mapper</h1>
          <p className="text-slate-500 text-sm mt-1">
            Define and persist field mappings between connection schemas
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
              <Workflow className="w-12 h-12 mb-3 opacity-25" />
              <p className="text-sm font-medium">No saved mappings yet</p>
              <p className="text-xs mt-1">Click &ldquo;New Mapping&rdquo; to create your first schema mapping</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-center">Fields</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-slate-900">{m.name}</TableCell>
                      <TableCell>
                        <span className="text-slate-700">{m.sourceConnectionName}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-mono text-xs text-slate-600">{m.sourceObject}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-700">{m.targetConnectionName}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-mono text-xs text-slate-600">{m.targetObject}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{m.fieldMappings.length}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(m)}
                            title="Edit mapping"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeletingId(m.id)}
                            title="Delete mapping"
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
          {/* Connection + Object selectors */}
          <div className="grid grid-cols-2 gap-6">
            <ConnectionObjectPicker
              label="Source"
              dotColorClass="bg-indigo-500"
              connectionId={sourceConnectionId}
              selectedObject={sourceObject}
              connections={connections}
              loadingConnections={loadingConnections}
              onConnectionChange={(v) => { setSourceConnectionId(v); setSourceObject(''); setCurrentMappings([]); }}
              onObjectChange={(v) => { setSourceObject(v); setCurrentMappings([]); }}
            />
            <ConnectionObjectPicker
              label="Target"
              dotColorClass="bg-violet-500"
              connectionId={targetConnectionId}
              selectedObject={targetObject}
              connections={connections}
              loadingConnections={loadingConnections}
              onConnectionChange={(v) => { setTargetConnectionId(v); setTargetObject(''); setCurrentMappings([]); }}
              onObjectChange={(v) => { setTargetObject(v); setCurrentMappings([]); }}
            />
          </div>

          {/* Canvas area */}
          {loadingCanvas && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          )}

          {(sourceSchemaError || targetSchemaError) && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <span>Failed to load schema. Check that the connection is active and the object exists.</span>
            </div>
          )}

          {showCanvas && (
            <SchemaMapperCanvas
              key={canvasKey}
              sourceFields={sourceSchemaData?.fields ?? []}
              targetFields={targetSchemaData?.fields ?? []}
              sourceLabel={`${sourceConn?.name ?? 'Source'} · ${sourceObject}`}
              targetLabel={`${targetConn?.name ?? 'Target'} · ${targetObject}`}
              initialMappings={currentMappings}
              onChange={setCurrentMappings}
            />
          )}

          {!bothObjectsSelected && !loadingCanvas && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-dashed rounded-lg bg-slate-50">
              <Workflow className="w-10 h-10 mb-3 opacity-25" />
              <p className="text-sm">Select a source and target object to load the mapping canvas</p>
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
              placeholder="e.g. Salesforce Accounts → Redshift accounts"
              className="max-w-sm"
            />
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!mappingName.trim() || !bothObjectsSelected || isSaving}
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
              This will permanently delete the mapping. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(undefined)}>
              Cancel
            </Button>
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
