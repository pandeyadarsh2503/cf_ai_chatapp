import { useState, useEffect, useCallback } from "react";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import Sidebar from "./components/Sidebar";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
}

export interface SessionMeta {
  sessionId: string;
  title: string;
  createdAt: string;
  messageCount: number;
}

// ─────────────────────────────────────────────
// Constants & localStorage helpers
// ─────────────────────────────────────────────

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;
const SESSION_INDEX_KEY = "cf_ai_chatapp_sessions";
const ACTIVE_SESSION_KEY = "cf_ai_chatapp_active";
const msgsKey = (id: string) => `cf_ai_chatapp_msgs_${id}`;

function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateTitle(text: string): string {
  const cleaned = text.trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  const snippet = words.slice(0, 5).join(" ");
  return words.length > 5 ? snippet + "…" : snippet || "New Chat";
}

function loadSessionIndex(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSION_INDEX_KEY);
    return raw ? (JSON.parse(raw) as SessionMeta[]) : [];
  } catch { return []; }
}
function saveSessionIndex(s: SessionMeta[]) {
  localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(s));
}
function loadMessages(sessionId: string): Message[] {
  try {
    const raw = localStorage.getItem(msgsKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<Message, "timestamp"> & { timestamp: string }>;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}
function saveMessages(sessionId: string, messages: Message[]) {
  localStorage.setItem(msgsKey(sessionId), JSON.stringify(messages));
}

// ─────────────────────────────────────────────
// App Component
// ─────────────────────────────────────────────

export default function App() {
  // Sidebar open: true on desktop, false on mobile by default
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  const [sessions, setSessions] = useState<SessionMeta[]>(() => loadSessionIndex());

  // Always start with a fresh session on page load
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const newId = generateSessionId();
    localStorage.setItem(ACTIVE_SESSION_KEY, newId);
    return newId;
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Close sidebar when screen shrinks below md
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Persist messages + update messageCount in session index
  useEffect(() => {
    saveMessages(activeSessionId, messages);
    if (messages.length > 0) {
      setSessions((prev) => {
        const exists = prev.find((s) => s.sessionId === activeSessionId);
        if (!exists) return prev;
        const updated = prev.map((s) =>
          s.sessionId === activeSessionId ? { ...s, messageCount: messages.length } : s
        );
        saveSessionIndex(updated);
        return updated;
      });
    }
  }, [activeSessionId, messages]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  const handleSelectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) {
      // On mobile: close sidebar after selecting
      if (window.innerWidth < 768) setSidebarOpen(false);
      return;
    }
    saveMessages(activeSessionId, messages);
    setActiveSessionId(sessionId);
    setMessages(loadMessages(sessionId));
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [activeSessionId, messages]);

  const handleNewChat = useCallback(() => {
    saveMessages(activeSessionId, messages);
    const newId = generateSessionId();
    setActiveSessionId(newId);
    setMessages([]);
    localStorage.setItem(ACTIVE_SESSION_KEY, newId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [activeSessionId, messages]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.sessionId !== sessionId);
      saveSessionIndex(updated);
      return updated;
    });
    localStorage.removeItem(msgsKey(sessionId));
    if (sessionId === activeSessionId) {
      const newId = generateSessionId();
      setActiveSessionId(newId);
      setMessages([]);
      localStorage.setItem(ACTIVE_SESSION_KEY, newId);
    }
  }, [activeSessionId]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Register session on first message
    if (messages.length === 0) {
      const title = generateTitle(text);
      const meta: SessionMeta = {
        sessionId: activeSessionId,
        title,
        createdAt: new Date().toISOString(),
        messageCount: 1,
      };
      setSessions((prev) => {
        if (prev.find((s) => s.sessionId === activeSessionId)) return prev;
        const updated = [meta, ...prev];
        saveSessionIndex(updated);
        return updated;
      });
    }

    try {
      const res = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId: activeSessionId }),
      });

      if (!res.ok) {
        let errorText = `Server error: ${res.status}`;
        try {
          const errData = (await res.json()) as { error?: string };
          if (errData?.error) errorText = errData.error;
        } catch { /* ignore */ }
        throw new Error(errorText);
      }

      const data = (await res.json()) as { reply: string; sessionId: string };
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "error",
        content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, activeSessionId]);

  const currentTitle = sessions.find((s) => s.sessionId === activeSessionId)?.title;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-gray-950 flex overflow-hidden">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`
        fixed inset-y-0 left-0 z-30 md:relative md:z-auto
        transition-transform duration-250
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:hidden"}
        w-[260px] md:w-60 flex-shrink-0
      `}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDelete={handleDeleteSession}
        />
      </div>

      {/* ── Main Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* ── Header ── */}
        <header className="flex-shrink-0 flex items-center justify-between
          px-4 sm:px-5 py-3 sm:py-4
          bg-gray-900/80 backdrop-blur-md
          border-b border-white/5
          z-10">

          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Hamburger */}
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen((v) => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                text-gray-400 hover:text-white hover:bg-white/10
                transition-all duration-150 flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex-shrink-0
              bg-gradient-to-br from-orange-500 to-amber-400
              flex items-center justify-center
              shadow-lg shadow-orange-500/25 text-base sm:text-lg">
              🤖
            </div>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-white leading-none truncate">
                CF AI Chat
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">
                {currentTitle ?? "New Conversation"} · Llama&nbsp;3.3
              </p>
            </div>
          </div>

          {/* Session badge — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600
              font-mono bg-gray-800/80 border border-white/5 rounded-full px-3 py-1"
              title={`Session: ${activeSessionId}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeSessionId.slice(0, 8)}…
            </span>
          </div>
        </header>

        {/* ── Chat Window ── */}
        <div className="flex-1 overflow-hidden">
          <ChatWindow messages={messages} isLoading={isLoading} />
        </div>

        {/* ── Input Bar ── */}
        <div className="flex-shrink-0 border-t border-white/5 bg-gray-900/60 backdrop-blur-md">
          <InputBar onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
