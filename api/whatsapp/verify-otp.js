import { checkOtp, createSession, getUserRecord, isValidPhone, normalizePhone } from "../_store.js";

const REASON_MESSAGES = {
  expired: "That code expired or was never sent. Request a new one.",
  too_many_attempts: "Too many wrong attempts. Request a new code.",
  mismatch: "That code doesn't match. Check it and try again.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { phone, code } = req.body ?? {};
  if (!isValidPhone(phone) || !code) {
    res.status(400).json({ error: "Phone and code are required." });
    return;
  }
  const digits = normalizePhone(phone);

  const result = await checkOtp(digits, code);
  if (!result.ok) {
    res.status(400).json({ error: REASON_MESSAGES[result.reason] || "Verification failed." });
    return;
  }

  const token = await createSession(digits);
  const record = await getUserRecord(digits);
  res.status(200).json({
    token,
    phone: digits,
    state: {
      goals: record.goals,
      tasks: record.tasks,
      habits: record.habits,
      reflections: record.reflections || [],
      chatHistory: record.chatHistory || [],
    },
  });
}
