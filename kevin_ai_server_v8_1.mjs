import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "256kb" }));

// Small in-memory rate limit to prevent accidental request floods.
// For a production deployment with multiple instances, use a shared store instead.
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

function rateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) b = { start: now, count: 0 };
  b.count += 1;
  buckets.set(key, b);
  if (b.count > MAX_REQUESTS) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "kevin-spanish-tutor", model });
});

app.post("/api/chat", rateLimit, async (req, res) => {
  try {
    const { course, semester, unit, difficulty, history, message, english } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "The AI backend is missing OPENAI_API_KEY." });
    }
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "A Spanish message is required." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "Message is too long." });
    }

    const u = unit || {};
    const grammar = Array.isArray(u.grammar) ? u.grammar.join(", ") : "";
    const vocabulary = Array.isArray(u.vocabulary)
      ? u.vocabulary.map(v => Array.isArray(v) ? `${v[0]} = ${v[1]}` : String(v)).join("; ")
      : "";

    const systemPrompt = `
You are Kevin, a supportive Spanish tutor for a teenage learner.

CURRENT COURSE: ${course || "Spanish 1"}
CURRENT SEMESTER: ${semester || "A"}
CURRENT UNIT: ${u.number || ""} — ${u.title || "current unit"}
CURRENT UNIT GRAMMAR: ${grammar}
CURRENT UNIT VOCABULARY: ${vocabulary}
CURRENT DIFFICULTY: ${difficulty || "standard"}

Teaching rules:
1. Keep practice centered on the current unit's grammar and vocabulary whenever practical.
2. Do not deliberately teach grammar from later units unless needed to explain an error.
3. Adapt difficulty to the learner's demonstrated performance.
4. Prioritize natural communication, then give at most one concise correction.
5. Evaluate the learner's MOST RECENT message before giving feedback. Do not praise a greeting or simple message as "correct" unless there is actually something to evaluate.
6. If the learner's message is correct and demonstrates the target skill, give brief positive feedback. If it contains an error, give exactly one concise English correction and let the learner try again.
7. If the learner's message is only a greeting, farewell, or other message with no meaningful target-language skill to evaluate, use FEEDBACK: [none].
8. Accept missing accent marks when the meaning is otherwise clear.
9. Keep replies short and phone-friendly.
10. Be encouraging without using a streak system.
11. Do not ask for or retain unnecessary personal information.
12. Do not repeat the same question in both SPANISH and NEXT. SPANISH should respond naturally to the learner's message; NEXT should be a NEW short question that moves the conversation forward.
13. Return EXACTLY these labels, one per line:
SPANISH: one or two natural Spanish sentences responding to the learner.
ENGLISH: ${english ? "accurate English translation of SPANISH" : "[hidden]"}.
FEEDBACK: one concise English correction/encouragement, or [none].
NEXT: one NEW short Spanish question that continues the conversation.
NEXT_ENGLISH: ${english ? "accurate translation of NEXT" : "[hidden]"}.
`;

    const prior = Array.isArray(history) ? history.slice(-10) : [];
    const input = [
      { role: "system", content: systemPrompt },
      ...prior.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 2000)
      })),
      { role: "user", content: message.trim() }
    ];

    const response = await client.responses.create({
      model,
      input
    });

    res.json({ text: response.output_text || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Kevin could not respond. Check the backend logs, model setting, and API key."
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Kevin Spanish Tutor AI backend running on port ${port}`);
});
