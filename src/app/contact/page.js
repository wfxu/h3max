"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const inputCls =
  "w-full bg-bg-page border border-divider/60 rounded py-2.5 px-3 text-xs outline-none focus:border-primary/60 transition-all font-semibold text-primary-text";

export default function ContactPage() {
  const { data: session } = useSession();
  const [info, setInfo] = useState(null); // { enabled, supportEmail }
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    axios.get("/api/contact").then(({ data }) => setInfo(data)).catch(() => setInfo({ enabled: false }));
  }, []);

  useEffect(() => {
    if (session?.user?.email && !form.email) setForm((f) => ({ ...f, email: session.user.email, name: f.name || session.user.name || "" }));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await axios.post("/api/contact", form);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-2 border-b border-divider/40 pb-6">
          <h1 className="text-3xl font-black tracking-tight">Contact</h1>
          <p className="text-sm text-secondary-text">
            Billing questions, refund requests, broken renders, or a scenario you would like to see — write to us here.
            {info?.supportEmail && (
              <>
                {" "}Or e-mail <a href={`mailto:${info.supportEmail}`} className="text-primary font-bold hover:underline">{info.supportEmail}</a>.
              </>
            )}
          </p>
        </div>

        {sent ? (
          <div className="p-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm">
            <p className="font-bold text-emerald-400">Message sent.</p>
            <p className="text-secondary-text mt-1">We reply to the address you gave, usually within 1–2 days.</p>
          </div>
        ) : info && !info.enabled ? (
          <div className="p-6 rounded-lg bg-bg-card border border-divider/50 text-sm text-secondary-text">
            The contact form is not available right now. Please open an issue on{" "}
            <a href="https://github.com/wfxu/h3max/issues/new" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">GitHub</a>.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-secondary-text uppercase tracking-wider block">Name (optional)</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-secondary-text uppercase tracking-wider block">Your e-mail *</label>
                <input type="email" required className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-secondary-text uppercase tracking-wider block">Message *</label>
              <textarea required minLength={10} className={`${inputCls} h-40 resize-y`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Include the tool name, the time, and your PayPal transaction id if it is about a payment." />
            </div>
            {/* honeypot: hidden from people, tempting for bots */}
            <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" aria-hidden="true" />
            <button type="submit" disabled={sending || !info} className="bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white px-6 py-3 rounded-full text-xs font-bold shadow-md cursor-pointer active:scale-[0.98]">
              {sending ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
