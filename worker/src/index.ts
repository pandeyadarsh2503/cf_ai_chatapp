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

/** Response body returned from POST /chat */
interface ChatResponseBody {
  reply: string;
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

/** Cloudflare Workers AI run result for text generation */
interface AITextResponse {
  response?: string;
}

/** Bindings available on the Worker's env object */
interface Env {
  AI: {
    run(
      model: string,
      options: { messages: ChatMessage[] }
    ): Promise<AITextResponse>;
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
  env: Env
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

  // Call Workers AI — Llama 3.3
  let aiReply: string;
  try {
    const aiResponse = await env.AI.run(LLAMA_MODEL, { messages });
    aiReply = aiResponse.response?.trim() ?? "I'm sorry, I could not generate a response.";
  } catch (err) {
    console.error("Workers AI error:", err);
    const errBody: ErrorResponseBody = {
      error: "AI service error. Please try again.",
      status: 502,
    };
    return jsonResponse(errBody, 502);
  }

  // Append AI reply to history
  history.push({ role: "assistant", content: aiReply });

  // Persist updated history to KV (trimmed to last MAX_HISTORY_MESSAGES)
  try {
    await saveHistory(env.CHAT_HISTORY, sessionId, history);
  } catch (err) {
    // Non-fatal: log but still return the reply
    console.error("KV save error:", err);
  }

  const responseBody: ChatResponseBody = {
    reply: aiReply,
    sessionId,
  };

  return jsonResponse(responseBody, 200);
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    // ── CORS pre-flight ──────────────────────────
    if (method === "OPTIONS") {
      return corsPreflightResponse();
    }

    // ── Route: POST /chat ────────────────────────
    if (pathname === "/chat" && method === "POST") {
      return handleChat(request, env);
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
