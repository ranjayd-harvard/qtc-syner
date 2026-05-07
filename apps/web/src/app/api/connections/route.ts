import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listConnections, createConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';

export async function GET() {
  try {
    const connections = await listConnections();
    return NextResponse.json(connections);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['salesforce', 'netsuite', 'redshift']),
  credentials: z.record(z.unknown()),
});

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const connection = await createConnection(body.name, body.type, body.credentials as never);
    await logActivity(connection.id, connection.name, 'create', 'success');
    return NextResponse.json(connection, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
