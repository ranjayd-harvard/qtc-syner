'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AnalysisResult } from '@/app/api/product-syncer/analyze/route';

interface MatchResultsProps {
  result: AnalysisResult;
}

function rowToCsv(obj: Record<string, unknown>): string {
  return Object.values(obj)
    .map((v) => {
      const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    })
    .join(',');
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(rowToCsv).join('\n');
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMatchedCsv(result: AnalysisResult) {
  const rows = result.matchedPairs.map(({ sfRecord, nsRecord }) => {
    const sf: Record<string, unknown> = {};
    const ns: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sfRecord)) sf[`sf_${k}`] = v;
    for (const [k, v] of Object.entries(nsRecord)) ns[`ns_${k}`] = v;
    return { ...sf, ...ns };
  });
  exportCsv(rows, 'matched_products.csv');
}

function RecordCell({ value }: { value: unknown }) {
  const str = value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return (
    <span className="block truncate max-w-[200px]" title={str}>
      {str || '—'}
    </span>
  );
}

// Pick a handful of "interesting" keys to display from a record
function previewKeys(record: Record<string, unknown>, matchField: string): string[] {
  const priority = [matchField, 'Name', 'name', 'ProductCode', 'itemid', 'displayName', 'Id', 'id'];
  const keys = Object.keys(record).filter(
    (k) => record[k] != null && String(record[k]).trim() !== ''
  );
  const ordered = [
    ...priority.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !priority.includes(k)),
  ];
  return ordered.slice(0, 4);
}

export function MatchResults({ result }: MatchResultsProps) {
  const [tab, setTab] = useState<'matched' | 'unmatched'>('matched');

  const sfKeys =
    result.matchedPairs.length > 0
      ? previewKeys(result.matchedPairs[0].sfRecord, result.sfMatchFields[0] ?? '')
      : previewKeys(result.unmatchedSfRecords[0] ?? {}, result.sfMatchFields[0] ?? '');

  const nsKeys =
    result.matchedPairs.length > 0
      ? previewKeys(result.matchedPairs[0].nsRecord, result.nsMatchFields[0] ?? '')
      : [];

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4">
        <button
          className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'matched'
              ? 'border-indigo-500 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('matched')}
        >
          Matched pairs
          <Badge variant="secondary" className="ml-2">{result.matchedCount}</Badge>
        </button>
        <button
          className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'unmatched'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('unmatched')}
        >
          Unmatched in Salesforce
          <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">{result.unmatchedSfCount}</Badge>
        </button>
        <div className="ml-auto flex gap-2 py-1.5">
          {tab === 'matched' && result.matchedPairs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => exportMatchedCsv(result)}
            >
              <Download className="w-3 h-3" /> Export CSV
            </Button>
          )}
          {tab === 'unmatched' && result.unmatchedSfRecords.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => exportCsv(result.unmatchedSfRecords, 'unmatched_salesforce_products.csv')}
            >
              <Download className="w-3 h-3" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Matched pairs table */}
      {tab === 'matched' && (
        <>
          {result.matchedPairs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10 italic">No matched records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white">
                    {sfKeys.map((k) => (
                      <TableHead key={`sf-${k}`} className="text-indigo-700 bg-indigo-50/50 text-xs font-semibold">
                        SF · {k}
                      </TableHead>
                    ))}
                    {nsKeys.map((k) => (
                      <TableHead key={`ns-${k}`} className="text-violet-700 bg-violet-50/50 text-xs font-semibold">
                        NS · {k}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.matchedPairs.map(({ sfRecord, nsRecord }, i) => (
                    <TableRow key={i}>
                      {sfKeys.map((k) => (
                        <TableCell key={`sf-${k}`} className="text-xs py-2 bg-indigo-50/20">
                          <RecordCell value={sfRecord[k]} />
                        </TableCell>
                      ))}
                      {nsKeys.map((k) => (
                        <TableCell key={`ns-${k}`} className="text-xs py-2 bg-violet-50/20">
                          <RecordCell value={nsRecord[k]} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Unmatched table */}
      {tab === 'unmatched' && (
        <>
          {result.unmatchedSfRecords.length === 0 ? (
            <p className="text-sm text-emerald-600 text-center py-10">
              All Salesforce products are matched in NetSuite.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white">
                    {sfKeys.map((k) => (
                      <TableHead key={k} className="text-indigo-700 bg-indigo-50/50 text-xs font-semibold">
                        {k}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.unmatchedSfRecords.map((row, i) => (
                    <TableRow key={i}>
                      {sfKeys.map((k) => (
                        <TableCell key={k} className="text-xs py-2">
                          <RecordCell value={row[k]} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {result.matchedCount > 200 || result.unmatchedSfCount > 200 ? (
        <p className="text-xs text-slate-400 text-center py-2 border-t border-slate-100">
          Showing first 200 rows — export CSV for the full dataset
        </p>
      ) : null}
    </div>
  );
}
