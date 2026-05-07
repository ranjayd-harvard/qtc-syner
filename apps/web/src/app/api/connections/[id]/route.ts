import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getConnection, updateConnection, deleteConnection } from '@/models/Connection';
import { logActivity } from '@/models/ActivityLog';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const connection = await getConnection(params.id);
    if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(connection);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['salesforce', 'netsuite', 'redshift']),
  credentials: z.record(z.unknown()),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = updateSchema.parse(await req.json());
    const connection = await updateConnection(params.id, body.name, body.type, body.credentials as never);
    if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await logActivity(connection.id, connection.name, 'update', 'success');
    return NextResponse.json(connection);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const connection = await getConnection(params.id);
    const deleted = await deleteConnection(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (connection) {
      await logActivity(connection.id, connection.name, 'delete', 'success');
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
