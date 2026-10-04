"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Support = "unsupported" | "needs-install" | "not-configured" | "ready";

function detectSupport(): Support {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iOS only exposes Web Push to apps added to the home screen.
  if (ios && !standalone) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return VAPID_PUBLIC_KEY ? "ready" : "not-configured";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** Enable/disable price-target alerts on this device. */
export function PushToggle({ userId }: { userId: string }) {
  const [support] = useState<Support>(detectSupport);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (support !== "ready") return;
    let cancelled = false;
    (async () => {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setSubscribed(sub != null);
    })().catch(() => {
      if (!cancelled) setSubscribed(false);
    });
    return () => {
      cancelled = true;
    };
  }, [support]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      // Ask first, straight from the tap: iOS requires a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Permiso denegado. Actívalo en Ajustes → Notificaciones → Wealth.");
        return;
      }
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          owner_id: userId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      setSubscribed(true);

      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
      setMsg(
        res.ok && body.sent
          ? "Listo: te ha llegado una notificación de prueba."
          : `Activado, pero la prueba falló${body.error ? `: ${body.error}` : ""}.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const hint =
    support === "needs-install"
      ? "Para recibir avisos en el iPhone, añade la app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí."
      : support === "unsupported"
        ? "Este navegador no admite notificaciones push."
        : support === "not-configured"
          ? "Faltan las claves VAPID en el servidor."
          : null;

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--muted)]">Avisarme al llegar al objetivo</span>
        {support === "ready" ? (
          <button
            onClick={subscribed ? disable : enable}
            disabled={busy || subscribed == null}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] uppercase tracking-wider disabled:opacity-50 ${
              subscribed
                ? "border-[var(--accent)]/60 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {subscribed ? <Bell size={12} /> : <BellOff size={12} />}
            {busy ? "…" : subscribed ? "Activado" : "Activar"}
          </button>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-[11px] text-[var(--muted)]">{hint}</p> : null}
      {msg ? <p className="mt-1.5 text-[11px] text-[var(--muted)]">{msg}</p> : null}
      {support === "ready" && subscribed ? (
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          Se comprueba cada noche con el snapshot diario.
        </p>
      ) : null}
    </div>
  );
}
