'use client';

import Link from 'next/link';
import { Cloud, Server, Database, Pencil, FlaskConical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { DeleteConnectionDialog } from './DeleteConnectionDialog';
import { formatRelativeTime } from '@/lib/utils';
import { useTestConnection } from '@/hooks/useExplorer';
import type { ConnectionSummary } from '@/types/connection';

const TypeIcon = { salesforce: Cloud, netsuite: Server, redshift: Database };
const TypeLabel = { salesforce: 'Salesforce', netsuite: 'NetSuite', redshift: 'Redshift' };
const TypeColor = {
  salesforce: 'text-[#0176D3]',
  netsuite: 'text-[#009A44]',
  redshift: 'text-[#FF9900]',
};

function TypeCell({ type }: { type: ConnectionSummary['type'] }) {
  const Icon = TypeIcon[type];
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${TypeColor[type]}`} />
      <span className="text-sm">{TypeLabel[type]}</span>
    </div>
  );
}

export function ConnectionsTable({ connections }: { connections: ConnectionSummary[] }) {
  const testMutation = useTestConnection();

  if (connections.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <p className="text-sm text-slate-500">No connections yet.</p>
        <Link href="/admin/connections/new">
          <Button className="mt-4">Add your first connection</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Tested</TableHead>
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connections.map((conn) => (
            <TableRow key={conn.id} className="hover:bg-slate-50/50">
              <TableCell className="font-medium">{conn.name}</TableCell>
              <TableCell><TypeCell type={conn.type} /></TableCell>
              <TableCell><ConnectionStatusBadge status={conn.status} /></TableCell>
              <TableCell className="text-sm text-slate-500">
                {formatRelativeTime(conn.lastTestedAt)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Test connection"
                    disabled={testMutation.isPending}
                    onClick={() => testMutation.mutate(conn.id)}
                  >
                    <FlaskConical className="w-4 h-4 text-slate-500" />
                  </Button>
                  <Link href={`/admin/connections/${conn.id}`}>
                    <Button variant="ghost" size="icon" title="Edit">
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </Button>
                  </Link>
                  <DeleteConnectionDialog id={conn.id} name={conn.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
