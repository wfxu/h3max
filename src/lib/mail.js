// Outbound e-mail through Resend's REST API (no SDK). Unconfigured → mailConfigured() is false and
// callers fall back gracefully; the operator's inbox (CONTACT_TO) never appears in the client.
const RESEND_URL = "https://api.resend.com/emails";

export function mailConfigured() {
  const key = process.env.RESEND_API_KEY || "";
  return key.startsWith("re_") && !!process.env.CONTACT_TO;
}

export function mailFrom() {
  return process.env.MAIL_FROM || "H3 Max Studio <support@h3max.info>";
}

export async function sendMail({ to, subject, text, html, replyTo }) {
  if (!mailConfigured()) throw new Error("Mail is not configured (RESEND_API_KEY / CONTACT_TO)");
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: mailFrom(),
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}
