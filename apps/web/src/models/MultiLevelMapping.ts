import type { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface FieldMappingEntry {
  sourceField: string;
  targetField: string;
}

export interface LevelConfig {
  connectionId: string;
  connectionName: string;
  object: string;
}

export interface MultiLevelMappingDocument {
  _id?: ObjectId;
  name: string;
  level1: LevelConfig;
  level2: LevelConfig;
  level3: LevelConfig;
  l1ToL2Mappings: FieldMappingEntry[];
  l2ToL3Mappings: FieldMappingEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MultiLevelMappingSummary {
  id: string;
  name: string;
  level1: LevelConfig;
  level2: LevelConfig;
  level3: LevelConfig;
  l1ToL2Mappings: FieldMappingEntry[];
  l2ToL3Mappings: FieldMappingEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMultiLevelMappingData {
  name: string;
  level1: LevelConfig;
  level2: LevelConfig;
  level3: LevelConfig;
  l1ToL2Mappings: FieldMappingEntry[];
  l2ToL3Mappings: FieldMappingEntry[];
}

function toSummary(doc: MultiLevelMappingDocument): MultiLevelMappingSummary {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    level1: doc.level1,
    level2: doc.level2,
    level3: doc.level3,
    l1ToL2Mappings: doc.l1ToL2Mappings,
    l2ToL3Mappings: doc.l2ToL3Mappings,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listMultiLevelMappings(): Promise<MultiLevelMappingSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<MultiLevelMappingDocument>('multi_level_mappings')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toSummary);
}

export async function getMultiLevelMappingById(id: string): Promise<MultiLevelMappingSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const doc = await db
    .collection<MultiLevelMappingDocument>('multi_level_mappings')
    .findOne({ _id: new ObjectId(id) });
  return doc ? toSummary(doc) : null;
}

export async function createMultiLevelMapping(
  data: CreateMultiLevelMappingData
): Promise<MultiLevelMappingSummary> {
  const db = await getDb();
  const now = new Date();
  const doc: MultiLevelMappingDocument = { ...data, createdAt: now, updatedAt: now };
  const result = await db
    .collection<MultiLevelMappingDocument>('multi_level_mappings')
    .insertOne(doc);
  return toSummary({ ...doc, _id: result.insertedId as unknown as ObjectId });
}

export async function updateMultiLevelMapping(
  id: string,
  data: CreateMultiLevelMappingData
): Promise<MultiLevelMappingSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db
    .collection<MultiLevelMappingDocument>('multi_level_mappings')
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  return result ? toSummary(result) : null;
}

export async function deleteMultiLevelMappingById(id: string): Promise<boolean> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db
    .collection<MultiLevelMappingDocument>('multi_level_mappings')
    .deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
