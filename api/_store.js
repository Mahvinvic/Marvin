import { kv } from "@vercel/kv";
import crypto from "node:crypto";

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

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

// A "session" maps a token to an account key. Account keys are namespaced
// so different sign-in methods never collide in the user-record store:
// a normalized phone number (e.g. "+15551234567") for WhatsApp, or
// "google:<sub>" for Google sign-in. Callers are responsible for building
// the key (e.g. normalizePhone(phone)) before it reaches these functions —
// nothing in here re-normalizes, so a "google:..." key passes through intact.
export async function createSession(accountKey) {
  const token = crypto.randomBytes(24).toString("hex");
  await kv.set(`session:${token}`, accountKey, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function accountForSession(token) {
  if (!token) return null;
  return (await kv.get(`session:${token}`)) || null;
}

// Lets a phone number that's already signed in via another method (Google)
// share that same account record, instead of the WhatsApp number always
// getting its own separate one. Keyed on digits only (no leading "+") since
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
