"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoGrid from "@/components/studio/VideoGrid";
import axios from "axios";
import { Toaster } from "react-hot-toast";

export default function Gallery() {
  const { status } = useSession();
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      axios
        .get("/api/creations?limit=200")
        .then(({ data }) => setCreations(data || []))
        .catch(() => setCreations([]))
        .finally(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-6">
        <div className="space-y-1 border-b border-divider/40 pb-6">
          <h1 className="text-2xl font-black tracking-tight">My clips</h1>
          <p className="text-xs text-secondary-text">Every video you generated across all Studio tools.</p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : status !== "authenticated" ? (
          <div className="py-20 text-center text-xs text-secondary-text">
            <Link href="/login?callbackUrl=/gallery" className="text-primary font-bold hover:underline">Sign in</Link> to see your clips.
          </div>
        ) : (
          <VideoGrid creations={creations} emptyHint="Pick a tool in the Studio and generate your first clip." />
        )}
      </main>
      <Footer />
    </div>
  );
}
