"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const MIN_PASSWORD_LENGTH = 12;

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

type Phase = "form" | "success" | "error";

export default function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // When the global account already exists, we skip name/password fields.
  const [existingAccount, setExistingAccount] = useState(false);

  if (!token) {
    return (
      <AuthShell>
        <ErrorState message="Ungültiger Einladungslink. Bitte wende dich an deinen Administrator." />
      </AuthShell>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!existingAccount) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setErrorMessage(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Die Passwörter stimmen nicht überein.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, string> = { token };
      if (!existingAccount) {
        body.firstName = firstName;
        body.lastName = lastName;
        body.password = password;
      }

      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({})) as {
        error?: string;
        alreadyAccepted?: boolean;
        userId?: string;
      };

      if (!res.ok && res.status !== 409) {
        // 409 with alreadyAccepted = still a success state
        const msg = data.error ?? "Ein Fehler ist aufgetreten.";
        // If the error is about a missing existing account, let user fill in details
        if (msg.includes("erforderlich") && existingAccount) {
          setExistingAccount(false);
          setErrorMessage("Bitte gib deine Daten ein, um ein neues Konto zu erstellen.");
        } else {
          setErrorMessage(msg);
          if (res.status === 404 || res.status === 410) {
            setPhase("error");
          }
        }
        return;
      }

      setPhase("success");
    } catch {
      setErrorMessage("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === "error") {
    return (
      <AuthShell>
        <ErrorState message={errorMessage || "Einladung ungültig oder abgelaufen."} />
      </AuthShell>
    );
  }

  if (phase === "success") {
    return (
      <AuthShell>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Konto aktiviert</h2>
          <p className="text-sm text-[var(--text-2)]">
            Dein Konto wurde erfolgreich aktiviert. Du kannst dich jetzt anmelden.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Zur Anmeldung
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--foreground)]">Einladung annehmen</h2>
          <p className="text-sm text-[var(--text-2)]">
            Erstelle dein Konto, um die Einladung anzunehmen.
          </p>
        </div>

        {/* Toggle: existing account */}
        <label className="flex items-center gap-2 text-sm text-[var(--text-2)] cursor-pointer">
          <input
            type="checkbox"
            checked={existingAccount}
            onChange={(e) => {
              setExistingAccount(e.target.checked);
              setErrorMessage("");
            }}
            className="rounded border-[var(--border)]"
          />
          Ich habe bereits ein SportClubEvo-Konto
        </label>

        {!existingAccount && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--foreground)]">Vorname</label>
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--foreground)]">Nachname</label>
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--foreground)]">Passwort</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 pr-10 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                  tabIndex={-1}
                >
                  {showPassword ? "👁" : "🔒"}
                </button>
              </div>
              <p className="text-xs text-[var(--muted)]">Mindestens {MIN_PASSWORD_LENGTH} Zeichen</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--foreground)]">Passwort bestätigen</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          </>
        )}

        {existingAccount && (
          <div className="rounded-[var(--radius-md)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Dein bestehendes Konto (mit der eingeladenen E-Mail-Adresse) wird mit dem Club verknüpft.
          </div>
        )}

        {errorMessage && (
          <p className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition",
            isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:opacity-90",
          )}
        >
          {isSubmitting ? "Wird verarbeitet…" : "Einladung annehmen"}
        </button>

        <p className="text-center text-xs text-[var(--muted)]">
          <Link href="/login" className="hover:text-[var(--foreground)] transition">
            Zurück zur Anmeldung
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="mb-8">
        <ScePlatformWordmark size={36} />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[var(--foreground)]">Link ungültig</h2>
      <p className="text-sm text-[var(--text-2)]">{message}</p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
      >
        Zur Anmeldung
      </Link>
    </div>
  );
}
