import Link from 'next/link';
import { Cloud, Server, Database, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectionStatusBadge } from '@/components/connections/ConnectionStatusBadge';
import type { ConnectionSummary } from '@/types/connection';

const TypeIcon = { salesforce: Cloud, netsuite: Server, redshift: Database };
const TypeLabel = { salesforce: 'Salesforce', netsuite: 'NetSuite', redshift: 'Redshift' };
const TypeBg = {
  salesforce: 'bg-blue-50 group-hover:bg-blue-100',
  netsuite: 'bg-green-50 group-hover:bg-green-100',
  redshift: 'bg-orange-50 group-hover:bg-orange-100',
};
const TypeColor = {
  salesforce: 'text-[#0176D3]',
  netsuite: 'text-[#009A44]',
  redshift: 'text-[#FF9900]',
};

interface Props {
  connections: ConnectionSummary[];
}

export function ConnectionPicker({ connections }: Props) {
  if (connections.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-500">No connections yet.</p>
        <Link href="/admin/connections/new" className="text-indigo-600 text-sm font-medium hover:underline mt-2 inline-block">
          Configure your first connection →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {connections.map((conn) => {
        const Icon = TypeIcon[conn.type];
        return (
          <Link key={conn.id} href={`/explorer/${conn.id}`}>
            <Card className="hover:shadow-lg transition-all cursor-pointer group border-2 hover:border-indigo-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${TypeBg[conn.type]}`}>
                    <Icon className={`w-6 h-6 ${TypeColor[conn.type]}`} />
                  </div>
                  <ConnectionStatusBadge status={conn.status} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{conn.name}</p>
                  <p className="text-sm text-slate-500">{TypeLabel[conn.type]}</p>
                  {conn.objectCount !== undefined && (
                    <p className="text-xs text-slate-400 mt-1">{conn.objectCount} objects</p>
                  )}
                </div>
                <div className="mt-4 flex items-center text-xs font-medium text-indigo-600 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Browse objects <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
