import { Key } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  return TYPE_COLOR[type.toLowerCase()] || 'bg-slate-100 text-slate-600';
}

export function SchemaViewer({ fields }: { fields: FieldMeta[] }) {
  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>Field Name</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Nullable</TableHead>
            <TableHead>Length</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.name} className="hover:bg-slate-50/50">
              <TableCell className="font-mono text-sm flex items-center gap-2">
                {field.isPrimary && <Key className="w-3.5 h-3.5 text-amber-500" />}
                {field.name}
              </TableCell>
              <TableCell className="text-sm text-slate-600">{field.label}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${typeColor(field.type)}`}>
                  {field.type}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={field.nullable ? 'outline' : 'secondary'} className="text-xs">
                  {field.nullable ? 'nullable' : 'required'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {field.length ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
