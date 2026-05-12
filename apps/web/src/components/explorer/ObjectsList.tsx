'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ObjectCard } from './ObjectCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { ObjectMeta } from '@/types/connector';

type TypeFilter = 'all' | 'table' | 'object' | 'view';

interface Props {
  objects: ObjectMeta[];
  connectionId: string;
  isLoading?: boolean;
}

export function ObjectsList({ objects, connectionId, isLoading }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const availableTypes = useMemo(
    () => Array.from(new Set(objects.map((o) => o.type))).sort(),
    [objects]
  );
  const showTypeFilter = availableTypes.length > 1;

  const filtered = useMemo(
    () =>
      objects.filter((o) => {
        const matchesSearch =
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          o.label.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || o.type === typeFilter;
        return matchesSearch && matchesType;
      }),
    [objects, search, typeFilter]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-lg" />
        ))}
      </div>
    );
  }

  const FILTER_LABELS: Record<TypeFilter, string> = {
    all: 'All',
    table: 'SuiteQL Tables',
    object: 'Record API',
    view: 'Views',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={`Search ${filtered.length} of ${objects.length}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {showTypeFilter && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['all', ...availableTypes] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {FILTER_LABELS[t] ?? t}
                {t !== 'all' && (
                  <span className="ml-1 text-slate-400">
                    {objects.filter((o) => o.type === t).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          {search
            ? `No objects match "${search}"`
            : `No ${typeFilter === 'all' ? '' : FILTER_LABELS[typeFilter] + ' '}objects found`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((obj) => (
            <ObjectCard key={obj.name} object={obj} connectionId={connectionId} />
          ))}
        </div>
      )}
    </div>
  );
}
