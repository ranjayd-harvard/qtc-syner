import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ConnectionType } from '@/types/connection';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export const SOURCE_LABELS: Record<ConnectionType, string> = {
  salesforce: 'Salesforce',
  netsuite: 'NetSuite',
  redshift: 'Redshift',
};

export const SOURCE_COLORS: Record<ConnectionType, string> = {
  salesforce: '#0176D3',
  netsuite: '#009A44',
  redshift: '#FF9900',
};

export const SOURCE_BG: Record<ConnectionType, string> = {
  salesforce: 'bg-salesforce-light text-salesforce',
  netsuite: 'bg-netsuite-light text-netsuite',
  redshift: 'bg-redshift-light text-redshift',
};

export function getQueryLanguage(type: ConnectionType): string {
  switch (type) {
    case 'salesforce': return 'soql';
    case 'netsuite': return 'sql';
    case 'redshift': return 'sql';
  }
}

export function getQueryPlaceholder(type: ConnectionType): string {
  switch (type) {
    case 'salesforce':
      return 'SELECT Id, Name, Amount FROM Opportunity WHERE Amount > 1000 LIMIT 25';
    case 'netsuite':
      return 'SELECT id, tranid, entity FROM transaction WHERE trandate > SYSDATE - 30 OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY';
    case 'redshift':
      return 'SELECT * FROM public.orders WHERE created_at > CURRENT_DATE - 30 LIMIT 25';
  }
}
