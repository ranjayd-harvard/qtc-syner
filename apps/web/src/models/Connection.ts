import type { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { encrypt, decrypt } from '@/lib/encryption';
import type {
  ConnectionDocument,
  ConnectionSummary,
  RawCredentials,
  ConnectionStatus,
} from '@/types/connection';

function toSummary(doc: ConnectionDocument): ConnectionSummary {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    type: doc.type,
    status: doc.status,
    lastTestedAt: doc.lastTestedAt?.toISOString(),
    lastErrorMessage: doc.lastErrorMessage,
    objectCount: doc.objectCount,
    metadata: doc.metadata,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listConnections(): Promise<ConnectionSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<ConnectionDocument>('connections')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toSummary);
}

export async function getConnection(id: string): Promise<ConnectionSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const doc = await db
    .collection<ConnectionDocument>('connections')
    .findOne({ _id: new ObjectId(id) });
  return doc ? toSummary(doc) : null;
}

export async function getDecryptedCredentials(id: string): Promise<{ credentials: RawCredentials; type: string } | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const doc = await db
    .collection<ConnectionDocument>('connections')
    .findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  const raw = decrypt(doc.encryptedCredentials, doc.encryptionIv, doc.encryptionTag);
  return { credentials: JSON.parse(raw) as RawCredentials, type: doc.type };
}

export async function createConnection(
  name: string,
  type: ConnectionDocument['type'],
  credentials: RawCredentials
): Promise<ConnectionSummary> {
  const db = await getDb();
  const encrypted = encrypt(JSON.stringify(credentials));
  const now = new Date();
  const doc: ConnectionDocument = {
    name,
    type,
    status: 'untested',
    encryptedCredentials: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionTag: encrypted.tag,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<ConnectionDocument>('connections').insertOne(doc);
  return toSummary({ ...doc, _id: result.insertedId as unknown as ObjectId });
}

export async function updateConnection(
  id: string,
  name: string,
  type: ConnectionDocument['type'],
  credentials: RawCredentials
): Promise<ConnectionSummary | null> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const encrypted = encrypt(JSON.stringify(credentials));
  const now = new Date();
  const result = await db.collection<ConnectionDocument>('connections').findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        name,
        type,
        encryptedCredentials: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        encryptionTag: encrypted.tag,
        status: 'untested' as ConnectionStatus,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );
  return result ? toSummary(result) : null;
}

export async function deleteConnection(id: string): Promise<boolean> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  const result = await db
    .collection<ConnectionDocument>('connections')
    .deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

export async function updateConnectionStatus(
  id: string,
  status: ConnectionStatus,
  options?: { errorMessage?: string; objectCount?: number }
): Promise<void> {
  const { ObjectId } = await import('mongodb');
  const db = await getDb();
  await db.collection<ConnectionDocument>('connections').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
        lastTestedAt: new Date(),
        lastErrorMessage: options?.errorMessage,
        objectCount: options?.objectCount,
        updatedAt: new Date(),
      },
    }
  );
}
