'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/explorer/DataTable';
import { useTableData } from '@/hooks/useExplorer';
import { useConnection } from '@/hooks/useConnections';

export default function DataTablePage({ params }: { params: { connectionId: string; objectName: string } }) {
  const objectName = decodeURIComponent(params.objectName);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<string>();
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<string>();

  const { data: connection } = useConnection(params.connectionId);
  const { data, isLoading, error } = useTableData(params.connectionId, objectName, {
    page,
    pageSize,
    sort,
    direction,
    filter,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/explorer/${params.connectionId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-mono">{objectName}</h1>
            <p className="text-slate-500 text-sm">{connection?.name}</p>
          </div>
        </div>

        <Link href={`/explorer/${params.connectionId}/${params.objectName}/schema`}>
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="w-4 h-4" />
            View Schema
          </Button>
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-sm text-red-700">
          Failed to load data: {(error as Error).message}
        </div>
      ) : (
        <DataTable
          data={data?.rows ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          isLoading={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          onSortChange={(field, dir) => { setSort(field); setDirection(dir); setPage(1); }}
          onFilterChange={(f) => { setFilter(f || undefined); setPage(1); }}
        />
      )}
    </div>
  );
}
