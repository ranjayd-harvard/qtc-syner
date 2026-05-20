import type { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { FieldMappingEntry } from './SchemaMapping';
export type { FieldMappingEntry } from './SchemaMapping';

export interface ProductSyncerMappingDocument {
  _id?: ObjectId;
  name: string;
  sfConnectionId: string;
  sfConnectionName: string;
  sfDataMode?: 'object' | 'soql';
  sfObject: string;
  sfQuery?: string;
  nsConnectionId: string;
  nsConnectionName: string;
  nsDataMode?: 'object' | 'suiteql';
  nsObject: string;
  nsQuery?: string;
  fieldMappings: FieldMappingEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSyncerMappingSummary {
  id: string;
  name: string;
  sfConnectionId: string;
  sfConnectionName: string;
  sfDataMode: 'object' | 'soql';
  sfObject: string;
  sfQuery?: string;
  nsConnectionId: string;
  nsConnectionName: string;
  nsDataMode: 'object' | 'suiteql';
  nsObject: string;
  nsQuery?: string;
  fieldMappings: FieldMappingEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductSyncerMappingData {
  name: string;
  sfConnectionId: string;
  sfConnectionName: string;
  sfDataMode: 'object' | 'soql';
  sfObject: string;
  sfQuery?: string;
  nsConnectionId: string;
  nsConnectionName: string;
  nsDataMode: 'object' | 'suiteql';
  nsObject: string;
  nsQuery?: string;
  fieldMappings: FieldMappingEntry[];
}

function toSummary(doc: ProductSyncerMappingDocument): ProductSyncerMappingSummary {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    sfConnectionId: doc.sfConnectionId,
    sfConnectionName: doc.sfConnectionName,
    sfDataMode: doc.sfDataMode ?? 'object',
    sfObject: doc.sfObject ?? '',
    sfQuery: doc.sfQuery,
    nsConnectionId: doc.nsConnectionId,
    nsConnectionName: doc.nsConnectionName,
    nsDataMode: doc.nsDataMode ?? 'object',
    nsObject: doc.nsObject ?? '',
    nsQuery: doc.nsQuery,
    fieldMappings: doc.fieldMappings,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listProductSyncerMappings(): Promise<ProductSyncerMappingSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<ProductSyncerMappingDocument>('product_syncer_mappings')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toSummary);
}

export async function getProductSyncerMappingById(id: string): Promise<ProductSyncerMappingSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const doc = await db
    .collection<ProductSyncerMappingDocument>('product_syncer_mappings')
    .findOne({ _id: new ObjectId(id) });
  return doc ? toSummary(doc) : null;
}

export async function createProductSyncerMapping(
  data: CreateProductSyncerMappingData
): Promise<ProductSyncerMappingSummary> {
  const db = await getDb();
  const now = new Date();
  const doc: ProductSyncerMappingDocument = { ...data, createdAt: now, updatedAt: now };
  const result = await db
    .collection<ProductSyncerMappingDocument>('product_syncer_mappings')
    .insertOne(doc);
  return toSummary({ ...doc, _id: result.insertedId as unknown as ObjectId });
}

export async function updateProductSyncerMapping(
  id: string,
  data: CreateProductSyncerMappingData
): Promise<ProductSyncerMappingSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db
    .collection<ProductSyncerMappingDocument>('product_syncer_mappings')
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  return result ? toSummary(result) : null;
}

export async function deleteProductSyncerMappingById(id: string): Promise<boolean> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db
    .collection<ProductSyncerMappingDocument>('product_syncer_mappings')
    .deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
