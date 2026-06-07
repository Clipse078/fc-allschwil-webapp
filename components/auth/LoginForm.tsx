"use client";

import { Trophy } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (result?.error) {
      setErrorMessage("Ungültige E-Mail oder Passwort. Bitte nochmals versuchen.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="relative flex min-h-screen bg-[var(--background)]">
      {/* ── Left panel — branding ───────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "var(--tenant-primary)",
        }}
      >
        {/* Subtle overlay for depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.07) 0%, transparent 55%), " +
              "radial-gradient(circle at 80% 20%, rgba(0,0,0,0.08) 0%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Top: Logo + product name */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-hidden="true"
          >
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/60">
              SportClubEvo
            </p>
            <p className="text-sm font-semibold text-white leading-tight">
              Club Management
            </p>
          </div>
        </div>

        {/* Center: headline copy */}
        <div className="relative z-10">
          <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/60">
            Club Management
          </p>
          <h1
            className="font-[var(--font-display)] text-[3.2rem] font-bold uppercase leading-[0.94] tracking-[-0.02em] text-white xl:text-[3.8rem]"
          >
            Willkommen
            <br />
            <span className="text-white/70">zurück.</span>
          </h1>
          <p className="mt-5 max-w-[280px] text-sm leading-relaxed text-white/70">
            Der zentrale Arbeitsbereich für die Vereinsführung, Teams, Events und Planung.
          </p>
        </div>

        {/* Bottom: "Powered by" */}
        <div className="relative z-10">
          <p className="text-[0.7rem] font-medium text-white/40">
            Powered by{" "}
            <span className="font-semibold text-white/60">SportClubEvo</span>
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        {/* Mobile header */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[12px] text-white"
            style={{ background: "var(--tenant-primary)" }}
            aria-hidden="true"
          >
            <Trophy className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              SportClubEvo
            </p>
            <p className="text-lg font-bold text-[var(--foreground)]">Club Management</p>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-[1.5rem] font-bold tracking-tight text-[var(--foreground)]">
              Einloggen
            </h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Bitte melde dich mit deinen Zugangsdaten an.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[0.8125rem] font-medium text-[var(--text-2)]"
              >
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "fca-input",
                  "transition focus:ring-0",
                )}
                placeholder="name@verein.ch"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[0.8125rem] font-medium text-[var(--text-2)]"
              >
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="fca-input"
                placeholder="Passwort eingeben"
                required
              />
            </div>

            {errorMessage ? (
              <div className="fca-status-box fca-status-box-error text-xs">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full h-10 rounded-[var(--radius-lg)] font-semibold text-sm text-white transition",
                "disabled:cursor-not-allowed disabled:opacity-55",
              )}
              style={{
                background: "var(--tenant-primary)",
                boxShadow: "0 2px 8px color-mix(in srgb, var(--tenant-primary) 20%, transparent)",
              }}
            >
              {isSubmitting ? "Anmeldung läuft…" : "Einloggen"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-10 text-center text-[0.7rem] text-[var(--muted)]">
            Powered by{" "}
            <span className="font-semibold text-[var(--text-2)]">SportClubEvo</span>
          </p>
        </div>
      </div>
    </main>
  );
}
