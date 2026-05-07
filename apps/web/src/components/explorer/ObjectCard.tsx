import Link from 'next/link';
import { Table2, Eye, Box } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ObjectMeta } from '@/types/connector';

const TypeIcon = { table: Table2, view: Eye, object: Box };

interface Props {
  object: ObjectMeta;
  connectionId: string;
}

export function ObjectCard({ object, connectionId }: Props) {
  const Icon = TypeIcon[object.type];
  return (
    <Link href={`/explorer/${connectionId}/${encodeURIComponent(object.name)}`}>
      <Card className="hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
            <Icon className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{object.label}</p>
            <p className="text-xs text-slate-400 truncate">{object.name}</p>
          </div>
          <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{object.type}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
