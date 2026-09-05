// 本地开发专用：无需 Google OAuth，访问 /api/dev-login 即以 dev@local.test 登录。
// 生产环境返回 404。此文件为本地体验时新增，不属于上游仓库，可随时删除。
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { email: "dev@local.test" },
    update: {},
    create: { name: "Dev User", email: "dev@local.test", credits: 999 },
  });

  const sessionToken = `dev-session-${crypto.randomUUID()}`;
  const maxAge = 30 * 24 * 60 * 60;
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + maxAge * 1000) },
  });

  const nextParam = new URL(req.url).searchParams.get("next") || "/studio";
  const res = NextResponse.redirect(new URL(nextParam.startsWith("/") ? nextParam : "/studio", req.url));
  res.cookies.set("next-auth.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
