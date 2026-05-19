"use client";

import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const update = () => setNow(new Date());

    update();

    const interval = window.setInterval(update, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const formattedDate = useMemo(() => {
    const raw = new Intl.DateTimeFormat("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(now);

    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [now]);

  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
  }, [now]);

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
      setErrorMessage("Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070c18] text-white">
      {/* Ambient glow — platform blue only */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-8%] h-[600px] w-[600px] rounded-full bg-[#3f63b5]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-8%] h-[500px] w-[500px] rounded-full bg-[#3f63b5]/08 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1a2d5a]/30 blur-[140px]" />
      </div>

      {/* Subtle dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Top edge line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#3f63b5]/40 to-transparent" />

      {/* Date / time — top right */}
      <div className="relative z-10 flex justify-end px-8 pt-6 lg:px-14">
        <div className="text-right">
          <p className="text-[13px] font-medium tracking-wide text-white/40">
            {formattedDate}
          </p>
          <p className="mt-0.5 text-[36px] font-black leading-none tracking-tight text-white/70 lg:text-[44px]">
            {formattedTime}
          </p>
        </div>
      </div>

      {/* Main centered content */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-110px)] max-w-[1400px] flex-col items-center justify-center px-6 pb-16 pt-6 lg:px-10">
        <div className="w-full max-w-[460px] text-center">
          {/* Platform wordmark */}
          <div className="mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#3f63b5]/80">
              Platform
            </span>
          </div>
          <h1 className="font-[var(--font-display)] text-[3.2rem] font-black uppercase leading-[0.9] tracking-[-0.04em] text-white lg:text-[3.8rem]">
            SportClubEvo
          </h1>
          <p className="mt-3 text-[13px] font-medium tracking-[0.04em] text-white/40">
            The Operating System for Modern Sports Clubs
          </p>

          {/* Login card */}
          <div className="mx-auto mt-10 w-full rounded-[28px] border border-white/10 bg-white/[0.05] p-7 text-left shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
              Anmeldung
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50"
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#3f63b5]/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#3f63b5]/20"
                  placeholder="deine@email.ch"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50"
                >
                  Passwort
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#3f63b5]/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#3f63b5]/20"
                  placeholder="••••••••"
                  required
                />
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 w-full rounded-full bg-[#3f63b5] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#3f63b5]/20 transition hover:bg-[#4a70c8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Anmeldung läuft…" : "Einloggen"}
              </button>
            </form>
          </div>

          {/* Tenant context — bottom */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
            <span className="text-[11px] font-medium text-white/30">
              FC Allschwil Workspace
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
