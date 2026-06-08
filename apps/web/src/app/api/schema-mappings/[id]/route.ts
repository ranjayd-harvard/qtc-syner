import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSchemaMappingById, updateSchemaMapping, deleteSchemaMappingById } from '@/models/SchemaMapping';

const mappingSchema = z.object({
  name: z.string().min(1),
  sourceConnectionId: z.string().min(1),
  sourceConnectionName: z.string().min(1),
  sourceObject: z.string().min(1),
  targetConnectionId: z.string().min(1),
  targetConnectionName: z.string().min(1),
  targetObject: z.string().min(1),
  fieldMappings: z.array(
    z.object({
      sourceFields: z.array(z.string().min(1)).min(1),
      targetFields: z.array(z.string().min(1)).min(1),
      condition: z.enum(['AND', 'OR']).optional(),
    })
  ),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const mapping = await getSchemaMappingById(params.id);
    if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(mapping);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = mappingSchema.parse(await req.json());
    const mapping = await updateSchemaMapping(params.id, body);
    if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(mapping);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteSchemaMappingById(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
