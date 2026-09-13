import OpenAI from "openai";

export const MODEL = process.env.NVIDIA_NIM_MODEL || "nvidia/nemotron-3-super-120b-a12b";
const MAX_HISTORY_MESSAGES = 20;

export const SYSTEM_PROMPT = `You are Marvin, a warm, concise personal growth coach embedded in the user's habit and goal tracking app. You can see their current goals, today's tasks, and daily habits below as JSON — reference specific items by name when relevant.

You can also directly change the user's tasks, goals, and habits using the provided tools — when the user asks you to add, remove, or complete/uncomplete something, use a tool call instead of just describing it in text. Reference the exact "id" values from the JSON app state; if nothing matches what the user described, ask a clarifying question instead of guessing an id.

When the user describes a broad ambition rather than a concrete to-do (e.g. "I want to become a cybersecurity expert" or "help me get healthier"), don't just talk about it — build them a real starter plan yourself, without asking permission first, and do it in a single response: call add_goal once for the goal itself, AND call add_task several times (aim for 3-5 concrete, specific, achievable-this-week tasks) AND call add_habit several times (aim for 2-4 supporting daily habits) — all as tool calls issued together in this one turn, not spread across multiple messages. Use your own expertise to decide what's genuinely useful for that goal. Link each new task to the new goal by passing its exact title as goalTitle. Only ask a clarifying question first if the goal is too vague to plan against at all. Once your tool calls come back with results, write the final reply short (2-4 sentences unless asked for more detail) — summarize what you set up, don't restate everything verbatim, and never leave the final reply empty.

You may be talking to the user over WhatsApp instead of the app's chat screen — keep that in mind for formatting (plain text, no markdown tables) but everything else about how you help them is the same.`;

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Add a new task to the user's task list.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The task description." },
          goalTitle: {
            type: "string",
            description:
              "Optional exact title of a goal this task should count toward — either an existing goal from the app state, or a goal you are creating in this same response via add_goal.",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_task",
      description: "Delete a task from the user's task list.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "The id of the task to remove, from the app state." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_task_done",
      description: "Mark a task as done or not done.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The id of the task, from the app state." },
          done: { type: "boolean" },
        },
        required: ["id", "done"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_goal",
      description: "Add a new goal to the user's goal list.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          target: { type: "number", description: "Target number of tasks to complete per week. Defaults to 3 if omitted." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_goal",
      description: "Delete a goal. Any tasks linked to it are unlinked, not deleted.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "The id of the goal to remove, from the app state." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_habit",
      description: "Add a new daily habit to track.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_habit",
      description: "Delete a daily habit.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "The id of the habit to remove, from the app state." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_habit_done",
      description: "Mark a daily habit as done or not done for today.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The id of the habit, from the app state." },
          done: { type: "boolean" },
        },
        required: ["id", "done"],
      },
    },
  },
];

export const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "missing-key",
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function callMarvin({ messages, context, toolChoice }) {
  const wireMessages = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    if (m.role === "assistant" && m.tool_calls) return { role: "assistant", content: m.content ?? null, tool_calls: m.tool_calls };
    return { role: m.role, content: m.content };
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1536,
    tools: TOOLS,
    tool_choice: toolChoice === "none" ? "none" : "auto",
    messages: [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent app state (JSON):\n${context || "{}"}` },
      ...wireMessages,
    ],
  });

  const message = response.choices[0]?.message;
  if (message?.tool_calls?.length) {
    return { reply: message.content ?? null, toolCalls: message.tool_calls.slice(0, 12) };
  }
  return { reply: message?.content ?? "" };
}

// Streaming variant used by the web chat endpoint so the browser can render
// text as it's generated instead of waiting for the whole completion — cuts
// perceived response time down to the first token instead of the full reply.
// onDelta fires for each text chunk; tool-call arguments arrive incrementally
// too and are reassembled here since a caller can't act on partial JSON.
export async function callMarvinStream({ messages, context, toolChoice }, onDelta) {
  const wireMessages = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    if (m.role === "assistant" && m.tool_calls) return { role: "assistant", content: m.content ?? null, tool_calls: m.tool_calls };
    return { role: m.role, content: m.content };
  });

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1536,
    tools: TOOLS,
    tool_choice: toolChoice === "none" ? "none" : "auto",
    stream: true,
    messages: [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent app state (JSON):\n${context || "{}"}` },
      ...wireMessages,
    ],
  });

  let content = "";
  const toolCallsAcc = [];

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      onDelta?.(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const i = tc.index ?? 0;
        if (!toolCallsAcc[i]) toolCallsAcc[i] = { id: "", type: "function", function: { name: "", arguments: "" } };
        if (tc.id) toolCallsAcc[i].id = tc.id;
        if (tc.function?.name) toolCallsAcc[i].function.name += tc.function.name;
        if (tc.function?.arguments) toolCallsAcc[i].function.arguments += tc.function.arguments;
      }
    }
  }

  const toolCalls = toolCallsAcc.filter(Boolean);
  if (toolCalls.length) {
    return { reply: content || null, toolCalls: toolCalls.slice(0, 12) };
  }
  return { reply: content };
}

export function marvinErrorResponse(err) {
  console.error("NVIDIA NIM API error:", err);
  if (err instanceof OpenAI.AuthenticationError) {
    return { status: 401, error: "The server's NVIDIA API key was rejected. Check NVIDIA_API_KEY." };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return { status: 429, error: "Rate limited by NVIDIA NIM — try again in a moment." };
  }
  if (err instanceof OpenAI.BadRequestError) {
    return { status: 400, error: err.message };
  }
  if (err instanceof OpenAI.APIError) {
    return { status: err.status || 500, error: err.message };
  }
  return { status: 500, error: "Something went wrong talking to Marvin." };
}
