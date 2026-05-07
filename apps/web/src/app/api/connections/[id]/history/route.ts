import { NextResponse } from 'next/server';
import { getConnectionHistory } from '@/models/ActivityLog';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const history = await getConnectionHistory(params.id, limit);
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
