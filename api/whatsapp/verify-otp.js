import { checkOtp, linkPhoneToAccount, getUserRecord, saveUserRecord, isValidPhone, normalizePhone } from "../_store.js";
import { clerkUserIdFromRequest, accountKeyForClerkUser } from "../_clerk.js";

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

  // Signing in happens with Google (via Clerk) now — this endpoint's job is
  // to link a WhatsApp number onto an account that's already signed in, so
  // messages sent there land in the same goals/tasks/habits/chat record.
  const userId = await clerkUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in first, then link a WhatsApp number." });
    return;
  }

  const accountKey = accountKeyForClerkUser(userId);
  const accountRecord = await getUserRecord(accountKey);
  const accountIsEmpty =
    accountRecord.goals.length === 0 &&
    accountRecord.tasks.length === 0 &&
    accountRecord.habits.length === 0 &&
    (accountRecord.chatHistory || []).length === 0;
  if (accountIsEmpty) {
    const phoneRecord = await getUserRecord(digits);
    await saveUserRecord(accountKey, { ...accountRecord, ...phoneRecord });
  }
  await linkPhoneToAccount(digits, accountKey);
  const finalRecord = await getUserRecord(accountKey);
  res.status(200).json({
    linked: true,
    phone: digits,
    state: {
      goals: finalRecord.goals,
      tasks: finalRecord.tasks,
      habits: finalRecord.habits,
      reflections: finalRecord.reflections || [],
      chatHistory: finalRecord.chatHistory || [],
      watchList: finalRecord.watchList || [],
    },
  });
}
