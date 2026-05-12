import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMultiLevelMappingById,
  updateMultiLevelMapping,
  deleteMultiLevelMappingById,
} from '@/models/MultiLevelMapping';

const levelSchema = z.object({
  connectionId: z.string().min(1),
  connectionName: z.string().min(1),
  object: z.string().min(1),
});

const fieldMappingSchema = z.array(
  z.object({
    sourceField: z.string().min(1),
    targetField: z.string().min(1),
  })
);

const mappingSchema = z.object({
  name: z.string().min(1),
  level1: levelSchema,
  level2: levelSchema,
  level3: levelSchema,
  l1ToL2Mappings: fieldMappingSchema,
  l2ToL3Mappings: fieldMappingSchema,
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const mapping = await getMultiLevelMappingById(params.id);
    if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(mapping);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = mappingSchema.parse(await req.json());
    const mapping = await updateMultiLevelMapping(params.id, body);
    if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(mapping);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteMultiLevelMappingById(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
