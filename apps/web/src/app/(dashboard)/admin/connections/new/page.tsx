'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionForm } from '@/components/connections/ConnectionForm';
import { useCreateConnection } from '@/hooks/useConnections';
import type { ConnectionFormValues } from '@/types/connection';

export default function NewConnectionPage() {
  const router = useRouter();
  const createMutation = useCreateConnection();

  const handleSubmit = (values: ConnectionFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => router.push('/admin/connections'),
    });
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/connections">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Connection</h1>
          <p className="text-slate-500 text-sm">Connect to a Salesforce, NetSuite, or Redshift instance</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectionForm onSubmit={handleSubmit} isPending={createMutation.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}
