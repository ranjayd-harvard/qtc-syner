'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ProductSyncerMappingSummary,
  CreateProductSyncerMappingData,
} from '@/models/ProductSyncerMapping';
import { toast } from './use-toast';

async function fetchMappings(): Promise<ProductSyncerMappingSummary[]> {
  const res = await fetch('/api/product-syncer-mappings');
  if (!res.ok) throw new Error('Failed to fetch product syncer mappings');
  return res.json();
}

async function fetchMapping(id: string): Promise<ProductSyncerMappingSummary> {
  const res = await fetch(`/api/product-syncer-mappings/${id}`);
  if (!res.ok) throw new Error('Product syncer mapping not found');
  return res.json();
}

async function createMappingApi(data: CreateProductSyncerMappingData): Promise<ProductSyncerMappingSummary> {
  const res = await fetch('/api/product-syncer-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create product syncer mapping');
  }
  return res.json();
}

async function updateMappingApi(
  id: string,
  data: CreateProductSyncerMappingData
): Promise<ProductSyncerMappingSummary> {
  const res = await fetch(`/api/product-syncer-mappings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update product syncer mapping');
  }
  return res.json();
}

async function deleteMappingApi(id: string): Promise<void> {
  const res = await fetch(`/api/product-syncer-mappings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete product syncer mapping');
}

export function useProductSyncerMappings() {
  return useQuery({
    queryKey: ['product-syncer-mappings'],
    queryFn: fetchMappings,
    staleTime: 30_000,
  });
}

export function useProductSyncerMapping(id: string | undefined) {
  return useQuery({
    queryKey: ['product-syncer-mappings', id],
    queryFn: () => fetchMapping(id!),
    enabled: !!id,
  });
}

export function useCreateProductSyncerMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMappingApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-syncer-mappings'] });
      toast({ title: 'Mapping saved', variant: 'success' as never });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useUpdateProductSyncerMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateProductSyncerMappingData }) =>
      updateMappingApi(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['product-syncer-mappings'] });
      qc.invalidateQueries({ queryKey: ['product-syncer-mappings', id] });
      toast({ title: 'Mapping updated', variant: 'success' as never });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useDeleteProductSyncerMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMappingApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-syncer-mappings'] });
      toast({ title: 'Mapping deleted' });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}
