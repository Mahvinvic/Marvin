import { createSession, getUserRecord } from "../_store.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Verifies a Google Identity Services credential (an ID token JWT) by
// asking Google to decode and validate it, rather than pulling in a JWK
// verification library for a single endpoint.
async function verifyGoogleCredential(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!CLIENT_ID) {
    res.status(500).json({ error: "Server is missing GOOGLE_CLIENT_ID." });
    return;
  }

  const { credential } = req.body ?? {};
  if (!credential) {
    res.status(400).json({ error: "Missing Google credential." });
    return;
  }

  let claims;
  try {
    claims = await verifyGoogleCredential(credential);
  } catch (err) {
    console.error("Google token verification network error:", err);
    res.status(502).json({ error: "Couldn't reach Google to verify sign-in. Try again." });
    return;
  }

  if (!claims || claims.aud !== CLIENT_ID || claims.email_verified !== "true" || !claims.sub) {
    res.status(401).json({ error: "That Google sign-in couldn't be verified." });
    return;
  }

  const accountKey = `google:${claims.sub}`;
  const token = await createSession(accountKey);
  const record = await getUserRecord(accountKey);
  res.status(200).json({
    token,
    account: { email: claims.email, name: claims.name || claims.email, picture: claims.picture || null },
    state: {
      goals: record.goals,
      tasks: record.tasks,
      habits: record.habits,
      reflections: record.reflections || [],
      chatHistory: record.chatHistory || [],
    },
  });
}
