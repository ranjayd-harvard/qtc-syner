import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-indigo-600', iconBg = 'bg-indigo-50', trend, trendUp }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
            {trend && (
              <p className={cn('mt-1 text-xs', trendUp ? 'text-emerald-600' : 'text-slate-500')}>
                {trend}
              </p>
            )}
          </div>
          <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl', iconBg)}>
            <Icon className={cn('w-6 h-6', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
