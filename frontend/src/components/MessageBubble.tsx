import React from "react";
import type { Message } from "../App";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
}

// ─────────────────────────────────────────────
// Helper 1: Format timestamp
// ─────────────────────────────────────────────

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────
// Helper 2: Custom Markdown Formatter
// ─────────────────────────────────────────────
// A lightweight fallback parser to avoid npm dependencies while meeting UI requirements.

function renderMarkdown(text: string) {
  // Split the text by a greedy markdown code block regex
  const blocks = text.split(/(```[\s\S]*?```)/g);

  return blocks.map((block, i) => {
    // 1. If it's a code block
    if (block.startsWith("```") && block.endsWith("```")) {
      // Remove backticks and the optional language identifier on the first line
      const codeOnly = block.slice(3, -3).replace(/^[^\n]*\n/, "");
      return (
        <code key={i} className="msg-code-block scrollbar-thin">
          {codeOnly}
        </code>
      );
    }

    // 2. Otherwise it's normal text. We split it by inline code.
    const inlineParts = block.split(/(`[^`]+`)/g);

    return (
      <span key={i}>
        {inlineParts.map((part, j) => {
          // If inline code
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code key={j} className="msg-code-inline">
                {part.slice(1, -1)}
              </code>
            );
          }

          // 3. Otherwise, parse bold and newlines
          const textParts = part.split(/(\*\*[^*]+\*\*)/g);
          return (
            <React.Fragment key={j}>
              {textParts.map((tPart, k) => {
                if (tPart.startsWith("**") && tPart.endsWith("**")) {
                  return (
                    <strong key={k} className="font-semibold text-white">
                      {tPart.slice(2, -2)}
                    </strong>
                  );
                }

                // Render newlines as <br/>
                return tPart.split("\n").map((line, l, arr) => (
                  <React.Fragment key={l}>
                    {line}
                    {l < arr.length - 1 && <br />}
                  </React.Fragment>
                ));
              })}
            </React.Fragment>
          );
        })}
      </span>
    );
  });
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
        className="flex items-start gap-2 px-4 py-2 msg-animate"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-900/50 border border-red-700/60 flex items-center justify-center text-sm shadow-md mt-0.5">
          ⚠️
        </div>

        <div className="max-w-[85%] sm:max-w-[78%] bg-red-900/30 border border-red-700/50 text-red-300 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
          <p className="font-medium text-red-400 text-xs mb-0.5">Error</p>
          {message.content}
        </div>
      </div>
    );
  }

  // ── User Bubble (right-aligned, blue) ────────
  if (isUser) {
    return (
      <div className="flex flex-row-reverse items-end gap-2 px-3 sm:px-4 py-2 msg-animate">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-blue-600/30">
          YOU
        </div>

        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[78%] min-w-0">
          <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-md shadow-blue-600/20 break-words whitespace-pre-wrap">
            {message.content}
          </div>
          <span className="text-[10px] sm:text-xs text-gray-500 mt-1 mr-1.5 opacity-80">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  // ── Assistant Bubble (left-aligned, grey) ────
  return (
    <div className="flex items-end gap-2 px-3 sm:px-4 py-2 msg-animate">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-sm shadow-md shadow-orange-500/30 border border-orange-400/20">
        🤖
      </div>

      <div className="flex flex-col items-start max-w-[85%] sm:max-w-[78%] min-w-0 w-full">
        <div className="bg-[#1e2329] border border-gray-700/60 text-[#e6edf3] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-[1.65] shadow-sm break-words w-full overflow-hidden">
          {renderMarkdown(message.content)}
        </div>
        <span className="text-[10px] sm:text-xs text-gray-500 mt-1 ml-1.5 opacity-80">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
