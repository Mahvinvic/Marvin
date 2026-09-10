import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `You are Waypoint, a warm, concise personal growth coach embedded in the user's habit and goal tracking app. You can see their current goals, today's tasks, and daily habits below — reference specific items by name when it's relevant. Keep replies short (2-4 sentences unless asked for more detail), practical, and encouraging without being saccharine.`;

const client = new Anthropic();

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it to .env and restart the server." });
    return;
  }

  const { messages, context } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }

  const trimmed = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: `${SYSTEM_PROMPT}\n\nCurrent app state:\n${context || "(no data yet)"}`,
      messages: trimmed,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    res.json({ reply: textBlock?.text ?? "" });
  } catch (err) {
    console.error("Anthropic API error:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(401).json({ error: "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY." });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "Rate limited by the Anthropic API — try again in a moment." });
    } else if (err instanceof Anthropic.BadRequestError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof Anthropic.APIError) {
      res.status(err.status || 500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Something went wrong talking to Claude." });
    }
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Waypoint chat server listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY is not set. Chat requests will fail until you add it to .env.");
  }
});
