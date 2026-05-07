import { Badge } from '@/components/ui/badge';
import type { ConnectionStatus } from '@/types/connection';

const config: Record<ConnectionStatus, { label: string; variant: 'success' | 'error' | 'warning' }> = {
  active: { label: 'Active', variant: 'success' },
  error: { label: 'Error', variant: 'error' },
  untested: { label: 'Untested', variant: 'warning' },
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
