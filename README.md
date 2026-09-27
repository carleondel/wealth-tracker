# Wealth Tracker

Personal net-worth dashboard. Bring-your-own Supabase, self-hostable in
minutes. Multi-user with magic-link auth, no signup forms. Live prices without
API keys. Form-based journal to log buys, sells and account moves.

![Demo](./assets/demo.gif)

Built as a personal tool and as a portfolio piece. The UI is in Spanish — the
underlying code, schema and docs are in English.

## Three ways to use it

- 🧪 **Public demo (no signup)** → [**wealth-tracker-liart.vercel.app/demo**](https://wealth-tracker-liart.vercel.app/demo)
  Fictitious data, real prices. All interactions work — nothing persists. No
  account required.

- 🟢 **Hosted instance with your own data** → [**wealth-tracker-liart.vercel.app**](https://wealth-tracker-liart.vercel.app)
  Sign in with a magic link to your email. Your rows live in this project's
  Supabase, isolated from every other user via row-level security (see
  [Security model](#security-model) — and especially the trust trade-off if
  you use my deployment instead of your own).

- 🛠️ **Self-host** → fork this repo and follow [Self-host](#self-host-5-minutes)
  below. Full data sovereignty: your Supabase, your Vercel, your control.

---

## Why this exists

Off-the-shelf trackers force you to either upload broker statements (privacy
hostile) or pick from a tiny set of categories that don't match how you
actually think about your portfolio. This app does neither: you own the
database, you define the positions, and prices come from public feeds.

It's opinionated about workflow (snapshot-on-update, role-tagged positions,
liquidity-target rules) and unopinionated about what you hold — start with a
template or from scratch.

---

## Features

- 🔒 **Multi-tenant magic-link auth.** Each user only sees their own rows
  (Postgres RLS scoped to `auth.uid()`). No passwords, no signup form.
- 📈 **Live prices from free APIs.** CoinGecko (crypto) and Frankfurter ECB
  rates (USD↔EUR) work with no key. Finnhub (US stocks) needs a free key —
  signup is 30 seconds at [finnhub.io](https://finnhub.io).
- 📝 **Journal.** Log buys, sells, deposits and withdrawals from a simple
  form, review the queued operations and apply them in one go.
- 💰 **Interest accrual** on cash accounts. The app tracks days elapsed ×
  annual rate; you confirm before persisting.
- 📊 **Three tabs:** Resumen (performance + evolution chart) · Cartera
  (allocation + positions + scenario simulator) · Movimientos (journal +
  contributions).
- 🎨 **Dark monospace UI**, responsive down to mobile.
- 🪟 **Public `/demo` route** with fictitious data + real prices. All
  interactions work but nothing persists. No auth required.

---

## Screenshots

### Login
Passwordless — type your email, then enter the code from the email or click the link.

![Login](./assets/01-login.png)

### Resumen
Market performance for the selected range (contributions excluded) with the
net-worth evolution chart right below it, in € or %. Then the category
breakdown, liquidity cushion vs target, and the plan: this month's
contribution rule plus progress towards every price target.

![Resumen](./assets/02-overview.png)

### Cartera
Current vs target allocation per category, then every position and cash
account in compact rows grouped by category (price, 24h, P&L, weight, value).
Tap a row to edit it. A collapsible scenario simulator previews BTC / MSTR /
USD-EUR moves.

![Cartera](./assets/03-positions.png)

![Edit position modal](./assets/04-edit-position.png)

### Movimientos
Build operations (buy, sell, deposit, withdraw) from a form. They queue up
for review and nothing hits the DB until you apply them. The contribution
history lives below.

![Movimientos](./assets/08-journal.png)

---

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind v4
- **DB & auth:** Supabase (Postgres + Auth magic link)
- **Charts:** Recharts
- **Icons:** Lucide
- **Prices:** CoinGecko (crypto, no key) · Finnhub (stocks, free key) · Frankfurter (FX, no key)
- **Hosting:** Vercel (zero-config deploy from this repo)

---

## Self-host (5 minutes)

### 1. Clone and install

```bash
git clone https://github.com/carleondel/wealth-tracker
cd wealth-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. **SQL Editor** → new query → paste `supabase/schema.sql` → Run.
3. Run each migration in order: `supabase/migrations/001_*.sql`,
   `002_*.sql`, `003_*.sql`.
4. **Authentication → URL Configuration:** add `http://localhost:3000/**` to
   Redirect URLs. Set Site URL to `http://localhost:3000` (or your Vercel
   URL once deployed).
5. **Authentication → Providers → Email:** make sure Email is enabled.
   "Confirm email" can stay off for the magic-link flow.
6. **Authentication → Email Templates → Magic Link:** add the one-time code
   to the body, e.g. `<p>Tu código: <strong>{{ .Token }}</strong></p>`. The
   login screen accepts that code, which is the only way to sign in from an
   iOS home-screen app (it doesn't share storage with Safari, where the link
   opens).
7. **Project Settings → API:** copy your `Project URL` and the
   `publishable` key.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `publishable` key works; the legacy
  JWT anon key also works)
- `FINNHUB_API_KEY` *(needed for US stock prices.
  [Get one free in 30s](https://finnhub.io) — free tier covers 60 req/min)*

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your email, type
the code from the email (or click the link), then pick a template on the
empty dashboard.

### 5. Deploy

Push to GitHub, connect Vercel to the repo, paste the same env vars into the
project settings. Magic link works the same in production — just remember to
add the production URL to Supabase's Redirect URLs.

---

## Templates included

When a new user signs in, they pick one of three starting tesis (or start
empty):

| Template | Style | Positions |
|---|---|---|
| **Crypto-first** | BTC core, MSTR tactical, gold miners hedge, megacap tech | 14 |
| **Index ETF** | Bogleheads-style passive 4-fund | 4 (VOO, VXUS, BND, VNQ) |
| **Dividend Income** | Dividend ETFs + aristocrats | 6 (SCHD, VYM, JEPI, O, KO, T) |

All numbers are fictitious. Edit any position via the UI to make it yours —
no SQL required.

---

## Security model

- **Per-user isolation.** Every table has an `owner_id uuid references
  auth.users(id)` column. Row-level security policies enforce
  `auth.uid() = owner_id` on every read and write. A user cannot read or
  modify another user's rows even if they guess IDs.
- **Public anon key is by design.** Supabase's anon/publishable key ships in
  the browser bundle. Security comes from RLS, not from hiding the key.
- **Server secrets** (Finnhub key) live in `.env.local` and never leave the
  Next.js server. The `/api/prices` route is the only place that uses it.
- **No analytics, no tracking, no telemetry.** The app talks to your Supabase
  and the public price feeds, nothing else.
- **Your data lives in your Supabase project.** This repo is just the UI.

### Using the hosted instance

If you use [wealth-tracker-liart.vercel.app](https://wealth-tracker-liart.vercel.app)
instead of self-hosting, be aware of the trade-off:

- **Your rows are isolated from other users.** Row-level security blocks
  other accounts from reading or writing your data through the app.
- **The project owner (me) has full DB access** as the Supabase admin. I
  don't read your data, but I technically could. Same situation as any
  hosted SaaS.
- **If I stop paying or get bored**, the deployment can go down. You'd lose
  access (your data still exists in the DB, but no UI to it).
- **No SLA, no support, no backups guaranteed.** It's a portfolio
  deployment, not a product.

If any of that bothers you, self-host. The five-minute guide above gives you
your own Supabase and your own Vercel, and the app behaves identically.

---

## Project structure

```
app/
  layout.tsx
  page.tsx                   # auth gate (login vs dashboard)
  icon.tsx / apple-icon.tsx  # app icons generated from components/logo.tsx
  manifest.ts                # PWA manifest (home-screen install)
  demo/page.tsx              # public demo, in-memory state
  api/prices/route.ts        # CoinGecko + Stooq + Frankfurter
components/
  dashboard.tsx              # state + handlers (live + demo)
  login-screen.tsx
  header.tsx
  update-prices-modal.tsx
  edit-position-modal.tsx
  edit-asset-modal.tsx
  tabs/{overview,portfolio,journal}.tsx
  ui/{card,badge,button,progress}.tsx
lib/
  supabase.ts                # browser client
  types.ts                   # TS types for DB rows
  policy.ts                  # POLICY constants + category colors/targets
  calculations.ts            # P&L, breakdown, deviation, accrued interest
  format.ts                  # money/percent formatters
  seed.ts                    # 3 templates with fictitious data
  demo.ts                    # synthetic snapshots for /demo
  journal-ops.ts             # Op types, describeOp
supabase/
  schema.sql
  migrations/
    001_snapshots_prices.sql
    002_multi_tenant.sql
    003_asset_interest.sql
```

---

## Roadmap

- [ ] Per-user policy settings (liquidity target, monthly contribution) editable from UI
- [ ] User-defined categories (today: 5 fixed enum values)
- [ ] CSV export
- [ ] Mobile-optimised PWA install
- [ ] Optional Touch/Face ID gate on top of magic link

---

## Contributing

This is a personal project published as a portfolio piece. Issues and PRs are
welcome but scope is intentionally narrow — feel free to fork freely.

---

## License

MIT
