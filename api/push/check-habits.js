import { getAllPushSubscriberAccountKeys, getPushSubscription, removePushSubscription, getUserRecord } from "../_store.js";
import { ensureWebPushConfigured, webpush } from "../_webpush.js";

const CRON_SECRET = process.env.CRON_SECRET;

// Triggered on a schedule (see vercel.json) rather than by a user action —
// this is what makes habit reminders actually reach people when the app
// isn't open, unlike the in-app nag which only fires while it's running.
export default async function handler(req, res) {
  // Vercel sends this exact header for Cron Job-triggered requests once
  // CRON_SECRET is set; reject anything else so this can't be used to spam
  // arbitrary push notifications to every subscriber on demand.
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!ensureWebPushConfigured()) {
    res.status(500).json({ error: "Server is missing VAPID keys for push notifications." });
    return;
  }

  const accountKeys = await getAllPushSubscriberAccountKeys();
  let sent = 0;
  let pruned = 0;

  for (const accountKey of accountKeys) {
    const subscription = await getPushSubscription(accountKey);
    if (!subscription) continue;

    const record = await getUserRecord(accountKey);
    const pending = (record.habits || []).filter((h) => !h.done);
    if (pending.length === 0) continue;

    const target = pending[Math.floor(Math.random() * pending.length)];
    const payload = JSON.stringify({
      title: "Still on today's list",
      body: pending.length > 1 ? `"${target.title}" (+${pending.length - 1} more) isn't done yet.` : `"${target.title}" isn't done yet.`,
      url: "/",
    });

    try {
      await webpush.sendNotification(subscription, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription is gone (browser data cleared, app uninstalled, etc.) — stop trying it.
        await removePushSubscription(accountKey);
        pruned++;
      } else {
        console.error("Push send failed for", accountKey, err.statusCode, err.body);
      }
    }
  }

  res.status(200).json({ checked: accountKeys.length, sent, pruned });
}
