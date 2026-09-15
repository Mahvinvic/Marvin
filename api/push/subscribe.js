import { savePushSubscription, removePushSubscription } from "../_store.js";
import { clerkUserIdFromRequest, accountKeyForClerkUser } from "../_clerk.js";

export default async function handler(req, res) {
  const userId = await clerkUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const accountKey = accountKeyForClerkUser(userId);

  if (req.method === "POST") {
    const { subscription } = req.body ?? {};
    if (!subscription?.endpoint) {
      res.status(400).json({ error: "Missing push subscription." });
      return;
    }
    await savePushSubscription(accountKey, subscription);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    await removePushSubscription(accountKey);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
