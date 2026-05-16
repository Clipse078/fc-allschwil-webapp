"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import FcaBrandCrest from "@/components/shared/FcaBrandCrest";

export default function LoginForm() {
  const [email, setEmail] = useState("admin@fcallschwil.ch");
  const [password, setPassword] = useState("ChangeMe123!");
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
    <main className="relative min-h-screen overflow-hidden text-[#111827]">
      <div className="absolute inset-0">
        <Image
          src="/images/branding/fca-bg.jpg"
          alt="FC Allschwil Background"
          fill
          priority
          className="object-cover opacity-[0.6]"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.68)_38%,rgba(248,250,252,0.80)_100%)]" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-[420px] w-[420px] rounded-full bg-[#0b5db3]/10 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[#cf2027]/10 blur-3xl" />

        <div className="absolute left-1/2 top-1/2 h-[920px] w-[920px] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]">
          <FcaBrandCrest className="h-full w-full" variant="watermark" />
        </div>

        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#0b5db3]/35 to-[#cf2027]/35" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="flex justify-end px-8 pt-5 lg:px-14">
          <div className="text-right">
            <p className="text-[18px] font-medium tracking-tight text-slate-700 lg:text-[22px]">
              {formattedDate}
            </p>
            <p className="mt-1 text-[44px] font-black leading-none tracking-tight text-[#111827] lg:text-[58px]">
              {formattedTime}
            </p>
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-110px)] max-w-[1600px] flex-col items-center justify-center px-6 pb-16 pt-10 lg:px-10 lg:pb-20 lg:pt-6">
          <div className="w-full max-w-[980px] text-center">
            <div className="mx-auto mb-6 w-[88px] lg:mb-8 lg:w-[120px]">
              <Image
                src="/images/logos/fc-allschwil.png"
                alt="FC Allschwil"
                width={120}
                height={120}
                priority
                className="h-auto w-full object-contain drop-shadow-[0_8px_20px_rgba(15,23,42,0.15)]"
              />
            </div>

            <h1 className="text-[72px] font-black uppercase leading-[0.9] tracking-[-0.04em] text-[#111827] lg:text-[104px]">
              Willkommen
            </h1>

            <h2 className="text-[64px] font-black uppercase leading-[0.9] tracking-[-0.05em] text-[#0b5db3] lg:text-[96px]">
              beim FC Allschwil
            </h2>

            <h3 className="text-[56px] font-black uppercase leading-[0.9] tracking-[-0.05em] text-[#cf2027] lg:text-[88px]">
              Clubmanager
            </h3>

            <div className="mx-auto mt-10 w-full max-w-[520px] rounded-[32px] border border-white/70 bg-white/86 p-6 text-left shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b5db3] focus:ring-2 focus:ring-blue-100"
                    placeholder="admin@fcallschwil.ch"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Passwort
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#cf2027] focus:ring-2 focus:ring-red-100"
                    placeholder="Passwort"
                    required
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-full bg-[#cf2027] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-[#b51b22] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Anmeldung läuft..." : "Einloggen"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
