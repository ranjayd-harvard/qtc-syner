import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';
import type { ActivityLogSummary } from '@/models/ActivityLog';

const EVENT_LABELS: Record<string, string> = {
  test: 'Connection test',
  fetch_objects: 'Objects fetched',
  fetch_data: 'Data fetched',
  fetch_schema: 'Schema fetched',
  execute_query: 'Query executed',
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
};

export function RecentActivityFeed({ items }: { items: ActivityLogSummary[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            No activity yet. Test a connection to get started.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-6 py-3">
                <div className="mt-0.5 flex-shrink-0">
                  {item.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{item.connectionName}</span>
                    {' — '}
                    {EVENT_LABELS[item.eventType] || item.eventType}
                  </p>
                  {item.message && item.status === 'failure' && (
                    <p className="text-xs text-red-500 truncate">{item.message}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(item.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
