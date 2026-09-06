import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { mailConfigured, sendMail } from "@/lib/mail";

// Simple per-IP throttle so the form cannot be used to flood the inbox.
const LIMIT_PER_HOUR = 5;
const buckets = new Map();
function allow(ip) {
  const now = Date.now();
  const list = (buckets.get(ip) || []).filter((t) => now - t < 3600_000);
  if (list.length >= LIMIT_PER_HOUR) return false;
  list.push(now);
  buckets.set(ip, list);
  return true;
}

export async function GET() {
  return NextResponse.json({ enabled: mailConfigured(), supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null });
}

export async function POST(req) {
  try {
    if (!mailConfigured()) {
      return NextResponse.json({ error: "The contact form is not available yet." }, { status: 503 });
    }
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (!allow(ip)) return NextResponse.json({ error: "Too many messages — please try again later." }, { status: 429 });

    const body = (await req.json().catch(() => ({}))) || {};
    const email = String(body.email || "").trim().slice(0, 200);
    const name = String(body.name || "").trim().slice(0, 100);
    const message = String(body.message || "").trim().slice(0, 5000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid e-mail address." }, { status: 400 });
    if (message.length < 10) return NextResponse.json({ error: "Please write a little more detail (10+ characters)." }, { status: 400 });
    if (body.website) return NextResponse.json({ ok: true }); // honeypot field filled by bots

    const session = await getServerSession(authOptions).catch(() => null);
    const account = session?.user?.email ? `Signed-in account: ${session.user.email}\n` : "Not signed in\n";

    await sendMail({
      to: process.env.CONTACT_TO,
      replyTo: email,
      subject: `[h3max.info] ${name || email}`,
      text: `From: ${name ? `${name} <${email}>` : email}\n${account}IP: ${ip}\n\n${message}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact error:", error);
    return NextResponse.json({ error: "Could not send your message. Please try again later." }, { status: 500 });
  }
}
