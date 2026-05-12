import { Skeleton } from '@/components/ui/skeleton';
import { Cloud, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface SyncStatsProps {
  sfTotal: number | null;
  nsTotal: number | null;
  matchedCount?: number;
  unmatchedCount?: number;
  isLoadingSf: boolean;
  isLoadingNs: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  label: string;
  value: number | null | undefined;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-4 ${color}`}>
      <div className="flex-shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
        {isLoading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold">
            {value != null ? value.toLocaleString() : '—'}
          </p>
        )}
      </div>
    </div>
  );
}

export function SyncStats({
  sfTotal,
  nsTotal,
  matchedCount,
  unmatchedCount,
  isLoadingSf,
  isLoadingNs,
}: SyncStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Salesforce Product2"
        value={sfTotal}
        icon={Cloud}
        color="border-indigo-200 bg-indigo-50 text-indigo-800"
        isLoading={isLoadingSf}
      />
      <StatCard
        label="NetSuite Items"
        value={nsTotal}
        icon={Layers}
        color="border-violet-200 bg-violet-50 text-violet-800"
        isLoading={isLoadingNs}
      />
      <StatCard
        label="Matched"
        value={matchedCount}
        icon={CheckCircle2}
        color="border-emerald-200 bg-emerald-50 text-emerald-800"
      />
      <StatCard
        label="Unmatched in SF"
        value={unmatchedCount}
        icon={AlertCircle}
        color="border-amber-200 bg-amber-50 text-amber-800"
      />
    </div>
  );
}
