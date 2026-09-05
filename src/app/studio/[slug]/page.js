"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoTemplate from "@/components/templates/VideoTemplate";
import { FaArrowLeft, FaVideo } from "react-icons/fa";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { safeParseConfig } from "@/lib/params";

const POLL_MS = 4000;

export default function StudioToolPage({ params }) {
  const { slug } = use(params);
  const { status } = useSession();

  const [appInstance, setAppInstance] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [creations, setCreations] = useState([]);
  const [activeCreation, setActiveCreation] = useState(null);
  const [generating, setGenerating] = useState(false);
  const pollTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let res = await axios.get(`/api/app-instances?slug=${encodeURIComponent(slug)}`).catch(() => null);
        if (!res) res = await axios.get(`/api/app-instances?id=${encodeURIComponent(slug)}`);
        if (!cancelled) setAppInstance(res.data);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!appInstance) return;
    const theme = safeParseConfig(appInstance.config).theme || "slate-indigo";
    document.documentElement.setAttribute("data-theme", theme);
    return () => document.documentElement.setAttribute("data-theme", "slate-indigo");
  }, [appInstance]);

  const loadCreations = async () => {
    if (!appInstance || status !== "authenticated") return [];
    const { data } = await axios.get(`/api/creations?appId=${appInstance.id}&limit=24`);
    setCreations(data || []);
    return data || [];
  };

  const stopPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  };

  const pollUntilDone = (creationId) => {
    stopPolling();
    const tick = async () => {
      try {
        const list = await loadCreations();
        const current = list.find((c) => c.id === creationId);
        if (!current) return setGenerating(false);
        setActiveCreation(current);
        if (current.status === "processing") {
          pollTimer.current = setTimeout(tick, POLL_MS);
        } else {
          setGenerating(false);
          if (current.status === "completed") toast.success("Your clip is ready!");
          else toast.error(current.error || "Generation failed. Credits refunded.");
        }
      } catch {
        pollTimer.current = setTimeout(tick, POLL_MS * 2);
      }
    };
    pollTimer.current = setTimeout(tick, POLL_MS);
  };

  useEffect(() => {
    if (!appInstance || status !== "authenticated") return;
    loadCreations().then((list) => {
      const inFlight = list.find((c) => c.status === "processing");
      if (inFlight) {
        setActiveCreation(inFlight);
        setGenerating(true);
        pollUntilDone(inFlight.id);
      } else if (list[0]) {
        setActiveCreation(list[0]);
      }
    });
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appInstance, status]);

  const handleCreationCompleted = async (data) => {
    if (!data?.id) {
      await loadCreations();
      return;
    }
    if (data.status === "processing") {
      setActiveCreation({ ...data, prompt: undefined });
      setGenerating(true);
      pollUntilDone(data.id);
    } else {
      setGenerating(false);
      const list = await loadCreations();
      setActiveCreation(list.find((c) => c.id === data.id) || data);
    }
  };

  const shell = (children) => (
    <div className="min-h-dvh flex flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />
      {children}
      <Footer />
    </div>
  );

  if (notFound) {
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
        <FaVideo className="text-3xl opacity-20" />
        <h2 className="text-sm font-extrabold uppercase">Tool not found</h2>
        <p className="text-xs text-secondary-text">This tool doesn&apos;t exist or isn&apos;t published.</p>
        <Link href="/studio" className="text-xs text-primary font-bold hover:underline">
          Back to Studio
        </Link>
      </div>
    );
  }

  if (!appInstance) {
    return shell(
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completed = creations.filter((c) => c.status === "completed");

  return shell(
    <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-divider/40 pb-4">
        <div className="space-y-1 min-w-0">
          <Link href="/studio" className="text-[11px] text-secondary-text hover:text-primary flex items-center gap-1.5 font-bold">
            <FaArrowLeft size={9} /> All tools
          </Link>
          <h1 className="text-xl font-black tracking-tight text-white">{appInstance.name}</h1>
          {appInstance.description && <p className="text-xs text-secondary-text max-w-2xl">{appInstance.description}</p>}
        </div>
        {status === "authenticated" && (
          <Link
            href={`/studio/${appInstance.slug || appInstance.id}/gallery`}
            className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-full hover:bg-primary/20 transition-colors shrink-0"
          >
            My clips from this tool
          </Link>
        )}
      </div>

      <VideoTemplate
        appInstance={appInstance}
        activeCreation={activeCreation}
        generating={generating}
        setGenerating={setGenerating}
        onCreationCompleted={handleCreationCompleted}
      />

      {completed.length > 1 && (
        <section className="space-y-3 pt-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary-text">Recent clips</h3>
          <div className="flex gap-3 overflow-x-auto scrollbar-subtle pb-2">
            {completed.slice(0, 12).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCreation(c)}
                className={`relative shrink-0 w-40 aspect-video rounded overflow-hidden border bg-black transition-all ${
                  activeCreation?.id === c.id ? "border-primary" : "border-divider hover:border-primary/50"
                }`}
              >
                <video src={c.resultImage} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white/90 truncate text-left">{c.prompt}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
