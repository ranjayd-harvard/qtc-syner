'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionForm } from '@/components/connections/ConnectionForm';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnection, useUpdateConnection } from '@/hooks/useConnections';
import { useConnectionHistory } from '@/hooks/useExplorer';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import type { ConnectionFormValues } from '@/types/connection';

export default function EditConnectionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: connection, isLoading } = useConnection(params.id);
  const updateMutation = useUpdateConnection();
  const { data: history = [] } = useConnectionHistory(params.id);

  const handleSubmit = (values: ConnectionFormValues) => {
    updateMutation.mutate(
      { id: params.id, values },
      { onSuccess: () => router.push('/admin/connections') }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!connection) return <div>Connection not found.</div>;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/connections">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{connection.name}</h1>
          <p className="text-slate-500 text-sm capitalize">{connection.type} connection</p>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ConnectionForm
                defaultValues={{ name: connection.name, type: connection.type, id: connection.id }}
                onSubmit={handleSubmit}
                isPending={updateMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <RecentActivityFeed items={history} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
