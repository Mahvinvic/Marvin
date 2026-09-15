import { getUserRecord, saveUserRecord } from "./_store.js";
import { clerkUserIdFromRequest, accountKeyForClerkUser } from "./_clerk.js";

export default async function handler(req, res) {
  const userId = await clerkUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in, or the session expired." });
    return;
  }
  const accountKey = accountKeyForClerkUser(userId);

  if (req.method === "GET") {
    const record = await getUserRecord(accountKey);
    res.status(200).json({
      goals: record.goals,
      tasks: record.tasks,
      habits: record.habits,
      reflections: record.reflections || [],
      chatHistory: record.chatHistory || [],
      watchList: record.watchList || [],
    });
    return;
  }

  if (req.method === "PUT") {
    const { goals, tasks, habits, reflections, chatHistory, watchList } = req.body ?? {};
    const record = await getUserRecord(accountKey);
    await saveUserRecord(accountKey, {
      ...record,
      goals: goals ?? record.goals,
      tasks: tasks ?? record.tasks,
      habits: habits ?? record.habits,
      reflections: reflections ?? record.reflections,
      chatHistory: chatHistory ?? record.chatHistory,
      watchList: watchList ?? record.watchList,
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
