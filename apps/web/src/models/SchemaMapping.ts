import type { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface FieldMappingEntry {
  sourceField: string;
  targetField: string;
}

export interface SchemaMappingDocument {
  _id?: ObjectId;
  name: string;
  sourceConnectionId: string;
  sourceConnectionName: string;
  sourceObject: string;
  targetConnectionId: string;
  targetConnectionName: string;
  targetObject: string;
  fieldMappings: FieldMappingEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SchemaMappingSummary {
  id: string;
  name: string;
  sourceConnectionId: string;
  sourceConnectionName: string;
  sourceObject: string;
  targetConnectionId: string;
  targetConnectionName: string;
  targetObject: string;
  fieldMappings: FieldMappingEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchemaMappingData {
  name: string;
  sourceConnectionId: string;
  sourceConnectionName: string;
  sourceObject: string;
  targetConnectionId: string;
  targetConnectionName: string;
  targetObject: string;
  fieldMappings: FieldMappingEntry[];
}

function toSummary(doc: SchemaMappingDocument): SchemaMappingSummary {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    sourceConnectionId: doc.sourceConnectionId,
    sourceConnectionName: doc.sourceConnectionName,
    sourceObject: doc.sourceObject,
    targetConnectionId: doc.targetConnectionId,
    targetConnectionName: doc.targetConnectionName,
    targetObject: doc.targetObject,
    fieldMappings: doc.fieldMappings,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listSchemaMappings(): Promise<SchemaMappingSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<SchemaMappingDocument>('schema_mappings')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toSummary);
}

export async function getSchemaMappingById(id: string): Promise<SchemaMappingSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const doc = await db
    .collection<SchemaMappingDocument>('schema_mappings')
    .findOne({ _id: new ObjectId(id) });
  return doc ? toSummary(doc) : null;
}

export async function createSchemaMapping(data: CreateSchemaMappingData): Promise<SchemaMappingSummary> {
  const db = await getDb();
  const now = new Date();
  const doc: SchemaMappingDocument = { ...data, createdAt: now, updatedAt: now };
  const result = await db.collection<SchemaMappingDocument>('schema_mappings').insertOne(doc);
  return toSummary({ ...doc, _id: result.insertedId as unknown as ObjectId });
}

export async function updateSchemaMapping(
  id: string,
  data: CreateSchemaMappingData
): Promise<SchemaMappingSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db.collection<SchemaMappingDocument>('schema_mappings').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result ? toSummary(result) : null;
}

export async function deleteSchemaMappingById(id: string): Promise<boolean> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db
    .collection<SchemaMappingDocument>('schema_mappings')
    .deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
