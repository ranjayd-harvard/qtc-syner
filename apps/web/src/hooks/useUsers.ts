'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserSummary } from '@/models/User';
import { toast } from './use-toast';

async function fetchUsers(): Promise<UserSummary[]> {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

async function addUserApi(values: { name: string; email: string; password?: string }): Promise<UserSummary> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add user');
  }
  return res.json();
}

async function deleteUserApi(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove user');
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 30_000,
  });
}

export function useAddUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addUserApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User added' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteUserApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User removed' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });
}
