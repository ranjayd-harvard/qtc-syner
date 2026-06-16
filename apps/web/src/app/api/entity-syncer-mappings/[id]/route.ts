import { NextResponse } from 'next/server';
import {
  getEntitySyncerMappingById,
  updateEntitySyncerMapping,
  deleteEntitySyncerMappingById,
} from '@/models/EntitySyncerMapping';
import { productSyncerMappingSchema } from '../schemas';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const mapping = await getEntitySyncerMappingById(params.id);
    if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(mapping);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = productSyncerMappingSchema.parse(await req.json());
    const mapping = await updateEntitySyncerMapping(params.id, body);
    if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(mapping);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteEntitySyncerMappingById(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
