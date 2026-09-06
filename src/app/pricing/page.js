"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FaCheck, FaInfoCircle } from "react-icons/fa";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import config from "@/lib/config";

const DESCRIPTIONS = {
  starter: "Try a few scenarios and find the one that fits.",
  creator: "For regular posting — about 18 clips of 5 seconds.",
  pro: "Batches of variations, longer clips, 768P everywhere.",
  studio: "Best value for teams and agencies producing daily.",
};

const PLANS = Object.values(config.plans).map((p) => ({
  ...p,
  priceLabel: `$${(p.price / 100).toFixed(0)}`,
  description: DESCRIPTIONS[p.id] || "",
  popular: p.id === "pro",
  bonus: Math.round((p.credits / (p.price / 100) / 100 - 1) * 100),
}));

function PricingContent() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState(null);

  useEffect(() => {
    if (searchParams.get("success")) toast.success("Payment received — your credits are on the way.");
    if (searchParams.get("canceled")) toast("Checkout canceled.");
  }, [searchParams]);

  const handleCheckout = async (planId) => {
    if (status !== "authenticated") {
      toast.error("Please sign in first.");
      return;
    }
    setLoadingPlan(planId);
    try {
      const { data } = await axios.post("/api/checkout", { planId });
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not start checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-12 sm:px-6 lg:px-8 flex flex-col gap-10 items-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
          <FaInfoCircle className="text-primary text-xs" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Pay as you go</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Buy credits</h1>
        <p className="text-xs sm:text-sm text-secondary-text max-w-lg leading-relaxed">
          Credits work across every Studio tool and never expire. A 5-second 768P clip on H3 Max costs 60 credits; H3 Max Turbo starts at 20.
          Failed renders are refunded automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-bg-card border rounded-lg p-6 flex flex-col justify-between gap-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
              plan.popular ? "border-primary shadow-xl shadow-primary/5 lg:scale-105" : "border-divider/50 shadow-md"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-wider shadow">
                Most popular
              </span>
            )}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold uppercase tracking-wide">{plan.name}</h3>
                <p className="text-2xl font-black tracking-tight text-white">{plan.priceLabel}</p>
              </div>
              <div className="text-xs bg-bg-page/50 border border-divider/30 p-3 rounded text-center font-extrabold text-primary">
                {plan.credits.toLocaleString()} credits
                {plan.bonus > 0 && <span className="block text-[10px] text-emerald-400 font-bold mt-0.5">+{plan.bonus}% bonus</span>}
              </div>
              <p className="text-xs text-secondary-text leading-relaxed font-medium min-h-[3rem]">{plan.description}</p>
              <ul className="space-y-2 border-t border-divider/30 pt-4 text-xs font-semibold text-secondary-text">
                <li className="flex items-center gap-2"><FaCheck className="text-primary text-[10px]" /> ≈ {Math.floor(plan.credits / 60)} × 5s H3 Max clips</li>
                <li className="flex items-center gap-2"><FaCheck className="text-primary text-[10px]" /> All Studio tools</li>
                <li className="flex items-center gap-2"><FaCheck className="text-primary text-[10px]" /> Credits never expire</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loadingPlan !== null}
              className={`w-full py-3 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer active:scale-[0.98] ${
                plan.popular ? "bg-primary text-white hover:bg-primary-hover" : "bg-bg-page hover:bg-bg-card text-primary-text border border-divider"
              }`}
            >
              {loadingPlan === plan.id ? "Opening checkout…" : status === "authenticated" ? "Buy credits" : "Sign in to buy"}
            </button>
          </div>
        ))}
      </div>

      {status !== "authenticated" && (
        <p className="text-xs text-secondary-text">
          <Link href="/login?callbackUrl=/pricing" className="text-primary font-bold hover:underline">Sign in</Link> to purchase. New accounts already include free credits.
        </p>
      )}
    </main>
  );
}

export default function Pricing() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <PricingContent />
      </Suspense>
      <Footer />
    </div>
  );
}
