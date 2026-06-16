import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDecryptedCredentials } from '@/models/Connection';
import { connectorClient } from '@/lib/connector-client';
import type { UpsertOptions } from '@/lib/connector-client';
import type { ConnectionType } from '@/types/connection';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    targetConnectionId,
    targetObjectName,
    records,
    mode,
    externalIdField,
  } = await req.json() as {
    targetConnectionId: string;
    targetObjectName: string;
    records: Record<string, unknown>[];
    mode: 'create' | 'update' | 'upsert';
    externalIdField?: string;
  };

  if (!targetConnectionId || !targetObjectName || !records?.length || !mode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const conn = await getDecryptedCredentials(targetConnectionId);
  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const options: UpsertOptions = { mode, externalIdField };

  try {
    const result = await connectorClient.upsertRecords(
      conn.type as ConnectionType,
      conn.credentials,
      targetObjectName,
      records,
      options,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
