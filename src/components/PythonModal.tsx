import { useState } from "react";
import { Check, Copy, Download, FileCode2, X } from "lucide-react";
import type { PythonBundle } from "../types/chat";

interface PythonModalProps {
  open: boolean;
  onClose: () => void;
  bundle: PythonBundle | null;
  loading: boolean;
  error: string | null;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function PythonModal({
  open,
  onClose,
  bundle,
  loading,
  error,
}: PythonModalProps) {
  const [activeTab, setActiveTab] = useState<"py" | "cfg">("py");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const currentCode =
    activeTab === "py" ? bundle?.pythonCode ?? "" : bundle?.configTemplate ?? "";
  const currentFilename =
    activeTab === "py"
      ? bundle?.pythonFilename ?? "vale_ai.py"
      : bundle?.configFilename ?? "nova_config.json";

  const handleCopy = async () => {
    if (!currentCode) return;
    await navigator.clipboard?.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="python-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-[#111c2e] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2563eb]/20 text-[#38bdf8] flex items-center justify-center">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="python-modal-title"
                className="font-display text-base font-bold text-white"
              >
                Python Tkinter Desktop Source
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Run the native desktop GUI locally with Python 3 and google-genai
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-2 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220]/40">
          <div className="flex items-center gap-1 p-1 bg-[#0b1220] rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab("py")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "py"
                  ? "bg-[#2563eb] text-white"
                  : "text-[#94a3b8] hover:text-white"
              }`}
            >
              vale_ai.py
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cfg")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === "cfg"
                  ? "bg-[#2563eb] text-white"
                  : "text-[#94a3b8] hover:text-white"
              }`}
            >
              nova_config.json
            </button>
          </div>

          {bundle && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e293b] hover:bg-[#273549] text-[#e2e8f0] border border-white/10 transition-colors whitespace-nowrap cursor-pointer"
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
              <button
                type="button"
                onClick={() => downloadTextFile(currentFilename, currentCode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {currentFilename}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5 bg-[#0b1220]">
          {loading && (
            <p className="text-sm text-[#94a3b8]">Loading Python files…</p>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {!loading && !error && bundle && (
            <pre className="font-mono text-xs leading-relaxed text-[#e2e8f0] whitespace-pre overflow-x-auto">
              <code>{currentCode}</code>
            </pre>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-[#111c2e] text-xs text-[#94a3b8] flex flex-wrap items-center justify-between gap-2">
          <span>
            Local setup: <code className="font-mono text-[#38bdf8]">pip install google-genai</code> then{" "}
            <code className="font-mono text-[#38bdf8]">python vale_ai.py</code>
          </span>
        </div>
      </div>
    </div>
  );
}
