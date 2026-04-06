/**
 * cf-ai-chatapp-worker
 *
 * Cloudflare Worker that handles:
 *  - POST /chat       → Accept user message, load KV history, call Llama 3.3, save updated history, return reply
 *  - GET  /history    → Return full conversation history for a given sessionId
 *  - OPTIONS *        → CORS preflight
 */

// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────

/** A single chat message in the conversation history */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Expected request body for POST /chat */
interface ChatRequestBody {
  message: string;
  sessionId: string;
}


/** Response body returned from GET /history */
interface HistoryResponseBody {
  sessionId: string;
  history: ChatMessage[];
}

/** Error response body */
interface ErrorResponseBody {
  error: string;
  status: number;
}


/** Bindings available on the Worker's env object */
interface Env {
  AI: {
    run(
      model: string,
      options: { messages: ChatMessage[]; stream?: boolean }
    ): Promise<any>;
  };
  CHAT_HISTORY: KVNamespace;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Llama 3.3 model identifier on Workers AI */
const LLAMA_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** System prompt injected at the start of every conversation */
const SYSTEM_PROMPT: ChatMessage = {
  role: "system",
  content:
    "You are a helpful AI assistant. Be concise, friendly and clear.",
};

/** Maximum number of messages (excluding system) to keep in history */
const MAX_HISTORY_MESSAGES = 20;

/** KV TTL: 24 hours in seconds */
const KV_TTL_SECONDS = 86400;

/** CORS headers applied to every response */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Build a JSON Response with CORS headers and the correct content-type.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Build a CORS pre-flight response.
 */
function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Load conversation history from KV.
 * Returns an empty array if the key does not exist or is malformed.
 */
async function loadHistory(
  kv: KVNamespace,
  sessionId: string
): Promise<ChatMessage[]> {
  try {
    const raw = await kv.get(sessionId, "text");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatMessage[];
  } catch {
    // If the stored value is corrupted, start fresh
    return [];
  }
}

/**
 * Save history to KV with a TTL so stale sessions expire automatically.
 * Trims to MAX_HISTORY_MESSAGES (non-system messages) before saving.
 */
async function saveHistory(
  kv: KVNamespace,
  sessionId: string,
  history: ChatMessage[]
): Promise<void> {
  // Keep only the latest MAX_HISTORY_MESSAGES (user + assistant pairs)
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
  await kv.put(sessionId, JSON.stringify(trimmed), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

// ─────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────

/**
 * POST /chat
 *
 * Body: { message: string, sessionId: string }
 * Response: { reply: string, sessionId: string }
 */
async function handleChat(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let body: ChatRequestBody;

  // Parse and validate request body
  try {
    body = await request.json<ChatRequestBody>();
  } catch {
    const err: ErrorResponseBody = { error: "Invalid JSON body.", status: 400 };
    return jsonResponse(err, 400);
  }

  const { message, sessionId } = body;

  if (!message || typeof message !== "string" || message.trim() === "") {
    const err: ErrorResponseBody = {
      error: "Field 'message' is required and must be a non-empty string.",
      status: 400,
    };
    return jsonResponse(err, 400);
  }

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
    const err: ErrorResponseBody = {
      error: "Field 'sessionId' is required and must be a non-empty string.",
      status: 400,
    };
    return jsonResponse(err, 400);
  }

  // Load conversation history from KV
  const history = await loadHistory(env.CHAT_HISTORY, sessionId);

  // Append user's new message
  history.push({ role: "user", content: message.trim() });

  // Build messages array: system prompt first, then history
  const messages: ChatMessage[] = [SYSTEM_PROMPT, ...history];

  // Call Workers AI — Llama 3.3 with streaming enabled
  let aiResponseStream: ReadableStream;
  try {
    aiResponseStream = await env.AI.run(LLAMA_MODEL, { messages, stream: true });
  } catch (err) {
    console.error("Workers AI error:", err);
    const errBody: ErrorResponseBody = { error: "AI service error.", status: 502 };
    return jsonResponse(errBody, 502);
  }

  // Tee the stream: one for the user response, one for our background processor
  const [clientStream, workerStream] = aiResponseStream.tee();

  // Background processor: read the stream chunks, accumulate text, and save KV
  ctx.waitUntil((async () => {
    const reader = workerStream.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith("data:") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.response) fullReply += data.response;
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }

      // Once finished, append to history and save
      history.push({ role: "assistant", content: fullReply.trim() });
      await saveHistory(env.CHAT_HISTORY, sessionId, history);
    } catch (err) {
      console.error("Background stream processing error:", err);
    }
  })());

  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", "text/event-stream");
  
  return new Response(clientStream, { status: 200, headers });
}

/**
 * GET /history?sessionId=xxx
 *
 * Returns the full conversation history stored in KV for the given session.
 */
async function handleHistory(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId || sessionId.trim() === "") {
    const err: ErrorResponseBody = {
      error: "Query parameter 'sessionId' is required.",
      status: 400,
    };
    return jsonResponse(err, 400);
  }

  const history = await loadHistory(env.CHAT_HISTORY, sessionId);

  const responseBody: HistoryResponseBody = {
    sessionId,
    history,
  };

  return jsonResponse(responseBody, 200);
}

// ─────────────────────────────────────────────
// Main Export — fetch handler
// ─────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    // ── CORS pre-flight ──────────────────────────
    if (method === "OPTIONS") {
      return corsPreflightResponse();
    }

    // ── Route: POST /chat ────────────────────────
    if (pathname === "/chat" && method === "POST") {
      return handleChat(request, env, ctx);
    }

    // ── Route: GET /history ──────────────────────
    if (pathname === "/history" && method === "GET") {
      return handleHistory(request, env);
    }

    // ── 404 fallback ─────────────────────────────
    const err: ErrorResponseBody = {
      error: `Route not found: ${method} ${pathname}`,
      status: 404,
    };
    return jsonResponse(err, 404);
  },
};
