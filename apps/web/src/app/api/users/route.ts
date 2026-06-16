import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { listUsers, createUser } from '@/models/User';

export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).optional(),
});

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : undefined;
    const user = await createUser(body.name, body.email, passwordHash);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
