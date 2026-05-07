import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDecryptedCredentials, getConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';
import { connectorClient } from '@/lib/connector-client';

const schema = z.object({
  query: z.string().min(1),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(25),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const start = Date.now();
  try {
    const data = await getDecryptedCredentials(params.id);
    if (!data) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    const body = schema.parse(await req.json());
    const result = await connectorClient.query(
      data.type as never,
      data.credentials,
      body.query,
      { page: body.page, pageSize: body.pageSize }
    );

    const connection = await getConnection(params.id);
    if (connection) {
      await logActivity(params.id, connection.name, 'execute_query', 'success', {
        durationMs: Date.now() - start,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const connection = await getConnection(params.id);
    if (connection) {
      await logActivity(params.id, connection.name, 'execute_query', 'failure', {
        durationMs: Date.now() - start,
        message: String(err),
      });
    }
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
