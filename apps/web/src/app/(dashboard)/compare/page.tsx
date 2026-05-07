'use client';

import { useState } from 'react';
import { GitCompare, AlertTriangle } from 'lucide-react';
import { useConnections } from '@/hooks/useConnections';
import { useObjects, useSchema } from '@/hooks/useExplorer';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CompareTable } from '@/components/compare/CompareTable';

function SchemaEmptyWarning({ objectName }: { objectName: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
      <span>
        <span className="font-semibold font-mono">{objectName}</span> returned no fields from
        either the metadata catalog or a live data sample. This record type may not be queryable.
        Try a different object.
      </span>
    </div>
  );
}

export default function SchemaComparePage() {
  const { data: connections = [], isLoading: loadingConnections } = useConnections();

  const [leftConnectionId, setLeftConnectionId] = useState('');
  const [rightConnectionId, setRightConnectionId] = useState('');
  const [leftObject, setLeftObject] = useState('');
  const [rightObject, setRightObject] = useState('');

  const { data: leftObjectsData, isLoading: loadingLeftObjects } = useObjects(leftConnectionId);
  const { data: rightObjectsData, isLoading: loadingRightObjects } = useObjects(rightConnectionId);
  const { data: leftSchemaData, isLoading: loadingLeftSchema, isError: leftSchemaError } = useSchema(leftConnectionId, leftObject);
  const { data: rightSchemaData, isLoading: loadingRightSchema, isError: rightSchemaError } = useSchema(rightConnectionId, rightObject);

  const leftFields = leftSchemaData?.fields ?? [];
  const rightFields = rightSchemaData?.fields ?? [];

  // Loaded but returned no fields — connector may not expose schema for this record type
  const leftSchemaEmpty = !!leftObject && !loadingLeftSchema && !leftSchemaError && leftFields.length === 0;
  const rightSchemaEmpty = !!rightObject && !loadingRightSchema && !rightSchemaError && rightFields.length === 0;

  const leftConnection = connections.find((c) => c.id === leftConnectionId);
  const rightConnection = connections.find((c) => c.id === rightConnectionId);

  const connectionOptions = connections.map((c) => ({
    value: c.id,
    label: c.name,
    suffix: (
      <Badge variant="outline" className="text-xs capitalize">
        {c.type}
      </Badge>
    ),
  }));

  const leftObjectOptions = (leftObjectsData?.objects ?? []).map((o) => ({
    value: o.name,
    label: o.label || o.name,
    suffix: (
      <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        <Badge variant="outline" className="text-xs capitalize">{o.type}</Badge>
        {o.count != null && (
          <span className="text-xs text-slate-400 font-mono">{o.count.toLocaleString()}</span>
        )}
      </span>
    ),
  }));

  const rightObjectOptions = (rightObjectsData?.objects ?? []).map((o) => ({
    value: o.name,
    label: o.label || o.name,
    suffix: (
      <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        <Badge variant="outline" className="text-xs capitalize">{o.type}</Badge>
        {o.count != null && (
          <span className="text-xs text-slate-400 font-mono">{o.count.toLocaleString()}</span>
        )}
      </span>
    ),
  }));

  const bothSelected = !!leftObject && !!rightObject;
  const loadingTable = bothSelected && (loadingLeftSchema || loadingRightSchema);
  const showTable = bothSelected && !loadingLeftSchema && !loadingRightSchema;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schema Compare</h1>
        <p className="text-slate-500 text-sm mt-1">
          Compare object schemas across connections side by side
        </p>
      </div>

      {/* Connection + Object selectors */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left panel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-700">Left</span>
          </div>
          <SearchableSelect
            value={leftConnectionId}
            onValueChange={(v) => {
              setLeftConnectionId(v);
              setLeftObject('');
            }}
            options={connectionOptions}
            placeholder="Select connection…"
            searchPlaceholder="Search connections…"
            disabled={loadingConnections}
          />
          {leftConnectionId && (
            <SearchableSelect
              value={leftObject}
              onValueChange={setLeftObject}
              options={leftObjectOptions}
              placeholder={loadingLeftObjects ? 'Loading objects…' : 'Select object…'}
              searchPlaceholder="Search objects…"
              disabled={loadingLeftObjects}
            />
          )}
          {leftSchemaEmpty && <SchemaEmptyWarning objectName={leftObject} />}
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-700">Right</span>
          </div>
          <SearchableSelect
            value={rightConnectionId}
            onValueChange={(v) => {
              setRightConnectionId(v);
              setRightObject('');
            }}
            options={connectionOptions}
            placeholder="Select connection…"
            searchPlaceholder="Search connections…"
            disabled={loadingConnections}
          />
          {rightConnectionId && (
            <SearchableSelect
              value={rightObject}
              onValueChange={setRightObject}
              options={rightObjectOptions}
              placeholder={loadingRightObjects ? 'Loading objects…' : 'Select object…'}
              searchPlaceholder="Search objects…"
              disabled={loadingRightObjects}
            />
          )}
          {rightSchemaEmpty && <SchemaEmptyWarning objectName={rightObject} />}
        </div>
      </div>

      {/* Loading skeleton */}
      {loadingTable && (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      )}

      {/* Comparison table */}
      {showTable && (
        <CompareTable
          leftFields={leftFields}
          rightFields={rightFields}
          leftLabel={`${leftConnection?.name ?? 'Left'} · ${leftObject}`}
          rightLabel={`${rightConnection?.name ?? 'Right'} · ${rightObject}`}
        />
      )}

      {/* Empty state */}
      {!bothSelected && !loadingTable && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <GitCompare className="w-12 h-12 mb-3 opacity-25" />
          <p className="text-sm">Select a connection and object on each side to compare schemas</p>
        </div>
      )}
    </div>
  );
}
