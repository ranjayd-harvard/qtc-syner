'use client';

import { ConnectionPicker } from '@/components/explorer/ConnectionPicker';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnections } from '@/hooks/useConnections';

export default function ExplorerPage() {
  const { data: connections = [], isLoading } = useConnections();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Explorer</h1>
        <p className="text-slate-500 text-sm mt-1">Select a connection to browse its objects and data</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : (
        <ConnectionPicker connections={connections} />
      )}
    </div>
  );
}
