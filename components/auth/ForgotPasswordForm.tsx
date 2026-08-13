"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";

function ScePlatformWordmark({ size = 42 }: { size?: number }) {
  return (
    <Image
      src="/images/branding/sportclubevo_logo.png"
      alt="SportClubEvo"
      width={Math.round(size * 5.2)}
      height={size}
      priority
      className="h-auto w-auto max-w-[320px] object-contain"
    />
  );
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(
          (data as { error?: string }).error ??
            "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
        );
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setErrorMessage("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen" style={{ background: "#F8FAFC" }}>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 flex flex-col items-center gap-1">
          <ScePlatformWordmark size={40} />
        </div>

        <div className="w-full max-w-[400px]">
          <div
            className="rounded-2xl p-8"
            style={{
              background: "#ffffff",
              border: "1px solid #E5E7EB",
              boxShadow:
                "0 4px 24px rgba(17,24,39,0.08), 0 1px 4px rgba(17,24,39,0.04)",
            }}
          >
            {submitted ? (
              <SuccessState />
            ) : (
              <RequestForm
                email={email}
                setEmail={setEmail}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                onSubmit={handleSubmit}
              />
            )}
          </div>

          <p
            className="mt-6 text-center text-[0.72rem]"
            style={{ color: "#9CA3AF" }}
          >
            Powered by{" "}
            <span className="font-semibold" style={{ color: "#6B7280" }}>
              SportClubEvo
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}

function SuccessState() {
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(255,106,0,0.10)" }}
        aria-hidden="true"
      >
        <span style={{ fontSize: "1.5rem" }}>✉️</span>
      </div>

      <h2
        className="mb-3 text-[1.25rem] font-bold tracking-tight"
        style={{ color: "#111827" }}
      >
        E-Mail gesendet
      </h2>

      <p className="mb-6 text-[0.875rem] leading-relaxed" style={{ color: "#6B7280" }}>
        Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir
        einen Link zum Zurücksetzen des Passworts gesendet.
      </p>

      <p className="mb-6 text-[0.8125rem]" style={{ color: "#9CA3AF" }}>
        Bitte überprüfe auch deinen Spam-Ordner. Der Link ist 60 Minuten gültig.
      </p>

      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-xl px-6 text-[0.875rem] font-semibold transition"
        style={{
          background: "linear-gradient(135deg, #FF6A00 0%, #FF8533 100%)",
          color: "#ffffff",
          boxShadow: "0 2px 10px rgba(255,106,0,0.30)",
        }}
      >
        Zurück zum Login
      </Link>
    </div>
  );
}

function RequestForm({
  email,
  setEmail,
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  isSubmitting: boolean;
  errorMessage: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="mb-6">
        <h2
          className="text-[1.375rem] font-bold tracking-tight"
          style={{ color: "#111827" }}
        >
          Passwort vergessen?
        </h2>

        <p className="mt-1 text-[0.875rem]" style={{ color: "#6B7280" }}>
          Gib deine E-Mail-Adresse ein und wir senden dir einen
          Zurücksetzen-Link.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[0.8125rem] font-medium"
            style={{ color: "#374151" }}
          >
            E-Mail-Adresse
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn("fca-input", "transition focus:ring-0")}
            placeholder="name@verein.ch"
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
            "w-full h-11 rounded-xl font-semibold text-[0.9375rem] text-white transition",
            "disabled:cursor-not-allowed disabled:opacity-55",
          )}
          style={{
            background: isSubmitting
              ? "#FF8533"
              : "linear-gradient(135deg, #FF6A00 0%, #FF8533 100%)",
            boxShadow: "0 2px 10px rgba(255,106,0,0.30)",
          }}
        >
          {isSubmitting ? "Wird gesendet…" : "Zurücksetzen-Link senden"}
        </button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-[0.8125rem] transition-colors"
            style={{ color: "#6B7280" }}
          >
            ← Zurück zum Login
          </Link>
        </div>
      </form>
    </>
  );
}
