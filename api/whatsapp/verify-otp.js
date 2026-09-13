import {
  checkOtp,
  createSession,
  accountForSession,
  linkPhoneToAccount,
  getUserRecord,
  saveUserRecord,
  isValidPhone,
  normalizePhone,
} from "../_store.js";

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

  // Signing in happens with Google now — this endpoint's normal job is to
  // link a WhatsApp number onto an account that's already signed in, so
  // messages sent there land in the same goals/tasks/habits/chat record.
  const existingAccountKey = await accountForSession(req.headers["x-session-token"]);
  if (existingAccountKey) {
    const accountRecord = await getUserRecord(existingAccountKey);
    const accountIsEmpty =
      accountRecord.goals.length === 0 &&
      accountRecord.tasks.length === 0 &&
      accountRecord.habits.length === 0 &&
      (accountRecord.chatHistory || []).length === 0;
    if (accountIsEmpty) {
      const phoneRecord = await getUserRecord(digits);
      await saveUserRecord(existingAccountKey, { ...accountRecord, ...phoneRecord });
    }
    await linkPhoneToAccount(digits, existingAccountKey);
    const finalRecord = await getUserRecord(existingAccountKey);
    res.status(200).json({
      linked: true,
      phone: digits,
      state: {
        goals: finalRecord.goals,
        tasks: finalRecord.tasks,
        habits: finalRecord.habits,
        reflections: finalRecord.reflections || [],
        chatHistory: finalRecord.chatHistory || [],
      },
    });
    return;
  }

  // No signed-in session to link to — fall back to a standalone phone
  // account (kept for direct API use / backward compatibility).
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
