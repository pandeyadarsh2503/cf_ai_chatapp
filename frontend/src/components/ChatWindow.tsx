import { useEffect, useRef } from "react";
import type { Message } from "../App";
import MessageBubble from "./MessageBubble";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
}

// ─────────────────────────────────────────────
// Typing Indicator (animated pulsing dots)
// ─────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2"
      aria-label="AI is thinking"
      role="status"
    >
      {/* AI avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-sm shadow-md shadow-orange-500/20">
        🤖
      </div>

      {/* Dots bubble */}
      <div className="bg-gray-800 border border-gray-700/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 select-none">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-3xl mb-4 shadow-xl shadow-orange-500/30">
        🤖
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">
        How can I help you?
      </h2>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        Ask me anything. I remember our conversation and will give you concise,
        friendly answers powered by Llama&nbsp;3.3.
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
        {[
          "Explain quantum computing simply",
          "Write a Python hello world",
          "What is Cloudflare Workers?",
          "Give me 3 productivity tips",
        ].map((prompt) => (
          <div
            key={prompt}
            className="text-xs text-gray-400 bg-gray-800 border border-gray-700/60 rounded-xl px-3 py-2 text-left leading-relaxed"
          >
            {prompt}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ChatWindow Component
// ─────────────────────────────────────────────

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever messages or the loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div
      id="chat-window"
      className="h-full overflow-y-auto scrollbar-thin py-4 space-y-1"
      role="log"
      aria-live="polite"
      aria-label="Chat conversation"
    >
      {messages.length === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}
        </>
      )}

      {/* Anchor element to scroll into view */}
      <div ref={bottomRef} />
    </div>
  );
}
