import { verifyToken } from "@clerk/backend";

const SECRET_KEY = process.env.CLERK_SECRET_KEY;

// Verifies the Clerk session token from an "Authorization: Bearer <token>"
// header and returns the signed-in user's Clerk id, or null if there isn't
// a valid one (missing header, expired session, Clerk not configured).
export async function clerkUserIdFromRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !SECRET_KEY) return null;
  try {
    const claims = await verifyToken(token, { secretKey: SECRET_KEY });
    return claims.sub || null;
  } catch {
    return null;
  }
}

export function accountKeyForClerkUser(userId) {
  return `clerk:${userId}`;
}
