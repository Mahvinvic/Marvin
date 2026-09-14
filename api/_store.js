import { kv } from "@vercel/kv";

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;

export function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

export function isValidPhone(phone) {
  return /^\+?[1-9]\d{7,14}$/.test(normalizePhone(phone));
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function storeOtp(phone, code) {
  await kv.set(`otp:${normalizePhone(phone)}`, { code, attempts: 0 }, { ex: OTP_TTL_SECONDS });
}

export async function checkOtp(phone, code) {
  const key = `otp:${normalizePhone(phone)}`;
  const record = await kv.get(key);
  if (!record) return { ok: false, reason: "expired" };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (String(record.code) !== String(code).trim()) {
    await kv.set(key, { ...record, attempts: record.attempts + 1 }, { ex: OTP_TTL_SECONDS });
    return { ok: false, reason: "mismatch" };
  }
  await kv.del(key);
  return { ok: true };
}

// Lets a phone number that's already signed in via another method (Google,
// via Clerk) share that same account record, instead of the WhatsApp
// number always getting its own separate one. Keyed on digits only (no leading "+") since
// the number a user types on the web ("+1 555...") and the number Meta's
// webhook reports for the same conversation ("1555...") don't otherwise
// agree on formatting.
function aliasKeyFor(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

export async function linkPhoneToAccount(phone, accountKey) {
  await kv.set(`phone-alias:${aliasKeyFor(phone)}`, accountKey);
}

export async function resolveAccountKey(phone) {
  const alias = await kv.get(`phone-alias:${aliasKeyFor(phone)}`);
  return alias || normalizePhone(phone);
}

export async function getUserRecord(accountKey) {
  const record = await kv.get(`user:${accountKey}`);
  return record || { goals: [], tasks: [], habits: [], reflections: [], chatHistory: [] };
}

export async function saveUserRecord(accountKey, record) {
  await kv.set(`user:${accountKey}`, record);
}
