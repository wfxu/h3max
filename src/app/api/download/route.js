import { NextResponse } from "next/server";

// Only proxy files from hosts we hand out ourselves (fal.ai CDN + the mock sample). Anything else is
// redirected instead of fetched server-side, so the endpoint cannot be used to reach internal hosts.
const ALLOWED_HOSTS = [/(^|\.)fal\.media$/i, /(^|\.)fal\.ai$/i, /(^|\.)fal\.run$/i, /^commondatastorage\.googleapis\.com$/i, /^storage\.googleapis\.com$/i];

function isAllowedDownloadHost(hostname) {
  return ALLOWED_HOSTS.some((re) => re.test(hostname));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !isAllowedDownloadHost(parsed.hostname)) {
    return NextResponse.redirect(parsed.toString());
  }

  try {
    const res = await fetch(parsed.toString());
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const contentType = res.headers.get("content-type") || "video/mp4";
    const last = parsed.pathname.split("/").pop() || "";
    const filename = /\.\w{2,5}$/.test(last) ? last : `h3max_${Date.now()}.mp4`;
    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.redirect(parsed.toString());
  }
}
