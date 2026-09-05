"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoGrid from "@/components/studio/VideoGrid";
import { FaArrowLeft, FaVideo } from "react-icons/fa";
import axios from "axios";
import { Toaster } from "react-hot-toast";

export default function StudioToolGallery({ params }) {
  const { slug } = use(params);
  const { status } = useSession();
  const [appInstance, setAppInstance] = useState(null);
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    (async () => {
      try {
        let res = await axios.get(`/api/app-instances?slug=${encodeURIComponent(slug)}`).catch(() => null);
        if (!res) res = await axios.get(`/api/app-instances?id=${encodeURIComponent(slug)}`);
        setAppInstance(res.data);
        if (status === "authenticated") {
          const { data } = await axios.get(`/api/creations?appId=${res.data.id}&limit=200`);
          setCreations(data || []);
        }
      } catch {
        setAppInstance(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, status]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-6">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !appInstance ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <FaVideo className="text-3xl opacity-20 mb-2" />
            <h2 className="text-sm font-extrabold uppercase">Tool not found</h2>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-divider/40 pb-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-black tracking-tight">{appInstance.name} · my clips</h1>
                <p className="text-xs text-secondary-text">Everything you generated with this tool.</p>
              </div>
              <Link
                href={`/studio/${appInstance.slug || appInstance.id}`}
                className="flex items-center gap-2 bg-bg-card hover:bg-bg-page border border-divider px-4 py-2 rounded-full text-xs font-bold transition-all text-secondary-text hover:text-primary-text"
              >
                <FaArrowLeft size={10} /> Back to tool
              </Link>
            </div>
            {status !== "authenticated" ? (
              <div className="py-20 text-center text-xs text-secondary-text">
                <Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link> to see your clips.
              </div>
            ) : (
              <VideoGrid creations={creations} emptyHint={`Generate something with ${appInstance.name} to fill this gallery.`} />
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
