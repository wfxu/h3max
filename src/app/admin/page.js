"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CustomSelect from "@/components/studio/CustomSelect";
import { FaPlus, FaTrash, FaPen, FaExternalLinkAlt, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { H3_MODELS, RESOLUTIONS, ASPECT_RATIOS, DEFAULT_MODEL_ID, DURATION_MIN, DURATION_MAX, getModel, suggestedCredits, estimateUsd, clampDuration } from "@/lib/models";
import { safeParseConfig } from "@/lib/params";
import { computeCost } from "@/lib/cost";
import { slugify } from "@/lib/slug";

const PARAM_TYPE_OPTIONS = [
  { label: "Hidden (fixed value)", value: "hidden" },
  { label: "Text input", value: "text" },
  { label: "Text area", value: "textarea" },
  { label: "Number", value: "number" },
  { label: "Toggle", value: "boolean" },
  { label: "Dropdown", value: "enum" },
  { label: "Slider", value: "slider" },
  { label: "Image upload", value: "image_list" },
  { label: "Video upload", value: "video_list" },
  { label: "Audio upload", value: "audio_list" },
];

const THEME_OPTIONS = [
  { label: "Slate / Indigo (default)", value: "slate-indigo" },
  { label: "Neon Cyberpunk", value: "cyberpunk" },
  { label: "Emerald", value: "emerald" },
  { label: "Sunset", value: "sunset" },
  { label: "Midnight", value: "midnight" },
];

const UPLOAD_TYPES = ["image_list", "video_list", "audio_list"];

function emptyForm() {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    coverImage: "",
    isPublic: true,
    sortOrder: 0,
    config: {
      modelEndpoint: DEFAULT_MODEL_ID,
      systemPrompt: "",
      promptLabel: "",
      promptPlaceholder: "",
      showPrompt: true,
      requireImage: false,
      duration: 5,
      resolution: "768P",
      aspectRatio: "",
      creditCost: 60,
      theme: "slate-indigo",
      userParams: [],
    },
  };
}

function formFromTool(tool) {
  const cfg = safeParseConfig(tool.config);
  return {
    id: tool.id,
    name: tool.name || "",
    slug: tool.slug || "",
    description: tool.description || "",
    coverImage: tool.coverImage || "",
    isPublic: tool.isPublic !== false,
    sortOrder: tool.sortOrder ?? 0,
    config: { ...emptyForm().config, ...cfg, userParams: Array.isArray(cfg.userParams) ? cfg.userParams : [] },
  };
}

const inputCls =
  "w-full bg-bg-page border border-divider/60 rounded py-2 px-3 text-xs outline-none focus:border-primary/60 transition-all font-semibold text-primary-text min-h-[38px]";
const labelCls = "text-[10px] font-bold text-secondary-text uppercase tracking-wider block";

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[10px] text-secondary-text/80">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-xs font-bold text-primary-text">{label}</span>
      <span className="relative inline-flex items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <span className="w-9 h-5 bg-bg-page rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-secondary-text peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary border border-divider" />
      </span>
    </label>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean(session?.user?.isAdmin);

  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = modal closed
  const [saving, setSaving] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [showJson, setShowJson] = useState(false);

  const load = async () => {
    try {
      const { data } = await axios.get("/api/app-instances?all=1");
      setTools(data || []);
    } catch {
      toast.error("Could not load tools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isAdmin) load();
    else if (status !== "loading") setLoading(false);
  }, [status, isAdmin]);

  const cfg = form?.config;
  const model = cfg ? getModel(cfg.modelEndpoint) || getModel(DEFAULT_MODEL_ID) : null;
  const durationForEstimate = cfg ? (cfg.duration === "" ? DURATION_MIN : clampDuration(cfg.duration)) : 5;
  const suggested = cfg ? suggestedCredits(cfg.modelEndpoint, cfg.resolution, durationForEstimate) : 0;
  const usd = cfg ? estimateUsd(cfg.modelEndpoint, cfg.resolution, durationForEstimate) : 0;
  const previewCost = cfg ? computeCost(cfg, {}) : 0;

  const setCfg = (patch) => setForm((f) => ({ ...f, config: { ...f.config, ...patch } }));
  const setParams = (updater) => setCfg({ userParams: typeof updater === "function" ? updater(cfg.userParams) : updater });
  const updateParam = (index, patch) =>
    setParams((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const importJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const detected = Object.entries(parsed)
        .filter(([key]) => key !== "prompt")
        .map(([key, val]) => {
          const k = key.toLowerCase();
          let type = "text";
          let defaultValue = val;
          let maxInputs;
          if (k.includes("image")) {
            type = "image_list";
            maxInputs = Array.isArray(val) || k.endsWith("s") ? 5 : 1;
            defaultValue = [];
          } else if (k.includes("video")) {
            type = "video_list";
            maxInputs = Array.isArray(val) ? 3 : 1;
            defaultValue = [];
          } else if (k.includes("audio")) {
            type = "audio_list";
            maxInputs = Array.isArray(val) ? 3 : 1;
            defaultValue = [];
          } else if (typeof val === "boolean") type = "boolean";
          else if (typeof val === "number") type = key === "duration" ? "slider" : "number";
          else if (typeof val === "string" && val.includes("\n")) type = "textarea";
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const base = { key, label, type, defaultValue, maxInputs };
          if (key === "duration") return { ...base, min: DURATION_MIN, max: DURATION_MAX, step: 1, costPerUnit: 0 };
          return base;
        });
      setParams(detected);
      setShowJson(false);
      toast.success(`Imported ${detected.length} parameters`);
    } catch {
      toast.error("Invalid JSON");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description,
        coverImage: form.coverImage,
        isPublic: form.isPublic,
        sortOrder: Number(form.sortOrder) || 0,
        config: form.config,
      };
      if (form.id) await axios.put("/api/app-instances", { id: form.id, ...payload });
      else await axios.post("/api/app-instances", payload);
      toast.success(form.id ? "Tool updated" : "Tool created");
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tool) => {
    if (!confirm(`Delete "${tool.name}"? Users keep their clips; the tool page disappears.`)) return;
    try {
      await axios.delete(`/api/app-instances?id=${tool.id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  };

  const togglePublic = async (tool) => {
    try {
      await axios.put("/api/app-instances", { id: tool.id, isPublic: !tool.isPublic });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  const shell = (children) => (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />
      {children}
      <Footer />
    </div>
  );

  if (status === "loading" || (loading && isAdmin)) {
    return shell(
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
        <FaLock className="text-3xl opacity-20" />
        <h2 className="text-sm font-extrabold uppercase">Admin access required</h2>
        <p className="text-xs text-secondary-text max-w-sm">
          {status === "authenticated"
            ? `Signed in as ${session.user.email}. Add this address to ADMIN_EMAILS to manage tools.`
            : "Sign in with an operator account to manage Studio tools."}
        </p>
        {status !== "authenticated" && (
          <Link href="/login?callbackUrl=/admin" className="text-xs text-primary font-bold hover:underline">Sign in</Link>
        )}
      </div>
    );
  }

  return shell(
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-10 sm:px-6 lg:px-8 flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-divider/40 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight">Studio tools</h1>
          <p className="text-xs text-secondary-text">Each tool is one scenario: a fixed H3 Max endpoint, baked-in settings and a minimal form for users.</p>
        </div>
        <button
          onClick={() => setForm(emptyForm())}
          className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <FaPlus /> New tool
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Tools", value: tools.length },
          { label: "Published", value: tools.filter((t) => t.isPublic).length },
          { label: "My credits", value: session.user.credits ?? 0 },
        ].map((m) => (
          <div key={m.label} className="bg-bg-card border border-divider/50 rounded-lg p-4">
            <span className="text-[10px] font-black text-secondary-text uppercase tracking-widest block">{m.label}</span>
            <span className="text-2xl font-black text-white">{m.value}</span>
          </div>
        ))}
      </div>

      {tools.length === 0 ? (
        <div className="py-16 border border-divider/30 bg-bg-card/10 rounded-lg text-center text-xs text-secondary-text">
          No tools yet. Create one, or run <code className="text-primary">npm run db:seed</code> to load the starter scenarios.
        </div>
      ) : (
        <div className="overflow-x-auto border border-divider/40 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-bg-card/60 text-[10px] uppercase tracking-wider text-secondary-text">
              <tr>
                <th className="text-left px-4 py-3 font-black">Tool</th>
                <th className="text-left px-4 py-3 font-black">Model</th>
                <th className="text-left px-4 py-3 font-black">Settings</th>
                <th className="text-left px-4 py-3 font-black">Credits</th>
                <th className="text-left px-4 py-3 font-black">Order</th>
                <th className="text-left px-4 py-3 font-black">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const c = safeParseConfig(tool.config);
                const m = getModel(c.modelEndpoint);
                return (
                  <tr key={tool.id} className="border-t border-divider/30 hover:bg-bg-card/40">
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-primary-text">{tool.name}</div>
                      <div className="text-[10px] text-secondary-text">/studio/{tool.slug || tool.id}</div>
                    </td>
                    <td className="px-4 py-3 text-secondary-text">{m?.label || c.modelEndpoint}</td>
                    <td className="px-4 py-3 text-secondary-text">
                      {c.resolution || "768P"} · {c.duration === "" || c.duration === undefined ? "user picks" : `${c.duration}s`}
                      {c.aspectRatio ? ` · ${c.aspectRatio}` : ""} · {(c.userParams || []).length} params
                    </td>
                    <td className="px-4 py-3 font-bold text-primary">{computeCost(c, {})}</td>
                    <td className="px-4 py-3 text-secondary-text">{tool.sortOrder}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublic(tool)}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold ${
                          tool.isPublic ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-bg-page text-secondary-text border-divider"
                        }`}
                      >
                        {tool.isPublic ? <FaEye /> : <FaEyeSlash />} {tool.isPublic ? "Public" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/studio/${tool.slug || tool.id}`} target="_blank" className="p-2 rounded hover:bg-bg-page text-secondary-text hover:text-primary" title="Open">
                          <FaExternalLinkAlt size={11} />
                        </Link>
                        <button onClick={() => setForm(formFromTool(tool))} className="p-2 rounded hover:bg-bg-page text-secondary-text hover:text-primary" title="Edit">
                          <FaPen size={11} />
                        </button>
                        <button onClick={() => remove(tool)} className="p-2 rounded hover:bg-bg-page text-secondary-text hover:text-red-500" title="Delete">
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setForm(null)} />
          <div className="relative bg-bg-card border border-divider w-full max-w-6xl rounded-xl p-6 sm:p-8 space-y-6 animate-scale-up shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-subtle">
            <div className="space-y-1 border-b border-divider/40 pb-4">
              <h2 className="text-lg font-black tracking-tight">{form.id ? "Edit tool" : "New tool"}</h2>
              <p className="text-xs text-secondary-text">Decide everything here so the user only has to add a photo or a sentence.</p>
            </div>

            <form onSubmit={save} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left: listing + model */}
                <div className="space-y-5 lg:col-span-5">
                  <Field label="Name">
                    <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bring a photo to life" />
                  </Field>
                  <Field label="URL slug" hint={`/studio/${form.slug || slugify(form.name) || "…"}`}>
                    <input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from name" />
                  </Field>
                  <Field label="Description (shown on the card and tool page)">
                    <textarea className={`${inputCls} h-20 resize-none`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </Field>
                  <Field label="Cover image URL (optional)">
                    <input className={inputCls} value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="https://…" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Sort order">
                      <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                    </Field>
                    <Field label="Theme">
                      <CustomSelect value={cfg.theme} onChange={(v) => setCfg({ theme: v })} options={THEME_OPTIONS} />
                    </Field>
                  </div>
                  <div className="border border-divider/40 rounded-lg px-4 py-2 bg-bg-page/20">
                    <Toggle label="Published on /studio" checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} />
                  </div>

                  <div className="border border-divider/40 rounded-lg p-4 bg-bg-page/20 space-y-4">
                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">Model & fixed settings</span>
                    <Field label="fal.ai endpoint">
                      <CustomSelect
                        value={cfg.modelEndpoint}
                        onChange={(v) => setCfg({ modelEndpoint: v })}
                        options={H3_MODELS.map((m) => ({ label: m.label, value: m.id }))}
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Length">
                        <CustomSelect
                          value={cfg.duration === "" ? "" : String(cfg.duration)}
                          onChange={(v) => setCfg({ duration: v === "" ? "" : Number(v) })}
                          options={[
                            { label: "User picks", value: "" },
                            ...Array.from({ length: DURATION_MAX - DURATION_MIN + 1 }, (_, i) => ({ label: `${DURATION_MIN + i}s`, value: String(DURATION_MIN + i) })),
                          ]}
                        />
                      </Field>
                      <Field label="Resolution">
                        <CustomSelect value={cfg.resolution} onChange={(v) => setCfg({ resolution: v })} options={RESOLUTIONS.map((r) => ({ label: r, value: r }))} />
                      </Field>
                      <Field label="Aspect">
                        <CustomSelect
                          value={cfg.aspectRatio}
                          onChange={(v) => setCfg({ aspectRatio: v })}
                          disabled={model?.mode === "i2v"}
                          options={[{ label: model?.mode === "i2v" ? "From image" : "Default", value: "" }, ...ASPECT_RATIOS.map((a) => ({ label: a, value: a }))]}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Base credit cost"
                      hint={`fal.ai cost ≈ $${usd.toFixed(3)} for ${durationForEstimate}s at ${cfg.resolution}. Suggested (×1.5): ${suggested} credits. Users see: ${previewCost} credits${cfg.duration === "" ? " + per-second modifiers" : ""}.`}
                    >
                      <div className="flex gap-2">
                        <input type="number" min="0" className={inputCls} value={cfg.creditCost} onChange={(e) => setCfg({ creditCost: Number(e.target.value) })} />
                        <button type="button" onClick={() => setCfg({ creditCost: suggested })} className="shrink-0 px-3 rounded border border-primary/30 bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20">
                          Use {suggested}
                        </button>
                      </div>
                    </Field>
                    {model?.mode !== "t2v" && (
                      <Toggle label="Image is required" checked={cfg.requireImage} onChange={(v) => setCfg({ requireImage: v })} />
                    )}
                  </div>
                </div>

                {/* Right: prompt + params */}
                <div className="space-y-5 lg:col-span-7">
                  <div className="border border-divider/40 rounded-lg p-4 bg-bg-page/20 space-y-4">
                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">Prompt</span>
                    <Field label="Hidden prompt prefix (users never see this)" hint="Prepended to whatever the user types. Use it to lock the style, camera and mood of the scenario.">
                      <textarea className={`${inputCls} h-24 resize-none`} value={cfg.systemPrompt} onChange={(e) => setCfg({ systemPrompt: e.target.value })} placeholder="Cinematic product commercial, slow orbit, studio lighting…" />
                    </Field>
                    <Toggle label="Show a text box to the user" checked={cfg.showPrompt} onChange={(v) => setCfg({ showPrompt: v })} />
                    {cfg.showPrompt && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Text box label">
                          <input className={inputCls} value={cfg.promptLabel} onChange={(e) => setCfg({ promptLabel: e.target.value })} placeholder="Describe your video" />
                        </Field>
                        <Field label="Placeholder">
                          <input className={inputCls} value={cfg.promptPlaceholder} onChange={(e) => setCfg({ promptPlaceholder: e.target.value })} placeholder="What should happen in the clip?" />
                        </Field>
                      </div>
                    )}
                  </div>

                  <div className="border border-divider/40 rounded-xl p-4 bg-bg-page/10 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-divider/20">
                      <div>
                        <span className="text-[11px] font-black text-primary uppercase tracking-widest block">Extra inputs</span>
                        <span className="text-[10px] text-secondary-text">
                          Keys map to fal.ai fields ({model?.mode === "t2v" ? "aspect_ratio, duration, resolution, seed" : model?.mode === "r2v" ? "reference_image_urls, reference_video_urls, reference_audio_urls, duration…" : "image_url, end_image_url, duration, resolution, seed"}). Hidden = fixed value, never shown.
                        </span>
                      </div>
                      <button type="button" onClick={() => setShowJson(!showJson)} className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded cursor-pointer shrink-0">
                        {showJson ? "Cancel" : "Import JSON"}
                      </button>
                    </div>

                    {showJson && (
                      <div className="space-y-2 p-3 bg-bg-page border border-divider rounded-lg">
                        <textarea
                          value={jsonInput}
                          onChange={(e) => setJsonInput(e.target.value)}
                          placeholder='{ "image_url": "", "duration": 5, "resolution": "768P" }'
                          className={`${inputCls} h-20 font-mono`}
                        />
                        <button type="button" onClick={importJson} className="w-full py-2 bg-primary text-white text-[10px] font-bold rounded cursor-pointer">
                          Parse
                        </button>
                      </div>
                    )}

                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-subtle">
                      {cfg.userParams.length === 0 ? (
                        <div className="text-center py-8 text-secondary-text text-xs">No extra inputs — the user only sees the upload and/or text box.</div>
                      ) : (
                        cfg.userParams.map((param, index) => (
                          <div key={index} className="p-3 bg-bg-page/40 border border-divider/40 rounded-lg space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-primary uppercase tracking-wider">#{index + 1}</span>
                              <button type="button" onClick={() => setParams((l) => l.filter((_, i) => i !== index))} className="text-secondary-text hover:text-red-500 p-1 cursor-pointer">
                                <FaTrash size={10} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <Field label="Key">
                                <input className={inputCls} value={param.key} onChange={(e) => updateParam(index, { key: e.target.value })} placeholder="duration" />
                              </Field>
                              <Field label="Label">
                                <input className={inputCls} value={param.label || ""} onChange={(e) => updateParam(index, { label: e.target.value })} />
                              </Field>
                              <Field label="Type">
                                <CustomSelect
                                  value={param.type}
                                  onChange={(v) => {
                                    const patch = { type: v };
                                    if (v === "boolean") patch.defaultValue = false;
                                    else if (v === "number" || v === "slider") patch.defaultValue = Number(param.defaultValue) || 0;
                                    else if (UPLOAD_TYPES.includes(v)) {
                                      patch.defaultValue = [];
                                      patch.maxInputs = param.maxInputs || 1;
                                    } else if (typeof param.defaultValue !== "string") patch.defaultValue = "";
                                    if (v === "enum") patch.options = param.options || [];
                                    updateParam(index, patch);
                                  }}
                                  options={PARAM_TYPE_OPTIONS}
                                />
                              </Field>
                              <Field label={param.type === "hidden" ? "Fixed value" : "Default"}>
                                {param.type === "boolean" ? (
                                  <CustomSelect
                                    value={param.defaultValue ? "true" : "false"}
                                    onChange={(v) => updateParam(index, { defaultValue: v === "true" })}
                                    options={[{ label: "False", value: "false" }, { label: "True", value: "true" }]}
                                  />
                                ) : UPLOAD_TYPES.includes(param.type) ? (
                                  <input className={inputCls} disabled value="(uploaded by user)" />
                                ) : (
                                  <input
                                    type={param.type === "number" || param.type === "slider" ? "number" : "text"}
                                    className={inputCls}
                                    value={param.defaultValue ?? ""}
                                    onChange={(e) => updateParam(index, { defaultValue: param.type === "number" || param.type === "slider" ? Number(e.target.value) : e.target.value })}
                                  />
                                )}
                              </Field>
                            </div>

                            {UPLOAD_TYPES.includes(param.type) && (
                              <div className="grid grid-cols-2 gap-2">
                                <Field label="Max files">
                                  <input type="number" min="1" max="12" className={inputCls} value={param.maxInputs ?? 1} onChange={(e) => updateParam(index, { maxInputs: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} />
                                </Field>
                                <Field label="Help text">
                                  <input className={inputCls} value={param.help || ""} onChange={(e) => updateParam(index, { help: e.target.value })} />
                                </Field>
                              </div>
                            )}
                            {param.type === "enum" && (
                              <div className="grid grid-cols-2 gap-2">
                                <Field label="Options (comma separated)">
                                  <input
                                    className={inputCls}
                                    value={param.optionsText ?? (param.options || []).join(", ")}
                                    onChange={(e) => updateParam(index, { optionsText: e.target.value, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                                    placeholder="480P, 768P"
                                  />
                                </Field>
                                <Field label="Extra credits per option">
                                  <input
                                    className={inputCls}
                                    value={param.costModifiersText ?? (param.costModifiers || []).join(", ")}
                                    onChange={(e) => updateParam(index, { costModifiersText: e.target.value, costModifiers: e.target.value.split(",").map((s) => Number(s.trim()) || 0) })}
                                    placeholder="0, 20"
                                  />
                                </Field>
                              </div>
                            )}
                            {(param.type === "slider" || param.type === "number") && (
                              <div className="grid grid-cols-4 gap-2">
                                <Field label="Min"><input type="number" className={inputCls} value={param.min ?? ""} onChange={(e) => updateParam(index, { min: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
                                <Field label="Max"><input type="number" className={inputCls} value={param.max ?? ""} onChange={(e) => updateParam(index, { max: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
                                <Field label="Step"><input type="number" className={inputCls} value={param.step ?? 1} onChange={(e) => updateParam(index, { step: Number(e.target.value) || 1 })} /></Field>
                                <Field label="Credits / unit"><input type="number" className={inputCls} value={param.costPerUnit ?? 0} onChange={(e) => updateParam(index, { costPerUnit: Number(e.target.value) })} /></Field>
                              </div>
                            )}
                            {param.type === "boolean" && (
                              <Field label="Extra credits when on">
                                <input type="number" className={inputCls} value={param.costIfTrue ?? 0} onChange={(e) => updateParam(index, { costIfTrue: Number(e.target.value) })} />
                              </Field>
                            )}
                            {(param.type === "text" || param.type === "textarea") && (
                              <Field label="Placeholder">
                                <input className={inputCls} value={param.placeholder || ""} onChange={(e) => updateParam(index, { placeholder: e.target.value })} />
                              </Field>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setParams((l) => [...l, { key: `param_${Date.now().toString().slice(-4)}`, label: "New input", type: "text", defaultValue: "" }])} className="flex-1 py-2 border border-dashed border-divider hover:border-primary/50 text-[10px] font-bold text-secondary-text hover:text-white rounded cursor-pointer">
                        + Add input
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCfg({ duration: "" });
                          setParams((l) => [...l.filter((p) => p.key !== "duration"), { key: "duration", label: "Length", type: "slider", defaultValue: 5, min: DURATION_MIN, max: DURATION_MAX, step: 1, costPerUnit: Math.ceil(suggested / durationForEstimate) }]);
                        }}
                        className="flex-1 py-2 border border-dashed border-divider hover:border-primary/50 text-[10px] font-bold text-secondary-text hover:text-white rounded cursor-pointer"
                      >
                        + Let the user pick length (5–15s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-divider/40">
                <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 bg-bg-page border border-divider text-secondary-text rounded text-xs font-bold hover:bg-bg-card cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white rounded text-xs font-bold shadow-md cursor-pointer">
                  {saving ? "Saving…" : form.id ? "Save changes" : "Create tool"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
