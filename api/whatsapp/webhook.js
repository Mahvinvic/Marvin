import { getUserRecord, saveUserRecord } from "../_store.js";
import { runMarvinTurn } from "../_agent.js";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const MAX_CHAT_HISTORY = 20;

async function sendWhatsAppMessage(to, text) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error("WhatsApp send-message error:", JSON.stringify(body));
  }
}

export default async function handler(req, res) {
  // Meta's one-time webhook verification handshake (done once, when you
  // register the callback URL in the Meta dashboard).
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Forbidden");
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  // Acknowledge immediately — Meta retries aggressively on anything but a
  // fast 200, and the actual reply goes out over a separate API call below.
  res.status(200).json({ received: true });

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error("WhatsApp webhook: missing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID.");
    return;
  }

  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== "text") return;

    const from = message.from;
    const text = message.text?.body?.trim();
    if (!from || !text) return;

    const record = await getUserRecord(from);
    const history = (record.chatHistory || []).slice(-MAX_CHAT_HISTORY);

    const { finalReply, newState } = await runMarvinTurn(
      { goals: record.goals, tasks: record.tasks, habits: record.habits },
      history,
      text
    );

    const updatedHistory = [...history, { role: "user", content: text }, { role: "assistant", content: finalReply }].slice(
      -MAX_CHAT_HISTORY
    );

    await saveUserRecord(from, { ...record, ...newState, chatHistory: updatedHistory });
    await sendWhatsAppMessage(from, finalReply || "Done.");
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
  }
}
