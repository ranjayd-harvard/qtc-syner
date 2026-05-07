'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTableToolbar } from './DataTableToolbar';
import { DataTablePagination } from './DataTablePagination';
import { DataTableSkeleton } from './DataTableSkeleton';
import { DataTableColumnHeader } from './DataTableColumnHeader';
import type { DataRow } from '@/types/connector';

interface DataTableProps {
  data: DataRow[];
  total: number;
  page: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  onFilterChange: (filter: string) => void;
}

function inferColumns(rows: DataRow[]): ColumnDef<DataRow>[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).map((key) => ({
    accessorKey: key,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={key} />
    ),
    cell: ({ getValue }) => {
      const val = getValue();
      if (val === null || val === undefined) return <span className="text-slate-300">—</span>;
      if (typeof val === 'object') return <span className="text-xs text-slate-500">{JSON.stringify(val)}</span>;
      return <span className="text-sm">{String(val)}</span>;
    },
  }));
}

export function DataTable({
  data,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onFilterChange,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = inferColumns(data);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: Math.ceil(total / pageSize),
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      if (newSorting.length > 0) {
        onSortChange(newSorting[0].id, newSorting[0].desc ? 'desc' : 'asc');
      }
    },
  });

  if (isLoading) return <DataTableSkeleton />;

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} onFilterChange={onFilterChange} data={data} />
      <div className="rounded-md border bg-white overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-slate-50">
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-50/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="max-w-[200px] truncate">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
