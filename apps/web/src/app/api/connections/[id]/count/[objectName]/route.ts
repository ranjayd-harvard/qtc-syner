import { NextResponse } from 'next/server';
import { getDecryptedCredentials } from '@/models/Connection';
import { connectorClient } from '@/lib/connector-client';
import type { ConnectionType } from '@/types/connection';

export async function GET(
  _req: Request,
  { params }: { params: { id: string; objectName: string } }
) {
  try {
    const creds = await getDecryptedCredentials(params.id);
    if (!creds) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

    const objectName = decodeURIComponent(params.objectName);

    if (creds.type === 'netsuite') {
      // NetSuite SuiteQL totalResults is unreliable when FETCH NEXT is 1 — run a COUNT query instead.
      // The connector appends OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY, which correctly returns the 1
      // aggregate result row while items[0].total holds the real count.
      const result = await connectorClient.query(
        creds.type as ConnectionType,
        creds.credentials,
        `SELECT COUNT(*) AS total FROM ${objectName}`,
        { page: 1, pageSize: 1 }
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      const count = row
        ? Number(row.total ?? row.TOTAL ?? row['COUNT(*)'] ?? row['count(*)'] ?? 0)
        : 0;
      return NextResponse.json({ count });
    }

    // Salesforce + Redshift: totalResults from fetchData with pageSize=1 is reliable.
    const result = await connectorClient.data(
      creds.type as ConnectionType,
      creds.credentials,
      objectName,
      { page: 1, pageSize: 1 }
    );
    return NextResponse.json({ count: result.total });
  } catch (err) {
    console.error('Record count error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
