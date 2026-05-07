'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectionsTable } from '@/components/connections/ConnectionsTable';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnections } from '@/hooks/useConnections';

export default function ConnectionsPage() {
  const { data: connections = [], isLoading } = useConnections();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connections</h1>
          <p className="text-slate-500 text-sm mt-1">
            {connections.length} configured connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/admin/connections/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Connection
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      ) : (
        <ConnectionsTable connections={connections} />
      )}
    </div>
  );
}
