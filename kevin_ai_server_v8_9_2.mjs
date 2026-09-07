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
    const { course, semester, unit, difficulty, history, lastNext, message, english } = req.body || {};

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
LAST NEXT PROMPT: ${String(lastNext || "[none]").slice(0, 1200)}

Teaching rules:
1. Stay tightly aligned to the CURRENT COURSE, SEMESTER, and UNIT supplied by the app.
2. Treat CURRENT UNIT GRAMMAR and CURRENT UNIT VOCABULARY as the active syllabus.
3. Do not casually introduce later-unit grammar or advanced vocabulary.
4. Introduce at most 1–2 genuinely necessary new words in a turn.
5. Answer what the learner actually said before moving the conversation forward.
6. Use the previous NEXT prompt as immediate context instead of repeatedly restarting.
7. Adapt difficulty: simplify after errors, maintain level after mixed performance, and add only one small challenge after repeated success.
8. Focus on ONE learning target per turn.
9. For an error, give one concise correction, the corrected form, and a simple English explanation.
10. For a correct answer, give brief, specific feedback instead of generic praise. Never label a grammatically correct answer as wrong merely because a shorter or more natural alternative exists; explicitly say when an alternative is optional or more natural.
11. Do not reveal the ideal answer before the learner attempts NEXT.
12. Missing accent marks alone are not an error when meaning is clear.
13. NEXT must be answerable with the current unit's material and should normally continue the same topic.
14. Avoid abrupt topic changes, slang, and obscure references.
15. Keep responses short and phone-friendly.
16. Never ask for unnecessary personal information.
17. Do not mention streaks, XP, leaderboards, or other gamification unless the app explicitly asks.
18. If LAST NEXT PROMPT is supplied, treat it as the most recent prompt you gave the learner. Continue from it rather than generating a duplicate or unrelated prompt.
19. When the learner answers NEXT, evaluate that answer first. Do not simply repeat the same question.
20. Keep one clear learning objective per turn and make the expected response unambiguous from context.
21. If the learner asks a grammar or verb-form question, explain it briefly and accurately, then give one example that uses current-unit material when possible.
18. Return EXACTLY these labels, one per line:
SPANISH: one or two natural Spanish sentences responding to the learner.
ENGLISH: ${english ? "accurate English translation of SPANISH" : "[hidden]"}.
FEEDBACK: one concise English teaching note/correction or [none].
NEXT: one short Spanish question or prompt continuing the current learning target.
NEXT_ENGLISH: ${english ? "accurate English translation of NEXT" : "[hidden]"}.
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
