'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Column } from '@tanstack/react-table';

interface Props<T> {
  column: Column<T>;
  title: string;
}

export function DataTableColumnHeader<T>({ column, title }: Props<T>) {
  if (!column.getCanSort()) return <span>{title}</span>;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      <span>{title}</span>
      {column.getIsSorted() === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : column.getIsSorted() === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
      )}
    </Button>
  );
}
