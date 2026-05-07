import Link from 'next/link';
import { Cloud, Database, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectionStatusBadge } from '@/components/connections/ConnectionStatusBadge';
import { formatRelativeTime } from '@/lib/utils';
import type { ConnectionSummary } from '@/types/connection';

const TypeIcon = { salesforce: Cloud, netsuite: Server, redshift: Database };
const TypeColor = {
  salesforce: 'text-[#0176D3]',
  netsuite: 'text-[#009A44]',
  redshift: 'text-[#FF9900]',
};

export function ConnectionHealthCard({ connection }: { connection: ConnectionSummary }) {
  const Icon = TypeIcon[connection.type];
  return (
    <Link href={`/explorer/${connection.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon className={`w-5 h-5 ${TypeColor[connection.type]}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{connection.name}</p>
            <p className="text-xs text-slate-500">
              Last tested {formatRelativeTime(connection.lastTestedAt)}
            </p>
          </div>
          <ConnectionStatusBadge status={connection.status} />
        </CardContent>
      </Card>
    </Link>
  );
}
