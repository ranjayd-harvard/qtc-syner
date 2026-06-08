'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from './DataTable';
import { getQueryPlaceholder } from '@/lib/utils';
import { useQueryMutation } from '@/hooks/useExplorer';
import type { ConnectionType } from '@/types/connection';
import type { QueryResponse } from '@/types/connector';

interface Props {
  connectionId: string;
  connectionType: ConnectionType;
}

export function QueryEditor({ connectionId, connectionType }: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const mutation = useQueryMutation(connectionId);

  const run = async () => {
    if (!query.trim()) return;
    setPage(1);
    const res = await mutation.mutateAsync({ query, page: 1, pageSize });
    setResult(res);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {connectionType === 'salesforce' ? 'SOQL' : 'SQL'} Query
          </span>
          <Button size="sm" onClick={run} disabled={mutation.isPending || !query.trim()} className="gap-2">
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run <span className="text-xs opacity-70 hidden sm:inline">(⌘↵)</span>
          </Button>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getQueryPlaceholder(connectionType)}
          className="w-full min-h-[160px] p-4 font-mono text-sm text-slate-800 resize-y outline-none bg-white placeholder:text-slate-400"
          spellCheck={false}
        />
      </div>

      {mutation.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {(mutation.error as Error).message}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{result.total.toLocaleString()} row(s) returned</p>
          <DataTable
            data={result.rows}
            total={result.total}
            page={page}
            pageSize={pageSize}
            onPageChange={(p) => {
              setPage(p);
              mutation.mutateAsync({ query, page: p, pageSize }).then(setResult);
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
              mutation.mutateAsync({ query, page: 1, pageSize: s }).then(setResult);
            }}
            onSortChange={() => {}}
            onFilterChange={() => {}}
          />
        </div>
      )}
    </div>
  );
}
