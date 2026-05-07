import { NextResponse } from 'next/server';
import { getDecryptedCredentials, updateConnectionStatus } from '@/models/Connection';
import { getConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';
import { connectorClient } from '@/lib/connector-client';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const start = Date.now();
  try {
    const data = await getDecryptedCredentials(params.id);
    if (!data) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    const result = await connectorClient.test(data.type as never, data.credentials);
    const durationMs = Date.now() - start;

    const connection = await getConnection(params.id);
    if (connection) {
      await updateConnectionStatus(
        params.id,
        result.success ? 'active' : 'error',
        { errorMessage: result.success ? undefined : result.message }
      );
      await logActivity(
        params.id,
        connection.name,
        'test',
        result.success ? 'success' : 'failure',
        { durationMs, message: result.message }
      );
    }

    return NextResponse.json({ ...result, durationMs });
  } catch (err) {
    const connection = await getConnection(params.id);
    if (connection) {
      await updateConnectionStatus(params.id, 'error', { errorMessage: String(err) });
      await logActivity(params.id, connection.name, 'test', 'failure', {
        durationMs: Date.now() - start,
        message: String(err),
      });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
