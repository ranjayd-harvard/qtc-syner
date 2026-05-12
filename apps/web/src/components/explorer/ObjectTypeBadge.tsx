import { Badge } from '@/components/ui/badge';

const LABELS: Record<string, string> = {
  table: 'SuiteQL',
  object: 'Record API',
  view: 'view',
};

const STYLES: Record<string, string> = {
  table: 'bg-teal-50 text-teal-700 border-teal-200',
  object: '',  // default outline
  view: '',
};

interface Props {
  type: string;
}

export function ObjectTypeBadge({ type }: Props) {
  const label = LABELS[type] ?? type;
  const extraClass = STYLES[type] ?? '';
  return (
    <Badge variant="outline" className={`text-xs ${extraClass}`}>
      {label}
    </Badge>
  );
}
