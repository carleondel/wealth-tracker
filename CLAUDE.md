@AGENTS.md

# Wealth Tracker

Personal net-worth dashboard with auth + multi-tenancy. Each user sees only
their own data. Includes a public `/demo` route backed by fake in-memory data.

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth magic link) via `@supabase/supabase-js`
- Recharts (charts) + Lucide (icons)
- Prices: CoinGecko (crypto, no key), Finnhub (US stocks, free `FINNHUB_API_KEY`),
  Frankfurter (USD/EUR, no key)

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — lint

## Environment (`.env.local`, gitignored)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # or the legacy JWT anon key
```

`NEXT_PUBLIC_*` are public-by-design (Supabase RLS enforces security).
Server-only: `FINNHUB_API_KEY`, and for the daily cron `SUPABASE_SERVICE_ROLE_KEY`
+ `CRON_SECRET` (see README "Daily snapshot").

## Data model
SQL lives in `supabase/schema.sql` (base tables) and
`supabase/migrations/` (incremental changes). Run them in order in the Supabase
SQL editor. Seed data is **not** in SQL — each user clicks "Cargar datos de
ejemplo" to seed their own rows via `lib/seed.ts`.

Tables (all rows gated by `owner_id = auth.uid()`):
- `positions` — tickers held (shares, avg_price_usd, category, platform, role, target_price_usd, is_crypto)
- `manual_assets` — cash/savings accounts + `interest_rate_annual`
- `snapshots` — point-in-time net worth (total_eur, breakdown, prices, fx)
- `contributions` — recorded contributions (amount_eur, type, date)
- `user_settings` — one row per user: `category_targets` jsonb (target % per category)
- `trades` — one row per buy/sell applied from the Journal (signed shares, price_usd,
  amount_eur, funding, realized_usd for sells, date). Append-only log; positions stay
  the source of truth for current holdings.

## Auth flow
1. User lands on `/` → `components/login-screen.tsx` asks for email.
2. `signInWithOtp` sends an email with a magic link **and** a one-time code
   (the Supabase "Magic Link" template must include `{{ .Token }}`).
3. Either the user types the code → `verifyOtp({ email, token, type: "email" })`,
   or clicks the link → redirects to `/` with session tokens in the URL hash,
   which `@supabase/supabase-js` parses.
4. The code path is required for the iOS home-screen app: it has its own
   storage, so a link opened in Safari never logs the installed app in.
5. `components/dashboard.tsx` receives `userId` + `userEmail` as props and
   filters everything through Supabase RLS.

`/demo` bypasses auth entirely — it renders the same `Dashboard` with
`demoMode` prop which short-circuits every Supabase call to local state.

## Categories, roles, policy
- Colors: Crypto `#F7931A`, Crypto Proxy `#FF6B35`, Gold Miners `#D4AF37`,
  Equities `#4A9EFF`, Liquidez `#52D9A4`.
- Roles: `core` · `tactica` · `cobertura` · `complemento` · `caja` · `residual`.
- `lib/policy.ts` holds `POLICY` constants (liquidity target, MSTR exit bands…).
  These are currently global — future work may make them per-user.
- `CATEGORY_TARGETS` in `policy.ts` are only the **defaults**; the effective
  targets come from `user_settings.category_targets` (loaded in `dashboard.tsx`,
  edited in the "Asignación vs objetivo" card).

## UI guidelines
- Dark theme, background `#080C18`, monospace font (Geist Mono).
- Four tabs: **Resumen** (`overview.tsx`: P&L + evolution chart, distribution,
  liquidity, plan) · **Cartera** (`portfolio.tsx`: allocation vs target, positions
  grouped by category, collapsible simulator) · **Benchmark** (`benchmark.tsx`:
  time-weighted return vs S&P 500 and BTC, € or $) · **Movimientos**
  (`journal.tsx`: manual ops + contributions history).
- Persistent top header: total EUR + today's change · USD/EUR and BTC chips · UPDATE + pencil · last update.
- Values displayed in EUR. Asset prices shown in USD.
- FX/BTC chips show a status dot (LIVE / FALLBACK / MANUAL); clicking them opens
  the pencil modal to override.
- Role explanations live in `ROLE_INFO` (`lib/policy.ts`) and show as tooltips.

## How prices work
- Prices are **never** auto-fetched on page load.
- Fetch logic lives in `lib/prices-server.ts` (`fetchPrices`), shared by
  `/api/prices` and `/api/cron/snapshot`. Server-only.
- `vercel.json` schedules `/api/cron/snapshot` daily at 22:00 UTC: service-role
  client, one price fetch for the union of tickers, one snapshot per user.
  Protected by `CRON_SECRET` bearer header.
- User clicks `UPDATE` → `/api/prices?tickers=…` → parallel fan-out to:
  - CoinGecko `simple/price?include_24hr_change=true` for crypto (BTC-USD, SOL-USD, XRP-USD, USDC-USD…).
  - Finnhub single-symbol CSV per US stock ticker (`...q/l/?s=<ticker>.us&f=sd2t2ohlcv&h&e=csv`). Intraday % change derived from `(close − open) / open`.
  - Frankfurter (ECB reference) for USD→EUR.
- USDC and USDT are pinned to 1. Partial failures land in `errors[]` and
  surface as a banner; working tickers still save a snapshot.
- The pencil icon opens the manual-entry modal for overrides.

## How performance is measured
- Resumen shows `getPnLForRange`: net change minus contributions in the period
  (simple, in €). Its % is relative to the baseline total.
- Benchmark shows `getTimeWeightedReturn` (TWR): one snapshot per day
  (`lastSnapshotPerDay`), sub-period returns chained, contribution dated D
  neutralised at the start of day D's sub-period. The % is independent of how
  much was contributed. Benchmarks come from `/api/benchmark` (Yahoo ^GSPC and
  BTC-USD, CoinGecko fallback for BTC, Frankfurter USD/EUR series; 1h cache)
  and are fetched once when the tab mounts — this is the only network call
  outside UPDATE, and it never touches positions or snapshots.

## How the Journal works
- `components/manual-op-form.tsx` builds ops (buy, sell, deposit, withdraw) typed in `lib/journal-ops.ts`.
- The `JournalTab` shows a checkbox list of ops; `applyJournalOps` in the
  dashboard executes the checked ones against Supabase (or local state in demo).
- Buy/Sell ops carry a cash counterpart ("Pagado con"): a liquidity account
  (`adjust_asset`) or external money (`contribute`, negative for sells). Every
  applied `adjust_position` also inserts a `trades` row.
- The Journal lists the trade log and contributions, each with a CSV export
  (`lib/csv.ts`, client-side Blob download).

## Project structure
```
app/
  layout.tsx
  page.tsx                   # auth gate (login vs dashboard)
  icon.tsx / apple-icon.tsx  # PNG icons rendered from LogoMark
  manifest.ts                # PWA manifest
  demo/page.tsx              # public demo, demoMode=true
  api/prices/route.ts        # user-triggered prices → fetchPrices
  api/cron/snapshot/route.ts # daily snapshot for all users (Vercel Cron)
  api/benchmark/route.ts     # S&P 500 + BTC daily closes + USD/EUR series
components/
  dashboard.tsx              # all state + handlers (branches on demoMode)
  login-screen.tsx           # email → OTP code (or magic link)
  logo.tsx                   # LogoMark SVG (UI + generated icons)
  header.tsx
  update-prices-modal.tsx    # manual price entry fallback
  edit-position-modal.tsx    # CRUD positions
  edit-asset-modal.tsx       # CRUD manual assets + apply interest
  tabs/{overview,portfolio,benchmark,journal}.tsx
  ui/{card,badge,button,progress,range-pills}.tsx
lib/
  supabase.ts                # client
  types.ts                   # Position, ManualAsset, Snapshot, Contribution…
  policy.ts                  # POLICY constants, category colors/targets, ROLE_INFO
  prices-server.ts           # CoinGecko + Finnhub + Frankfurter aggregator (server)
  calculations.ts            # P&L, TWR, breakdown, deviation, accrued interest
  benchmark.ts               # benchmark types + pct-at-dates helper (shared)
  format.ts                  # fmtEur, fmtUsd, fmtPct, fmtDateTime
  csv.ts                     # toCsv + downloadCsv for the export buttons
  seed.ts                    # DEMO_POSITIONS / DEMO_MANUAL_ASSETS (fake data)
  demo.ts                    # makeDemo* + generateDemoSnapshots for /demo
  journal-ops.ts             # Op types, describeOp
supabase/
  schema.sql                 # base tables
  migrations/
    001_snapshots_prices.sql
    002_multi_tenant.sql
    003_asset_interest.sql
    004_user_settings.sql
    005_trades.sql
```

## Secrets + repo hygiene
- `.env.local` is gitignored. Never commit real keys.
- `lib/seed.ts` contains **only fictitious** example data. Never put real
  holdings here — the repo will be published as portfolio.
- Supabase URL + publishable key are safe to document in the README (public by
  design, RLS enforces per-user access).

## Behaviors to enforce
- Do **not** fetch prices on page load.
- Do **not** bypass RLS — always include `owner_id: userId` on inserts.
- Do **not** commit real portfolio numbers to `lib/seed.ts`.
- Do **not** add `demoMode` branches outside `dashboard.tsx` — keep demo
  detection in one place.
- Do **not** write tests yet.
- Keep commit messages focused on *why*, one or two sentences. Git commits are
  authored by the user directly; the assistant does not run `git commit`.
