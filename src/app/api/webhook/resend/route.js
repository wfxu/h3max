import { NextResponse } from "next/server";
import { verifyResendWebhook, parseReceivedEvent } from "@/lib/resend-webhook";
import { forwardReceivedEmail, mailConfigured } from "@/lib/mail";

// Inbound mail for *@h3max.info: Resend receives it (MX record) and POSTs `email.received` here;
// we pull the body and attachments from the Receiving API and forward them to CONTACT_TO, so the
// operator's personal inbox never appears anywhere public. Resend retries on non-2xx.
const recentlyForwarded = new Set(); // best-effort de-dupe for webhook retries within one instance

export async function POST(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  if (!secret.startsWith("whsec_")) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }
  const rawBody = await req.text();
  if (!verifyResendWebhook(req.headers, rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseReceivedEvent(payload);
  if (!event) return NextResponse.json({ ok: true, ignored: payload?.type || "unknown" });
  if (!mailConfigured()) return NextResponse.json({ error: "Mail is not configured" }, { status: 503 });

  if (recentlyForwarded.has(event.emailId)) return NextResponse.json({ ok: true, duplicate: true });
  try {
    const result = await forwardReceivedEmail(event.emailId, { to: process.env.CONTACT_TO });
    recentlyForwarded.add(event.emailId);
    if (recentlyForwarded.size > 500) recentlyForwarded.delete(recentlyForwarded.values().next().value);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Resend inbound forward error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
