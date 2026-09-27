"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

const inputClass =
  "bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (!token) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="flex items-center gap-2.5">
            <LogoMark size={36} />
            <span className="text-xs uppercase tracking-widest text-[var(--muted)]">
              Wealth Tracker
            </span>
          </div>
          <h1 className="text-2xl font-semibold mt-5">
            Tu patrimonio, solo tuyo.
          </h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Te enviamos un email con un código y un link. Sin passwords.
          </p>
        </div>

        {step === "email" ? (
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
                className={inputClass}
              />
            </label>
            <Button
              type="submit"
              disabled={busy || !email}
              className="w-full justify-center h-10"
            >
              <Mail size={12} />
              {busy ? "Enviando…" : "Enviar código"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm">
              Enviado a <strong>{email}</strong>. Escribe el código del email
              aquí, o abre el link desde este mismo navegador.
            </p>
            <label className="flex flex-col gap-1 text-xs">
              <span className="uppercase tracking-wider text-[var(--muted)]">
                Código
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="123456"
                autoFocus
                className={`${inputClass} tracking-[0.4em] text-center text-lg`}
              />
            </label>
            <Button
              type="submit"
              disabled={busy || code.replace(/\D/g, "").length < 6}
              className="w-full justify-center h-10"
            >
              <KeyRound size={12} />
              {busy ? "Verificando…" : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="w-full text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline underline-offset-2"
            >
              Cambiar email o reenviar
            </button>
          </form>
        )}

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
