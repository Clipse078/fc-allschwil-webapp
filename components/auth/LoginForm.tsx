"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  CalendarDays,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
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
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(11,93,179,0.09),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(207,32,39,0.08),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f2f5fa_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(11,93,179,0.04)_0%,rgba(255,255,255,0)_35%,rgba(255,255,255,0)_65%,rgba(207,32,39,0.04)_100%)]" />
        <div className="absolute left-[-140px] top-[8%] h-[320px] w-[320px] rounded-full bg-[#0b5db3]/12 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-[320px] w-[320px] rounded-full bg-[#cf2027]/10 blur-3xl" />
        <div className="absolute left-[8%] top-[16%] hidden h-[720px] w-[720px] -rotate-[18deg] opacity-[0.05] xl:block">
          <FcaBrandCrest className="h-full w-full" variant="watermark" />
        </div>
        <div className="absolute right-[4%] top-[10%] hidden h-[540px] w-[540px] rotate-[16deg] opacity-[0.035] 2xl:block">
          <FcaBrandCrest className="h-full w-full" variant="watermark" />
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1520px] flex-col px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex justify-end">
          <div className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-right shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{formattedDate}</span>
            </div>
            <p className="mt-1 text-[28px] font-black leading-none tracking-[-0.04em] text-[#0b122d] sm:text-[34px]">
              {formattedTime}
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center py-6 lg:py-10">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_440px] lg:gap-12">
            <section className="relative">
              <div className="max-w-[760px]">
                <div className="mb-8 flex items-center gap-4">
                  <div className="flex h-[92px] w-[92px] items-center justify-center rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:h-[112px] sm:w-[112px]">
                    <Image
                      src="/images/logos/fc-allschwil.png"
                      alt="FC Allschwil"
                      width={96}
                      height={96}
                      priority
                      className="h-auto w-full object-contain"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-600">
                      FC Allschwil
                    </p>
                    <p className="mt-2 text-sm text-slate-600 sm:text-base">
                      Interner Bereich für Planung, Organisation und Vereinssteuerung
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h1 className="font-display text-[44px] font-black uppercase leading-[0.9] tracking-[-0.05em] text-[#0b122d] sm:text-[58px] lg:text-[74px]">
                    Clubmanager
                  </h1>

                  <h2 className="font-display text-[24px] font-black uppercase leading-[0.96] tracking-[-0.04em] text-[#0b5db3] sm:text-[32px] lg:text-[40px]">
                    Willkommen beim FC Allschwil
                  </h2>

                  <p className="max-w-[620px] pt-3 text-sm leading-7 text-slate-600 sm:text-base">
                    Zentrale Plattform für Benutzer, Rollen, Planung, Kommunikation und
                    operative Abläufe im Club.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur">
                    <ShieldCheck className="h-4 w-4 text-[#0b5db3]" />
                    <span>Geschützter interner Bereich</span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur">
                    <Lock className="h-4 w-4 text-[#cf2027]" />
                    <span>2FA-ready Architektur</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="relative">
              <div className="relative overflow-hidden rounded-[34px] border border-white/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-sm sm:p-7">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0b4aa2_0%,#4a6fd1_45%,#cf2027_100%)]" />

                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600">
                    Zugang
                  </p>
                  <h3 className="mt-3 text-[26px] font-black tracking-[-0.03em] text-[#0b122d]">
                    Anmelden
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Bitte gib deine Zugangsdaten ein, um auf das System zuzugreifen.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      E-Mail
                    </label>

                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="name@fcallschwil.ch"
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0b5db3]/35 focus:bg-white focus:ring-4 focus:ring-[#0b5db3]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Passwort
                    </label>

                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Passwort"
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0b5db3]/35 focus:bg-white focus:ring-4 focus:ring-[#0b5db3]/10"
                      />
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                      className="text-xs font-semibold text-[#0b5db3] transition hover:text-[#094c91]"
                    >
                      Passwort vergessen?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0b5db3] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(11,93,179,0.24)] transition hover:bg-[#094c91] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{isSubmitting ? "Anmeldung läuft..." : "Anmelden"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="my-6 h-px bg-slate-200" />

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="mt-0.5 rounded-full bg-white p-2 shadow-sm">
                    <Lock className="h-4 w-4 text-slate-700" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Sicherer Zugang
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Geschützter Bereich für interne Vorgänge, Benutzerverwaltung und
                      operative Clubprozesse.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
