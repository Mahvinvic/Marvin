import webpush from "web-push";

const PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@example.com";

let configured = false;
export function ensureWebPushConfigured() {
  if (configured || !PUBLIC_KEY || !PRIVATE_KEY) return configured;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export { webpush };
