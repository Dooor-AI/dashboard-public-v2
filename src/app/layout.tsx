import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dashboard Demo',
  description: 'Dashboard with AI Chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen flex">
        <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col p-4 gap-1 shrink-0">
          <h1 className="text-lg font-semibold text-white mb-6 px-3">Dashboard</h1>
          <Link
            href="/"
            className="px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/chat"
            className="px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            Chat
          </Link>
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
