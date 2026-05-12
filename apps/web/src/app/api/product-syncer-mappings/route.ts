import { NextResponse } from 'next/server';
import { listProductSyncerMappings, createProductSyncerMapping } from '@/models/ProductSyncerMapping';
import { productSyncerMappingSchema } from './schemas';

export async function GET() {
  try {
    const mappings = await listProductSyncerMappings();
    return NextResponse.json(mappings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = productSyncerMappingSchema.parse(await req.json());
    const mapping = await createProductSyncerMapping(body);
    return NextResponse.json(mapping, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
