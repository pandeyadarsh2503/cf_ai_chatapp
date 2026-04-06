import type { SessionMeta } from "../App";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SidebarProps {
  sessions: SessionMeta[];
  activeSessionId: string;
  isOpen: boolean;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────
// Session Item
// ─────────────────────────────────────────────

interface SessionItemProps {
  session: SessionMeta;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionItem({ session, isActive, onSelect, onDelete }: SessionItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`
        group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer
        transition-all duration-150 select-none
        ${isActive
          ? "bg-gray-800 border border-gray-600/60 shadow-sm"
          : "hover:bg-gray-800/50 border border-transparent"
        }
      `}
    >
      {/* Active left accent bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-orange-400 to-amber-500 rounded-r-full" />
      )}

      {/* Icon */}
      <div
        className={`
          flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs
          ${isActive ? "bg-orange-500/20 text-orange-400" : "bg-gray-700/60 text-gray-500"}
        `}
      >
        💬
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-medium truncate leading-tight ${
            isActive ? "text-white" : "text-gray-300 group-hover:text-gray-200"
          }`}
        >
          {session.title}
        </p>
        <p className="text-[10px] text-gray-600 mt-0.5">
          {formatDate(session.createdAt)}
          {session.messageCount > 0 && (
            <> &middot; {session.messageCount} msg{session.messageCount !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Delete button — shown on hover */}
      <button
        onClick={onDelete}
        title="Delete session"
        className="
          flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded
          flex items-center justify-center text-gray-500 hover:text-red-400
          hover:bg-red-900/30 transition-all duration-150
        "
        aria-label="Delete this session"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

export default function Sidebar({
  sessions,
  activeSessionId,
  isOpen,
  onSelect,
  onNewChat,
  onDelete,
}: SidebarProps) {
  if (!isOpen) return null;

  return (
    <aside
      className="
        w-60 flex-shrink-0 flex flex-col
        bg-gray-950/70 border-r border-gray-700/50
        transition-all duration-200
      "
      aria-label="Session history sidebar"
    >
      {/* ── New Chat Button ── */}
      <div className="px-3 py-4 border-b border-gray-700/50">
        <button
          id="new-chat-btn"
          onClick={onNewChat}
          className="
            w-full flex items-center justify-center gap-2 px-4 py-2.5
            bg-gradient-to-r from-orange-500 to-amber-400
            hover:from-orange-400 hover:to-amber-300
            text-white text-xs font-semibold rounded-xl
            transition-all duration-200 shadow-md shadow-orange-500/20
            hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0
          "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* ── Session Label ── */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Recent Sessions
        </p>
      </div>

      {/* ── Session List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <span className="text-3xl mb-3 opacity-40">💬</span>
            <p className="text-xs text-gray-600 leading-relaxed">
              No sessions yet.
              <br />
              Start a conversation!
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.sessionId}
              session={session}
              isActive={session.sessionId === activeSessionId}
              onSelect={() => onSelect(session.sessionId)}
              onDelete={(e) => {
                e.stopPropagation();
                onDelete(session.sessionId);
              }}
            />
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-gray-700/50">
        <p className="text-[10px] text-gray-700 text-center">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} stored locally
        </p>
      </div>
    </aside>
  );
}
