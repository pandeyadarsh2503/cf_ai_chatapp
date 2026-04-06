import { useState, useRef, useCallback, type KeyboardEvent } from "react";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface InputBarProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

// ─────────────────────────────────────────────
// InputBar Component
// ─────────────────────────────────────────────

export default function InputBar({ onSend, isLoading }: InputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !isLoading;

  // Auto-resize textarea up to a max height
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      // Reset height to recalculate scroll height
      e.target.style.height = "auto";
      // Clamp to 160px max
      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    },
    []
  );

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const text = value;
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSend(text);
  }, [canSend, value, onSend]);

  // Send on Enter (not Shift+Enter)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="px-4 py-3">
      <div
        className={`
          flex items-end gap-2 bg-gray-800 border rounded-2xl px-4 py-2.5 transition-all duration-200
          ${isLoading
            ? "border-gray-700 opacity-80"
            : "border-gray-700/60 focus-within:border-blue-500/70 focus-within:shadow-lg focus-within:shadow-blue-500/10"
          }
        `}
      >
        {/* Textarea */}
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={isLoading ? "Waiting for response…" : "Type a message… (Enter to send, Shift+Enter for new line)"}
          rows={1}
          aria-label="Chat message input"
          className="
            flex-1 resize-none bg-transparent text-gray-100 placeholder-gray-500
            text-sm leading-relaxed outline-none min-h-[24px] max-h-[160px]
            disabled:cursor-not-allowed transition-colors duration-200
            scrollbar-thin
          "
          style={{ height: "auto" }}
        />

        {/* Send Button */}
        <button
          id="send-btn"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={`
            flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
            ${canSend
              ? "bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }
          `}
        >
          {isLoading ? (
            /* Spinner while loading */
            <svg
              className="w-4 h-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          ) : (
            /* Send icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Helper text */}
      <p className="text-center text-xs text-gray-600 mt-1.5">
        Press <kbd className="font-mono bg-gray-800 border border-gray-700 rounded px-1">Enter</kbd> to send ·{" "}
        <kbd className="font-mono bg-gray-800 border border-gray-700 rounded px-1">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
