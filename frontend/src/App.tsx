import { useState, useEffect, useCallback } from "react";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import Sidebar from "./components/Sidebar";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** A single chat message displayed in the UI */
export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
}

/** Lightweight metadata stored in the session index */
export interface SessionMeta {
  sessionId: string;
  /** Auto-generated from the first user message (first ~5 words) */
  title: string;
  createdAt: string; // ISO string
  messageCount: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;

// localStorage keys
const SESSION_INDEX_KEY = "cf_ai_chatapp_sessions";
const ACTIVE_SESSION_KEY = "cf_ai_chatapp_active";
const msgsKey = (id: string) => `cf_ai_chatapp_msgs_${id}`;

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Derive a short keyword title from the first user message.
 * Strips punctuation, takes up to 5 words, appends ellipsis if longer.
 */
function generateTitle(text: string): string {
  const cleaned = text.trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  const snippet = words.slice(0, 5).join(" ");
  return words.length > 5 ? snippet + "…" : snippet || "New Chat";
}

// ── localStorage helpers ──────────────────────

function loadSessionIndex(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSION_INDEX_KEY);
    return raw ? (JSON.parse(raw) as SessionMeta[]) : [];
  } catch {
    return [];
  }
}

function saveSessionIndex(sessions: SessionMeta[]): void {
  localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(sessions));
}

function loadMessages(sessionId: string): Message[] {
  try {
    const raw = localStorage.getItem(msgsKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Omit<Message, "timestamp"> & { timestamp: string }
    >;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(sessionId: string, messages: Message[]): void {
  localStorage.setItem(msgsKey(sessionId), JSON.stringify(messages));
}

// ─────────────────────────────────────────────
// App Component
// ─────────────────────────────────────────────

export default function App() {
  // ── Sidebar ──────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Session index (all sessions, lightweight metadata) ──
  const [sessions, setSessions] = useState<SessionMeta[]>(() =>
    loadSessionIndex()
  );

  // ── Active session ID ─────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (stored) return stored;
    const newId = generateSessionId();
    localStorage.setItem(ACTIVE_SESSION_KEY, newId);
    return newId;
  });

  // ── Messages for the active session ───────────
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
    return stored ? loadMessages(stored) : [];
  });

  const [isLoading, setIsLoading] = useState(false);

  // ── Validate WORKER_URL ───────────────────────
  useEffect(() => {
    if (
      !WORKER_URL ||
      WORKER_URL.includes("your-worker") ||
      WORKER_URL.includes("your-subdomain")
    ) {
      console.warn(
        "[cf_ai_chatapp] VITE_WORKER_URL is not configured correctly. " +
          "Edit frontend/.env and set VITE_WORKER_URL=http://localhost:8787"
      );
    }
  }, []);

  // ── Persist messages + update session messageCount ──
  useEffect(() => {
    saveMessages(activeSessionId, messages);

    if (messages.length > 0) {
      setSessions((prev) => {
        const exists = prev.find((s) => s.sessionId === activeSessionId);
        if (!exists) return prev;
        const updated = prev.map((s) =>
          s.sessionId === activeSessionId
            ? { ...s, messageCount: messages.length }
            : s
        );
        saveSessionIndex(updated);
        return updated;
      });
    }
  }, [activeSessionId, messages]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  /** Switch to an existing session */
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      // Persist current session messages before switching
      saveMessages(activeSessionId, messages);
      const loaded = loadMessages(sessionId);
      setActiveSessionId(sessionId);
      setMessages(loaded);
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    },
    [activeSessionId, messages]
  );

  /** Start a brand-new chat session */
  const handleNewChat = useCallback(() => {
    saveMessages(activeSessionId, messages);
    const newId = generateSessionId();
    setActiveSessionId(newId);
    setMessages([]);
    localStorage.setItem(ACTIVE_SESSION_KEY, newId);
  }, [activeSessionId, messages]);

  /** Delete a session from the index and localStorage */
  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.sessionId !== sessionId);
        saveSessionIndex(updated);
        return updated;
      });
      localStorage.removeItem(msgsKey(sessionId));

      // If we deleted the active session, start a fresh one
      if (sessionId === activeSessionId) {
        const newId = generateSessionId();
        setActiveSessionId(newId);
        setMessages([]);
        localStorage.setItem(ACTIVE_SESSION_KEY, newId);
      }
    },
    [activeSessionId]
  );

  /** Send a message to the Worker */
  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // If this is the first message in the session → register it in the index
      if (messages.length === 0) {
        const title = generateTitle(text);
        const newMeta: SessionMeta = {
          sessionId: activeSessionId,
          title,
          createdAt: new Date().toISOString(),
          messageCount: 1,
        };
        setSessions((prev) => {
          // Guard against duplicate entries
          if (prev.find((s) => s.sessionId === activeSessionId)) return prev;
          const updated = [newMeta, ...prev];
          saveSessionIndex(updated);
          return updated;
        });
      }

      try {
        const res = await fetch(`${WORKER_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            sessionId: activeSessionId,
          }),
        });

        if (!res.ok) {
          let errorText = `Server error: ${res.status}`;
          try {
            const errData = await res.json();
            if (errData && typeof errData.error === "string") {
              errorText = errData.error;
            }
          } catch {
            // ignore
          }
          throw new Error(errorText);
        }

        const data = await res.json<{ reply: string; sessionId: string }>();
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "error",
          content:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, activeSessionId]
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center p-4">
      {/* ── App Card ── */}
      <div
        className="w-full max-w-6xl flex bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden"
        style={{ height: "90vh" }}
      >
        {/* ── Sidebar ── */}
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          isOpen={sidebarOpen}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDelete={handleDeleteSession}
        />

        {/* ── Main Chat Panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ── Header ── */}
          <header className="flex items-center justify-between px-5 py-4 bg-gray-800/60 border-b border-gray-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle */}
              <button
                id="sidebar-toggle-btn"
                onClick={() => setSidebarOpen((v) => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-all duration-150"
                title="Toggle session sidebar"
                aria-label="Toggle session sidebar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              {/* Logo */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="text-white text-lg" role="img" aria-label="robot">
                  🤖
                </span>
              </div>

              <div>
                <h1 className="text-base font-semibold text-white tracking-tight leading-none">
                  CF AI Chat
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {/* Show current session title if it exists */}
                  {sessions.find((s) => s.sessionId === activeSessionId)
                    ?.title ?? "New Conversation"}{" "}
                  · Llama 3.3
                </p>
              </div>
            </div>

            {/* Session badge */}
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-gray-800 border border-gray-700 rounded-full px-3 py-1"
              title={`Session ID: ${activeSessionId}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {activeSessionId.slice(0, 8)}…
            </span>
          </header>

          {/* ── Chat Window ── */}
          <div className="flex-1 overflow-hidden">
            <ChatWindow messages={messages} isLoading={isLoading} />
          </div>

          {/* ── Input Bar ── */}
          <div className="border-t border-gray-700/50 bg-gray-800/40 backdrop-blur-sm">
            <InputBar onSend={handleSend} isLoading={isLoading} />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="mt-3 text-xs text-gray-600 text-center">
        Cloudflare Workers AI · KV Session Memory · React + Vite + Tailwind CSS
      </p>
    </div>
  );
}
