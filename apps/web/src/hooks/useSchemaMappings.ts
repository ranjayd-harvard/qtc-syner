'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SchemaMappingSummary, CreateSchemaMappingData } from '@/models/SchemaMapping';
import { toast } from './use-toast';

async function fetchSchemaMappings(): Promise<SchemaMappingSummary[]> {
  const res = await fetch('/api/schema-mappings');
  if (!res.ok) throw new Error('Failed to fetch schema mappings');
  return res.json();
}

async function fetchSchemaMapping(id: string): Promise<SchemaMappingSummary> {
  const res = await fetch(`/api/schema-mappings/${id}`);
  if (!res.ok) throw new Error('Schema mapping not found');
  return res.json();
}

async function createSchemaMappingApi(data: CreateSchemaMappingData): Promise<SchemaMappingSummary> {
  const res = await fetch('/api/schema-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create schema mapping');
  }
  return res.json();
}

async function updateSchemaMappingApi(id: string, data: CreateSchemaMappingData): Promise<SchemaMappingSummary> {
  const res = await fetch(`/api/schema-mappings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update schema mapping');
  }
  return res.json();
}

async function deleteSchemaMappingApi(id: string): Promise<void> {
  const res = await fetch(`/api/schema-mappings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete schema mapping');
}

export function useSchemaMappings() {
  return useQuery({
    queryKey: ['schema-mappings'],
    queryFn: fetchSchemaMappings,
    staleTime: 30_000,
  });
}

export function useSchemaMapping(id: string | undefined) {
  return useQuery({
    queryKey: ['schema-mappings', id],
    queryFn: () => fetchSchemaMapping(id!),
    enabled: !!id,
  });
}

export function useCreateSchemaMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSchemaMappingApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schema-mappings'] });
      toast({ title: 'Mapping saved', variant: 'success' as never });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useUpdateSchemaMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateSchemaMappingData }) =>
      updateSchemaMappingApi(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schema-mappings'] });
      toast({ title: 'Mapping updated', variant: 'success' as never });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useDeleteSchemaMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSchemaMappingApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schema-mappings'] });
      toast({ title: 'Mapping deleted' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}
