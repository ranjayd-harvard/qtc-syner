'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QueryEditor } from '@/components/explorer/QueryEditor';
import { ConnectionStatusBadge } from '@/components/connections/ConnectionStatusBadge';
import { useConnection } from '@/hooks/useConnections';

export default function QueryPage({ params }: { params: { connectionId: string } }) {
  const { data: connection } = useConnection(params.connectionId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href={`/explorer/${params.connectionId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Query Editor</h1>
            {connection && <ConnectionStatusBadge status={connection.status} />}
          </div>
          <p className="text-slate-500 text-sm">{connection?.name}</p>
        </div>
      </div>

      {connection ? (
        <QueryEditor connectionId={params.connectionId} connectionType={connection.type} />
      ) : (
        <div className="h-40 rounded-lg bg-slate-100 animate-pulse" />
      )}
    </div>
  );
}
