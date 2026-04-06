# CF AI Chat — AI-Powered Conversation App

> A production-ready, full-stack AI chat application built entirely on the Cloudflare ecosystem. It uses **Llama 3.3** via Workers AI for responses, **Cloudflare KV** for per-session conversation memory, a **Cloudflare Worker** for API routing, and a **React + Vite + Tailwind CSS** frontend hosted on **Cloudflare Pages**.

---

## Live Demo

> 🔗 **[https://cf-ai-chatapp.pages.dev/](https://cf-ai-chatapp.pages.dev/)**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│   React + Vite + Tailwind (Cloudflare Pages)                    │
│   ┌──────────┐  ┌───────────────┐  ┌──────────┐                │
│   │ InputBar │  │  ChatWindow   │  │MessageBubble│             │
│   └────┬─────┘  └───────────────┘  └──────────┘                │
│        │  POST /chat {message, sessionId}                       │
└────────┼────────────────────────────────────────────────────────┘
         │  HTTPS
         ▼
┌─────────────────────────────────────────────────────────────────┐
│             CLOUDFLARE WORKER (TypeScript)                      │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐     │
│   │  1. Parse & validate request body                     │     │
│   │  2. Load history from KV  ─────────────────────────►  │     │
│   │                           ◄──── KV: [ChatMessage[]]   │     │
│   │  3. Append user message to history                    │     │
│   │  4. Call Workers AI (Llama 3.3)  ──────────────────►  │     │
│   │                                  ◄──── AI reply       │     │
│   │  5. Append AI reply to history                        │     │
│   │  6. Trim + save history to KV (TTL 24h)  ──────────►  │     │
│   │  7. Return { reply, sessionId }                       │     │
│   └───────────────────────────────────────────────────────┘     │
└───────────────────┬──────────────────────┬──────────────────────┘
                    │                      │
         ┌──────────▼──────┐    ┌──────────▼────────────┐
         │ Cloudflare KV   │    │ Cloudflare Workers AI  │
         │ (CHAT_HISTORY)  │    │ Llama 3.3 70B FP8 Fast │
         │ Per-session     │    │ @cf/meta/llama-3.3-    │
         │ JSON history    │    │  70b-instruct-fp8-fast │
         └─────────────────┘    └────────────────────────┘
```

---

## Components & Cloudflare Services

| Component | Role | Cloudflare Service |
|---|---|---|
| **Worker** (`worker/`) | REST API, AI orchestration, KV I/O | Cloudflare Workers |
| **KV Namespace** | Per-session conversation history with TTL | Cloudflare KV |
| **Workers AI** | Llama 3.3 LLM inference | Cloudflare Workers AI |
| **Frontend** (`frontend/`) | React chat UI, session management | Cloudflare Pages |

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- **Wrangler CLI** (`npm install -g wrangler`)
- A **Cloudflare account** (free tier is sufficient)
- You must be logged in: `wrangler login`

---

## Project Structure

```
cf_ai_chatapp/
├── README.md
├── PROMPTS.md
├── worker/
│   ├── src/
│   │   └── index.ts          ← Worker entry point
│   ├── wrangler.toml         ← Wrangler / bindings config
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── package.json
    ├── .env.example          ← Copy to .env and fill in Worker URL
    └── src/
        ├── index.css
        ├── main.tsx
        ├── App.tsx
        └── components/
            ├── ChatWindow.tsx
            ├── MessageBubble.tsx
            └── InputBar.tsx
```

---

## Local Development

### Step 1 — Create KV Namespaces

Run these two commands and **note the IDs** returned:

```bash
# Production namespace
wrangler kv:namespace create "CHAT_HISTORY"
# → id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Preview namespace (used by wrangler dev)
wrangler kv:namespace create "CHAT_HISTORY" --preview
# → id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

Open `worker/wrangler.toml` and replace the placeholder values:

```toml
[[kv_namespaces]]
binding = "CHAT_HISTORY"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"        # ← paste production id
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy" # ← paste preview id
```

### Step 2 — Start the Worker (local)

```bash
cd worker
npm install
npm run dev
# Worker is live at http://localhost:8787
```

### Step 3 — Configure the Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```
VITE_WORKER_URL=http://localhost:8787
```

### Step 4 — Start the Frontend (local)

```bash
cd frontend
npm install
npm run dev
# Frontend is live at http://localhost:5173
```

Open your browser at **http://localhost:5173** — the app is running.

---

## Deployment

### Deploy the Worker to Cloudflare

```bash
cd worker
npm run deploy
# Wrangler will output your Worker URL, e.g.:
# https://cf-ai-chatapp-worker.YOUR_SUBDOMAIN.workers.dev
```

### Deploy the Frontend to Cloudflare Pages

**Option A — Wrangler CLI**

```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name cf-ai-chatapp
```

**Option B — Cloudflare Dashboard (Git integration)**

1. Push the repo to GitHub/GitLab.
2. In the Cloudflare Dashboard → Pages → Create a project → Connect to Git.
3. Set:
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Add environment variable: `VITE_WORKER_URL` = `https://cf-ai-chatapp-worker.YOUR_SUBDOMAIN.workers.dev`
5. Deploy.

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_WORKER_URL` | Full URL of your deployed Cloudflare Worker |

Example:
```
VITE_WORKER_URL=https://cf-ai-chatapp-worker.your-subdomain.workers.dev
```

---

## API Reference

### `POST /chat`

**Request body:**
```json
{
  "message": "What is Cloudflare Workers?",
  "sessionId": "abc123"
}
```

**Response:**
```json
{
  "reply": "Cloudflare Workers is a serverless platform...",
  "sessionId": "abc123"
}
```

### `GET /history?sessionId=abc123`

**Response:**
```json
{
  "sessionId": "abc123",
  "history": [
    { "role": "user", "content": "What is Cloudflare Workers?" },
    { "role": "assistant", "content": "Cloudflare Workers is..." }
  ]
}
```

---

## How It Works

### Full Request Flow

1. **User types a message** in the React frontend and presses Enter (or clicks Send).
2. **Frontend generates a `sessionId`** on first load and stores it in `localStorage`. This ensures conversation memory persists across page refreshes.
3. **Frontend sends `POST /chat`** to the Cloudflare Worker with `{ message, sessionId }`.
4. **Worker loads history** from Cloudflare KV using `sessionId` as the key. On first message the array is empty.
5. **Worker appends the user message** to the history array.
6. **Worker calls Workers AI** with the full message array (system prompt + history). Llama 3.3 70B generates a reply.
7. **Worker appends the AI reply** to history, trims to the last 20 messages, and saves back to KV with a 24-hour TTL.
8. **Worker returns `{ reply, sessionId }`** to the frontend.
9. **Frontend displays the reply** in a styled message bubble and auto-scrolls to the bottom.

### Conversation Memory

- Each session stores its history as a JSON array in Cloudflare KV under the key `sessionId`.
- The KV entry expires automatically after **24 hours** (86400 seconds TTL).
- History is **trimmed to the last 20 messages** before saving to prevent unbounded growth.
- Clicking **"Clear Chat"** removes the `sessionId` from `localStorage` and generates a new one — effectively starting a fresh session.

---

## IDs and Keys Required to Run This Project

See the table at the bottom of this README for a summary of all IDs/keys you need.

| What | Where to Get It | Where to Put It |
|---|---|---|
| **KV Namespace ID** (production) | `wrangler kv:namespace create "CHAT_HISTORY"` | `worker/wrangler.toml` → `id` |
| **KV Preview ID** | `wrangler kv:namespace create "CHAT_HISTORY" --preview` | `worker/wrangler.toml` → `preview_id` |
| **Worker URL** | After `npm run deploy` in `worker/` | `frontend/.env` → `VITE_WORKER_URL` |
| **Cloudflare Account** | [dash.cloudflare.com](https://dash.cloudflare.com) → sign up free | Required to use Wrangler |

> **No API keys are required for Workers AI.** The `AI` binding is automatically available in your Worker — Cloudflare handles authentication internally.

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Llama 3.3 70B FP8 Fast via Cloudflare Workers AI |
| Backend | Cloudflare Workers (TypeScript) |
| Memory | Cloudflare KV |
| Frontend | React 18 + Vite 5 + TypeScript |
| Styling | Tailwind CSS v3 |
| Hosting | Cloudflare Pages |
