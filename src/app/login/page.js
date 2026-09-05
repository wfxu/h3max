"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaGoogle, FaInfoCircle } from "react-icons/fa";

const isDev = process.env.NODE_ENV !== "production";

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("callbackUrl") || searchParams.get("next") || "/studio";
  const next = rawNext.startsWith("/") ? rawNext : "/studio";

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg-page px-6 text-primary-text">
      <div className="relative bg-bg-card border border-divider w-full max-w-md rounded-lg p-8 space-y-8 shadow-2xl animate-scale-up">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] flex items-center justify-center text-2xl text-white font-black shadow-md">
            H3
          </div>
          <h2 className="text-2xl font-black tracking-tight">Sign in to H3 Max Studio</h2>
          <p className="text-xs font-semibold text-secondary-text leading-relaxed px-4">
            Sign in to generate videos, keep your clips in a gallery and top up credits. New accounts get free credits to try a tool.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn("google", { callbackUrl: next })}
            className="w-full py-3.5 bg-white text-neutral-900 rounded-full text-xs font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <FaGoogle className="text-sm text-red-500" />
            <span>Continue with Google</span>
          </button>
          {isDev && (
            <a
              href={`/api/dev-login?next=${encodeURIComponent(next)}`}
              className="w-full py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold flex items-center justify-center hover:bg-amber-500/20 transition-all"
            >
              Dev sign-in (local only)
            </a>
          )}
        </div>

        <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/10 p-3.5 rounded text-[11px] leading-relaxed text-secondary-text">
          <FaInfoCircle className="text-primary text-xs shrink-0 mt-0.5" />
          <span>
            Payments are handled by Stripe; credits are added to your account automatically. Failed generations are refunded.
          </span>
        </div>

        <p className="text-center text-[11px] text-secondary-text">
          <Link href="/studio" className="hover:text-primary-text">← Back to Studio</Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-bg-page text-primary-text">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
