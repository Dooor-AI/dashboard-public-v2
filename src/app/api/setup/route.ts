import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL DEFAULT 'New Chat',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "sessionId" TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    return NextResponse.json({ status: 'ok', message: 'Database tables created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}
