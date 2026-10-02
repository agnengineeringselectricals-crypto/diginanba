import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    const existing = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rowCount) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    const passwordHash = await hash(body.password, 12);
    const created = await db.query('INSERT INTO users(email, password_hash, display_name) VALUES($1,$2,$3) RETURNING id,email,display_name', [email, passwordHash, body.name]);
    return NextResponse.json({ user: created.rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Please enter a valid name, email and password of at least 8 characters.' }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: 'Unable to create account.' }, { status: 500 });
  }
}
