"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChartLine,
  Database,
  Info,
  LayoutDashboard,
  LogOut,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Header } from "@/components/header";
import { UpdatePricesModal } from "@/components/update-prices-modal";
import { EditPositionModal, type PositionPayload } from "@/components/edit-position-modal";
import { EditAssetModal, type AssetPayload } from "@/components/edit-asset-modal";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { OverviewTab } from "@/components/tabs/overview";
import { PortfolioTab } from "@/components/tabs/portfolio";
import { JournalTab } from "@/components/tabs/journal";
import { BenchmarkTab } from "@/components/tabs/benchmark";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  getAccruedInterest,
  getCategoryBreakdown,
  getDayChange,
  getTotalEur,
} from "@/lib/calculations";
import {
  describeOp,
  findAssetByName,
  findPositionByTicker,
  type JournalOp,
} from "@/lib/journal-ops";
import {
  generateDemoSnapshots,
  makeDemoContributions,
  makeDemoManualAssets,
  makeDemoPositions,
} from "@/lib/demo";
import { TEMPLATES, getTemplate, type TemplateId } from "@/lib/seed";
import type {
  CategoryTargets,
  Contribution,
  ManualAsset,
  Position,
  PriceMap,
  PricesResult,
  Snapshot,
  Trade,
  UserSettings,
} from "@/lib/types";
import { CATEGORY_TARGETS, POLICY } from "@/lib/policy";

type Tab = "overview" | "portfolio" | "benchmark" | "journal";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "portfolio", label: "Cartera", icon: Wallet },
  { id: "benchmark", label: "Benchmark", icon: ChartLine },
  { id: "journal", label: "Movimientos", icon: ArrowLeftRight },
];

const DEFAULT_USD_EUR = 0.92;
const DEFAULT_BTC = 75000;

interface Props {
  userId: string;
  userEmail: string;
  /** When true, skips all Supabase calls and runs against local state only. */
  demoMode?: boolean;
}

const localId = () =>
  `local-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

export function Dashboard({ userId, userEmail, demoMode = false }: Props) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [manualAssets, setManualAssets] = useState<ManualAsset[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [categoryTargets, setCategoryTargets] = useState<CategoryTargets>(CATEGORY_TARGETS);
  const [speculationCapPct, setSpeculationCapPct] = useState<number>(POLICY.speculationCapPct);
  const [prices, setPrices] = useState<PriceMap>({});
  const [usdEur, setUsdEur] = useState(DEFAULT_USD_EUR);
  const [btcUsd, setBtcUsd] = useState(DEFAULT_BTC);
  const [fxSource, setFxSource] = useState<"LIVE" | "MANUAL" | "FALLBACK">(
    "FALLBACK",
  );
  const [btcSource, setBtcSource] = useState<"LIVE" | "MANUAL" | "FALLBACK">(
    "FALLBACK",
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [navHidden, setNavHidden] = useHideOnScrollDown();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null | undefined>(undefined);
  const [editingAsset, setEditingAsset] = useState<ManualAsset | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demoBannerOpen, setDemoBannerOpen] = useState(true);

  // Runs once on mount; `loading` starts true and `err` null, so no reset here.
  useEffect(() => {
    async function loadAll() {
      try {
        if (demoMode) {
          const pos = makeDemoPositions();
          const assets = makeDemoManualAssets();
          const contribs = makeDemoContributions();

          // Fetch live prices so the demo looks real.
          try {
            const tickers = pos.map((p) => p.ticker).join(",");
            const res = await fetch(
              `/api/prices?tickers=${encodeURIComponent(tickers)}`,
              { cache: "no-store" },
            );
            if (res.ok) {
              const data = (await res.json()) as PricesResult;
              if (Object.keys(data.prices ?? {}).length > 0) {
                setPrices(data.prices);
                setUsdEur(data.usdEur || DEFAULT_USD_EUR);
                const btc = data.btcUsd || data.prices["BTC-USD"]?.price || DEFAULT_BTC;
                setBtcUsd(btc);
                setFxSource("LIVE");
                setBtcSource("LIVE");
                // Generate a realistic history curve.
                const breakdown = getCategoryBreakdown(
                  pos,
                  assets,
                  data.prices,
                  data.usdEur,
                );
                const total = getTotalEur(breakdown);
                const fakeSnaps = generateDemoSnapshots(
                  total,
                  breakdown,
                  data.prices,
                  data.usdEur,
                  btc,
                  20,
                );
                setSnapshots(fakeSnaps);
              }
            }
          } catch {
            // Demo still usable without network; just no chart data.
          }
          // After the fetch so no state is set synchronously inside the mount effect.
          setPositions(pos);
          setManualAssets(assets);
          setContributions(contribs);
          return;
        }

        const [p, m, s, c, st, t] = await Promise.all([
          supabase.from("positions").select("*").order("created_at"),
          supabase.from("manual_assets").select("*").order("name"),
          supabase
            .from("snapshots")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("contributions")
            .select("*")
            .order("date", { ascending: false }),
          supabase.from("user_settings").select("*").maybeSingle(),
          supabase
            .from("trades")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);
        if (p.error) throw p.error;
        if (m.error) throw m.error;
        if (s.error) throw s.error;
        if (c.error) throw c.error;
        if (st.error) throw st.error;
        if (t.error) throw t.error;
        setTrades(t.data as Trade[]);

        setPositions(p.data as Position[]);
        setManualAssets(m.data as ManualAsset[]);
        setSnapshots(s.data as Snapshot[]);
        setContributions(c.data as Contribution[]);
        const settings = st.data as UserSettings | null;
        setCategoryTargets({
          ...CATEGORY_TARGETS,
          ...(settings?.category_targets ?? {}),
        });
        setSpeculationCapPct(
          settings?.speculation_cap_pct != null
            ? Number(settings.speculation_cap_pct)
            : POLICY.speculationCapPct,
        );

        const latest = (s.data as Snapshot[])[0];
        if (latest) {
          setUsdEur(Number(latest.usd_eur_rate) || DEFAULT_USD_EUR);
          setBtcUsd(Number(latest.btc_price_usd) || DEFAULT_BTC);
          setPrices((latest.prices as unknown as PriceMap) ?? {});
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [demoMode]);

  const breakdown = useMemo(
    () => getCategoryBreakdown(positions, manualAssets, prices, usdEur),
    [positions, manualAssets, prices, usdEur],
  );
  const totalEur = useMemo(() => getTotalEur(breakdown), [breakdown]);
  const dayChange = useMemo(
    () => getDayChange(positions, prices, usdEur, totalEur),
    [positions, prices, usdEur, totalEur],
  );

  const persistSnapshot = useCallback(
    async (
      result: PricesResult,
      source: "LIVE" | "MANUAL",
    ): Promise<Snapshot | null> => {
      const mergedPrices: PriceMap = { ...prices, ...result.prices };
      const nextBreakdown = getCategoryBreakdown(
        positions,
        manualAssets,
        mergedPrices,
        result.usdEur,
      );
      const nextTotal = getTotalEur(nextBreakdown);

      if (demoMode) {
        const localSnap: Snapshot = {
          id: localId(),
          total_eur: nextTotal,
          breakdown: nextBreakdown,
          prices: mergedPrices,
          usd_eur_rate: result.usdEur,
          btc_price_usd: result.btcUsd,
          created_at: new Date().toISOString(),
        };
        setPrices(mergedPrices);
        setUsdEur(result.usdEur);
        setBtcUsd(result.btcUsd);
        setFxSource(source);
        setBtcSource(source);
        setSnapshots((prev) => [localSnap, ...prev]);
        return localSnap;
      }

      const { data, error } = await supabase
        .from("snapshots")
        .insert({
          owner_id: userId,
          total_eur: nextTotal,
          breakdown: nextBreakdown,
          prices: mergedPrices,
          usd_eur_rate: result.usdEur,
          btc_price_usd: result.btcUsd,
        })
        .select()
        .single();
      if (error) {
        setErr(error.message);
        return null;
      }

      setPrices(mergedPrices);
      setUsdEur(result.usdEur);
      setBtcUsd(result.btcUsd);
      setFxSource(source);
      setBtcSource(source);
      setSnapshots((prev) => [data as Snapshot, ...prev]);
      return data as Snapshot;
    },
    [prices, positions, manualAssets, userId, demoMode],
  );

  const handleSavePrices = useCallback(
    async (result: PricesResult) => {
      const saved = await persistSnapshot(result, "MANUAL");
      if (saved) setModalOpen(false);
    },
    [persistSnapshot],
  );

  const handleAutoUpdate = useCallback(async () => {
    if (positions.length === 0) return;
    setUpdating(true);
    setErr(null);
    try {
      const tickers = positions.map((p) => p.ticker).join(",");
      const res = await fetch(
        `/api/prices?tickers=${encodeURIComponent(tickers)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`API /prices → HTTP ${res.status}`);
      const data = (await res.json()) as PricesResult & { errors?: string[] };
      if (Object.keys(data.prices ?? {}).length === 0) {
        throw new Error(
          `No prices returned${data.errors ? `: ${data.errors.join("; ")}` : ""}`,
        );
      }
      await persistSnapshot(
        {
          usdEur: data.usdEur,
          btcUsd: data.btcUsd || data.prices["BTC-USD"]?.price || 0,
          prices: data.prices,
        },
        "LIVE",
      );
      if (data.errors && data.errors.length > 0) {
        setErr(
          `Precios parciales: ${data.errors.length} ticker(s) fallaron — ${data.errors.join("; ")}`,
        );
      }
    } catch (e) {
      setErr(
        `Fallo al traer precios — abre el modal (lápiz) para entrada manual. ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setUpdating(false);
    }
  }, [positions, persistSnapshot]);

  const handleSavePosition = useCallback(
    async (payload: PositionPayload, id: string | null) => {
      if (demoMode) {
        if (id) {
          setPositions((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...payload } : p)),
          );
        } else {
          const newPos: Position = {
            id: localId(),
            created_at: new Date().toISOString(),
            ...payload,
          };
          setPositions((prev) => [...prev, newPos]);
        }
        setEditingPosition(undefined);
        return;
      }
      if (id) {
        const { data, error } = await supabase
          .from("positions")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        setPositions((prev) =>
          prev.map((p) => (p.id === id ? (data as Position) : p)),
        );
      } else {
        const { data, error } = await supabase
          .from("positions")
          .insert({ ...payload, owner_id: userId })
          .select()
          .single();
        if (error) throw error;
        setPositions((prev) => [...prev, data as Position]);
      }
      setEditingPosition(undefined);
    },
    [userId, demoMode],
  );

  const handleDeletePosition = useCallback(
    async (id: string) => {
      if (demoMode) {
        setPositions((prev) => prev.filter((p) => p.id !== id));
        setEditingPosition(undefined);
        return;
      }
      const { error } = await supabase.from("positions").delete().eq("id", id);
      if (error) throw error;
      setPositions((prev) => prev.filter((p) => p.id !== id));
      setEditingPosition(undefined);
    },
    [demoMode],
  );

  const handleSaveAsset = useCallback(
    async (payload: AssetPayload, id: string | null) => {
      const now = new Date().toISOString();
      if (demoMode) {
        if (id) {
          setManualAssets((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, ...payload, updated_at: now } : a,
            ),
          );
        } else {
          const newAsset: ManualAsset = {
            id: localId(),
            updated_at: now,
            ...payload,
          };
          setManualAssets((prev) => [...prev, newAsset]);
        }
        setEditingAsset(undefined);
        return;
      }
      if (id) {
        const { data, error } = await supabase
          .from("manual_assets")
          .update({ ...payload, updated_at: now })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        setManualAssets((prev) =>
          prev.map((a) => (a.id === id ? (data as ManualAsset) : a)),
        );
      } else {
        const { data, error } = await supabase
          .from("manual_assets")
          .insert({ ...payload, owner_id: userId })
          .select()
          .single();
        if (error) throw error;
        setManualAssets((prev) => [...prev, data as ManualAsset]);
      }
      setEditingAsset(undefined);
    },
    [userId, demoMode],
  );

  const handleDeleteAsset = useCallback(
    async (id: string) => {
      if (demoMode) {
        setManualAssets((prev) => prev.filter((a) => a.id !== id));
        setEditingAsset(undefined);
        return;
      }
      const { error } = await supabase.from("manual_assets").delete().eq("id", id);
      if (error) throw error;
      setManualAssets((prev) => prev.filter((a) => a.id !== id));
      setEditingAsset(undefined);
    },
    [demoMode],
  );

  const handleApplyInterest = useCallback(
    async (asset: ManualAsset) => {
      const { accruedEur } = getAccruedInterest(asset);
      if (accruedEur <= 0) return;
      const newValue = asset.value_eur + accruedEur;
      const now = new Date().toISOString();
      if (demoMode) {
        const next: ManualAsset = {
          ...asset,
          value_eur: newValue,
          updated_at: now,
        };
        setManualAssets((prev) =>
          prev.map((a) => (a.id === asset.id ? next : a)),
        );
        setEditingAsset(next);
        return;
      }
      const { data, error } = await supabase
        .from("manual_assets")
        .update({ value_eur: newValue, updated_at: now })
        .eq("id", asset.id)
        .select()
        .single();
      if (error) throw error;
      setManualAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? (data as ManualAsset) : a)),
      );
      setEditingAsset(data as ManualAsset);
    },
    [demoMode],
  );

  const handleSeedDemo = useCallback(async (templateId: TemplateId) => {
    if (demoMode) return; // Demo already seeded locally on mount
    const template = getTemplate(templateId);
    if (!template) return;
    setSeeding(true);
    setErr(null);
    try {
      const positionRows = template.positions.map((p) => ({ ...p, owner_id: userId }));
      const assetRows = template.manualAssets.map((a) => ({ ...a, owner_id: userId }));
      const [pRes, aRes] = await Promise.all([
        supabase.from("positions").insert(positionRows).select(),
        supabase.from("manual_assets").insert(assetRows).select(),
      ]);
      if (pRes.error) throw pRes.error;
      if (aRes.error) throw aRes.error;
      const seededPositions = pRes.data as Position[];
      setPositions(seededPositions);
      setManualAssets(aRes.data as ManualAsset[]);

      // Auto-fetch live prices so the user immediately sees real values.
      try {
        const tickers = seededPositions.map((p) => p.ticker).join(",");
        const res = await fetch(
          `/api/prices?tickers=${encodeURIComponent(tickers)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as PricesResult;
          if (Object.keys(data.prices ?? {}).length > 0) {
            const nextBreakdown = getCategoryBreakdown(
              seededPositions,
              aRes.data as ManualAsset[],
              data.prices,
              data.usdEur,
            );
            const nextTotal = getTotalEur(nextBreakdown);
            const { data: snap } = await supabase
              .from("snapshots")
              .insert({
                owner_id: userId,
                total_eur: nextTotal,
                breakdown: nextBreakdown,
                prices: data.prices,
                usd_eur_rate: data.usdEur,
                btc_price_usd:
                  data.btcUsd || data.prices["BTC-USD"]?.price || 0,
              })
              .select()
              .single();
            setPrices(data.prices);
            setUsdEur(data.usdEur);
            setBtcUsd(data.btcUsd || data.prices["BTC-USD"]?.price || 0);
            setFxSource("LIVE");
            setBtcSource("LIVE");
            if (snap) setSnapshots((prev) => [snap as Snapshot, ...prev]);
          }
        }
      } catch {
        // Non-fatal: user can press Update manually.
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }, [userId, demoMode]);

  const handleSaveTargets = useCallback(
    async (targets: CategoryTargets) => {
      setCategoryTargets(targets);
      if (demoMode) return;
      const { error } = await supabase.from("user_settings").upsert({
        owner_id: userId,
        category_targets: targets,
        updated_at: new Date().toISOString(),
      });
      if (error) setErr(error.message);
    },
    [userId, demoMode],
  );

  const handleSaveSpeculationCap = useCallback(
    async (pct: number) => {
      setSpeculationCapPct(pct);
      if (demoMode) return;
      const { error } = await supabase.from("user_settings").upsert({
        owner_id: userId,
        speculation_cap_pct: pct,
        updated_at: new Date().toISOString(),
      });
      if (error) setErr(error.message);
    },
    [userId, demoMode],
  );

  const handleLogout = useCallback(async () => {
    if (demoMode) {
      window.location.href = "/";
      return;
    }
    await supabase.auth.signOut();
  }, [demoMode]);

  const applyJournalOps = useCallback(
    async (ops: JournalOp[]) => {
      const failed: string[] = [];
      let applied = 0;
      const posMap = new Map(positions.map((p) => [p.id, { ...p }]));
      const assetMap = new Map(manualAssets.map((a) => [a.id, { ...a }]));
      const nowIso = new Date().toISOString();

      for (const op of ops) {
        try {
          if (op.type === "adjust_position") {
            const existing = findPositionByTicker(
              Array.from(posMap.values()),
              op.ticker,
            );
            if (!existing) {
              failed.push(
                `${describeOp(op, positions, manualAssets)} — posición no encontrada`,
              );
              continue;
            }
            const nextShares = existing.shares + op.delta_shares;
            const updates: Partial<Position> = { shares: nextShares };
            if (op.delta_shares > 0 && op.price_usd) {
              const prevCost =
                (existing.avg_price_usd ?? op.price_usd) * existing.shares;
              const newCost = op.price_usd * op.delta_shares;
              updates.avg_price_usd =
                nextShares > 0 ? (prevCost + newCost) / nextShares : op.price_usd;
            }
            const realized =
              op.delta_shares < 0 && op.price_usd && existing.avg_price_usd != null
                ? (op.price_usd - existing.avg_price_usd) * Math.abs(op.delta_shares)
                : null;
            const tradeRow = {
              ticker: existing.ticker,
              shares: op.delta_shares,
              price_usd: op.price_usd ?? null,
              amount_eur: op.amount_eur ?? null,
              funding: op.funding ?? null,
              realized_usd: realized,
              date: op.date ?? nowIso.slice(0, 10),
              note: null,
            };
            if (demoMode) {
              posMap.set(existing.id, { ...existing, ...updates });
              setTrades((prev) => [{ id: localId(), created_at: nowIso, ...tradeRow }, ...prev]);
            } else {
              const { data, error } = await supabase
                .from("positions")
                .update(updates)
                .eq("id", existing.id)
                .select()
                .single();
              if (error) throw error;
              posMap.set(existing.id, data as Position);
              const ins = await supabase
                .from("trades")
                .insert({ owner_id: userId, ...tradeRow })
                .select()
                .single();
              if (ins.error) throw ins.error;
              setTrades((prev) => [ins.data as Trade, ...prev]);
            }
            applied++;
          } else if (op.type === "set_position") {
            const existing = findPositionByTicker(
              Array.from(posMap.values()),
              op.ticker,
            );
            if (!existing) {
              failed.push(
                `${describeOp(op, positions, manualAssets)} — posición no encontrada`,
              );
              continue;
            }
            const updates: Partial<Position> = {};
            if (op.shares != null) updates.shares = op.shares;
            if (op.avg_price_usd != null) updates.avg_price_usd = op.avg_price_usd;
            if (op.target_price_usd != null)
              updates.target_price_usd = op.target_price_usd;
            if (demoMode) {
              posMap.set(existing.id, { ...existing, ...updates });
            } else {
              const { data, error } = await supabase
                .from("positions")
                .update(updates)
                .eq("id", existing.id)
                .select()
                .single();
              if (error) throw error;
              posMap.set(existing.id, data as Position);
            }
            applied++;
          } else if (op.type === "adjust_asset") {
            const existing = findAssetByName(
              Array.from(assetMap.values()),
              op.name,
            );
            if (!existing) {
              failed.push(
                `${describeOp(op, positions, manualAssets)} — cuenta no encontrada`,
              );
              continue;
            }
            const nextValue = existing.value_eur + op.delta_eur;
            if (demoMode) {
              assetMap.set(existing.id, {
                ...existing,
                value_eur: nextValue,
                updated_at: nowIso,
              });
            } else {
              const { data, error } = await supabase
                .from("manual_assets")
                .update({ value_eur: nextValue, updated_at: nowIso })
                .eq("id", existing.id)
                .select()
                .single();
              if (error) throw error;
              assetMap.set(existing.id, data as ManualAsset);
            }
            applied++;
          } else if (op.type === "set_asset") {
            const existing = findAssetByName(
              Array.from(assetMap.values()),
              op.name,
            );
            if (!existing) {
              failed.push(
                `${describeOp(op, positions, manualAssets)} — cuenta no encontrada`,
              );
              continue;
            }
            if (demoMode) {
              assetMap.set(existing.id, {
                ...existing,
                value_eur: op.value_eur,
                updated_at: nowIso,
              });
            } else {
              const { data, error } = await supabase
                .from("manual_assets")
                .update({ value_eur: op.value_eur, updated_at: nowIso })
                .eq("id", existing.id)
                .select()
                .single();
              if (error) throw error;
              assetMap.set(existing.id, data as ManualAsset);
            }
            applied++;
          } else if (op.type === "contribute") {
            const date = op.date ?? nowIso.slice(0, 10);
            if (demoMode) {
              const local: Contribution = {
                id: localId(),
                amount_eur: op.amount_eur,
                type: op.contribution_type,
                note: op.note ?? null,
                date,
                created_at: nowIso,
              };
              setContributions((prev) => [local, ...prev]);
            } else {
              const { data, error } = await supabase
                .from("contributions")
                .insert({
                  owner_id: userId,
                  amount_eur: op.amount_eur,
                  type: op.contribution_type,
                  note: op.note ?? null,
                  date,
                })
                .select()
                .single();
              if (error) throw error;
              setContributions((prev) => [data as Contribution, ...prev]);
            }
            applied++;
          }
        } catch (e) {
          failed.push(
            `${describeOp(op, positions, manualAssets)} — ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      setPositions(Array.from(posMap.values()));
      setManualAssets(Array.from(assetMap.values()));
      return { applied, failed };
    },
    [positions, manualAssets, userId, demoMode],
  );

  const latestSnapshotIso = snapshots[0]?.created_at ?? null;
  const isEmpty = !loading && positions.length === 0 && manualAssets.length === 0;

  return (
    <>
      <Header
        totalEur={totalEur}
        dayChange={dayChange}
        usdEur={usdEur}
        btcUsd={btcUsd}
        fxStatus={fxSource}
        btcStatus={btcSource}
        lastUpdated={latestSnapshotIso}
        onUpdate={handleAutoUpdate}
        onManualEdit={() => setModalOpen(true)}
        updating={updating}
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-6 flex-1 w-full">
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-4 sm:border-b border-[var(--border)]">
          <h1 className="sm:hidden text-xs uppercase tracking-wider text-[var(--muted)]">
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
          <nav className="hidden sm:flex gap-1 -mb-px min-w-0 flex-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-3 py-3 text-xs uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-[var(--accent)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            {demoMode ? (
              <Badge variant="accent">DEMO</Badge>
            ) : (
              <span
                className="hidden md:inline text-[10px] text-[var(--muted)] truncate max-w-[180px]"
                title={userEmail}
              >
                {userEmail}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="p-2 sm:p-1.5 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
              title={demoMode ? "Salir del demo" : "Salir"}
              aria-label={demoMode ? "Salir del demo" : "Salir"}
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>

        {demoMode && demoBannerOpen ? (
          <div className="mb-4 rounded-md border border-[var(--accent)]/40 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] pl-3 pr-1 py-1 flex items-center gap-2 text-xs">
            <Info size={13} className="text-[var(--accent)] shrink-0" />
            <span className="flex-1 min-w-0">
              <strong className="text-[var(--foreground)]">Demo</strong>
              <span className="text-[var(--muted)]">
                {" "}· datos ficticios, precios reales. Nada se guarda.
              </span>
            </span>
            <button
              onClick={() => setDemoBannerOpen(false)}
              className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
              aria-label="Cerrar aviso"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-md border border-[var(--danger)]/60 bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] px-4 py-3 text-sm">
            {err}
          </div>
        ) : null}

        {loading ? (
          <DashboardSkeleton />
        ) : isEmpty ? (
          <div className="py-10">
            <div className="text-center mb-8 max-w-xl mx-auto">
              <Database size={28} className="text-[var(--muted)] mx-auto mb-3" />
              <h2 className="text-xl font-semibold">Empieza aquí</h2>
              <p className="text-sm text-[var(--muted)] mt-2">
                Elige una plantilla según tu tesis de inversión. Son posiciones
                y cuentas de <strong>ejemplo</strong> — las cambias cuando
                quieras. Al cargar una, se traen los precios reales y se guarda
                tu primer snapshot.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSeedDemo(t.id)}
                  disabled={seeding}
                  className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left hover:border-[var(--accent)]/60 transition-colors disabled:opacity-50"
                >
                  <div className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
                    {t.id.replace("-", " · ")}
                  </div>
                  <div className="text-base font-semibold">{t.label}</div>
                  <div className="text-xs text-[var(--muted)]">{t.tagline}</div>
                  <div className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
                    {t.description}
                  </div>
                  <div className="mt-auto pt-3 text-[10px] uppercase tracking-wider text-[var(--muted)] group-hover:text-[var(--accent)]">
                    {t.positions.length} posiciones · {t.manualAssets.length} cuentas
                  </div>
                </button>
              ))}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => {
                  setTab("portfolio");
                  setEditingPosition(null);
                }}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline underline-offset-2"
              >
                O empieza sin datos y añade tus propias posiciones
              </button>
            </div>

            {seeding ? (
              <div className="text-center text-xs text-[var(--muted)] mt-4">
                Cargando plantilla y precios…
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {tab === "overview" && (
              <OverviewTab
                breakdown={breakdown}
                totalEur={totalEur}
                prices={prices}
                positions={positions}
                snapshots={snapshots}
                contributions={contributions}
              />
            )}
            {tab === "portfolio" && (
              <PortfolioTab
                positions={positions}
                manualAssets={manualAssets}
                prices={prices}
                usdEur={usdEur}
                btcUsd={btcUsd}
                totalEur={totalEur}
                categoryTargets={categoryTargets}
                onSaveTargets={handleSaveTargets}
                speculationCapPct={speculationCapPct}
                onSaveSpeculationCap={handleSaveSpeculationCap}
                onAddPosition={() => setEditingPosition(null)}
                onEditPosition={(p) => setEditingPosition(p)}
                onAddAsset={() => setEditingAsset(null)}
                onEditAsset={(a) => setEditingAsset(a)}
              />
            )}
            {tab === "benchmark" && (
              <BenchmarkTab snapshots={snapshots} contributions={contributions} />
            )}
            {tab === "journal" && (
              <JournalTab
                positions={positions}
                manualAssets={manualAssets}
                contributions={contributions}
                trades={trades}
                usdEur={usdEur}
                onApply={applyJournalOps}
              />
            )}
          </>
        )}
      </main>

      <nav
        className={`sm:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out ${
          navHidden ? "translate-y-full" : "translate-y-0"
        }`}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setNavHidden(false);
              window.scrollTo({ top: 0 });
            }}
            aria-current={tab === id ? "page" : undefined}
            className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] uppercase tracking-normal transition-colors ${
              tab === id ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            <Icon size={18} strokeWidth={tab === id ? 2.25 : 1.75} />
            {label}
          </button>
        ))}
      </nav>

      <UpdatePricesModal
        open={modalOpen}
        positions={positions}
        current={{ usdEur, btcUsd, prices }}
        onCancel={() => setModalOpen(false)}
        onSave={handleSavePrices}
      />

      <EditPositionModal
        open={editingPosition !== undefined}
        position={editingPosition ?? null}
        onCancel={() => setEditingPosition(undefined)}
        onSave={handleSavePosition}
        onDelete={handleDeletePosition}
      />

      <EditAssetModal
        open={editingAsset !== undefined}
        asset={editingAsset ?? null}
        onCancel={() => setEditingAsset(undefined)}
        onSave={handleSaveAsset}
        onDelete={handleDeleteAsset}
        onApplyInterest={handleApplyInterest}
      />
    </>
  );
}

/**
 * Mobile-app style bottom bar: hides while scrolling down, comes back on any
 * scroll up or near the top. Small jitters (< 8px) are ignored so it doesn't
 * flicker, and iOS overscroll bounce (negative / past-the-end Y) is clamped.
 */
function useHideOnScrollDown(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        const y = Math.min(Math.max(window.scrollY, 0), Math.max(maxY, 0));
        const dy = y - lastY;
        if (y < 64) setHidden(false);
        else if (Math.abs(dy) < 8) return;
        else setHidden(dy > 0);
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return [hidden, setHidden];
}
