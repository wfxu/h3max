import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import config from "@/lib/config";

const UPDATED = "September 6, 2026";
const CONTACT = "the contact form at https://h3max.info/contact";

// Plain-language policies for a small credit-based generation service. Review before launch.
const PAGES = {
  terms: {
    title: "Terms of Service",
    sections: [
      ["What this is", `${config.appName} (h3max.info, "the Service") lets you generate short videos with MiniMax H3 Max through fal.ai using prepaid credits. By creating an account or buying credits you agree to these terms.`],
      ["Accounts", "You need a Google account to sign in. You are responsible for activity under your account. We may suspend accounts that abuse the Service, attempt to bypass limits, or generate prohibited content."],
      ["Credits and payments", "Credits are prepaid units used to generate videos. Prices are shown before you generate. Credits are bought through PayPal in USD, do not expire, are not transferable and, except where required by law, are non-refundable once used. Free credits granted at sign-up have no cash value."],
      ["Failed generations", "If a generation fails on our side or at the model provider, the credits it reserved are returned to your balance automatically."],
      ["Your content", "You keep the rights to what you upload and to the videos you generate, subject to the rights of the model provider (MiniMax / fal.ai). You must have the right to use any image you upload. Do not upload or generate content that is illegal, sexual involving minors, non-consensual, hateful, or that impersonates real people in a misleading way."],
      ["Availability", "The Service depends on third-party providers and is offered as-is. We may change tools, prices and features at any time. We are not liable for indirect losses; our total liability is limited to the amount you paid in the last 12 months."],
      ["Independence", "h3max.info is an independent community project and is not affiliated with MiniMax or fal.ai."],
      ["Contact", `Questions: use ${CONTACT}.`],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["What we collect", "Your Google account name, e-mail and avatar (for sign-in); the prompts, images and videos you create; your credit balance and purchase records (order id, amount, currency — never your card or PayPal login); basic server logs."],
      ["How we use it", "To run the Service: authenticate you, generate videos, keep your gallery, add credits after payment, prevent abuse, and improve the tools. We do not sell personal data and do not use your content to train models."],
      ["Who else sees it", "fal.ai processes your prompts and images to generate videos and hosts the resulting files. PayPal processes payments. Our database and hosting providers store data on our behalf. The public hub page uses Google Analytics and Vercel Analytics."],
      ["Retention", "Your gallery is kept while your account exists. Delete your account (contact us) and we remove your data within 30 days, except payment records we must keep for accounting."],
      ["Your rights", "You can ask for a copy of your data or its deletion at any time via the contact below. If you are in the EU/UK you also have the right to lodge a complaint with your supervisory authority."],
      ["Cookies", "We use only the cookies needed to keep you signed in, plus analytics on the hub page."],
      ["Contact", `Privacy requests: ${CONTACT}.`],
    ],
  },
  refunds: {
    title: "Refund Policy",
    sections: [
      ["Unused credits", "If you bought credits and have not used any of them, contact us within 14 days of purchase for a full refund to your original payment method."],
      ["Partly used packs", "Credits already spent on completed generations cannot be refunded. Remaining unused credits from a pack can be refunded on request within 14 days, minus the value of credits used."],
      ["Failed or broken results", "Credits for generations that fail are returned automatically. If a completed video is clearly broken (no video, corrupted file), tell us within 7 days and we will re-credit it."],
      ["Quality of AI output", "Generative video is probabilistic. A result that is technically fine but not what you hoped for is not a defect and is not refundable — use the cheaper Quick Draft tool to iterate before spending on longer clips."],
      ["How to ask", `Use ${CONTACT} with your account e-mail and the PayPal transaction id. Refunds are processed through PayPal within 5–10 business days.`],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}

export async function generateMetadata({ params }) {
  const { page } = await params;
  const doc = PAGES[page];
  return doc ? { title: doc.title } : {};
}

export default async function LegalPage({ params }) {
  const { page } = await params;
  const doc = PAGES[page];
  if (!doc) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Navbar />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-2 border-b border-divider/40 pb-6">
          <h1 className="text-3xl font-black tracking-tight">{doc.title}</h1>
          <p className="text-xs text-secondary-text">Last updated {UPDATED} · h3max.info</p>
        </div>
        <div className="space-y-6">
          {doc.sections.map(([heading, body]) => (
            <section key={heading} className="space-y-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-primary">{heading}</h2>
              <p className="text-sm text-secondary-text leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
        <nav className="flex gap-4 text-xs pt-6 border-t border-divider/40">
          {Object.entries(PAGES).map(([slug, d]) => (
            <Link key={slug} href={`/legal/${slug}`} className={slug === page ? "text-primary font-bold" : "text-secondary-text hover:text-primary-text"}>
              {d.title}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </div>
  );
}
