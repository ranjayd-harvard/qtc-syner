import { NextResponse } from 'next/server';
import { getDecryptedCredentials, updateConnectionStatus } from '@/models/Connection';
import { getConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';
import { connectorClient } from '@/lib/connector-client';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const start = Date.now();
  try {
    const data = await getDecryptedCredentials(params.id);
    if (!data) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    const result = await connectorClient.objects(data.type as never, data.credentials);
    const durationMs = Date.now() - start;

    const connection = await getConnection(params.id);
    if (connection) {
      await updateConnectionStatus(params.id, 'active', { objectCount: result.objects.length });
      await logActivity(params.id, connection.name, 'fetch_objects', 'success', { durationMs });
    }

    return NextResponse.json(result);
  } catch (err) {
    const connection = await getConnection(params.id);
    if (connection) {
      await logActivity(params.id, connection.name, 'fetch_objects', 'failure', {
        durationMs: Date.now() - start,
        message: String(err),
      });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
