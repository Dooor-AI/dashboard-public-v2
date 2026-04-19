import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const sessions = await prisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    return NextResponse.json(sessions);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
