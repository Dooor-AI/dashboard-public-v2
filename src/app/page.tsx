export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';

export default async function DashboardPage() {
  let totalChats = 0;
  let messagesToday = 0;
  let recentSessions: { id: string; title: string; updatedAt: Date; _count: { messages: number } }[] = [];
  let hasData = true;

  try {
    totalChats = await prisma.chatSession.count();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    messagesToday = await prisma.chatMessage.count({
      where: { createdAt: { gte: todayStart } },
    });

    recentSessions = await prisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { _count: { select: { messages: true } } },
    });
  } catch {
    hasData = false;
  }

  const metrics = [
    { label: 'Total Chats', value: hasData ? totalChats.toString() : '-' },
    { label: 'Messages Today', value: hasData ? messagesToday.toString() : '-' },
    { label: 'Avg Response Time', value: '1.2s' },
    { label: 'Active Users', value: '3' },
  ];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-white mb-6">Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-sm text-zinc-400 mb-1">{m.label}</p>
            <p className="text-2xl font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-medium text-white mb-4">Recent Sessions</h3>
      {!hasData ? (
        <p className="text-zinc-500">No data available</p>
      ) : recentSessions.length === 0 ? (
        <p className="text-zinc-500">No sessions yet</p>
      ) : (
        <div className="space-y-2">
          {recentSessions.map((s) => (
            <div
              key={s.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-white">{s.title}</p>
                <p className="text-xs text-zinc-500">
                  {s._count.messages} messages
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                {new Date(s.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
