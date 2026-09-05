import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { safeParseConfig } from "@/lib/params";
import { getModel } from "@/lib/models";
import { computeCost } from "@/lib/cost";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Studio",
  description: "Pick a scenario, add a photo or a line of text, get a MiniMax H3 Max video. No parameters to tune.",
};

const GRADIENTS = [
  "from-violet-600/60 to-cyan-500/40",
  "from-fuchsia-600/60 to-orange-400/40",
  "from-emerald-600/60 to-sky-500/40",
  "from-amber-500/60 to-rose-500/40",
  "from-blue-600/60 to-indigo-400/40",
  "from-teal-600/60 to-lime-400/40",
];

export default async function StudioPage() {
  const tools = await prisma.appInstance.findMany({
    where: { isPublic: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-12 sm:px-6 lg:px-8 flex flex-col gap-10">
        <div className="space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-widest">
            MiniMax H3 Max · fal.ai
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Pick a scenario. Skip the settings.</h1>
          <p className="text-sm text-secondary-text leading-relaxed">
            Every tool below is H3 Max with the model, length, resolution and prompt style already dialed in. Add a photo or a
            sentence and generate. New accounts start with free credits.
          </p>
        </div>

        {tools.length === 0 ? (
          <div className="py-20 border border-divider/30 bg-bg-card/10 rounded-lg text-center text-xs text-secondary-text font-bold uppercase tracking-wider">
            No tools published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool, i) => {
              const cfg = safeParseConfig(tool.config);
              const model = getModel(cfg.modelEndpoint);
              const cost = computeCost(cfg, {});
              const href = `/studio/${tool.slug || tool.id}`;
              const inputHint = model?.mode === "t2v" ? "Text" : model?.mode === "r2v" ? "Reference images + text" : "Photo + text";
              return (
                <Link
                  key={tool.id}
                  href={href}
                  className="group bg-bg-card border border-divider/50 rounded-xl overflow-hidden shadow-md hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  <div className={`relative h-40 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} overflow-hidden`}>
                    {tool.coverImage ? (
                      <img src={tool.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-black/40 text-white border border-white/20 backdrop-blur">
                        {model?.family || "H3 Max"}
                      </span>
                      <span className="text-[10px] font-bold text-white/90">{inputHint}</span>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <h3 className="text-sm font-extrabold text-primary-text group-hover:text-primary transition-colors">{tool.name}</h3>
                    <p className="text-xs text-secondary-text leading-relaxed line-clamp-3 flex-1">{tool.description || "H3 Max video generation."}</p>
                    <div className="flex items-center justify-between text-[10px] font-bold text-secondary-text border-t border-divider/40 pt-3">
                      <span>
                        {cfg.resolution || "768P"}
                        {cfg.duration ? ` · ${cfg.duration}s` : " · 5–15s"}
                        {cfg.aspectRatio ? ` · ${cfg.aspectRatio}` : ""}
                      </span>
                      <span className="text-primary">{cfg.duration ? `${cost} credits` : `from ${cost} credits`}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
