'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SOURCE_COLORS, SOURCE_LABELS } from '@/lib/utils';

interface SourcesPieChartProps {
  byType: { salesforce: number; netsuite: number; redshift: number };
}

export function SourcesPieChart({ byType }: SourcesPieChartProps) {
  const data = Object.entries(byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: SOURCE_LABELS[type as keyof typeof SOURCE_LABELS],
      value: count,
      color: SOURCE_COLORS[type as keyof typeof SOURCE_COLORS],
    }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sources by Type</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No connections configured yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sources by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${v} connection(s)`, '']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
