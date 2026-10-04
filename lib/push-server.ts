import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_INFO } from "./policy";
import type { Position, PriceMap } from "./types";

/**
 * Server-only Web Push helpers (service-role client). Configured from env:
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
 */

/** Price must fall this far below the target to re-arm an alert. */
const REARM_BELOW = 0.95;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured != null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (configured = true);
}

/** Sends to every device of a user; drops subscriptions the push service rejects as gone. */
export async function sendToUser(
  admin: SupabaseClient,
  ownerId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("owner_id", ownerId);
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const s of data ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (e) {
      failed++;
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return { sent, failed };
}

/**
 * Alerts once when a position's price reaches its target. The alert re-arms
 * after the price drops below REARM_BELOW × target, or when the target changes.
 */
export async function sendTargetAlerts(
  admin: SupabaseClient,
  positions: Array<Position & { owner_id: string }>,
  prices: PriceMap,
): Promise<{ alerts: number; sent: number; errors: string[] }> {
  const errors: string[] = [];
  const withTarget = positions.filter((p) => p.target_price_usd != null && prices[p.ticker]?.price);
  if (withTarget.length === 0) return { alerts: 0, sent: 0, errors };

  const { data: existing, error } = await admin
    .from("target_alerts")
    .select("position_id, target_price_usd")
    .in("position_id", withTarget.map((p) => p.id));
  if (error) return { alerts: 0, sent: 0, errors: [`target_alerts: ${error.message}`] };
  const notified = new Set((existing ?? []).map((r) => `${r.position_id}:${Number(r.target_price_usd)}`));

  let alerts = 0;
  let sent = 0;
  for (const p of withTarget) {
    const target = Number(p.target_price_usd);
    const price = prices[p.ticker].price;
    const key = `${p.id}:${target}`;
    if (price < target * REARM_BELOW && notified.has(key)) {
      await admin.from("target_alerts").delete().eq("position_id", p.id).eq("target_price_usd", target);
      continue;
    }
    if (price < target || notified.has(key)) continue;

    const ticker = p.ticker.replace(/-USD$/i, "");
    try {
      const r = await sendToUser(admin, p.owner_id, {
        title: `${ticker} alcanzó tu objetivo`,
        body: `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })} (objetivo $${target.toLocaleString("en-US")}). ${ROLE_INFO[p.role].rule}`,
        url: "/",
        tag: `target-${p.id}`,
      });
      sent += r.sent;
      // No device reached (none enabled yet): try again on the next run.
      if (r.sent === 0) continue;
      const ins = await admin
        .from("target_alerts")
        .insert({ position_id: p.id, target_price_usd: target, owner_id: p.owner_id });
      if (ins.error) errors.push(`${ticker}: ${ins.error.message}`);
      alerts++;
    } catch (e) {
      errors.push(`${ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { alerts, sent, errors };
}
