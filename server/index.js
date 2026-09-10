import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const MODEL = process.env.NVIDIA_NIM_MODEL || "nvidia/nemotron-3-super-120b-a12b";
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `You are Marvin, a warm, concise personal growth coach embedded in the user's habit and goal tracking app. You can see their current goals, today's tasks, and daily habits below — reference specific items by name when it's relevant. Keep replies short (2-4 sentences unless asked for more detail), practical, and encouraging without being saccharine.`;

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "missing-key",
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", async (req, res) => {
  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "Server is missing NVIDIA_API_KEY. Add it to .env and restart the server." });
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
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent app state:\n${context || "(no data yet)"}` },
        ...trimmed,
      ],
    });

    res.json({ reply: response.choices[0]?.message?.content ?? "" });
  } catch (err) {
    console.error("NVIDIA NIM API error:", err);
    if (err instanceof OpenAI.AuthenticationError) {
      res.status(401).json({ error: "The server's NVIDIA API key was rejected. Check NVIDIA_API_KEY." });
    } else if (err instanceof OpenAI.RateLimitError) {
      res.status(429).json({ error: "Rate limited by NVIDIA NIM — try again in a moment." });
    } else if (err instanceof OpenAI.BadRequestError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof OpenAI.APIError) {
      res.status(err.status || 500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Something went wrong talking to Marvin." });
    }
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Marvin chat server listening on http://localhost:${PORT}`);
  if (!process.env.NVIDIA_API_KEY) {
    console.warn("Warning: NVIDIA_API_KEY is not set. Chat requests will fail until you add it to .env.");
  }
});
