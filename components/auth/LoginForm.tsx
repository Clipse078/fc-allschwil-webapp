"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { CalendarDays, KeyRound, Lock, Mail } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import FcaBrandCrest from "@/components/shared/FcaBrandCrest";

const REMEMBER_EMAIL_KEY = "fca-login-remember-email";
const REMEMBER_ENABLED_KEY = "fca-login-remember-enabled";
const DEFAULT_EMAIL = "admin@fcallschwil.ch";
const DEFAULT_PASSWORD = "ChangeMe123!";

function getInitialRememberMe(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
}

function getInitialEmail(): string {
  if (typeof window === "undefined") {
    return DEFAULT_EMAIL;
  }

  const rememberEnabled = window.localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
  const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);

  if (rememberEnabled && rememberedEmail) {
    return rememberedEmail;
  }

  return DEFAULT_EMAIL;
}

function isSameOriginUrl(url: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function LoginForm() {
  const [email, setEmail] = useState(getInitialEmail);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [rememberMe, setRememberMe] = useState(getInitialRememberMe);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

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

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBER_ENABLED_KEY);
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result) {
        setErrorMessage("Login fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }

      if (result.error) {
        setErrorMessage("Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.");
        return;
      }

      if (!result.ok) {
        setErrorMessage("Anmeldung konnte nicht abgeschlossen werden.");
        return;
      }

      const targetUrl =
        result.url && isSameOriginUrl(result.url) ? result.url : "/dashboard";

      window.location.assign(targetUrl);
    } catch {
      setErrorMessage("Während der Anmeldung ist ein Fehler aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7f9] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left_center,rgba(58,107,196,0.12),transparent_28%),radial-gradient(circle_at_right_center,rgba(207,32,39,0.10),transparent_24%),linear-gradient(180deg,#f7f8fa_0%,#f4f5f7_100%)]" />
        <div className="absolute inset-x-0 top-[84px] h-px bg-slate-200/90" />
        <div className="absolute left-1/2 top-1/2 h-[960px] w-[960px] -translate-x-1/2 -translate-y-[42%] opacity-[0.055]">
          <FcaBrandCrest className="h-full w-full" variant="watermark" />
        </div>
        <div className="absolute left-[-140px] top-[10%] h-[420px] w-[420px] rounded-full bg-[#0b5db3]/8 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[#cf2027]/7 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="flex justify-end px-6 pt-5 lg:px-12">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-[15px] font-medium tracking-tight text-slate-600 lg:text-[18px]">
              <CalendarDays className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="mt-1 text-[54px] font-black leading-none tracking-[-0.05em] text-[#0b122d] lg:text-[66px]">
              {formattedTime}
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-[1600px] items-center justify-center px-6 pb-14 pt-4 lg:px-10">
          <div className="w-full">
            <div className="mx-auto flex max-w-[980px] flex-col items-center text-center">
              <div className="mb-8 w-[112px] lg:mb-10 lg:w-[132px]">
                <Image
                  src="/images/logos/fc-allschwil.png"
                  alt="FC Allschwil"
                  width={132}
                  height={132}
                  priority
                  className="h-auto w-full object-contain drop-shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                />
              </div>

              <div className="space-y-1">
                <h1 className="font-display text-[64px] font-black uppercase leading-[0.88] tracking-[-0.055em] text-[#0b122d] sm:text-[82px] lg:text-[96px]">
                  Willkommen
                </h1>
                <h2 className="font-display text-[48px] font-black uppercase leading-[0.88] tracking-[-0.055em] text-[#0d5db7] sm:text-[66px] lg:text-[82px]">
                  beim FC Allschwil
                </h2>
                <h3 className="font-display text-[50px] font-black uppercase leading-[0.88] tracking-[-0.055em] text-[#c9181e] sm:text-[68px] lg:text-[84px]">
                  Clubmanager
                </h3>
              </div>

              <div className="mt-10 w-full max-w-[360px] rounded-[8px] border border-slate-300 bg-white/90 p-6 text-left shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
                <div className="mb-5 text-center">
                  <h4 className="text-[18px] font-semibold text-slate-900">Anmelden</h4>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    Bitte geben Sie Ihre Zugangsdaten ein, um auf das System zuzugreifen.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
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
                        className="w-full rounded-[4px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#0b5db3] focus:ring-2 focus:ring-[#0b5db3]/15"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
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
                        className="w-full rounded-[4px] border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#0b5db3] focus:ring-2 focus:ring-[#0b5db3]/15"
                      />
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-[4px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0b5db3] focus:ring-[#0b5db3]/30"
                      />
                      <span>Angemeldet bleiben</span>
                    </label>

                    <Link
                      href="mailto:admin@fcallschwil.ch?subject=Passwort%20vergessen"
                      className="text-xs font-medium text-[#0b5db3] transition hover:text-[#094c91]"
                    >
                      Passwort vergessen?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-[4px] bg-[#0b5db3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#094c91] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Anmeldung läuft..." : "Anmelden"}
                  </button>
                </form>

                <div className="my-5 h-px bg-slate-200" />

                <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  <span>2FA-geschützter Bereich für interne Vorgänge</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
