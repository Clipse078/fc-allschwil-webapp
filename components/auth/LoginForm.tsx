"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import SportClubEvoLogo from "@/components/branding/SportClubEvoLogo";

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
    <main className="relative flex min-h-screen" style={{ background: "#F8FAFC" }}>

      {/* ── Left panel — brand / marketing ──────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[48%] xl:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "#ffffff", borderRight: "1px solid #E5E7EB" }}
      >
        {/* Decorative background blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute -top-32 -left-32 rounded-full"
            style={{
              width: 480,
              height: 480,
              background: "radial-gradient(circle, rgba(255,106,0,0.08) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 rounded-full"
            style={{
              width: 320,
              height: 320,
              background: "radial-gradient(circle, rgba(255,106,0,0.06) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Top: SCE wordmark */}
        <div className="relative z-10">
          <SportClubEvoLogo size="lg" />
        </div>

        {/* Center: headline + tagline */}
        <div className="relative z-10">
          <p
            className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "#FF6A00" }}
          >
            Club Management Platform
          </p>
          <h1
            className="text-[2.75rem] font-bold leading-[1.1] tracking-[-0.025em]"
            style={{ color: "#111827" }}
          >
            Das Betriebssystem
            <br />
            <span style={{ color: "#FF6A00" }}>für moderne</span>
            <br />
            Sportvereine.
          </h1>
          <p
            className="mt-6 max-w-[320px] text-[0.9375rem] leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            Teams, Events, News und Kommunikation — professionell verwaltet an einem Ort.
          </p>

          {/* Feature bullets */}
          <ul className="mt-8 space-y-3">
            {[
              "Saisonplanung & Eventmanagement",
              "News, Seiten & Publishing-Workflow",
              "Anmeldungen & Mitgliederverwaltung",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white text-[0.65rem] font-bold"
                  style={{ background: "#FF6A00" }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span className="text-[0.875rem]" style={{ color: "#374151" }}>
                  {feat}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-[0.72rem]" style={{ color: "#9CA3AF" }}>
            © 2026 SportClubEvo — Alle Rechte vorbehalten.
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">

        {/* Mobile-only header */}
        <div className="mb-8 flex flex-col items-center gap-1 lg:hidden">
          <SportClubEvoLogo size="md" />
        </div>

        <div className="w-full max-w-[400px]">

          {/* Form card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: "#ffffff",
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 24px rgba(17,24,39,0.08), 0 1px 4px rgba(17,24,39,0.04)",
            }}
          >
            {/* Form header */}
            <div className="mb-6">
              <h2
                className="text-[1.375rem] font-bold tracking-tight"
                style={{ color: "#111827" }}
              >
                Einloggen
              </h2>
              <p className="mt-1 text-[0.875rem]" style={{ color: "#6B7280" }}>
                Bitte melde dich mit deinen Zugangsdaten an.
              </p>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[0.8125rem] font-medium"
                  style={{ color: "#374151" }}
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn("fca-input", "transition focus:ring-0")}
                  placeholder="name@verein.ch"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[0.8125rem] font-medium"
                  style={{ color: "#374151" }}
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

              {errorMessage && (
                <div className="fca-status-box fca-status-box-error text-xs">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full h-11 rounded-xl font-semibold text-[0.9375rem] text-white transition",
                  "disabled:cursor-not-allowed disabled:opacity-55",
                )}
                style={{
                  background: isSubmitting
                    ? "#FF8533"
                    : "linear-gradient(135deg, #FF6A00 0%, #FF8533 100%)",
                  boxShadow: "0 2px 10px rgba(255,106,0,0.30)",
                }}
              >
                {isSubmitting ? "Anmeldung läuft…" : "Einloggen"}
              </button>
            </form>
          </div>

          {/* Footer attribution */}
          <p
            className="mt-6 text-center text-[0.72rem]"
            style={{ color: "#9CA3AF" }}
          >
            Powered by{" "}
            <span className="font-semibold" style={{ color: "#6B7280" }}>
              SportClubEvo
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
