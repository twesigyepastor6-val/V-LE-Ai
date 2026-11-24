import { isValidElement, memo, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];
import { Check, Copy, FileText, Pencil, Play, RotateCw, Share2, Square, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChatMessage } from "../types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  onCopy: (text: string) => void;
  isStreaming?: boolean;
}

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden bg-[#0b1220] border border-white/10 my-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111c2e] border-b border-white/10 text-xs text-[#94a3b8]">
        <span className="font-mono">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1 text-[#94a3b8] hover:text-white transition-colors py-0.5 px-1.5 rounded cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#22c55e]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[13px] leading-relaxed text-[#e2e8f0]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function extractCodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractCodeText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractCodeText(node.props.children);
  }
  return "";
}

function getMarkdownComponents(isUser: boolean): Components {
  return {
    pre({ children }) {
      let language = "code";
      let rawCode = "";

      if (isValidElement<{ className?: string; children?: ReactNode }>(children)) {
        const match = /language-([^\s]+)/.exec(children.props.className || "");
        if (match?.[1]) {
          language = match[1];
        }
        rawCode = extractCodeText(children.props.children).replace(/\n$/, "");
      } else {
        rawCode = extractCodeText(children).replace(/\n$/, "");
      }

      return <CodeBlock language={language} code={rawCode} />;
    },

    code({ className, children, ...props }) {
      const hasLanguage = Boolean(className && /language-/.test(className));
      if (hasLanguage) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code
          className={`font-mono text-[0.875em] px-1.5 py-0.5 rounded border ${
            isUser
              ? "bg-black/20 text-white border-white/20"
              : "bg-[#0b1220]/70 text-[#38bdf8] border-white/10"
          }`}
          {...props}
        >
          {children}
        </code>
      );
    },

    p({ children }) {
      return (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {children}
        </p>
      );
    },

    strong({ children }) {
      return (
        <strong className="font-semibold text-white">
          {children}
        </strong>
      );
    },

    em({ children }) {
      return <em className="italic">{children}</em>;
    },

    ul({ children }) {
      return (
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed marker:text-[#38bdf8]">
          {children}
        </ul>
      );
    },

    ol({ children }) {
      return (
        <ol className="list-decimal pl-5 space-y-1.5 text-[15px] leading-relaxed marker:font-mono marker:text-xs marker:text-[#38bdf8]">
          {children}
        </ol>
      );
    },

    li({ children }) {
      return <li className="break-words pl-0.5">{children}</li>;
    },

    h1({ children }) {
      return (
        <h3 className="font-display text-lg font-bold text-white mt-2 mb-1">
          {children}
        </h3>
      );
    },

    h2({ children }) {
      return (
        <h4 className="font-display text-base font-bold text-white mt-2 mb-1">
          {children}
        </h4>
      );
    },

    h3({ children }) {
      return (
        <h5 className="font-display text-[15px] font-bold text-white mt-1.5 mb-0.5">
          {children}
        </h5>
      );
    },

    blockquote({ children }) {
      return (
        <blockquote
          className={`rounded-xl px-3.5 py-2.5 text-sm border ${
            isUser
              ? "bg-black/15 border-white/20 text-white"
              : "bg-[#0b1220]/50 border-white/10 text-[#cbd5e1]"
          }`}
        >
          {children}
        </blockquote>
      );
    },

    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline underline-offset-2 transition-colors ${
            isUser
              ? "text-white hover:text-[#dcfce7]"
              : "text-[#38bdf8] hover:text-[#7dd3fc]"
          }`}
        >
          {children}
        </a>
      );
    },

    table({ children }) {
      return (
        <div
          className="overflow-x-auto my-2 rounded-xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <table className="w-full text-left text-xs border-collapse">
            {children}
          </table>
        </div>
      );
    },

    th({ children }) {
      return (
        <th className="px-3 py-2 font-display font-semibold bg-[#0b1220] text-white border-b border-white/10">
          {children}
        </th>
      );
    },

    td({ children }) {
      return (
        <td className="px-3 py-2 border-b border-white/[0.06] text-[#e2e8f0]">
          {children}
        </td>
      );
    },
  };
}

export const MessageBubble = memo(
  function MessageBubble({
    message,
    onCopy,
    isStreaming = false,
  }: MessageBubbleProps) {
    const isUser = message.role === "user";
    const components = useMemo(() => getMarkdownComponents(isUser), [isUser]);

    const [copied, setCopied] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [liked, setLiked] = useState<boolean | null>(null);

    const handleCopyClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopy(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };

    const handleShareClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (navigator.share) {
          await navigator.share({
            title: "V∆LE Ai Response",
            text: message.content,
          });
        } else {
          await navigator.clipboard.writeText(message.content);
          alert("Copied message to share");
        }
      } catch {
        // Ignore share abort
      }
    };

    const handleSpeakClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      const synth = window.speechSynthesis;
      if (speaking) {
        synth.cancel();
        setSpeaking(false);
        return;
      }

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
    };

    const handleRegenerateClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Dispatched via custom event or handled if callback provided
      window.dispatchEvent(
        new CustomEvent("vale-regenerate", { detail: { id: message.id } })
      );
    };

    return (
      <div
        className={`flex items-start gap-3 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >


        <div
          role="button"
          tabIndex={0}
          onClick={() => onCopy(message.content)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCopy(message.content);
            }
          }}
          title="Click to copy message"
          className={`group relative max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] bg-[#1e293b] hover:bg-[#243247] border border-white/[0.06] text-[#e2e8f0] ${
            isUser ? "rounded-tr-md" : "rounded-tl-md"
          }`}
        >


          {message.attachment && (
            <div className="mb-2.5 rounded-xl bg-black/20 border border-white/10 p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[#38bdf8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">
                  {message.attachment.name}
                </p>
                <p className="text-[10px] text-[#94a3b8] font-mono">
                  {Math.round(message.attachment.size / 1024)} KB
                </p>
              </div>
            </div>
          )}

          <div className={`space-y-2.5 ${isUser ? "text-white" : "text-[#e2e8f0]"}`}>
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              components={components}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <div
              className={`text-[11px] font-mono tabular-nums ${
                isUser ? "text-[#dcfce7]" : "text-[#94a3b8]"
              }`}
            >
              {isStreaming ? <span>Writing…</span> : <span>{message.timestamp}</span>}
            </div>

            {!isUser && (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={handleCopyClick}
                  title="Copy"
                  className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleShareClick}
                  title="Share"
                  className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSpeakClick}
                  title={speaking ? "Stop speaking" : "Read aloud"}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    speaking ? "text-[#38bdf8] bg-white/10" : "text-[#94a3b8] hover:text-white hover:bg-white/10"
                  }`}
                >
                  {speaking ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLiked(liked === true ? null : true)}
                  title="Thumbs up"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    liked === true ? "text-[#22c55e] bg-white/10" : "text-[#94a3b8] hover:text-white hover:bg-white/10"
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLiked(liked === false ? null : false)}
                  title="Thumbs down"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    liked === false ? "text-rose-400 bg-white/10" : "text-[#94a3b8] hover:text-white hover:bg-white/10"
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateClick}
                  title="Regenerate"
                  className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            {isUser && (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("vale-edit-prompt", {
                        detail: { id: message.id, content: message.content },
                      })
                    );
                  }}
                  title="Edit prompt"
                  className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.timestamp === next.message.timestamp &&
    prev.isStreaming === next.isStreaming &&
    prev.onCopy === next.onCopy
);
