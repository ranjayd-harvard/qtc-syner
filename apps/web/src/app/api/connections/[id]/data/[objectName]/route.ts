import { NextResponse } from 'next/server';
import { getDecryptedCredentials, getConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';
import { connectorClient } from '@/lib/connector-client';

export async function GET(req: Request, { params }: { params: { id: string; objectName: string } }) {
  const start = Date.now();
  try {
    const data = await getDecryptedCredentials(params.id);
    if (!data) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25', 10);
    const sortField = url.searchParams.get('sort') || undefined;
    const direction = (url.searchParams.get('direction') || 'asc') as 'asc' | 'desc';
    const filter = url.searchParams.get('filter') || undefined;

    const result = await connectorClient.data(
      data.type as never,
      data.credentials,
      decodeURIComponent(params.objectName),
      {
        page,
        pageSize,
        sort: sortField ? { field: sortField, direction } : undefined,
        filter,
      }
    );

    const connection = await getConnection(params.id);
    if (connection) {
      await logActivity(params.id, connection.name, 'fetch_data', 'success', {
        durationMs: Date.now() - start,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const connection = await getConnection(params.id);
    if (connection) {
      await logActivity(params.id, connection.name, 'fetch_data', 'failure', {
        durationMs: Date.now() - start,
        message: String(err),
      });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
