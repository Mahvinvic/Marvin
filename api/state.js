import { accountForSession, getUserRecord, saveUserRecord } from "./_store.js";

export default async function handler(req, res) {
  const token = req.headers["x-session-token"];
  const accountKey = await accountForSession(token);
  if (!accountKey) {
    res.status(401).json({ error: "Not logged in, or the session expired." });
    return;
  }

  if (req.method === "GET") {
    const record = await getUserRecord(accountKey);
    res.status(200).json({
      goals: record.goals,
      tasks: record.tasks,
      habits: record.habits,
      reflections: record.reflections || [],
      chatHistory: record.chatHistory || [],
    });
    return;
  }

  if (req.method === "PUT") {
    const { goals, tasks, habits, reflections, chatHistory } = req.body ?? {};
    const record = await getUserRecord(accountKey);
    await saveUserRecord(accountKey, {
      ...record,
      goals: goals ?? record.goals,
      tasks: tasks ?? record.tasks,
      habits: habits ?? record.habits,
      reflections: reflections ?? record.reflections,
      chatHistory: chatHistory ?? record.chatHistory,
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
