'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConnectionSummary, ConnectionFormValues } from '@/types/connection';
import { toast } from './use-toast';

async function fetchConnections(): Promise<ConnectionSummary[]> {
  const res = await fetch('/api/connections');
  if (!res.ok) throw new Error('Failed to fetch connections');
  return res.json();
}

async function fetchConnection(id: string): Promise<ConnectionSummary> {
  const res = await fetch(`/api/connections/${id}`);
  if (!res.ok) throw new Error('Connection not found');
  return res.json();
}

async function createConnectionApi(values: ConnectionFormValues): Promise<ConnectionSummary> {
  const res = await fetch('/api/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create connection');
  }
  return res.json();
}

async function updateConnectionApi(id: string, values: ConnectionFormValues): Promise<ConnectionSummary> {
  const res = await fetch(`/api/connections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update connection');
  }
  return res.json();
}

async function deleteConnectionApi(id: string): Promise<void> {
  const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete connection');
}

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: fetchConnections,
    staleTime: 30_000,
  });
}

export function useConnection(id: string) {
  return useQuery({
    queryKey: ['connections', id],
    queryFn: () => fetchConnection(id),
    enabled: !!id,
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createConnectionApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      toast({ title: 'Connection created', variant: 'success' as never });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useUpdateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ConnectionFormValues }) =>
      updateConnectionApi(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      toast({ title: 'Connection updated', variant: 'success' as never });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteConnectionApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      toast({ title: 'Connection deleted' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}
