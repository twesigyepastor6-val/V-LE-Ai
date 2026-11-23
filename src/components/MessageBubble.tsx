import { isValidElement, memo, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];
import { Check, Copy } from "lucide-react";
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

    return (
      <div
        className={`flex items-start gap-3 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        {!isUser && (
          <div
            className="w-9 h-9 rounded-full bg-[#38bdf8] text-white font-display font-bold text-sm flex items-center justify-center shrink-0 select-none mt-0.5"
            aria-hidden="true"
          >
            V
          </div>
        )}

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
          className={`group relative max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] ${
            isUser
              ? "bg-[#22c55e] hover:bg-[#1fb355] text-white rounded-tr-md"
              : "bg-[#1e293b] hover:bg-[#243247] border border-white/[0.06] text-[#e2e8f0] rounded-tl-md"
          }`}
        >
          {!isUser && (
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="font-display text-[11px] font-bold tracking-wider text-[#38bdf8]">
                V∆LE AI
              </span>
              <Copy className="w-3.5 h-3.5 text-[#94a3b8] opacity-0 group-hover:opacity-100 transition-opacity" />
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

          <div
            className={`mt-1.5 flex items-center justify-end gap-1.5 text-[11px] font-mono tabular-nums ${
              isUser ? "text-[#dcfce7]" : "text-[#94a3b8]"
            }`}
          >
            {isStreaming ? <span>Writing…</span> : <span>{message.timestamp}</span>}
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
