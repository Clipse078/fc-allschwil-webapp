"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";

const CANONICAL_LOGO_SRC = "/images/branding/sportclubevo_logo_alt.png";
const LOGO_ASPECT = 864 / 174;

function ScePlatformWordmark({
  height = 40,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={CANONICAL_LOGO_SRC}
      alt="SportClubEvo"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}

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
    <main className="sce-login relative flex min-h-screen bg-[var(--background)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 left-[18%] rounded-full"
          style={{
            width: 480,
            height: 480,
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--sce-primary) 6%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-8%] right-[-4%] rounded-full"
          style={{
            width: 360,
            height: 360,
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--sce-primary) 4%, transparent) 0%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative z-10 flex w-full flex-col lg:min-h-screen lg:flex-row">
        <div
          className={cn(
            "hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col",
            "border-r border-[var(--border)] px-12 py-14 xl:px-16 xl:py-16",
          )}
        >
          <ScePlatformWordmark height={44} className="max-w-[300px]" />

          <div className="flex flex-1 flex-col justify-center py-16">
            <div className="max-w-[26rem]">
              <h1 className="sce-login-headline text-[2.125rem] font-bold tracking-[-0.03em] text-[var(--foreground)] xl:text-[2.375rem]">
                Das Betriebssystem
                <br />
                für moderne
                <br />
                Sportvereine.
              </h1>
              <p className="mt-6 max-w-[22rem] text-[0.9375rem] leading-[1.65] text-[var(--text-2)]">
                Teams, Events, News und Kommunikation — professionell verwaltet an einem Ort.
              </p>
            </div>
          </div>

          <p className="text-[0.6875rem] tracking-wide text-[var(--muted)]">
            © 2026 SportClubEvo
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 sm:px-10 lg:py-16">
          <div className="mb-12 flex flex-col items-center lg:hidden">
            <ScePlatformWordmark height={40} className="max-w-[260px]" />
          </div>

          <div className="w-full max-w-[400px]">
            <div className="mb-9">
              <h2 className="text-[1.5rem] font-bold tracking-[-0.02em] text-[var(--foreground)]">
                Einloggen
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="sce-login-label">
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sce-login-input"
                  placeholder="name@verein.ch"
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <label htmlFor="password" className="sce-login-label mb-0">
                    Passwort
                  </label>
                  <a
                    href="/forgot-password"
                    className="sce-link-primary shrink-0 text-[0.75rem] font-medium leading-none"
                  >
                    Passwort vergessen?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sce-login-input"
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
                  "sce-login-submit w-full",
                  "disabled:cursor-not-allowed disabled:opacity-55",
                )}
              >
                {isSubmitting ? "Anmeldung läuft…" : "Einloggen"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
