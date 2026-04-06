import type { Message } from "../App";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
}

// ─────────────────────────────────────────────
// Helper: Format timestamp
// ─────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────
// MessageBubble Component
// ─────────────────────────────────────────────

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  // ── Error Bubble ────────────────────────────
  if (isError) {
    return (
      <div
        className="flex items-start gap-2 px-4 py-1"
        role="alert"
        aria-live="assertive"
      >
        {/* Error icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-900/50 border border-red-700/60 flex items-center justify-center text-sm">
          ⚠️
        </div>

        <div className="max-w-[78%] bg-red-900/30 border border-red-700/50 text-red-300 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
          <p className="font-medium text-red-400 text-xs mb-0.5">Error</p>
          {message.content}
        </div>
      </div>
    );
  }

  // ── User Bubble (right-aligned, blue) ────────
  if (isUser) {
    return (
      <div className="flex flex-row-reverse items-end gap-2 px-4 py-1">
        {/* User avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-600/20">
          You
        </div>

        <div className="flex flex-col items-end max-w-[78%]">
          <div
            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-md shadow-blue-600/20 break-words"
          >
            {message.content}
          </div>
          <span className="text-xs text-gray-600 mt-1 mr-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  // ── Assistant Bubble (left-aligned, grey) ────
  return (
    <div className="flex items-end gap-2 px-4 py-1">
      {/* AI avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-sm shadow-md shadow-orange-500/20">
        🤖
      </div>

      <div className="flex flex-col items-start max-w-[78%]">
        <div
          className="bg-gray-800 border border-gray-700/60 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm break-words"
        >
          {/* Render line breaks in AI responses */}
          {message.content.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-600 mt-1 ml-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
