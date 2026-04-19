'use client';

import { useEffect, useRef, useState } from 'react';

interface Session {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // ignore
    }
  }

  async function loadSession(id: string) {
    setActiveSessionId(id);
    try {
      const res = await fetch(`/api/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // ignore
    }
  }

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: activeSessionId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!activeSessionId) {
          setActiveSessionId(data.sessionId);
        }
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        fetchSessions();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Sessions sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <button
            onClick={startNewChat}
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
          >
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeSessionId === s.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <p className="truncate">{s.title}</p>
              <p className="text-xs text-zinc-600">{s._count.messages} msgs</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <p className="text-zinc-500 text-center mt-20">Start a conversation</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-2xl ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
            >
              <div
                className={`px-4 py-3 rounded-lg text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'bg-zinc-900/50 text-zinc-300'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="max-w-2xl mr-auto">
              <div className="px-4 py-3 rounded-lg bg-zinc-900/50 text-zinc-500 text-sm">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-zinc-800 p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm rounded-md transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
