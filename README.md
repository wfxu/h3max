# h3max.info — H3 Max Hub + Studio

Two things live in this repo:

1. **The hub** — the hand-written landing page at `/` (`public/index.html`): official links, fal.ai APIs, open weights, pricing, guides. Served as a static file, byte-for-byte the original site.
2. **The Studio** — a Next.js app under `/studio`: ready-made MiniMax H3 Max video tools. Each tool is one *scenario* (fixed fal.ai endpoint, length, resolution, aspect ratio and a hidden prompt prefix) with a minimal form, so users only add a photo or a sentence. Google sign-in, credits, Stripe checkout, per-user gallery, admin console.

Live: https://h3max.info · Independent community project, not affiliated with MiniMax or fal.ai.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 7 + PostgreSQL · NextAuth (Google) · Creem (merchant of record; Stripe optional) · `@fal-ai/client` (queue API + webhooks)

## Routes

| Path | What |
|---|---|
| `/` | static hub page (`public/index.html`, via a rewrite in `next.config.mjs`) |
| `/studio` | public directory of tools (server-rendered) |
| `/studio/[slug]` | one tool: form → generate → result |
| `/studio/[slug]/gallery`, `/gallery` | the signed-in user's clips |
| `/pricing` | credit packs (one-time purchase via Creem, or Stripe) |
| `/admin` | operator console: create/edit/publish tools (`ADMIN_EMAILS` only) |
| `/api/generation` | charges credits, whitelists inputs, submits to fal.ai |
| `/api/webhook/fal` | fal.ai completion webhook (ED25519 signature verified) |
| `/api/webhook/creem`, `/api/webhook/stripe` | credit top-ups (HMAC / Stripe-signature verified, idempotent per order) |

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

1. PostgreSQL (Supabase / Neon): set `DATABASE_URL` and `DIRECT_URL`, run `npx prisma db push` once.
2. Google OAuth client with redirect URI `https://h3max.info/api/auth/callback/google`.
3. `FAL_KEY` from fal.ai; `WEBHOOK_URL=https://h3max.info` so fal can post completions.
4. Payments (`PAYMENT_PROVIDER=creem`): a Creem account (accepts individual sellers from mainland China), one product per credit pack → `CREEM_PRODUCT_*`, `CREEM_API_KEY`, and a webhook for `checkout.completed` → `https://h3max.info/api/webhook/creem` (`CREEM_WEBHOOK_SECRET`). Use a `creem_test_…` key first: it targets `test-api.creem.io` and charges nothing. Stripe works the same way with `PAYMENT_PROVIDER=stripe`.
5. `ADMIN_EMAILS` — the operator Google account(s).
6. `npm run db:seed` once to publish the starter scenarios, then tune them in `/admin`.

## Pricing model

1 credit = $0.01. Suggested tool prices are fal.ai list price × 1.5 (`src/lib/models.js`): H3 Max 768P → 12 credits/s, H3 Max Turbo 768P → 6/s, Turbo 480P → 4/s. New accounts start with 60 credits. Failed renders are refunded automatically.

## Submit a link to the hub

Open an issue: https://github.com/wfxu/h3max/issues/new
