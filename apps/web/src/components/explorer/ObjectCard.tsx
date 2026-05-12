import Link from 'next/link';
import { Table2, Eye, Box } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ObjectMeta } from '@/types/connector';

const TYPE_CONFIG = {
  table: {
    Icon: Table2,
    iconBg: 'bg-teal-50 group-hover:bg-teal-100',
    iconColor: 'text-teal-600',
    badge: <Badge className="text-xs bg-teal-50 text-teal-700 border-teal-200 flex-shrink-0">SuiteQL</Badge>,
  },
  view: {
    Icon: Eye,
    iconBg: 'bg-slate-100 group-hover:bg-indigo-50',
    iconColor: 'text-slate-500 group-hover:text-indigo-600',
    badge: <Badge variant="outline" className="text-xs flex-shrink-0">view</Badge>,
  },
  object: {
    Icon: Box,
    iconBg: 'bg-slate-100 group-hover:bg-indigo-50',
    iconColor: 'text-slate-500 group-hover:text-indigo-600',
    badge: <Badge variant="outline" className="text-xs flex-shrink-0">Record API</Badge>,
  },
};

interface Props {
  object: ObjectMeta;
  connectionId: string;
}

export function ObjectCard({ object, connectionId }: Props) {
  const config = TYPE_CONFIG[object.type] ?? TYPE_CONFIG.object;
  const { Icon, iconBg, iconColor, badge } = config;
  return (
    <Link href={`/explorer/${connectionId}/${encodeURIComponent(object.name)}`}>
      <Card className="hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
        <CardContent className="p-4 flex items-start gap-3">
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${iconBg}`}>
            <Icon className={`w-4 h-4 transition-colors ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{object.label}</p>
            <p className="text-xs text-slate-400 truncate">{object.name}</p>
          </div>
          {badge}
        </CardContent>
      </Card>
    </Link>
  );
}
