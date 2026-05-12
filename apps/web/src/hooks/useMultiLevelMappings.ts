'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MultiLevelMappingSummary, CreateMultiLevelMappingData } from '@/models/MultiLevelMapping';
import { toast } from './use-toast';

async function fetchMultiLevelMappings(): Promise<MultiLevelMappingSummary[]> {
  const res = await fetch('/api/multi-level-mappings');
  if (!res.ok) throw new Error('Failed to fetch multi-level mappings');
  return res.json();
}

async function fetchMultiLevelMapping(id: string): Promise<MultiLevelMappingSummary> {
  const res = await fetch(`/api/multi-level-mappings/${id}`);
  if (!res.ok) throw new Error('Multi-level mapping not found');
  return res.json();
}

async function createMultiLevelMappingApi(
  data: CreateMultiLevelMappingData
): Promise<MultiLevelMappingSummary> {
  const res = await fetch('/api/multi-level-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create multi-level mapping');
  }
  return res.json();
}

async function updateMultiLevelMappingApi(
  id: string,
  data: CreateMultiLevelMappingData
): Promise<MultiLevelMappingSummary> {
  const res = await fetch(`/api/multi-level-mappings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update multi-level mapping');
  }
  return res.json();
}

async function deleteMultiLevelMappingApi(id: string): Promise<void> {
  const res = await fetch(`/api/multi-level-mappings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete multi-level mapping');
}

export function useMultiLevelMappings() {
  return useQuery({
    queryKey: ['multi-level-mappings'],
    queryFn: fetchMultiLevelMappings,
    staleTime: 30_000,
  });
}

export function useMultiLevelMapping(id: string | undefined) {
  return useQuery({
    queryKey: ['multi-level-mappings', id],
    queryFn: () => fetchMultiLevelMapping(id!),
    enabled: !!id,
  });
}

export function useCreateMultiLevelMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMultiLevelMappingApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multi-level-mappings'] });
      toast({ title: 'Mapping saved', variant: 'success' as never });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useUpdateMultiLevelMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateMultiLevelMappingData }) =>
      updateMultiLevelMappingApi(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multi-level-mappings'] });
      toast({ title: 'Mapping updated', variant: 'success' as never });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useDeleteMultiLevelMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMultiLevelMappingApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multi-level-mappings'] });
      toast({ title: 'Mapping deleted' });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}
