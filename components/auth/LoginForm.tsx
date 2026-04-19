"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { KeyRound, Lock, Mail, Shield } from "lucide-react";
import { useState, type FormEvent } from "react";

const REMEMBER_EMAIL_KEY = "fca-login-remember-email";
const REMEMBER_ENABLED_KEY = "fca-login-remember-enabled";

function getInitialRememberMe(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
}

function getInitialEmail(): string {
  if (typeof window === "undefined") {
    return "admin@fcallschwil.ch";
  }

  const rememberEnabled = window.localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
  const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);

  if (rememberEnabled && rememberedEmail) {
    return rememberedEmail;
  }

  return "admin@fcallschwil.ch";
}

export default function LoginForm() {
  const [email, setEmail] = useState(getInitialEmail);
  const [password, setPassword] = useState("ChangeMe123!");
  const [rememberMe, setRememberMe] = useState(getInitialRememberMe);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBER_ENABLED_KEY);
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

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
    <main className="min-h-screen bg-[#f3f4f6] px-4 py-8 text-[#1f2937]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[360px] items-center justify-center">
        <div className="w-full rounded-[4px] border border-slate-300 bg-white p-6 shadow-sm">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f67e8] text-white shadow-[0_8px_20px_rgba(79,103,232,0.25)]">
              <Shield className="h-5 w-5" />
            </div>

            <div className="flex items-center gap-2">
              <Image
                src="/images/logos/fc-allschwil.png"
                alt="FC Allschwil"
                width={26}
                height={26}
                priority
                className="h-6 w-6 object-contain"
              />
              <span className="text-[17px] font-semibold tracking-tight text-[#4f67e8]">
                FC Allschwil
              </span>
            </div>
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-[18px] font-semibold text-[#1f2937]">Anmelden</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Bitte geben Sie Ihre Zugangsdaten ein, um auf das System zuzugreifen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#374151]"
              >
                E-Mail
              </label>

              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@fcallschwil.ch"
                  required
                  className="w-full rounded-[4px] border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#4f67e8] focus:ring-2 focus:ring-[#4f67e8]/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#374151]"
              >
                Passwort
              </label>

              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Passwort"
                  required
                  className="w-full rounded-[4px] border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#4f67e8] focus:ring-2 focus:ring-[#4f67e8]/15"
                />
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-[4px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#4f67e8] focus:ring-[#4f67e8]/30"
                />
                <span>Angemeldet bleiben</span>
              </label>

              <Link
                href="mailto:admin@fcallschwil.ch?subject=Passwort%20vergessen"
                className="text-sm font-medium text-[#4f67e8] transition hover:text-[#3f55cb]"
              >
                Passwort vergessen?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[4px] bg-[#4f67e8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4459d2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Anmeldung läuft..." : "Anmelden"}
            </button>
          </form>

          <div className="my-6 h-px bg-slate-200" />

          <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            <span>2FA-geschützter Bereich für interne Vorgänge</span>
          </div>
        </div>
      </div>
    </main>
  );
}