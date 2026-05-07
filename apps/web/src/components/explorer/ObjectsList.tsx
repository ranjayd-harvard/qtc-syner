'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ObjectCard } from './ObjectCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { ObjectMeta } from '@/types/connector';

interface Props {
  objects: ObjectMeta[];
  connectionId: string;
  isLoading?: boolean;
}

export function ObjectsList({ objects, connectionId, isLoading }: Props) {
  const [search, setSearch] = useState('');
  const filtered = objects.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.label.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder={`Search ${objects.length} objects…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          No objects match &ldquo;{search}&rdquo;
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
