import { notFound } from 'next/navigation';
import { getProductSyncerMappingById } from '@/models/ProductSyncerMapping';
import { SyncDataView } from './SyncDataView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductSyncerDataPage({ params }: PageProps) {
  const { id } = await params;
  const mapping = await getProductSyncerMappingById(id);
  if (!mapping) notFound();
  return <SyncDataView mapping={mapping} />;
}
