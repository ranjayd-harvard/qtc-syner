import { NextResponse } from 'next/server';
import { listConnections } from '@/models/Connection';
import { getRecentActivity } from '@/models/ActivityLog';

export async function GET() {
  try {
    const [connections, activity] = await Promise.all([
      listConnections(),
      getRecentActivity(20),
    ]);

    const stats = {
      total: connections.length,
      active: connections.filter((c) => c.status === 'active').length,
      error: connections.filter((c) => c.status === 'error').length,
      untested: connections.filter((c) => c.status === 'untested').length,
      byType: {
        salesforce: connections.filter((c) => c.type === 'salesforce').length,
        netsuite: connections.filter((c) => c.type === 'netsuite').length,
        redshift: connections.filter((c) => c.type === 'redshift').length,
      },
    };

    return NextResponse.json({ stats, connections, activity });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
