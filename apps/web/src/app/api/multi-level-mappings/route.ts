import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listMultiLevelMappings, createMultiLevelMapping } from '@/models/MultiLevelMapping';

const levelSchema = z.object({
  connectionId: z.string().min(1),
  connectionName: z.string().min(1),
  object: z.string().min(1),
});

const fieldMappingSchema = z.array(
  z.object({
    sourceFields: z.array(z.string().min(1)).min(1),
    targetFields: z.array(z.string().min(1)).min(1),
    condition: z.enum(['AND', 'OR']).optional(),
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

export async function GET() {
  try {
    const mappings = await listMultiLevelMappings();
    return NextResponse.json(mappings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = mappingSchema.parse(await req.json());
    const mapping = await createMultiLevelMapping(body);
    return NextResponse.json(mapping, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
