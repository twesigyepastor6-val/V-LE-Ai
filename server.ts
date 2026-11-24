import "dotenv/config";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const PORT = Number(process.env.PORT) || 3000;
const ASSISTANT_NAME = "V∆LE Ai";
const PRIMARY_MODEL = "gemini-4-hydrogen";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const MAX_HISTORY_TURNS = 30;
const COOLDOWN_MS = 60_000;

const SYSTEM_PROMPT = `You are ${ASSISTANT_NAME}, a friendly, intelligent, and helpful AI assistant.

Rules:
- Be clear, concise, and useful.
- Use short paragraphs and bullet points when helpful.
- If you do not know something, say so honestly.
- Never ask for passwords, PINs, card numbers, bank codes, or private identification numbers.
- Do not pretend to access the user's phone, files, contacts, camera, or accounts.
- Give practical, actionable answers.
- For coding, provide complete working examples when useful.
`;

const HISTORY_FILE = path.resolve(process.cwd(), "nova_chat_history.json");
const PYTHON_SOURCE_FILE = path.resolve(
  process.cwd(),
  "public/assets/aistudio/Animated_App_2eef2afc.txt"
);

type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type SavedSession = {
  id: string;
  title: string;
  saved_at: string;
  messages: StoredMessage[];
};

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;
let primaryCooldownUntil = 0;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it in Settings > Secrets."
    );
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedClient;
}

function isTransientCapacityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return (
    status === 503 ||
    status === 429 ||
    msg.includes('"code":503') ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand")
  );
}

function extractFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let extracted = raw;

  try {
    const outer = JSON.parse(raw);
    if (outer?.error?.message) {
      extracted = outer.error.message;
      try {
        const inner = JSON.parse(extracted);
        if (inner?.error?.message) {
          extracted = inner.error.message;
        }
      } catch {
        // Inner message is already plain text
      }
    }
  } catch {
    // Raw message is already plain text
  }

  if (
    extracted.includes("API_KEY_INVALID") ||
    extracted.includes("PERMISSION_DENIED") ||
    extracted.includes("API key")
  ) {
    return "Gemini API authentication failed. Please check your API key in Settings > Secrets.";
  }
  if (extracted.includes("RESOURCE_EXHAUSTED") || extracted.includes("429")) {
    return "Rate limit reached right now. Please wait a moment and try again.";
  }
  if (extracted.includes("high demand") || extracted.includes("UNAVAILABLE")) {
    return "The AI model is temporarily busy due to high demand. Please try again in a moment.";
  }
  return extracted || "Unable to reach Gemini right now. Please try again.";
}

async function readHistoryFile(): Promise<SavedSession[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, idx) => ({
      id: typeof item.id === "string" ? item.id : `legacy-${idx}-${Date.now()}`,
      title:
        typeof item.title === "string" && item.title.trim()
          ? item.title
          : deriveSessionTitle(item.messages),
      saved_at:
        typeof item.saved_at === "string"
          ? item.saved_at
          : new Date().toISOString(),
      messages: Array.isArray(item.messages) ? item.messages : [],
    }));
  } catch {
    return [];
  }
}

async function writeHistoryFile(sessions: SavedSession[]): Promise<void> {
  await fs.writeFile(
    HISTORY_FILE,
    JSON.stringify(sessions, null, 2),
    "utf-8"
  );
}

async function generateSmartTitle(
  ai: GoogleGenAI,
  messages: StoredMessage[]
): Promise<string> {
  const userMessages = messages
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => m.content.trim())
    .filter(Boolean);

  if (userMessages.length === 0) return "Saved Conversation";

  const firstFew = userMessages.slice(0, 3).join("\n- ");
  const prompt = `Summarize the following chat conversation into a very short, catchy title (maximum 5 words, no quotes, no punctuation at end):\n- ${firstFew}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: "You are a concise title generator. Output only the short title.",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });

    const titleText = (response.text ?? "").replace(/["'\n]/g, "").trim();
    if (titleText && titleText.length <= 50) {
      return titleText;
    }
  } catch {
    // Fall back to heuristic title on any network or quota error
  }

  const fallbackLine = userMessages[0].replace(/\s+/g, " ").trim();
  return fallbackLine.length > 36 ? `${fallbackLine.slice(0, 36)}…` : fallbackLine;
}

function deriveSessionTitle(messages: unknown): string {
  if (!Array.isArray(messages)) return "Saved Conversation";
  const firstUser = messages.find(
    (m) =>
      m &&
      typeof m === "object" &&
      (m as { role?: string }).role === "user" &&
      typeof (m as { content?: string }).content === "string"
  ) as { content: string } | undefined;

  if (!firstUser) return "Saved Conversation";
  const singleLine = firstUser.content.replace(/\s+/g, " ").trim();
  return singleLine.length > 36 ? `${singleLine.slice(0, 36)}…` : singleLine;
}

function formatNowTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mon = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mon}-${dd} ${hh}:${mm}:${ss}`;
}

async function openModelStream(
  ai: GoogleGenAI,
  model: string,
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
  userMessage: string
) {
  const thinkingLevel =
    model === FALLBACK_MODEL ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      thinkingConfig: {
        thinkingLevel,
      },
    },
    history: contents,
  });

  return chat.sendMessageStream({
    message: userMessage,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, assistant: ASSISTANT_NAME, model: PRIMARY_MODEL });
  });

  // Streaming Gemini chat endpoint
  app.post("/api/chat", async (req, res) => {
    const { message, history, attachment } = req.body ?? {};

    if (
      (typeof message !== "string" || !message.trim()) &&
      (!attachment || typeof attachment.content !== "string")
    ) {
      res.status(400).json({ error: "Message text or document attachment is required." });
      return;
    }

    const rawHistory = Array.isArray(history)
      ? history.slice(-MAX_HISTORY_TURNS)
      : [];
    const contents: Array<{
      role: "user" | "model";
      parts: Array<any>;
    }> = [];

    for (const item of rawHistory) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.content === "string" &&
        item.content.trim()
      ) {
        const role = item.role === "user" ? "user" : "model";
        contents.push({
          role,
          parts: [{ text: item.content }],
        });
      }
    }

    // Build parts for the current message
    const currentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    const messageText = typeof message === "string" ? message.trim() : "";
    if (messageText) {
      currentParts.push({ text: messageText });
    }

    if (
      attachment &&
      typeof attachment === "object" &&
      typeof attachment.content === "string" &&
      typeof attachment.type === "string"
    ) {
      // attachment.content may be "data:image/png;base64,iVBOR..." or raw base64
      let mimeType = attachment.type || "application/octet-stream";
      let base64Data = attachment.content;
      const commaIdx = base64Data.indexOf(",");
      if (commaIdx !== -1) {
        const header = base64Data.slice(0, commaIdx);
        const match = header.match(/data:([^;]+);base64/);
        if (match?.[1]) {
          mimeType = match[1];
        }
        base64Data = base64Data.slice(commaIdx + 1);
      }

      currentParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });

      if (!messageText) {
        currentParts.unshift({
          text: `Please analyze this attached document (${attachment.name || "file"}):`,
        });
      }
    }

    contents.push({
      role: "user",
      parts: currentParts,
    });

    // Gemini multi-turn history must begin with a user turn.
    while (contents.length > 0 && contents[0].role !== "user") {
      contents.shift();
    }

    let ai: GoogleGenAI;
    try {
      ai = getAiClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initialize Gemini client.";
      res.status(500).json({ error: msg });
      return;
    }

    let aborted = false;
    res.on("close", () => {
      if (!res.writableEnded) {
        aborted = true;
      }
    });

    req.socket?.setNoDelay(true);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const trimmedMessage = message.trim();
    const useFallbackFirst = Date.now() < primaryCooldownUntil;
    const candidateModels = useFallbackFirst
      ? [FALLBACK_MODEL, PRIMARY_MODEL]
      : [PRIMARY_MODEL, FALLBACK_MODEL];

    try {
      let lastError: unknown;
      let streamed = false;

      for (const model of candidateModels) {
        if (aborted) break;
        let emittedAnyChunk = false;

        try {
          const stream = await openModelStream(ai, model, contents as any, trimmedMessage);

          for await (const chunk of stream) {
            if (aborted) break;
            const text = chunk.text ?? "";
            if (text) {
              emittedAnyChunk = true;
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }

          streamed = true;
          break;
        } catch (err) {
          lastError = err;
          if (!emittedAnyChunk && isTransientCapacityError(err)) {
            if (model === PRIMARY_MODEL) {
              primaryCooldownUntil = Date.now() + COOLDOWN_MS;
            }
            continue;
          }
          throw err;
        }
      }

      if (!streamed && lastError) {
        throw lastError;
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err) {
      if (aborted) return;
      console.error("Gemini API error:", err);
      const errorMessage = extractFriendlyError(err);
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  });

  // Persistent chat history endpoints (mirrors nova_chat_history.json)
  app.get("/api/chats", async (_req, res) => {
    try {
      const sessions = await readHistoryFile();
      res.json({ sessions });
    } catch (err) {
      console.error("Read history error:", err);
      res.status(500).json({ error: "Could not read saved chats." });
    }
  });

  app.post("/api/chats", async (req, res) => {
    try {
      const { messages, title } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "Nothing to save yet." });
        return;
      }

      const sanitizedMessages: StoredMessage[] = messages
        .filter(
          (m) =>
            m &&
            typeof m === "object" &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .map((m, idx) => ({
          id: typeof m.id === "string" ? m.id : `msg-${Date.now()}-${idx}`,
          role: m.role,
          content: m.content,
          timestamp: typeof m.timestamp === "string" ? m.timestamp : "",
        }));

      if (sanitizedMessages.length === 0) {
        res.status(400).json({ error: "Nothing to save yet." });
        return;
      }

      let ai: GoogleGenAI;
      try {
        ai = getAiClient();
      } catch {
        ai = null as unknown as GoogleGenAI;
      }

      const resolvedTitle =
        typeof title === "string" && title.trim()
          ? title.trim()
          : ai
            ? await generateSmartTitle(ai, sanitizedMessages)
            : deriveSessionTitle(sanitizedMessages);

      const sessions = await readHistoryFile();
      const newSession: SavedSession = {
        id: `chat-${Date.now()}`,
        title: resolvedTitle,
        saved_at: formatNowTime(),
        messages: sanitizedMessages,
      };

      sessions.push(newSession);
      await writeHistoryFile(sessions);

      res.status(201).json({ session: newSession, sessions });
    } catch (err) {
      console.error("Save history error:", err);
      res.status(500).json({ error: "Failed to save chat." });
    }
  });

  app.delete("/api/chats/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sessions = await readHistoryFile();
      const filtered = sessions.filter((s) => s.id !== id);
      await writeHistoryFile(filtered);
      res.json({ sessions: filtered });
    } catch (err) {
      console.error("Delete history error:", err);
      res.status(500).json({ error: "Failed to delete chat." });
    }
  });

  // Expose desktop Python script & safe config template
  app.get("/api/python-files", async (_req, res) => {
    try {
      const pythonCode = await fs.readFile(PYTHON_SOURCE_FILE, "utf-8");
      const configTemplate = JSON.stringify(
        {
          api_key: "PASTE_YOUR_GEMINI_API_KEY_HERE",
          model: "gemini-2.5-flash",
          assistant_name: "V∆LE Ai",
          screen_width: 720,
          screen_height: 1612,
          title_font_size: 30,
          small_font_size: 18,
          message_font_size: 24,
          input_font_size: 24,
          button_font_size: 28,
          header_height: 120,
          user_bubble_margin: 80,
          agent_bubble_margin: 40,
          bubble_padding: 20,
        },
        null,
        2
      );

      res.json({
        pythonFilename: "vale_ai.py",
        pythonCode,
        configFilename: "nova_config.json",
        configTemplate,
      });
    } catch (err) {
      console.error("Python bundle read error:", err);
      res.status(500).json({ error: "Python source file not available." });
    }
  });

  if (process.env.NODE_ENV === "production") {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`V∆LE Ai server running at http://localhost:${PORT}`);
  });
}

startServer();
