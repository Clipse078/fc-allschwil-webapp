"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";

function ScePlatformWordmark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/images/branding/sportclubevo_logo.png"
      alt="SportClubEvo"
      width={Math.round(size * 5.2)}
      height={size}
      priority
      className="h-auto w-auto max-w-[280px] object-contain"
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
          className="absolute -top-40 left-1/4 rounded-full"
          style={{
            width: 520,
            height: 520,
            background:
              "radial-gradient(circle, rgba(255,106,0,0.07) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(255,106,0,0.05) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        <div
          className={cn(
            "hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between",
            "border-r border-[var(--border)] px-10 py-12 xl:px-14",
          )}
        >
          <ScePlatformWordmark size={32} />

          <div className="max-w-md">
            <h1
              className="text-[2.25rem] font-bold leading-[1.12] tracking-[-0.025em] text-[var(--foreground)] xl:text-[2.5rem]"
            >
              Das Betriebssystem
              <br />
              für moderne Sportvereine.
            </h1>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--text-2)]">
              Teams, Events, News und Kommunikation — professionell verwaltet an einem Ort.
            </p>
          </div>

          <p className="text-[0.72rem] text-[var(--muted)]">
            © 2026 SportClubEvo
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
          <div className="mb-10 flex flex-col items-center gap-2 lg:hidden">
            <ScePlatformWordmark size={34} />
          </div>

          <div className="w-full max-w-[380px]">
            <div className="mb-8">
              <h2 className="text-[1.375rem] font-bold tracking-tight text-[var(--foreground)]">
                Einloggen
              </h2>
              <p className="mt-1.5 text-[0.875rem] text-[var(--text-2)]">
                Bitte melde dich mit deinen Zugangsdaten an.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[0.8125rem] font-medium text-[var(--text-2)]"
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="fca-input"
                  placeholder="name@verein.ch"
                  required
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[0.8125rem] font-medium text-[var(--text-2)]"
                  >
                    Passwort
                  </label>
                  <a
                    href="/forgot-password"
                    className="sce-link-primary text-[0.75rem] font-medium"
                    tabIndex={-1}
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
                  "fca-button-primary w-full h-11 text-[0.9375rem]",
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
