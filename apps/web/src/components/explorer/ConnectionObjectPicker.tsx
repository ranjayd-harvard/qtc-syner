'use client';

import { useState, useMemo } from 'react';
import { useObjects } from '@/hooks/useExplorer';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { ObjectTypeBadge } from './ObjectTypeBadge';
import type { ConnectionSummary } from '@/types/connection';

type TypeFilter = 'all' | 'table' | 'object' | 'view';

const FILTER_LABELS: Record<TypeFilter, string> = {
  all: 'All',
  table: 'SuiteQL',
  object: 'Record API',
  view: 'Views',
};

interface ConnectionObjectPickerProps {
  label: string;
  dotColorClass: string;
  connectionId: string;
  selectedObject: string;
  connections: ConnectionSummary[];
  loadingConnections: boolean;
  onConnectionChange: (id: string) => void;
  onObjectChange: (name: string) => void;
}

export function ConnectionObjectPicker({
  label,
  dotColorClass,
  connectionId,
  selectedObject,
  connections,
  loadingConnections,
  onConnectionChange,
  onObjectChange,
}: ConnectionObjectPickerProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const { data: objectsData, isLoading: loadingObjects } = useObjects(connectionId);
  const allObjects = objectsData?.objects ?? [];

  const availableTypes = useMemo(
    () => Array.from(new Set(allObjects.map((o) => o.type))).sort() as TypeFilter[],
    [allObjects]
  );
  const showFilter = connectionId && availableTypes.length > 1;

  const filteredObjects = useMemo(
    () => (typeFilter === 'all' ? allObjects : allObjects.filter((o) => o.type === typeFilter)),
    [allObjects, typeFilter]
  );

  const objectOptions = filteredObjects.map((o) => ({
    value: o.name,
    label: o.label || o.name,
    suffix: (
      <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        <ObjectTypeBadge type={o.type} />
        {o.count != null && (
          <span className="text-xs text-slate-400 font-mono">{o.count.toLocaleString()}</span>
        )}
      </span>
    ),
  }));

  const connectionOptions = connections.map((c) => ({
    value: c.id,
    label: c.name,
    suffix: (
      <Badge variant="outline" className="text-xs capitalize">{c.type}</Badge>
    ),
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColorClass} flex-shrink-0`} />
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>

      <SearchableSelect
        value={connectionId}
        onValueChange={(v) => {
          onConnectionChange(v);
          setTypeFilter('all');
        }}
        options={connectionOptions}
        placeholder={loadingConnections ? 'Loading…' : 'Select connection…'}
        searchPlaceholder="Search connections…"
        disabled={loadingConnections}
      />

      {connectionId && (
        <>
          {showFilter && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
              {(['all', ...availableTypes] as TypeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTypeFilter(t);
                    onObjectChange('');
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {FILTER_LABELS[t] ?? t}
                  {t !== 'all' && (
                    <span className="ml-1 opacity-60">
                      {allObjects.filter((o) => o.type === t).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <SearchableSelect
            value={selectedObject}
            onValueChange={onObjectChange}
            options={objectOptions}
            placeholder={loadingObjects ? 'Loading objects…' : 'Select object…'}
            searchPlaceholder="Search objects…"
            disabled={loadingObjects}
          />
        </>
      )}
    </div>
  );
}
