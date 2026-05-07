import { NextResponse } from 'next/server';
import { getDecryptedCredentials, getConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';
import { connectorClient } from '@/lib/connector-client';

export async function GET(_req: Request, { params }: { params: { id: string; objectName: string } }) {
  const start = Date.now();
  try {
    const data = await getDecryptedCredentials(params.id);
    if (!data) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    const result = await connectorClient.schema(
      data.type as never,
      data.credentials,
      decodeURIComponent(params.objectName)
    );

    const connection = await getConnection(params.id);
    if (connection) {
      await logActivity(params.id, connection.name, 'fetch_schema', 'success', {
        durationMs: Date.now() - start,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
