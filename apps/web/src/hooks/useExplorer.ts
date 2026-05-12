'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import type { ObjectMeta, FieldMeta, DataResponse, QueryResponse } from '@/types/connector';
import { toast } from './use-toast';

async function fetchObjects(connectionId: string): Promise<{ objects: ObjectMeta[] }> {
  const res = await fetch(`/api/connections/${connectionId}/objects`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to load objects');
  }
  return res.json();
}

async function fetchData(
  connectionId: string,
  objectName: string,
  params: { page: number; pageSize: number; sort?: string; direction?: string; filter?: string }
): Promise<DataResponse> {
  const sp = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.sort && { sort: params.sort }),
    ...(params.direction && { direction: params.direction }),
    ...(params.filter && { filter: params.filter }),
  });
  const res = await fetch(
    `/api/connections/${connectionId}/data/${encodeURIComponent(objectName)}?${sp}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch data');
  }
  return res.json();
}

async function fetchSchema(connectionId: string, objectName: string): Promise<{ fields: FieldMeta[] }> {
  const res = await fetch(
    `/api/connections/${connectionId}/schema/${encodeURIComponent(objectName)}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch schema');
  }
  return res.json();
}

async function executeQuery(
  connectionId: string,
  query: string,
  page: number,
  pageSize: number
): Promise<QueryResponse> {
  const res = await fetch(`/api/connections/${connectionId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, page, pageSize }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Query failed');
  }
  return res.json();
}

export function useObjects(connectionId: string) {
  return useQuery({
    queryKey: ['objects', connectionId],
    queryFn: () => fetchObjects(connectionId),
    enabled: !!connectionId,
    staleTime: 60_000,
  });
}

export function useRecordCount(connectionId: string, objectName: string) {
  return useQuery({
    queryKey: ['record-count', connectionId, objectName],
    queryFn: async () => {
      const res = await fetch(
        `/api/connections/${connectionId}/count/${encodeURIComponent(objectName)}`
      );
      if (!res.ok) throw new Error('Failed to fetch record count');
      const data = await res.json() as { count: number };
      return data.count;
    },
    enabled: !!connectionId && !!objectName,
    staleTime: 60_000,
  });
}

export function useTableData(
  connectionId: string,
  objectName: string,
  params: { page: number; pageSize: number; sort?: string; direction?: string; filter?: string }
) {
  return useQuery({
    queryKey: ['tableData', connectionId, objectName, params],
    queryFn: () => fetchData(connectionId, objectName, params),
    enabled: !!connectionId && !!objectName,
    placeholderData: (prev) => prev,
  });
}

export function useSchema(connectionId: string, objectName: string) {
  return useQuery({
    queryKey: ['schema', connectionId, objectName],
    queryFn: () => fetchSchema(connectionId, objectName),
    enabled: !!connectionId && !!objectName,
    staleTime: 300_000,
  });
}

export function useQueryMutation(connectionId: string) {
  return useMutation({
    mutationFn: ({ query, page, pageSize }: { query: string; page: number; pageSize: number }) =>
      executeQuery(connectionId, query, page, pageSize),
    onError: (err: Error) =>
      toast({ title: 'Query failed', description: err.message, variant: 'destructive' }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch(`/api/connections/${connectionId}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'Connection successful', description: `Latency: ${data.latencyMs}ms`, variant: 'success' as never });
      } else {
        toast({ title: 'Connection failed', description: data.message, variant: 'destructive' });
      }
    },
    onError: (err: Error) =>
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' }),
  });
}

export function useConnectionHistory(connectionId: string) {
  return useQuery({
    queryKey: ['history', connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connectionId}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    },
    enabled: !!connectionId,
  });
}
