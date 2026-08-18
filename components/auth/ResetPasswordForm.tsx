"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const MIN_PASSWORD_LENGTH = 12;

type TokenValidation =
  | { valid: false }
  | { valid: true; isInvitation: false }
  | {
      valid: true;
      isInvitation: true;
      isExistingUser: boolean;
      tenantName: string | null;
      recipientFirstName: string | null;
    };

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

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Pre-validate the token; receive full context for invitation tokens.
  useEffect(() => {
    if (!token) {
      setValidation({ valid: false });
      return;
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: TokenValidation) => setValidation(data))
      .catch(() => setValidation({ valid: false }));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Die Passwörter stimmen nicht überein.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(
          (data as { error?: string }).error ??
            "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
        );
        return;
      }

      setSuccess(true);
    } catch {
      setErrorMessage("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isInvite = validation?.valid && validation.isInvitation;
  const tenantName = isInvite ? (validation as { tenantName: string | null }).tenantName : null;

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
            {validation === null && (
              <div className="py-8 text-center">
                <p className="text-[0.875rem]" style={{ color: "#9CA3AF" }}>
                  Überprüfe Link…
                </p>
              </div>
            )}

            {validation?.valid === false && <InvalidTokenState />}

            {validation?.valid === true &&
              validation.isInvitation &&
              validation.isExistingUser &&
              !success && (
                <ExistingUserInvitationState
                  tenantName={tenantName}
                  recipientFirstName={validation.recipientFirstName}
                  token={token}
                  onActivated={() => setSuccess(true)}
                />
              )}

            {validation?.valid === true &&
              !(validation.isInvitation && (validation as { isExistingUser?: boolean }).isExistingUser) &&
              !success && (
                <ResetForm
                  isInvitation={validation.isInvitation}
                  tenantName={tenantName}
                  newPassword={newPassword}
                  setNewPassword={setNewPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  showNewPassword={showNewPassword}
                  setShowNewPassword={setShowNewPassword}
                  showConfirmPassword={showConfirmPassword}
                  setShowConfirmPassword={setShowConfirmPassword}
                  isSubmitting={isSubmitting}
                  errorMessage={errorMessage}
                  onSubmit={handleSubmit}
                />
              )}

            {success && (
              <SuccessState
                isInvitation={isInvite ?? false}
                tenantName={tenantName}
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

// ── Existing-user invitation state ────────────────────────────────────────────

/**
 * Shown when an already-active global User receives a tenant invitation.
 * They don't need to set a password — they should log in with existing credentials.
 * Consuming the token marks it as used (idempotent on repeated visits).
 */
function ExistingUserInvitationState({
  tenantName,
  recipientFirstName,
  token,
  onActivated,
}: {
  tenantName: string | null;
  recipientFirstName: string | null;
  token: string;
  onActivated: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clubLabel = tenantName ?? "Ihrem Club";
  const greeting = recipientFirstName ? `Hallo ${recipientFirstName},` : "Hallo,";

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      // Consume the token by posting with a dummy no-op payload — the server
      // validates and marks the token used regardless of this path.
      const res = await fetch("/api/auth/invitation/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Ein Fehler ist aufgetreten.");
        return;
      }
      onActivated();
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(37,99,235,0.10)" }}
        aria-hidden="true"
      >
        <span style={{ fontSize: "1.5rem" }}>✉️</span>
      </div>

      <h2
        className="mb-3 text-[1.25rem] font-bold tracking-tight"
        style={{ color: "#111827" }}
      >
        Einladung zu {clubLabel}
      </h2>

      <p className="mb-4 text-[0.875rem] leading-relaxed" style={{ color: "#6B7280" }}>
        {greeting}
      </p>
      <p className="mb-6 text-[0.875rem] leading-relaxed" style={{ color: "#6B7280" }}>
        Du hast bereits ein SportClubEvo-Konto. Klicke auf den Button unten, um die
        Einladung zu <strong>{clubLabel}</strong> anzunehmen. Danach kannst du dich mit
        deinen bestehenden Zugangsdaten einloggen.
      </p>

      {error ? (
        <p className="mb-4 text-[0.8125rem] text-red-600">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleAccept}
        disabled={accepting}
        className="mb-4 inline-flex h-10 w-full items-center justify-center rounded-xl px-6 text-[0.875rem] font-semibold text-white transition disabled:opacity-60"
        style={{
          background: accepting
            ? "#3b82f6"
            : "linear-gradient(135deg, #2563EB 0%, #3b82f6 100%)",
          boxShadow: "0 2px 10px rgba(37,99,235,0.30)",
        }}
      >
        {accepting ? "Wird angenommen…" : "Einladung annehmen"}
      </button>

      <Link
        href="/login"
        className="text-[0.8125rem] transition-colors"
        style={{ color: "#6B7280" }}
      >
        ← Zum Login
      </Link>
    </div>
  );
}

// ── Invalid token ─────────────────────────────────────────────────────────────

function InvalidTokenState() {
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "#FEF2F2" }}
        aria-hidden="true"
      >
        <span style={{ fontSize: "1.25rem" }}>⚠️</span>
      </div>

      <h2
        className="mb-3 text-[1.25rem] font-bold tracking-tight"
        style={{ color: "#111827" }}
      >
        Link ungültig oder abgelaufen
      </h2>

      <p className="mb-6 text-[0.875rem] leading-relaxed" style={{ color: "#6B7280" }}>
        Dieser Link ist ungültig, bereits verwendet oder abgelaufen.
        Bitte kontaktiere deinen Club-Administrator für eine neue Einladung.
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
        Zum Login
      </Link>
    </div>
  );
}

// ── Success state ─────────────────────────────────────────────────────────────

function SuccessState({
  isInvitation,
  tenantName,
}: {
  isInvitation: boolean;
  tenantName: string | null;
}) {
  const clubLabel = tenantName ?? "deinem Club";

  if (isInvitation) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(22,163,74,0.10)" }}
          aria-hidden="true"
        >
          <span style={{ fontSize: "1.5rem" }}>✅</span>
        </div>

        <h2
          className="mb-3 text-[1.25rem] font-bold tracking-tight"
          style={{ color: "#111827" }}
        >
          Konto aktiviert
        </h2>

        <p className="mb-6 text-[0.875rem] leading-relaxed" style={{ color: "#6B7280" }}>
          Dein Konto wurde erfolgreich aktiviert. Du kannst dich jetzt bei{" "}
          <strong>{clubLabel}</strong> einloggen.
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
          Jetzt einloggen
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(255,106,0,0.10)" }}
        aria-hidden="true"
      >
        <span style={{ fontSize: "1.5rem" }}>✅</span>
      </div>

      <h2
        className="mb-3 text-[1.25rem] font-bold tracking-tight"
        style={{ color: "#111827" }}
      >
        Passwort aktualisiert
      </h2>

      <p className="mb-6 text-[0.875rem] leading-relaxed" style={{ color: "#6B7280" }}>
        Dein Passwort wurde erfolgreich gespeichert. Du kannst dich jetzt
        mit deinem neuen Passwort einloggen.
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
        Zum Login
      </Link>
    </div>
  );
}

// ── Password reset / invitation setup form ────────────────────────────────────

type ResetFormProps = {
  isInvitation: boolean;
  tenantName: string | null;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showNewPassword: boolean;
  setShowNewPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  isSubmitting: boolean;
  errorMessage: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

function ResetForm({
  isInvitation,
  tenantName,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  isSubmitting,
  errorMessage,
  onSubmit,
}: ResetFormProps) {
  const passwordMeetsLength = newPassword.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const clubLabel = tenantName ?? "SportClubEvo";

  return (
    <>
      <div className="mb-6">
        {isInvitation ? (
          <>
            <h2
              className="text-[1.375rem] font-bold tracking-tight"
              style={{ color: "#111827" }}
            >
              Konto aktivieren
            </h2>
            <p className="mt-1 text-[0.875rem]" style={{ color: "#6B7280" }}>
              Lege ein Passwort fest, um deinen Zugang zu{" "}
              <strong>{clubLabel}</strong> zu aktivieren.
            </p>
          </>
        ) : (
          <>
            <h2
              className="text-[1.375rem] font-bold tracking-tight"
              style={{ color: "#111827" }}
            >
              Neues Passwort wählen
            </h2>
            <p className="mt-1 text-[0.875rem]" style={{ color: "#6B7280" }}>
              Wähle ein sicheres Passwort für dein Konto.
            </p>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="newPassword"
            className="mb-1.5 block text-[0.8125rem] font-medium"
            style={{ color: "#374151" }}
          >
            {isInvitation ? "Passwort wählen" : "Neues Passwort"}
          </label>

          <div className="relative">
            <input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="fca-input pr-10"
              placeholder="Mindestens 12 Zeichen"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[0.75rem]"
              style={{ color: "#9CA3AF" }}
              aria-label={showNewPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              {showNewPassword ? "Verbergen" : "Anzeigen"}
            </button>
          </div>

          <p
            className="mt-1 text-[0.75rem]"
            style={{ color: passwordMeetsLength ? "#16a34a" : "#9CA3AF" }}
          >
            {passwordMeetsLength
              ? "✓ Mindestlänge erfüllt"
              : `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-[0.8125rem] font-medium"
            style={{ color: "#374151" }}
          >
            Passwort bestätigen
          </label>

          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="fca-input pr-10"
              placeholder="Passwort wiederholen"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[0.75rem]"
              style={{ color: "#9CA3AF" }}
              aria-label={
                showConfirmPassword ? "Passwort verbergen" : "Passwort anzeigen"
              }
            >
              {showConfirmPassword ? "Verbergen" : "Anzeigen"}
            </button>
          </div>

          {confirmPassword.length > 0 && (
            <p
              className="mt-1 text-[0.75rem]"
              style={{ color: passwordsMatch ? "#16a34a" : "#dc2626" }}
            >
              {passwordsMatch ? "✓ Passwörter stimmen überein" : "Passwörter stimmen nicht überein"}
            </p>
          )}
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
          {isSubmitting
            ? isInvitation
              ? "Wird aktiviert…"
              : "Wird gespeichert…"
            : isInvitation
              ? "Konto aktivieren"
              : "Passwort speichern"}
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
