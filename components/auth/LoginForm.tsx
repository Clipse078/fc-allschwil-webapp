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
    <main className="sce-dark-shell">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sce-dark-glow-green absolute -left-40 -top-40 h-[640px] w-[640px]" />
        <div className="sce-dark-glow-blue absolute -bottom-40 -right-40 h-[640px] w-[640px]" />
        <div className="sce-dark-glow-green absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div className="sce-dark-grid" />
        <div className="sce-accent-line-top" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16">

        {/* Platform identity mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/8 shadow-[0_0_40px_rgba(34,197,94,0.14)]">
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" aria-hidden="true">
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

          <p className="mt-3 max-w-[400px] text-center text-[1rem] font-medium leading-relaxed text-slate-300">
            The Operating System for Modern Sports Clubs
          </p>

          {/* Ecosystem pills */}
          <div className="sce-ecosystem-row mt-5 justify-center">
            <span className="sce-ecosystem-pill sce-ecosystem-pill-active">WebApp</span>
            <span className="text-[0.6rem] text-slate-600">·</span>
            <span className="sce-ecosystem-pill">Website</span>
            <span className="text-[0.6rem] text-slate-600">·</span>
            <span className="sce-ecosystem-pill">InfoBoard</span>
            <span className="text-[0.6rem] text-slate-600">·</span>
            <span className="sce-ecosystem-pill">Mobile App</span>
          </div>
        </div>

        {/* Login card */}
        <div className="sce-dark-card w-full max-w-[420px] p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="sce-dark-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="sce-dark-input"
                placeholder="superadmin@sportclubevo.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="sce-dark-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="sce-dark-input"
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
              className="sce-button-green mt-1"
            >
              {isSubmitting ? "Signing in…" : "Sign in to platform"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-[11px] font-medium tracking-wide text-slate-600">
          SportClubEvo &mdash; One operating system for sport and community
        </p>
      </div>
    </main>
  );
}
