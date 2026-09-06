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

export async function sendMail({ to, subject, text, html, replyTo, attachments }) {
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
      ...(attachments?.length ? { attachments } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

// ---- Inbound (Resend Receiving) -------------------------------------------------------------
// The webhook only carries metadata; body and attachments come from these endpoints.
const RESEND_API = "https://api.resend.com";
const MAX_FORWARD_ATTACHMENT_BYTES = 8 * 1024 * 1024; // total, keeps us well under Resend's 40 MB send limit

async function resendGet(path) {
  const res = await fetch(`${RESEND_API}${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: "no-store" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend GET ${path} ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export function getReceivedEmail(id) {
  return resendGet(`/emails/receiving/${encodeURIComponent(id)}`);
}

export async function listReceivedAttachments(id) {
  const data = await resendGet(`/emails/receiving/${encodeURIComponent(id)}/attachments`);
  return Array.isArray(data?.data) ? data.data : [];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Mail we must not bounce around: our own domain talking to itself, or auto-replies. */
export function shouldForwardInbound(email) {
  const from = String(email?.headers?.from || email?.from || "").toLowerCase();
  const ourDomain = (mailFrom().match(/@([^>\s]+)/) || [])[1]?.toLowerCase();
  if (ourDomain && from.includes(`@${ourDomain}`)) return false;
  const auto = String(email?.headers?.["auto-submitted"] || "").toLowerCase();
  if (auto && auto !== "no") return false;
  return true;
}

/**
 * Forward a received email (by Resend id) to `to`. Inline images already arrive embedded in the
 * HTML as data URIs, so only real attachments are re-attached, up to MAX_FORWARD_ATTACHMENT_BYTES.
 */
export async function forwardReceivedEmail(emailId, { to }) {
  const email = await getReceivedEmail(emailId);
  if (!shouldForwardInbound(email)) return { forwarded: false, reason: "skipped" };

  const originalFrom = email.headers?.from || email.from || "";
  const replyTo = (String(originalFrom).match(/<([^>]+)>/) || [])[1] || email.from || undefined;
  const recipients = Array.isArray(email.to) ? email.to.join(", ") : String(email.to || "");
  const subject = email.subject ? `Fwd: ${email.subject}` : "Fwd: (no subject)";

  const attachments = [];
  let omitted = 0;
  let total = 0;
  for (const att of await listReceivedAttachments(emailId).catch(() => [])) {
    if (att.content_disposition === "inline" || !att.download_url) continue;
    const size = Number(att.size) || 0;
    if (total + size > MAX_FORWARD_ATTACHMENT_BYTES) { omitted += 1; continue; }
    const res = await fetch(att.download_url);
    if (!res.ok) { omitted += 1; continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    total += buf.length;
    attachments.push({ filename: att.filename || "attachment", content: buf.toString("base64"), content_type: att.content_type || undefined });
  }

  const headerLines = [`From: ${originalFrom}`, `To: ${recipients}`, `Date: ${email.created_at || ""}`, `Subject: ${email.subject || ""}`];
  if (omitted) headerLines.push(`(${omitted} attachment(s) omitted — open in Resend: https://resend.com/emails/receiving/${emailId})`);
  const text = `${headerLines.join("\n")}\n\n${email.text || ""}`;
  const html = `<div style="font:13px/1.5 system-ui,sans-serif;color:#555;border-bottom:1px solid #ddd;margin-bottom:12px;padding-bottom:8px">${headerLines.map((l) => escapeHtml(l)).join("<br>")}</div>${email.html || `<pre style="white-space:pre-wrap">${escapeHtml(email.text || "")}</pre>`}`;

  const sent = await sendMail({ to, subject, text, html, replyTo, attachments: attachments.length ? attachments : undefined });
  return { forwarded: true, id: sent?.id, attachments: attachments.length, omitted };
}
