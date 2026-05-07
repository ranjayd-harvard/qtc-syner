'use client';

import { useState } from 'react';
import { Key, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FieldMeta } from '@/types/connector';

const TYPE_COLOR: Record<string, string> = {
  string: 'bg-blue-50 text-blue-700',
  varchar: 'bg-blue-50 text-blue-700',
  text: 'bg-blue-50 text-blue-700',
  int: 'bg-violet-50 text-violet-700',
  integer: 'bg-violet-50 text-violet-700',
  bigint: 'bg-violet-50 text-violet-700',
  numeric: 'bg-violet-50 text-violet-700',
  boolean: 'bg-amber-50 text-amber-700',
  date: 'bg-emerald-50 text-emerald-700',
  timestamp: 'bg-emerald-50 text-emerald-700',
  datetime: 'bg-emerald-50 text-emerald-700',
  picklist: 'bg-pink-50 text-pink-700',
  reference: 'bg-orange-50 text-orange-700',
};

function typeColor(type: string) {
  return TYPE_COLOR[type.toLowerCase()] ?? 'bg-slate-100 text-slate-600';
}

type ComparisonStatus = 'match' | 'type-mismatch' | 'left-only' | 'right-only';

interface ComparisonRow {
  fieldName: string;
  left: FieldMeta | null;
  right: FieldMeta | null;
  status: ComparisonStatus;
}

function buildRows(leftFields: FieldMeta[], rightFields: FieldMeta[]): ComparisonRow[] {
  const leftMap = new Map(leftFields.map((f) => [f.name, f]));
  const rightMap = new Map(rightFields.map((f) => [f.name, f]));
  const allNames = new Set([...leftMap.keys(), ...rightMap.keys()]);

  return Array.from(allNames)
    .sort()
    .map((name) => {
      const left = leftMap.get(name) ?? null;
      const right = rightMap.get(name) ?? null;
      const status: ComparisonStatus =
        left && right
          ? left.type.toLowerCase() === right.type.toLowerCase()
            ? 'match'
            : 'type-mismatch'
          : left
          ? 'left-only'
          : 'right-only';
      return { fieldName: name, left, right, status };
    });
}

function applyFilters(rows: ComparisonRow[], include: string, exclude: string): ComparisonRow[] {
  const inc = include.trim().toLowerCase();
  const exc = exclude.trim().toLowerCase();
  return rows.filter((r) => {
    const name = r.fieldName.toLowerCase();
    if (inc && !name.includes(inc)) return false;
    if (exc && name.includes(exc)) return false;
    return true;
  });
}

const ROW_BG: Record<ComparisonStatus, string> = {
  match: '',
  'type-mismatch': 'bg-amber-50',
  'left-only': 'bg-rose-50/60',
  'right-only': 'bg-rose-50/60',
};

const STATUS_BADGE: Record<ComparisonStatus, { label: string; className: string }> = {
  match: { label: '=', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'type-mismatch': { label: '≠', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  'left-only': { label: 'L', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  'right-only': { label: 'R', className: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export interface CompareTableProps {
  leftFields: FieldMeta[];
  rightFields: FieldMeta[];
  leftLabel: string;
  rightLabel: string;
}

export function CompareTable({ leftFields, rightFields, leftLabel, rightLabel }: CompareTableProps) {
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');

  const allRows = buildRows(leftFields, rightFields);
  const rows = applyFilters(allRows, include, exclude);

  const matchCount = allRows.filter((r) => r.status === 'match').length;
  const mismatchCount = allRows.filter((r) => r.status === 'type-mismatch').length;
  const leftOnlyCount = allRows.filter((r) => r.status === 'left-only').length;
  const rightOnlyCount = allRows.filter((r) => r.status === 'right-only').length;

  const isFiltered = include.trim() || exclude.trim();

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          {matchCount} matching
        </span>
        {mismatchCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            {mismatchCount} type mismatch
          </span>
        )}
        {leftOnlyCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
            {leftOnlyCount} only in left
          </span>
        )}
        {rightOnlyCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
            {rightOnlyCount} only in right
          </span>
        )}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          {allRows.length} total
        </span>
      </div>

      {/* Field filter bar */}
      <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
        <span className="text-xs font-medium text-slate-500 flex-shrink-0">Filter fields</span>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {/* Include */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500 pointer-events-none" />
            <Input
              value={include}
              onChange={(e) => setInclude(e.target.value)}
              placeholder="Include fields containing…"
              className="pl-8 h-8 text-sm border-emerald-200 focus-visible:ring-emerald-300 placeholder:text-slate-400"
            />
            {include && (
              <button
                onClick={() => setInclude('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span className="text-slate-300 flex-shrink-0">|</span>

          {/* Exclude */}
          <div className="relative flex-1 min-w-0">
            <X className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400 pointer-events-none" />
            <Input
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder="Exclude fields containing…"
              className="pl-8 h-8 text-sm border-rose-200 focus-visible:ring-rose-300 placeholder:text-slate-400"
            />
            {exclude && (
              <button
                onClick={() => setExclude('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Visible count */}
        <span className="flex-shrink-0 text-xs text-slate-400">
          {isFiltered ? (
            <span>
              <span className="font-semibold text-slate-600">{rows.length}</span> / {allRows.length} fields
            </span>
          ) : (
            <span className="font-semibold text-slate-600">{allRows.length} fields</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-8" />
              <TableHead className="font-semibold text-slate-700">Field</TableHead>
              {/* Left side header */}
              <TableHead className="border-l-2 border-indigo-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="text-indigo-700 truncate max-w-[160px]" title={leftLabel}>
                    {leftLabel}
                  </span>
                </div>
              </TableHead>
              <TableHead className="text-indigo-500/80 text-xs">Nullable</TableHead>
              <TableHead className="text-indigo-500/80 text-xs">Length</TableHead>
              {/* Right side header */}
              <TableHead className="border-l-2 border-violet-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                  <span className="text-violet-700 truncate max-w-[160px]" title={rightLabel}>
                    {rightLabel}
                  </span>
                </div>
              </TableHead>
              <TableHead className="text-violet-500/80 text-xs">Nullable</TableHead>
              <TableHead className="text-violet-500/80 text-xs">Length</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                  No fields match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const { label, className } = STATUS_BADGE[row.status];
                return (
                  <TableRow key={row.fieldName} className={ROW_BG[row.status]}>
                    {/* Status indicator */}
                    <TableCell className="px-2 py-2">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold border ${className}`}
                      >
                        {label}
                      </span>
                    </TableCell>

                    {/* Field name */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-mono text-sm">
                        {(row.left?.isPrimary || row.right?.isPrimary) && (
                          <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        )}
                        {row.fieldName}
                      </div>
                    </TableCell>

                    {/* Left fields */}
                    {row.left ? (
                      <>
                        <TableCell className="border-l-2 border-indigo-50">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${typeColor(row.left.type)}`}
                          >
                            {row.left.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.left.nullable ? 'outline' : 'secondary'} className="text-xs">
                            {row.left.nullable ? 'nullable' : 'required'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 font-mono">
                          {row.left.length ?? '—'}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell
                        colSpan={3}
                        className="border-l-2 border-indigo-50 text-center text-xs text-rose-300 italic"
                      >
                        not present
                      </TableCell>
                    )}

                    {/* Right fields */}
                    {row.right ? (
                      <>
                        <TableCell className="border-l-2 border-violet-50">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${typeColor(row.right.type)}`}
                          >
                            {row.right.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.right.nullable ? 'outline' : 'secondary'} className="text-xs">
                            {row.right.nullable ? 'nullable' : 'required'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 font-mono">
                          {row.right.length ?? '—'}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell
                        colSpan={3}
                        className="border-l-2 border-violet-50 text-center text-xs text-rose-300 italic"
                      >
                        not present
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
