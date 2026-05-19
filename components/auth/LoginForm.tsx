"use client";

import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import PlatformBrandMark from "@/components/shared/PlatformBrandMark";

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
    <main className="sce-login-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-[420px] w-[420px] rounded-full bg-[var(--sce-primary-soft)] blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[var(--sce-accent-soft)] blur-3xl" />
        <div className="sce-platform-watermark top-1/2 opacity-25" />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--sce-primary)]/35 to-[var(--sce-accent)]/35" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="flex justify-end px-8 pt-5 lg:px-14">
          <div className="text-right">
            <p className="text-[18px] font-medium tracking-tight text-[var(--sce-muted)] lg:text-[22px]">
              {formattedDate}
            </p>
            <p className="mt-1 text-[44px] font-black leading-none tracking-tight text-[var(--sce-heading)] lg:text-[58px]">
              {formattedTime}
            </p>
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-110px)] max-w-[1600px] flex-col items-center justify-center px-6 pb-16 pt-10 lg:px-10 lg:pb-20 lg:pt-6">
          <div className="w-full max-w-[980px] text-center">
            <div className="mb-6 flex justify-center lg:mb-8">
              <PlatformBrandMark size="lg" />
            </div>

            <p className="sce-eyebrow">Premium Sports Operations</p>

            <h1 className="mt-4 text-[64px] font-black uppercase leading-[0.88] tracking-[-0.05em] text-[var(--sce-heading)] lg:text-[104px]">
              SportClubEvo
            </h1>

            <h2 className="mx-auto mt-3 max-w-3xl text-[40px] font-black uppercase leading-[0.94] tracking-[-0.045em] text-[var(--sce-primary)] lg:text-[72px]">
              Operations Cockpit
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--sce-muted)] lg:text-lg">
              Eine neutrale Plattform-Shell für moderne Clubs, klare Prozesse und
              operative Exzellenz über alle Teams hinweg.
            </p>

            <div className="mx-auto mt-7 inline-flex">
              <span className="sce-tenant-chip">Demo workspace: FC Allschwil</span>
            </div>

            <div className="sce-card mx-auto mt-10 w-full max-w-[520px] p-6 text-left backdrop-blur-xl">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-[var(--sce-foreground)]"
                  >
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="sce-form-field"
                    placeholder="admin@fcallschwil.ch"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-[var(--sce-foreground)]"
                  >
                    Passwort
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="sce-form-field"
                    placeholder="Passwort"
                    required
                  />
                </div>

                {errorMessage ? (
                  <div className="fca-status-box fca-status-box-error">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="sce-action-primary w-full px-5 py-3"
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
