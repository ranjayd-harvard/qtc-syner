'use client';

import Link from 'next/link';
import { ArrowLeft, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SchemaViewer } from '@/components/explorer/SchemaViewer';
import { DataTableSkeleton } from '@/components/explorer/DataTableSkeleton';
import { useSchema } from '@/hooks/useExplorer';
import { useConnection } from '@/hooks/useConnections';

export default function SchemaPage({ params }: { params: { connectionId: string; objectName: string } }) {
  const objectName = decodeURIComponent(params.objectName);
  const { data: connection } = useConnection(params.connectionId);
  const { data, isLoading, error } = useSchema(params.connectionId, objectName);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/explorer/${params.connectionId}/${params.objectName}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-mono">{objectName} — Schema</h1>
            <p className="text-slate-500 text-sm">{connection?.name}</p>
          </div>
        </div>
        <Link href={`/explorer/${params.connectionId}/${params.objectName}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Table2 className="w-4 h-4" />
            View Data
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <DataTableSkeleton rows={8} cols={5} />
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-sm text-red-700">
          Failed to load schema: {(error as Error).message}
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 mb-3">{data?.fields.length ?? 0} fields</p>
          <SchemaViewer fields={data?.fields ?? []} />
        </div>
      )}
    </div>
  );
}
