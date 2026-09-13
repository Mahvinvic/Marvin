import { callMarvin } from "./_marvin.js";
import { buildContext, executeToolCalls } from "./_state.js";

const MAX_ROUNDS = 6;

// Server-side equivalent of the frontend's sendChatMessage loop in
// src/App.jsx — needed because WhatsApp has no browser to run tool calls
// against; this runs the same multi-round tool-calling loop against a
// plain state object instead of React state.
export async function runMarvinTurn(state, history, userText) {
  const context = buildContext(state);
  const titleToNewGoalId = {};
  let messages = [...history, { role: "user", content: userText }];
  let finalReply = "";
  let currentState = state;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const isLastRound = round === MAX_ROUNDS - 1;
    const { reply, toolCalls } = await callMarvin({ messages, context, toolChoice: isLastRound ? "none" : "auto" });

    if (toolCalls?.length && !isLastRound) {
      const { state: newState, toolResults } = executeToolCalls(currentState, toolCalls, titleToNewGoalId);
      currentState = newState;
      messages = [...messages, { role: "assistant", content: reply ?? null, tool_calls: toolCalls }, ...toolResults];
      continue;
    }

    finalReply = reply || "";
    break;
  }

  if (!finalReply) {
    messages = [...messages, { role: "user", content: "Summarize what you just set up for me, in 2-3 sentences." }];
    const { reply } = await callMarvin({ messages, context, toolChoice: "none" });
    finalReply = reply || "Done.";
  }

  return { finalReply, newState: currentState };
}
