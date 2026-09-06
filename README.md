# h3max.info — H3 Max Hub + Studio

Two things live in this repo:

1. **The hub** — the hand-written landing page at `/` (`public/index.html`): official links, fal.ai APIs, open weights, pricing, guides. Served as a static file, byte-for-byte the original site.
2. **The Studio** — a Next.js app under `/studio`: ready-made MiniMax H3 Max video tools. Each tool is one *scenario* (fixed fal.ai endpoint, length, resolution, aspect ratio and a hidden prompt prefix) with a minimal form, so users only add a photo or a sentence. Google sign-in, credits, Stripe checkout, per-user gallery, admin console.

Live: https://h3max.info · Independent community project, not affiliated with MiniMax or fal.ai.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 7 + PostgreSQL · NextAuth (Google) · PayPal Checkout (Creem/Stripe adapters optional) · `@fal-ai/client` (queue API + webhooks)

## Routes

| Path | What |
|---|---|
| `/` | static hub page (`public/index.html`, via a rewrite in `next.config.mjs`) |
| `/studio` | public directory of tools (server-rendered) |
| `/studio/[slug]` | one tool: form → generate → result |
| `/studio/[slug]/gallery`, `/gallery` | the signed-in user's clips |
| `/pricing` | credit packs — PayPal Checkout (Creem/Stripe adapters exist but are off) |
| `/admin` | operator console: create/edit/publish tools (`ADMIN_EMAILS` only) |
| `/legal/terms`, `/legal/privacy`, `/legal/refunds` | policies (edit the text in `src/app/legal/[page]/page.js`) |
| `/contact` | contact form → your inbox via Resend (`RESEND_API_KEY`, `CONTACT_TO`); shows a GitHub fallback until configured. Also shows `NEXT_PUBLIC_SUPPORT_EMAIL` (e.g. `support@h3max.info`) once inbound mail is set up |
| `/api/webhook/resend` | Resend Receiving webhook (`email.received`, Svix-signed with `RESEND_WEBHOOK_SECRET`): fetches the received mail + attachments from the Receiving API and forwards them to `CONTACT_TO`, so any `*@your-domain` address reaches you without exposing a personal inbox |
| `/api/generation` | charges credits, whitelists inputs, submits to fal.ai |
| `/api/webhook/fal` | fal.ai completion webhook (ED25519 signature verified) |
| `/api/paypal/return`, `/api/webhook/paypal`, `/api/webhook/creem`, `/api/webhook/stripe` | credit top-ups (signature-verified, idempotent per order) |

## Local development

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL, NEXTAUTH_SECRET, ADMIN_EMAILS
npx prisma db push            # create tables
npx prisma generate
npm run db:seed               # six starter scenarios
npm run dev
```

- Leave `FAL_KEY` empty to run in **mock mode**: generations complete instantly with a sample clip and cost nothing at fal.ai (credits are still deducted so the flow can be tested). Uploads are inlined as data URIs.
- `/api/dev-login` (non-production only) signs you in as `dev@local.test` without Google. Put that address in `ADMIN_EMAILS` to reach `/admin`.
- `npm test` runs the unit tests (cost model, input whitelisting, webhook signature verification, slugs).

## Production checklist

A git-ignored `.env.vercel` in the repo root lists every variable with a fresh `NEXTAUTH_SECRET`; fill it in and copy to Vercel → Settings → Environment Variables.

1. PostgreSQL (Supabase / Neon): set `DATABASE_URL` and `DIRECT_URL`, run `npx prisma db push` once.
2. Google OAuth client with redirect URI `https://h3max.info/api/auth/callback/google`.
3. `FAL_KEY` from fal.ai; `WEBHOOK_URL=https://h3max.info` so fal can post completions.
4. Payments (`PAYMENT_PROVIDERS=paypal`): **PayPal** — a REST app on developer.paypal.com → `PAYPAL_CLIENT_ID/SECRET`, `PAYPAL_ENV=live` (live credentials need a PayPal Business account), a webhook for `PAYMENT.CAPTURE.COMPLETED` → `https://h3max.info/api/webhook/paypal` (`PAYPAL_WEBHOOK_ID`). **Creem** — a Creem account (accepts individual sellers from mainland China), one product per credit pack → `CREEM_PRODUCT_*`, `CREEM_API_KEY`, and a webhook for `checkout.completed` → `https://h3max.info/api/webhook/creem` (`CREEM_WEBHOOK_SECRET`). Use a `creem_test_…` key first: it targets `test-api.creem.io` and charges nothing. Stripe works the same way with `PAYMENT_PROVIDER=stripe`.
5. `ADMIN_EMAILS` — the operator Google account(s).
6. `npm run db:seed` once to publish the starter scenarios, then tune them in `/admin`.

## Scenario recipe: prompt templates + image-aware inputs

A tool's prompt can be a **template** with placeholders: `{prompt}` = the user's text box, `{key}` = any extra input.
An input can be **auto-filled from the uploaded image**: mark it `autofill: vision` and give it an instruction; right after
the upload, `/api/analyze` runs fal `any-llm/vision` (Gemini 2.5 Flash, a few cents) and fills the field, which the user can still edit.

Example — *Profile Page Takeover* (seeded): the user uploads an X profile screenshot and types a line. The template contains
`{character}` (auto-described avatar person, keeps the actor consistent) and `{text}` (the line to graffiti). Everything else —
15 s, 768P, the whole choreography — is baked in. Mark such inputs `required` so generation refuses empty values.

## Pricing model

1 credit = $0.01. Suggested tool prices are fal.ai list price × 1.5 (`src/lib/models.js`): H3 Max 768P → 12 credits/s, H3 Max Turbo 768P → 6/s, Turbo 480P → 4/s. New accounts start with 60 credits. Failed renders are refunded automatically.

## Submit a link to the hub

Open an issue: https://github.com/wfxu/h3max/issues/new
