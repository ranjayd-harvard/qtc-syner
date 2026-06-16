import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
  createdAt: string;
}

export async function listUsers(): Promise<UserSummary[]> {
  const db = await getDb();
  const docs = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name as string,
    email: d.email as string,
    hasPassword: !!d.passwordHash,
    createdAt: (d.createdAt as Date).toISOString(),
  }));
}

export async function createUser(name: string, email: string, passwordHash?: string): Promise<UserSummary> {
  const db = await getDb();
  const existing = await db.collection('users').findOne({ email });
  if (existing) throw new Error('A user with this email already exists');
  const now = new Date();
  const result = await db.collection('users').insertOne({
    name,
    email,
    ...(passwordHash && { passwordHash }),
    createdAt: now,
    updatedAt: now,
  });
  return { id: result.insertedId.toString(), name, email, hasPassword: !!passwordHash, createdAt: now.toISOString() };
}

export async function removeUser(id: string): Promise<void> {
  const db = await getDb();
  await db.collection('users').deleteOne({ _id: new ObjectId(id) });
}
