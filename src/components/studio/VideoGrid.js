"use client";

import { useState } from "react";
import Link from "next/link";
import { FaDownload, FaVideo } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

function download(url, name) {
  const a = document.createElement("a");
  a.href = `/api/download?url=${encodeURIComponent(url)}`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Grid of a user's creations with a detail modal. Processing/failed items are shown with their state. */
export default function VideoGrid({ creations, emptyHint = "Nothing here yet." }) {
  const [selected, setSelected] = useState(null);

  if (!creations.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-bg-card/20 rounded border border-divider/30">
        <FaVideo className="text-4xl opacity-20 mb-4" />
        <h3 className="text-sm font-extrabold uppercase">No clips yet</h3>
        <p className="text-xs text-secondary-text max-w-xs mt-2">{emptyHint}</p>
        <Link href="/studio" className="mt-4 text-xs text-primary font-bold hover:underline">
          Browse tools
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {creations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => c.status === "completed" && setSelected(c)}
            className="group relative bg-bg-card border border-divider/50 rounded overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 text-left cursor-pointer"
          >
            <div className="aspect-video bg-black overflow-hidden flex items-center justify-center">
              {c.status === "completed" ? (
                <video src={c.resultImage} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              ) : c.status === "processing" ? (
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-[10px] text-red-400 font-bold px-4 text-center">Failed · refunded</span>
              )}
            </div>
            <div className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate">
                  {c.app?.name || "Studio"}
                </span>
                <span className="text-[10px] text-secondary-text shrink-0">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs font-semibold text-primary-text truncate">{c.prompt || "(image only)"}</p>
              <p className="text-[10px] text-secondary-text">
                {c.resolution || ""}
                {c.duration ? ` · ${c.duration}s` : ""} · {c.creditCost} credits
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-bg-card border border-divider max-w-4xl w-full rounded-lg overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-divider/50">
              <span className="text-xs font-extrabold uppercase tracking-widest text-primary">{selected.app?.name || "Clip"}</span>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-bg-page rounded-full text-secondary-text hover:text-primary-text">
                <IoClose size={20} />
              </button>
            </div>
            <div className="flex flex-col md:flex-row max-h-[80vh]">
              <div className="flex-1 bg-black flex items-center justify-center">
                <video src={selected.resultImage} className="max-h-[60vh] w-full object-contain" controls autoPlay loop playsInline />
              </div>
              <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-divider/50 p-5 flex flex-col justify-between gap-6">
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-secondary-text tracking-widest">Prompt</span>
                    <p className="font-semibold leading-relaxed break-words">{selected.prompt || "(image only)"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-divider/30 pt-4">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-secondary-text">Resolution</span>
                      <span className="font-bold">{selected.resolution || "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-secondary-text">Length</span>
                      <span className="font-bold">{selected.duration ? `${selected.duration}s` : "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-secondary-text">Credits</span>
                      <span className="font-bold">{selected.creditCost}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-secondary-text">Created</span>
                      <span className="font-bold">{new Date(selected.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => download(selected.resultImage, `h3max_${selected.id}.mp4`)}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-full text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <FaDownload className="text-xs" /> Download MP4
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
