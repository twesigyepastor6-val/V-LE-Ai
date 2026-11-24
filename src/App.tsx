import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  BookOpen,
  Code2,
  FileCode2,
  FolderOpen,
  Lightbulb,
  FileText,
  Mail,
  Menu,
  MessageSquarePlus,
  Mic,
  MicOff,
  Plus,
  Save,
  SendHorizonal,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { MessageBubble } from "./components/MessageBubble";
import { PythonModal } from "./components/PythonModal";
import { TypingBubble } from "./components/TypingBubble";
import { useSpeechToText } from "./hooks/useSpeechToText";
import type {
  ChatMessage,
  PythonBundle,
  QuickAction,
  SavedSession,
} from "./types/chat";

const ASSISTANT_NAME = "V∆LE Ai";

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "email",
    label: "Email",
    prompt: "Help me write a professional email.",
  },
  {
    id: "code",
    label: "Code",
    prompt: "Explain this code in simple terms:\n\n",
  },
  {
    id: "study",
    label: "Study",
    prompt: "Explain this topic in simple terms:\n\n",
  },
  {
    id: "ideas",
    label: "Ideas",
    prompt: "Give me 5 practical business ideas for Kampala, Uganda.",
  },
];

function getTimeLabel(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
}

function createWelcomeMessage(text: string): ChatMessage {
  return {
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: text,
    timestamp: getTimeLabel(),
    ephemeral: true,
  };
}

function QuickActionIcon({ id }: { id: string }) {
  switch (id) {
    case "email":
      return <Mail className="w-4 h-4 shrink-0" />;
    case "code":
      return <Code2 className="w-4 h-4 shrink-0" />;
    case "study":
      return <BookOpen className="w-4 h-4 shrink-0" />;
    default:
      return <Lightbulb className="w-4 h-4 shrink-0" />;
  }
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(
      `Hi! I’m ${ASSISTANT_NAME}, your AI assistant.\n\nAsk me anything, or tap a quick action above.`
    ),
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState(false);

  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const [pythonOpen, setPythonOpen] = useState(false);
  const [pythonBundle, setPythonBundle] = useState<PythonBundle | null>(null);
  const [pythonLoading, setPythonLoading] = useState(false);
  const [pythonError, setPythonError] = useState<string | null>(null);

  const [attachment, setAttachment] = useState<import("./types/chat").ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const showToast = useCallback((text: string, ms = 1800) => {
    setToastText(text);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText(null);
    }, ms);
  }, []);

  const {
    isSupported: speechSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechToText({
    onTranscript: (text) => {
      setInput(text);
    },
    onError: (msg) => {
      showToast(msg, 2400);
    },
  });

  const handleToggleVoice = useCallback(() => {
    if (busy) return;
    if (isListening) {
      stopListening();
      inputRef.current?.focus();
    } else {
      startListening(input);
      inputRef.current?.focus();
    }
  }, [busy, input, isListening, startListening, stopListening]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("File is too large (max 10MB)", 2500);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setAttachment({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        content: result,
      });
      showToast(`Attached ${file.name}`);
      e.target.value = "";
    };
    reader.onerror = () => {
      showToast("Could not read file");
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        setSavedSessions(data.sessions);
      }
    } catch {
      // Ignore silent startup fetch failure
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleChatScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, showTyping]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileDrawerOpen(false);
        setPythonOpen(false);
      }
    };
    const handleEditPrompt = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; content: string }>;
      if (customEvent.detail?.content) {
        setInput(customEvent.detail.content);
        inputRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("vale-edit-prompt", handleEditPrompt as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("vale-edit-prompt", handleEditPrompt as EventListener);
    };
  }, []);

  // Auto-resize textarea cleanly
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [input]);

  const handleCopyMessage = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard");
      } catch {
        showToast("Could not copy text");
      }
    },
    [showToast]
  );

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(prompt.length, prompt.length);
      }
    });
  };

  const handleNewChat = () => {
    if (busy) return;
    setMenuOpen(false);
    setMobileDrawerOpen(false);
    setActiveSessionId(null);
    setMessages([
      createWelcomeMessage("New chat started.\n\nHow can I help you today?"),
    ]);
    inputRef.current?.focus();
  };

  const handleSaveChat = async () => {
    setMenuOpen(false);
    const recordable = messages.filter((m) => !m.ephemeral);
    if (recordable.length === 0) {
      showToast("Nothing to save yet");
      return;
    }

    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: recordable }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to save chat");
        return;
      }
      if (Array.isArray(data.sessions)) {
        setSavedSessions(data.sessions);
      }
      if (data.session?.id) {
        setActiveSessionId(data.session.id);
      }
      showToast("Chat saved");
    } catch {
      showToast("Could not save chat");
    }
  };

  const loadSession = useCallback(
    (session: SavedSession, toastMsg?: string) => {
      if (busy) return;
      setMenuOpen(false);
      setMobileDrawerOpen(false);
      setActiveSessionId(session.id);
      setMessages(
        session.messages.map((m, idx) => ({
          id: m.id || `loaded-${idx}-${Date.now()}`,
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          timestamp: m.timestamp || getTimeLabel(),
        }))
      );
      showToast(toastMsg || "Loaded saved chat");
    },
    [busy, showToast]
  );

  const handleLoadLatestChat = async () => {
    if (busy) return;
    setMenuOpen(false);
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      const sessions: SavedSession[] = Array.isArray(data.sessions)
        ? data.sessions
        : [];
      setSavedSessions(sessions);
      if (sessions.length === 0) {
        showToast("No saved chats yet");
        return;
      }
      loadSession(sessions[sessions.length - 1], "Loaded latest chat");
    } catch {
      showToast("Could not read saved chats");
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.sessions)) {
        setSavedSessions(data.sessions);
        if (activeSessionId === id) {
          setActiveSessionId(null);
        }
        showToast("Conversation removed");
      }
    } catch {
      showToast("Could not remove conversation");
    }
  };

  const openPythonModal = async () => {
    setMenuOpen(false);
    setMobileDrawerOpen(false);
    setPythonOpen(true);

    if (pythonBundle) return;
    setPythonLoading(true);
    setPythonError(null);
    try {
      const res = await fetch("/api/python-files");
      const data = await res.json();
      if (!res.ok) {
        setPythonError(data.error || "Could not load Python files.");
      } else {
        setPythonBundle(data);
      }
    } catch {
      setPythonError("Could not reach server to fetch Python source.");
    } finally {
      setPythonLoading(false);
    }
  };

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const sendMessage = async () => {
    if (busy) return;
    if (isListening) {
      stopListening();
    }
    const trimmed = input.trim();
    if (!trimmed && !attachment) return;

    const historySnapshot = messages
      .filter((m) => !m.ephemeral)
      .map((m) => ({ role: m.role, content: m.content }));

    const currentAttachment = attachment;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed || `[Attached document: ${currentAttachment?.name}]`,
      timestamp: getTimeLabel(),
      attachment: currentAttachment ?? undefined,
    };

    const controller = new AbortController();
    abortControllerRef.current = controller;
    shouldAutoScrollRef.current = true;

    setBusy(true);
    setInput("");
    setAttachment(null);
    setMessages((prev) => [...prev, userMsg]);
    setShowTyping(true);

    const assistantId = `assistant-${Date.now()}`;
    let assistantAdded = false;
    let accumulated = "";
    let rafPending = false;

    const flushAccumulated = () => {
      rafPending = false;
      const latestText = accumulated;
      if (!latestText) return;

      if (!assistantAdded) {
        assistantAdded = true;
        setShowTyping(false);
        setStreamingId(assistantId);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: latestText,
            timestamp: getTimeLabel(),
          },
        ]);
      } else {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;
          const next = prev.slice();
          next[idx] = { ...next[idx], content: latestText };
          return next;
        });
      }
    };

    const scheduleFlush = () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(flushAccumulated);
      }
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historySnapshot,
          attachment: currentAttachment,
        }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("text/event-stream")) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error ||
            "Sorry, I could not connect right now. Please check your configuration."
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response stream unavailable.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;

          const payload = JSON.parse(line.slice(6)) as {
            text?: string;
            done?: boolean;
            error?: string;
          };

          if (payload.error) {
            throw new Error(payload.error);
          }

          if (payload.text) {
            accumulated += payload.text;
            scheduleFlush();
          }
        }
      }

      if (rafPending || accumulated) {
        flushAccumulated();
      }

      if (!assistantAdded) {
        setShowTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "I didn't get a response. Please try again.",
            timestamp: getTimeLabel(),
          },
        ]);
      }
    } catch (err) {
      setShowTyping(false);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (accumulated) {
          flushAccumulated();
        }
        return;
      }

      const errMessage =
        err instanceof Error
          ? err.message
          : "Sorry, I could not connect right now.";

      if (assistantAdded) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `${accumulated}\n\n${errMessage}`.trim(),
                }
              : m
          )
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: errMessage,
            timestamp: getTimeLabel(),
          },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setShowTyping(false);
      setStreamingId(null);
      setBusy(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const recordableCount = messages.filter((m) => !m.ephemeral).length;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.07] space-y-2.5">
        <button
          type="button"
          onClick={handleNewChat}
          disabled={busy}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4 shrink-0" />
          <span>New Chat</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSaveChat}
            disabled={busy || recordableCount === 0}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1e293b] hover:bg-[#273549] disabled:opacity-45 text-[#e2e8f0] text-xs font-medium flex items-center justify-center gap-1.5 border border-white/[0.07] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span>Save Chat</span>
          </button>

          <button
            type="button"
            onClick={handleLoadLatestChat}
            disabled={busy || savedSessions.length === 0}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1e293b] hover:bg-[#273549] disabled:opacity-45 text-[#e2e8f0] text-xs font-medium flex items-center justify-center gap-1.5 border border-white/[0.07] transition-colors whitespace-nowrap cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span>Load Latest</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="px-2 py-1.5 flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold text-[#94a3b8]">
            Saved Chats
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#94a3b8]">
            {savedSessions.length}
          </span>
        </div>

        {loadingSessions ? (
          <p className="px-2 py-4 text-xs text-[#94a3b8]">
            Loading saved history…
          </p>
        ) : savedSessions.length === 0 ? (
          <div className="px-3 py-5 rounded-xl bg-[#0b1220]/50 border border-white/[0.05] text-xs text-[#94a3b8] leading-relaxed">
            No saved chats yet. Start a conversation and click Save Chat to
            store it in <span className="font-mono text-[#e2e8f0]">nova_chat_history.json</span>.
          </div>
        ) : (
          [...savedSessions].reverse().map((session) => {
            const isActive = activeSessionId === session.id;
            return (
              <div
                key={session.id}
                className={`group flex items-center gap-1 rounded-xl border transition-colors ${
                  isActive
                    ? "bg-[#1e293b] border-[#38bdf8]/40"
                    : "bg-transparent border-transparent hover:bg-[#1e293b]/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadSession(session)}
                  disabled={busy}
                  className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer"
                >
                  <p className="text-sm font-medium text-[#e2e8f0] truncate">
                    {session.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#94a3b8] flex items-center gap-1.5 font-mono tabular-nums">
                    <span>{session.saved_at.slice(0, 10)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{session.messages.length} msgs</span>
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSession(session.id)}
                  aria-label={`Delete ${session.title}`}
                  className="min-h-[40px] min-w-[36px] mr-1 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-rose-400 hover:bg-white/5 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-white/[0.07]">
        <button
          type="button"
          onClick={openPythonModal}
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#0b1220] hover:bg-[#1e293b] text-[#e2e8f0] border border-white/[0.07] text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <FileCode2 className="w-4 h-4 text-[#38bdf8] shrink-0" />
          <span>Python Desktop Source</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-dvh w-full flex bg-[#0b1220] text-[#e2e8f0] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-80 flex-col bg-[#111c2e] border-r border-white/[0.07] shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Saved chats drawer"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-80 max-w-[85vw] h-full bg-[#111c2e] border-r border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
              <span className="font-display font-bold text-base text-white">
                {ASSISTANT_NAME}
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0b1220] relative">
        {/* Gradient Header matching HEADER_TOP (#1d4ed8) -> HEADER_BOTTOM (#0ea5e9) */}
        <header
          className="shrink-0 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 shadow-md"
          style={{
            background: "linear-gradient(180deg, #1d4ed8 0%, #0ea5e9 100%)",
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 rounded-full bg-white text-[#1d4ed8] font-display font-bold text-xl flex items-center justify-center shrink-0 select-none shadow-sm"
              aria-hidden="true"
            >
              V
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight truncate">
                {ASSISTANT_NAME}
              </h1>
              <p className="text-xs sm:text-[13px] text-[#dbeafe] truncate">
                Your personal AI assistant
              </p>
            </div>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Open options menu"
              aria-expanded={menuOpen}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Menu className="w-6 h-6" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#111c2e] border border-white/10 shadow-2xl py-1.5 z-30">
                <button
                  type="button"
                  onClick={handleNewChat}
                  disabled={busy}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2563eb] disabled:opacity-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="w-4 h-4 text-[#38bdf8]" />
                  <span>New Chat</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveChat}
                  disabled={busy || recordableCount === 0}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2563eb] disabled:opacity-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#38bdf8]" />
                  <span>Save Chat</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadLatestChat}
                  disabled={busy}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2563eb] disabled:opacity-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-[#38bdf8]" />
                  <span>Load Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setMobileDrawerOpen(true);
                  }}
                  className="w-full lg:hidden px-4 py-2.5 text-left text-sm text-white hover:bg-[#2563eb] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-[#38bdf8]" />
                  <span>Saved Chats ({savedSessions.length})</span>
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={openPythonModal}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#2563eb] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4 text-[#38bdf8]" />
                  <span>Python Desktop Source</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Quick Actions Strip */}
        <div className="shrink-0 px-3 sm:px-6 pt-3 pb-2 border-b border-white/[0.05] bg-[#0b1220]">
          <div className="max-w-3xl mx-auto grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="min-h-[44px] px-2.5 sm:px-4 py-2 rounded-xl bg-[#111c2e] hover:bg-[#2563eb] text-[#38bdf8] hover:text-white font-display font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-white/[0.06] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                <QuickActionIcon id={action.id} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Chat Canvas */}
        <main
          ref={scrollContainerRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-5"
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCopy={handleCopyMessage}
                isStreaming={streamingId === msg.id}
              />
            ))}

            {showTyping && <TypingBubble />}
          </div>
        </main>

        {/* Toast Notification */}
        {toastText && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-24 left-1/2 lg:left-[calc(50%+10rem)] -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-[#38bdf8] text-[#0b1220] font-display font-bold text-xs sm:text-sm shadow-lg"
          >
            {toastText}
          </div>
        )}

        {/* Input Dock */}
        <footer className="shrink-0 bg-[#111c2e] border-t border-white/[0.07] px-3 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            {attachment && (
              <div className="mb-2 px-3 py-2 rounded-xl bg-[#1e293b] border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#2563eb]/20 text-[#38bdf8] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {attachment.name}
                    </p>
                    <p className="text-[10px] text-[#94a3b8] font-mono">
                      {Math.round(attachment.size / 1024)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="relative flex-1 flex items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,text/*,.txt,.md,.csv,.json,.js,.ts,.py"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  aria-label="Add document or image"
                  title="Add document or image"
                  className="absolute left-2.5 min-h-[36px] min-w-[36px] p-2 rounded-lg bg-transparent hover:bg-white/10 text-[#38bdf8] hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-45"
                >
                  <Plus className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleVoice}
                  disabled={busy}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={isListening}
                  title={
                    !speechSupported
                      ? "Voice input not supported in this browser"
                      : isListening
                        ? "Stop listening"
                        : "Voice input"
                  }
                  className={`absolute right-2.5 min-h-[36px] min-w-[36px] p-2 rounded-lg bg-transparent hover:bg-white/15 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-45 ${
                    isListening ? "text-rose-400 animate-pulse" : "text-[#38bdf8] hover:text-white"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    if (isListening) {
                      stopListening();
                    }
                    setInput(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isListening
                      ? "Listening… speak now"
                      : `Message ${ASSISTANT_NAME}…`
                  }
                  aria-label={`Message ${ASSISTANT_NAME}`}
                  className={`w-full min-h-[48px] max-h-[144px] resize-none rounded-xl bg-[#1e293b] text-white placeholder-[#94a3b8] pl-12 pr-12 py-3 text-[15px] leading-snug border focus:outline-none focus:ring-0 ${
                    isListening
                      ? "border-rose-500/70 placeholder-rose-300"
                      : "border-white/[0.06]"
                  }`}
                />
              </div>

              {busy ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  aria-label="Stop generating"
                  className="min-h-[48px] min-w-[44px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!input.trim() && !attachment}
                  aria-label="Send message"
                  className="min-h-[48px] min-w-[56px] px-4 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-45 disabled:hover:bg-[#2563eb] text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
                >
                  <SendHorizonal className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>

      <PythonModal
        open={pythonOpen}
        onClose={() => setPythonOpen(false)}
        bundle={pythonBundle}
        loading={pythonLoading}
        error={pythonError}
      />
    </div>
  );
}
