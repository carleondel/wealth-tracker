"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Wealth Tracker
          </div>
          <h1 className="text-2xl font-semibold mt-1">
            Tu patrimonio, solo tuyo.
          </h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Te enviamos un link mágico por email. Sin passwords, sin cuentas.
          </p>
        </div>

        <form onSubmit={send} className="space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="uppercase tracking-wider text-[var(--muted)]">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </label>
          <Button
            type="submit"
            disabled={status === "sending" || status === "sent" || !email}
            className="w-full justify-center"
          >
            <Mail size={12} />
            {status === "sending"
              ? "Enviando…"
              : status === "sent"
                ? "Link enviado"
                : "Enviar link"}
          </Button>
        </form>

        {status === "sent" ? (
          <div className="mt-5 rounded-md border border-[var(--accent)]/60 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-4 py-3 text-sm">
            Revisa tu bandeja <strong>{email}</strong>. El link te loguea y
            redirige a la app. Expira en 1h.
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-md border border-[var(--danger)]/60 bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-10 pt-6 border-t border-[var(--border)] text-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <Sparkles size={12} />
            Probar en modo demo sin cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
