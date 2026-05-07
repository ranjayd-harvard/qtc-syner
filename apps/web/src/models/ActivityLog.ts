import type { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type EventType =
  | 'test'
  | 'fetch_objects'
  | 'fetch_data'
  | 'fetch_schema'
  | 'execute_query'
  | 'create'
  | 'update'
  | 'delete';

export interface ActivityLogDocument {
  _id?: ObjectId;
  connectionId: string;
  connectionName: string;
  eventType: EventType;
  status: 'success' | 'failure';
  durationMs?: number;
  message?: string;
  createdAt: Date;
}

export interface ActivityLogSummary {
  id: string;
  connectionId: string;
  connectionName: string;
  eventType: EventType;
  status: 'success' | 'failure';
  durationMs?: number;
  message?: string;
  createdAt: string;
}

function toSummary(doc: ActivityLogDocument): ActivityLogSummary {
  return {
    id: doc._id!.toString(),
    connectionId: doc.connectionId,
    connectionName: doc.connectionName,
    eventType: doc.eventType,
    status: doc.status,
    durationMs: doc.durationMs,
    message: doc.message,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function logActivity(
  connectionId: string,
  connectionName: string,
  eventType: EventType,
  status: 'success' | 'failure',
  options?: { durationMs?: number; message?: string }
): Promise<void> {
  const db = await getDb();
  await db.collection<ActivityLogDocument>('activity_logs').insertOne({
    connectionId,
    connectionName,
    eventType,
    status,
    durationMs: options?.durationMs,
    message: options?.message,
    createdAt: new Date(),
  });
}

export async function getRecentActivity(limit = 20): Promise<ActivityLogSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<ActivityLogDocument>('activity_logs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toSummary);
}

export async function getConnectionHistory(
  connectionId: string,
  limit = 50
): Promise<ActivityLogSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<ActivityLogDocument>('activity_logs')
    .find({ connectionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toSummary);
}
