import { NextResponse } from 'next/server';
import { listEntitySyncerMappings, createEntitySyncerMapping } from '@/models/EntitySyncerMapping';
import { productSyncerMappingSchema } from './schemas';

export async function GET() {
  try {
    const mappings = await listEntitySyncerMappings();
    return NextResponse.json(mappings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = productSyncerMappingSchema.parse(await req.json());
    const mapping = await createEntitySyncerMapping(body);
    return NextResponse.json(mapping, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
