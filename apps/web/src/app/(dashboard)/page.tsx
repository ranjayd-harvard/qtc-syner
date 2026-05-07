'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { ConnectionHealthCard } from '@/components/dashboard/ConnectionHealthCard';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { SourcesPieChart } from '@/components/dashboard/SourcesPieChart';
import type { ConnectionSummary } from '@/types/connection';
import type { ActivityLogSummary } from '@/models/ActivityLog';

interface DashboardData {
  stats: {
    total: number;
    active: number;
    error: number;
    untested: number;
    byType: { salesforce: number; netsuite: number; redshift: number };
  };
  connections: ConnectionSummary[];
  activity: ActivityLogSummary[];
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of your connected data sources</p>
      </div>

      <StatsGrid stats={data.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Connection Health</h2>
          {data.connections.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No connections configured.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.connections.map((conn) => (
                <ConnectionHealthCard key={conn.id} connection={conn} />
              ))}
            </div>
          )}
        </div>

        <div>
          <SourcesPieChart byType={data.stats.byType} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed items={data.activity} />
      </div>
    </div>
  );
}
