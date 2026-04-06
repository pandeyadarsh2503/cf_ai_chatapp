# PROMPTS.md — AI Prompts Used to Build CF AI Chat

This document lists the AI prompts used during the development of this project, covering all major components.

---

## Prompt 1 — Worker API Logic and KV Memory

**Goal:** Scaffold the Cloudflare Worker that accepts chat messages, loads history from KV, calls an LLM, and saves the response.

**Prompt:**
> Write a Cloudflare Worker in TypeScript that handles a `POST /chat` endpoint. The endpoint should:
> - Accept a JSON body with fields `message: string` and `sessionId: string`
> - Load the existing conversation history from a Cloudflare KV namespace (`CHAT_HISTORY`) using `sessionId` as the key
> - Append the user message to the history as `{ role: "user", content: message }`
> - Call `env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages })` with the full conversation prefixed by a system prompt
> - Append the AI response to history as `{ role: "assistant", content: reply }`
> - Trim history to the last 20 messages before saving
> - Save the updated history to KV with a 24-hour TTL (`expirationTtl: 86400`)
> - Return `{ reply: string, sessionId: string }` as JSON
> - Define all TypeScript types: `ChatMessage`, `ChatRequestBody`, `ChatResponseBody`, `Env`
> - Include `loadHistory` and `saveHistory` helper functions with graceful error handling

---

## Prompt 2 — CORS Handling

**Goal:** Add full CORS support to the Worker so the React frontend running on a different origin can call it.

**Prompt:**
> Extend my Cloudflare Worker to fully handle CORS. Requirements:
> - Add an `OPTIONS` route at the top of the `fetch` handler that returns a 204 response with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, and `Access-Control-Max-Age: 86400`
> - Apply the same CORS headers to every response returned by `POST /chat` and `GET /history`
> - Create a `CORS_HEADERS` constant object and a `jsonResponse(body, status)` helper that attaches these headers and `Content-Type: application/json` to all responses
> - Ensure error responses also include the CORS headers so the browser can read them

---

## Prompt 3 — GET /history Endpoint

**Goal:** Add a secondary endpoint to retrieve a session's conversation history directly from KV.

**Prompt:**
> Add a `GET /history` endpoint to my Cloudflare Worker TypeScript file. It should:
> - Read the `sessionId` query parameter from the URL using `new URL(request.url).searchParams.get("sessionId")`
> - Return a 400 error if `sessionId` is missing
> - Call `loadHistory(env.CHAT_HISTORY, sessionId)` to retrieve the stored messages
> - Return `{ sessionId: string, history: ChatMessage[] }` as JSON with CORS headers
> - Define a `HistoryResponseBody` TypeScript interface

---

## Prompt 4 — React Component Structure and Tailwind Styling

**Goal:** Build the React frontend components: `App.tsx`, `ChatWindow.tsx`, `MessageBubble.tsx`, and `InputBar.tsx` using Tailwind CSS only.

**Prompt:**
> Build a React + TypeScript chat UI using Tailwind CSS (no external component libraries). The app must have:
> - `App.tsx`: Manages `messages: Message[]` state and `sessionId`. Sends `POST /chat` to a Cloudflare Worker URL from `import.meta.env.VITE_WORKER_URL`. Has a "Clear Chat" button.
> - `ChatWindow.tsx`: Renders a scrollable list of `MessageBubble` components. Shows a typing indicator (three pulsing dots) when `isLoading` is true. Auto-scrolls to the latest message using a `ref`.
> - `MessageBubble.tsx`: Renders user messages right-aligned with a blue gradient bubble, assistant messages left-aligned with a grey bubble, and error messages with a red warning bubble.
> - `InputBar.tsx`: Has an auto-resizing `<textarea>`, a send button, sends on Enter (but not Shift+Enter), and disables both input and button while loading.
> Use a dark (`bg-gray-900`/`bg-gray-950`) color scheme throughout. Add subtle gradients and transitions.

---

## Prompt 5 — Typing Indicator Animation

**Goal:** Create a smooth, realistic "typing" animation with three pulsing dots shown while the AI is generating a response.

**Prompt:**
> Create an animated typing indicator for a React chat UI using only Tailwind CSS and a small custom CSS keyframe animation. Requirements:
> - Three circular dots displayed side by side inside a rounded grey bubble
> - Each dot scales up and down using a `bounce`-style keyframe (`scale(0)` at 0%/80%/100%, `scale(1)` at 40%)
> - Apply a staggered `animation-delay` of `0s`, `0.2s`, `0.4s` to the three dots so they animate sequentially, not simultaneously
> - Define the keyframes in `index.css` as a `.typing-dot` class
> - The animation should loop indefinitely (`animation: 1.4s infinite ease-in-out`)
> - Show the component returned from a `TypingIndicator` function alongside an AI avatar on the left side of the chat

---

## Prompt 6 — Session Management with localStorage

**Goal:** Generate and persist a random `sessionId` across page refreshes so conversation memory is maintained.

**Prompt:**
> Implement session management for a React chat app using `localStorage`. Requirements:
> - On component mount, check `localStorage.getItem("cf_ai_chatapp_sessionId")`
> - If it exists, use it as the session ID
> - If it doesn't exist, generate a new UUID v4-style string using a custom `generateSessionId()` function (no external library), save it to `localStorage`, and use it as the session ID
> - Store the session ID in React state with `useState` initialized from the `localStorage` value
> - Implement a `handleClearChat()` function that: removes the key from `localStorage`, generates a new session ID, sets it in state, and clears the `messages` array
> - Pass the `sessionId` in every `POST /chat` request body

---

## Prompt 7 — Wrangler Config and KV Namespace Setup

**Goal:** Write the `wrangler.toml` configuration and document the commands to create the KV namespace.

**Prompt:**
> Write a `wrangler.toml` file for a Cloudflare Worker named `cf-ai-chatapp-worker` with the following requirements:
> - `main = "src/index.ts"`, `compatibility_date = "2024-01-01"`
> - An `[ai]` section with `binding = "AI"` to enable Workers AI
> - A `[[kv_namespaces]]` section with `binding = "CHAT_HISTORY"`, placeholder values for `id` and `preview_id`, and clear inline comments explaining which `wrangler kv:namespace create` commands the developer must run to obtain each ID
> Then write the exact commands:
> - `wrangler kv:namespace create "CHAT_HISTORY"` for the production namespace
> - `wrangler kv:namespace create "CHAT_HISTORY" --preview` for the preview namespace
> And explain where to paste each returned ID in `wrangler.toml`

---

## Prompt 8 — Error Handling and Input Validation

**Goal:** Add comprehensive error handling to both the Worker and frontend.

**Prompt:**
> Add production-grade error handling to a Cloudflare Worker + React chat app:
>
> **Worker side:**
> - Validate that `message` is a non-empty string; return 400 with `{ error: string, status: 400 }` if not
> - Validate that `sessionId` is a non-empty string; return 400 if not
> - Wrap the `env.AI.run(...)` call in try/catch; return 502 with a descriptive error on failure
> - Wrap the KV save in try/catch; log the error but still return the AI reply (non-fatal failure)
> - All error responses must include CORS headers
>
> **Frontend side:**
> - If the `fetch` response is not `res.ok`, parse the body to extract `error` message and throw it
> - Catch errors in the `handleSend` function and push an `{ role: "error" }` message to the `messages` state
> - Display error messages in a distinct red bubble in the `MessageBubble` component with a ⚠️ icon
> - Show an inline error (never a modal or alert) so the chat flow is not interrupted

---

## Prompt 9 — Deployment to Cloudflare Pages

**Goal:** Document the complete deployment flow for the React frontend to Cloudflare Pages.

**Prompt:**
> Write step-by-step deployment instructions for deploying a React + Vite app to Cloudflare Pages. Include:
> - How to build the production bundle: `npm run build` (outputs to `dist/`)
> - How to deploy using Wrangler CLI: `wrangler pages deploy dist --project-name cf-ai-chatapp`
> - How to deploy using the Cloudflare Dashboard with Git integration (set root directory, build command, output directory)
> - How to add the `VITE_WORKER_URL` environment variable in the Pages project settings
> - Why Vite env vars must be prefixed with `VITE_` and accessed via `import.meta.env`
> - A note that the `dist/` folder should not be committed to version control (add `dist` to `.gitignore`)
