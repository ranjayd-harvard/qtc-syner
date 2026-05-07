import { Plug2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { StatCard } from './StatCard';

interface StatsGridProps {
  stats: {
    total: number;
    active: number;
    error: number;
    untested: number;
  };
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Total Connections"
        value={stats.total}
        icon={Plug2}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-50"
      />
      <StatCard
        label="Active"
        value={stats.active}
        icon={CheckCircle2}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50"
      />
      <StatCard
        label="Errors"
        value={stats.error}
        icon={XCircle}
        iconColor="text-red-500"
        iconBg="bg-red-50"
      />
      <StatCard
        label="Untested"
        value={stats.untested}
        icon={HelpCircle}
        iconColor="text-amber-500"
        iconBg="bg-amber-50"
      />
    </div>
  );
}
