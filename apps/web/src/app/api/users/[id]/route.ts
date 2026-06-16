import { NextResponse } from 'next/server';
import { removeUser } from '@/models/User';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await removeUser(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
