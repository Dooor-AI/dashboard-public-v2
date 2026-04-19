import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const session = await prisma.chatSession.create({
        data: { title: message.slice(0, 50) },
      });
      currentSessionId = session.id;
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'user',
        content: message,
      },
    });

    await prisma.chatSession.update({
      where: { id: currentSessionId },
      data: { updatedAt: new Date() },
    });

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const fallback = 'AI chat is not configured. Set GEMINI_API_KEY.';
      await prisma.chatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: 'assistant',
          content: fallback,
        },
      });
      return NextResponse.json({ sessionId: currentSessionId, message: fallback });
    }

    const existingMessages = await prisma.chatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' },
    });

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const history = existingMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: m.content }],
      }));

    const chat = model.startChat({
      history,
      systemInstruction: {
        role: 'user',
        parts: [{ text: 'You are a helpful assistant. Be concise and clear in your responses.' }],
      },
    });

    const result = await chat.sendMessage(message);
    const assistantContent = result.response.text();

    await prisma.chatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'assistant',
        content: assistantContent,
      },
    });

    return NextResponse.json({ sessionId: currentSessionId, message: assistantContent });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
