import { callMarvinStream, marvinErrorResponse } from "./_marvin.js";

// Streams newline-delimited JSON events so the browser can show Marvin's
// reply as it's generated instead of waiting for the full round-trip:
//   {"type":"delta","text":"..."}       zero or more, as text is generated
//   {"type":"tool_calls","toolCalls":[...]}  when the model wants to act instead of reply
//   {"type":"done","reply":"..."}       terminal event with the final text
//   {"type":"error","error":"..."}      terminal event on failure
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "Server is missing NVIDIA_API_KEY. Set it in the project's environment variables." });
    return;
  }

  const { messages, context, toolChoice } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });

  try {
    const result = await callMarvinStream({ messages, context, toolChoice }, (text) => {
      res.write(JSON.stringify({ type: "delta", text }) + "\n");
    });

    if (result.toolCalls?.length) {
      res.write(JSON.stringify({ type: "tool_calls", toolCalls: result.toolCalls, reply: result.reply ?? null }) + "\n");
    } else {
      res.write(JSON.stringify({ type: "done", reply: result.reply || "" }) + "\n");
    }
  } catch (err) {
    const { error } = marvinErrorResponse(err);
    res.write(JSON.stringify({ type: "error", error }) + "\n");
  }

  res.end();
}
