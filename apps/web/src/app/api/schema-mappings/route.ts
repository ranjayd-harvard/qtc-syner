import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listSchemaMappings, createSchemaMapping } from '@/models/SchemaMapping';

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

export async function GET() {
  try {
    const mappings = await listSchemaMappings();
    return NextResponse.json(mappings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = mappingSchema.parse(await req.json());
    const mapping = await createSchemaMapping(body);
    return NextResponse.json(mapping, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
