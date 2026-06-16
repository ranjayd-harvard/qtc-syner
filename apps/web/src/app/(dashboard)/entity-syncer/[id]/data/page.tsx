import { notFound } from 'next/navigation';
import { getEntitySyncerMappingById } from '@/models/EntitySyncerMapping';
import { getAISettings } from '@/models/AppSettings';
import { SyncDataView } from './SyncDataView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntitySyncerDataPage({ params }: PageProps) {
  const { id } = await params;
  const [mapping, aiSettings] = await Promise.all([
    getEntitySyncerMappingById(id),
    getAISettings(),
  ]);
  if (!mapping) notFound();
  return <SyncDataView mapping={mapping} aiProvider={aiSettings.provider} />;
}
