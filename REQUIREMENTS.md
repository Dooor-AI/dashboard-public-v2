# Dashboard Demo - Full Requirements

Build a Next.js 15 dashboard app with AI chat and PostgreSQL, then deploy it to Dooor OS using the MCP tools.

## Overview

A dark-themed dashboard application with:
- Dashboard page showing metrics (total chats, messages today, etc.) pulled from the database
- AI chat page powered by Gemini 2.0 Flash with conversation history stored in PostgreSQL
- Database setup endpoint for initializing tables

## Tech Stack

- Next.js 15 (App Router, standalone output)
- React 19
- Tailwind CSS v4 (use `@import "tailwindcss"` in globals.css, NO tailwind.config.js)
- Prisma 6 (PostgreSQL)
- Google Generative AI SDK (`@google/generative-ai`)
- TypeScript

## Design

- Dark theme: bg-zinc-950 base, bg-zinc-900 cards, border-zinc-800 borders, emerald-500 accents
- No emojis anywhere
- Professional, clean UI
- Sidebar navigation with "Dashboard" and "Chat" links
- Inter font from next/font

---

## File Structure

```
dashboard-public-v2/
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  Dockerfile
  .gitignore
  public/.gitkeep
  prisma/schema.prisma
  src/
    lib/db.ts
    app/
      globals.css
      layout.tsx
      page.tsx          (dashboard - server component, force-dynamic)
      chat/page.tsx     (chat - client component)
      api/
        chat/route.ts
        sessions/route.ts
        sessions/[id]/messages/route.ts
        setup/route.ts
```

---

## Critical Implementation Details

### package.json

```json
{
  "name": "dashboard-demo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "next": "^15.3.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@prisma/client": "^6.6.0",
    "@google/generative-ai": "^0.24.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "prisma": "^6.6.0",
    "tailwindcss": "^4.1.4",
    "@tailwindcss/postcss": "^4.1.4"
  }
}
```

### next.config.ts

```typescript
import type { NextConfig } from 'next';
const nextConfig: NextConfig = { output: 'standalone' };
export default nextConfig;
```

### postcss.config.mjs

```javascript
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

### globals.css

```css
@import "tailwindcss";
```

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ChatSession {
  id        String        @id @default(uuid())
  title     String        @default("New Chat")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
  @@map("chat_sessions")
}

model ChatMessage {
  id        String      @id @default(uuid())
  sessionId String
  role      String
  content   String
  createdAt DateTime    @default(now())
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@map("chat_messages")
}
```

### Prisma Client Singleton (src/lib/db.ts)

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Dashboard Page (src/app/page.tsx)

CRITICAL: Must have `export const dynamic = 'force-dynamic'` at the top. Without this, Next.js pre-renders the page at build time when there is no DATABASE_URL, and the error gets frozen into static HTML.

- Server component that queries the database for stats
- Shows 4 metric cards: Total Chats, Messages Today, Avg Response Time (hardcoded "1.2s"), Active Users (hardcoded "3")
- Uses prisma.chatSession.count() and prisma.chatMessage.count() for real data
- Shows recent sessions list below cards
- If DB query fails, show "No data available" (catch block)

### Chat Page (src/app/chat/page.tsx)

Client component ("use client") with:
- Left sidebar: list of chat sessions fetched from /api/sessions
- Right panel: message area with input at bottom
- On send: POST to /api/chat with { message, sessionId }
- Display user messages (bg-zinc-800 rounded) and assistant messages (bg-zinc-900/50 rounded)
- Auto-scroll to bottom on new messages
- "New Chat" button that clears current session

### API: Chat (src/app/api/chat/route.ts)

POST handler:
1. Accept { message, sessionId? }
2. If no sessionId, create a new ChatSession (title = first 50 chars of message)
3. Save user message to DB
4. Read GEMINI_API_KEY from process.env
5. If no key: return fallback message "AI chat is not configured. Set GEMINI_API_KEY."
6. Call Gemini API:

```typescript
const { GoogleGenerativeAI } = await import('@google/generative-ai');
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Load conversation history
const history = existingMessages.map((m) => ({
  role: m.role === 'user' ? 'user' as const : 'model' as const,
  parts: [{ text: m.content }],
}));

const chat = model.startChat({
  history,
  systemInstruction: {
    role: 'user',
    parts: [{ text: 'You are a helpful assistant...' }],
  },
});

const result = await chat.sendMessage(message);
const assistantContent = result.response.text();
```

CRITICAL: `systemInstruction` MUST be a Content object `{ role: 'user', parts: [{ text: '...' }] }`, NOT a plain string. Plain string causes a 400 error from Gemini API.

7. Save assistant message to DB
8. Return { sessionId, message: assistantContent }

### API: Sessions (src/app/api/sessions/route.ts)

GET handler: return all ChatSessions ordered by updatedAt desc, with _count of messages.

### API: Session Messages (src/app/api/sessions/[id]/messages/route.ts)

GET handler: return all messages for a given session, ordered by createdAt asc.

### API: Setup (src/app/api/setup/route.ts)

GET handler that creates tables via raw SQL (no migration needed in container):

```typescript
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
```

Return `{ status: 'ok', message: 'Database tables created successfully' }`.

### Dockerfile

CRITICAL: The `public/` directory must exist (even if empty with just .gitkeep), otherwise the COPY step fails.

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### .gitignore

```
node_modules
.next
.env
.env.local
```

---

## Deploy to Dooor OS (via MCP)

After all code is written, committed, and pushed to the GitHub repo, use the Dooor OS MCP tools to deploy:

### Step 1: Create PostgreSQL Database

```
Tool: create_database
Args: { name: "Dashboard DB", slug: "dashboard-db", engine: "POSTGRES", version: "16", cpu: "250m", memory: "512Mi", storageGb: 5, highAvailability: false }
```

### Step 2: Get Database Connection String

```
Tool: get_database_connection
Args: { dbId: "<id from step 1>" }
```

This returns the full PostgreSQL URI like:
`postgresql://app:<password>@pg-dashboard-db-rw.tenant-dooor-labs.svc.cluster.local:5432/app`

### Step 3: Create the App

```
Tool: create_app
Args: { name: "Dashboard Demo", slug: "dashboard-v2", gitRepoUrl: "https://github.com/Dooor-AI/dashboard-public-v2", gitBranch: "main", dockerfilePath: "Dockerfile", autoDeploy: true }
```

### Step 4: Set Environment Variables

```
Tool: set_env_vars
Args: {
  appId: "<id from step 3>",
  vars: [
    { key: "DATABASE_URL", value: "<uri from step 2>", isSecret: true },
    { key: "GEMINI_API_KEY", value: "<ASK_USER_FOR_GEMINI_API_KEY>", isSecret: true }
  ]
}
```

### Step 5: Deploy

```
Tool: deploy_app
Args: { appId: "<id from step 3>" }
```

### Step 6: Monitor Build Progress

```
Tool: get_pipeline_state
Args: { appId: "<id from step 3>" }
```

Keep checking until build status is ACTIVE and deploy status is ACTIVE. Build typically takes ~3 minutes.

### Step 7: Initialize Database Tables

After deploy is complete, call the setup endpoint to create the tables:

```bash
curl https://dashboard-v2-dooor-labs.apps.dooor.ai/api/setup
```

Or ask the user to visit that URL.

### Step 8: Done

The app is live at: `https://dashboard-v2-dooor-labs.apps.dooor.ai`

- Dashboard: `/`
- Chat: `/chat`

---

## Known Pitfalls (avoid these)

1. **`export const dynamic = 'force-dynamic'`** - Must be on any page.tsx that queries the database, otherwise Next.js bakes the error into static HTML at build time
2. **Gemini systemInstruction** - Must be `{ role: 'user', parts: [{ text: '...' }] }`, NOT a plain string
3. **public/ directory** - Must exist in repo (add .gitkeep) or Dockerfile COPY fails
4. **Engine enum** - Database engine must be `"POSTGRES"` or `"REDIS"` (uppercase), not "postgresql"
5. **set_env_vars** - Use the MCP tool, not curl. Pass vars as array of { key, value, isSecret }
6. **Build time** - Cloud Build takes ~3 minutes. Use get_pipeline_state to monitor, don't just wait blindly
