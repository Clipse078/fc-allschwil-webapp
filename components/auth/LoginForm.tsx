"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("superadmin@sportclubevo.com");
  const [password, setPassword] = useState("ChangeMe123!");
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
      setErrorMessage("Login failed. Please check your email and password.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0f1e]">
      {/* Background radial glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-200px] top-[-200px] h-[600px] w-[600px] rounded-full bg-[#22c55e]/6 blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-200px] h-[600px] w-[600px] rounded-full bg-[#3b82f6]/6 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22c55e]/4 blur-[80px]" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#22c55e]/40 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16">
        {/* Platform mark */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/8 shadow-[0_0_32px_rgba(34,197,94,0.12)]">
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
              <circle cx="16" cy="16" r="13" stroke="#22c55e" strokeWidth="1.5" />
              <path
                d="M10 16h12M16 10l6 6-6 6"
                stroke="#22c55e"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#22c55e]">
            Platform Login
          </p>

          <h1 className="mt-3 text-center text-[2.8rem] font-black leading-[0.92] tracking-[-0.04em] text-white lg:text-[3.6rem]">
            SportClubEvo
          </h1>

          <p className="mt-3 max-w-[360px] text-center text-[0.95rem] leading-relaxed text-slate-400">
            The operating system for modern sports clubs
          </p>
        </div>

        {/* Login card */}
        <div className="w-full max-w-[420px] rounded-[28px] border border-white/6 bg-white/4 p-7 shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-[#22c55e]/50 focus:ring-2 focus:ring-[#22c55e]/10"
                placeholder="superadmin@sportclubevo.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-[#22c55e]/50 focus:ring-2 focus:ring-[#22c55e]/10"
                placeholder="••••••••••"
                required
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[#22c55e] px-5 py-3 text-sm font-semibold text-[#0a0f1e] shadow-[0_8px_24px_rgba(34,197,94,0.25)] transition hover:bg-[#16a34a] hover:shadow-[0_12px_32px_rgba(34,197,94,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in to platform"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-xs text-slate-600">
          SportClubEvo &mdash; Club Management Platform
        </p>
      </div>
    </main>
  );
}
