import { generateOtp, storeOtp, isValidPhone, normalizePhone } from "../_store.js";

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE || "otp_verification";
const OTP_TEMPLATE_LANG = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en_US";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    res.status(500).json({ error: "Server is missing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID." });
    return;
  }

  const { phone } = req.body ?? {};
  if (!isValidPhone(phone)) {
    res.status(400).json({ error: "Enter a valid phone number in international format, e.g. +15551234567." });
    return;
  }
  const digits = normalizePhone(phone);

  const code = generateOtp();
  await storeOtp(digits, code);

  try {
    const waRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits.replace("+", ""),
        type: "template",
        template: {
          name: OTP_TEMPLATE_NAME,
          language: { code: OTP_TEMPLATE_LANG },
          components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
        },
      }),
    });

    if (!waRes.ok) {
      const errBody = await waRes.json().catch(() => ({}));
      console.error("WhatsApp send-otp error:", JSON.stringify(errBody));
      res.status(502).json({
        error: errBody?.error?.message || "WhatsApp declined to send the code. Check your template name/status.",
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("WhatsApp send-otp network error:", err);
    res.status(500).json({ error: "Couldn't reach WhatsApp. Try again in a moment." });
  }
}
