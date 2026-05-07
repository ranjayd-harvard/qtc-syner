'use client';

import Link from 'next/link';
import { ArrowLeft, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ObjectsList } from '@/components/explorer/ObjectsList';
import { ConnectionStatusBadge } from '@/components/connections/ConnectionStatusBadge';
import { useConnection } from '@/hooks/useConnections';
import { useObjects } from '@/hooks/useExplorer';

export default function ObjectsPage({ params }: { params: { connectionId: string } }) {
  const { data: connection } = useConnection(params.connectionId);
  const { data: objectsData, isLoading, error } = useObjects(params.connectionId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/explorer">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {connection?.name ?? 'Loading…'}
              </h1>
              {connection && <ConnectionStatusBadge status={connection.status} />}
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              {isLoading ? 'Loading objects…' : `${objectsData?.objects.length ?? 0} objects available`}
            </p>
          </div>
        </div>

        <Link href={`/explorer/${params.connectionId}/query`}>
          <Button variant="outline" className="gap-2">
            <Code2 className="w-4 h-4" />
            Query Editor
          </Button>
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-sm text-red-700">
          Failed to load objects: {(error as Error).message}
        </div>
      ) : (
        <ObjectsList
          objects={objectsData?.objects ?? []}
          connectionId={params.connectionId}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
