"use client";

/**
 * AccountPageClient — Mein Konto self-service UI (MEIN-KONTO-01 / ACCOUNT-01-C2)
 *
 * Editable fields:
 *   - First name, last name (always — Person if linked, User otherwise)
 *   - Phone (only when a Person is linked)
 *   - Profile picture (only when a Person is linked)
 *
 * Read-only:
 *   - Login email (no verified email-change flow)
 *   - Current club / tenant name
 *   - Linked Person status
 *
 * Security:
 *   - In-app password change (current → new → confirm) via POST /api/account/change-password
 *
 * Not exposed:
 *   - Roles, permissions, OrgUnits, teams, tenant access
 */

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Save,
  Trash2,
  Upload,
  User,
  UserCheck,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// ── Types ─────────────────────────────────────────────────────────────────────

type AccountUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type LinkedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  imageUrl: string | null;
};

type AccountPageClientProps = {
  user: AccountUser;
  linkedPerson: LinkedPerson | null;
  tenantName: string | null;
};

// ── Feedback banner ───────────────────────────────────────────────────────────

function FeedbackBanner({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  if (type === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {message}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

// ── Inline avatar (profile card left column) ──────────────────────────────────

function ProfileAvatar({
  imageUrl,
  initials,
  displayName,
  onUpload,
  onRemove,
  uploading,
  removing,
  fileRef,
}: {
  imageUrl: string | null;
  initials: string;
  displayName: string;
  onUpload: () => void;
  onRemove: () => void;
  uploading: boolean;
  removing: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-col items-center gap-3 min-w-[96px]">
      {/* Avatar circle */}
      <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-[var(--border)] shadow-sm">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "var(--tenant-primary)" }}
            aria-hidden="true"
          >
            <span className="text-xl font-bold text-white select-none">
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5 w-full">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading || removing}
          onClick={onUpload}
          className="w-full text-xs justify-center"
        >
          {uploading ? (
            <Upload className="h-3 w-3 animate-pulse" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
          {imageUrl ? "Ersetzen" : "Bild hochladen"}
        </Button>

        {imageUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading || removing}
            onClick={onRemove}
            className="w-full text-xs justify-center"
          >
            {removing ? (
              <Trash2 className="h-3 w-3 animate-pulse" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Entfernen
          </Button>
        )}
      </div>

      <p className="text-center text-[0.65rem] text-[var(--muted)] leading-snug">
        JPEG, PNG oder WebP
        <br />
        max. 4 MB
      </p>
    </div>
  );
}

// ── Read-only field row ────────────────────────────────────────────────────────

function ReadOnlyField({
  icon: Icon,
  label,
  value,
  hint,
  badge,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)]">
        <Icon className="h-3 w-3 text-[var(--muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {label}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{value}</span>
          {badge}
        </div>
        {hint && (
          <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">{hint}</p>
        )}
      </div>
      <Lock className="mt-1 h-3 w-3 shrink-0 text-[var(--muted)] opacity-40" aria-label="Schreibgeschützt" />
    </div>
  );
}

// ── Password change form ───────────────────────────────────────────────────────

function PasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/account/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: "error", message: data.error ?? "Fehler beim Speichern." });
        } else {
          setFeedback({ type: "success", message: "Passwort erfolgreich geändert." });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setTimeout(() => {
            setOpen(false);
            setFeedback(null);
          }, 2000);
        }
      } catch {
        setFeedback({ type: "error", message: "Passwort konnte nicht geändert werden." });
      }
    });
  };

  const handleCancel = () => {
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFeedback(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">
            <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Passwort ändern</p>
            <p className="text-xs text-[var(--muted)]">Sicheres Passwort vergeben oder zurücksetzen.</p>
          </div>
        </div>
        {!open && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <KeyRound className="h-3 w-3" />
            Passwort ändern
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-[var(--border)]">
          {/* Current password */}
          <div>
            <label
              htmlFor="current-password"
              className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
            >
              Aktuelles Passwort
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="sce-input w-full pr-9"
                placeholder="Aktuelles Passwort"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label={showCurrent ? "Passwort verbergen" : "Passwort anzeigen"}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
            >
              Neues Passwort{" "}
              <span className="font-normal text-[var(--muted)]">(min. 12 Zeichen)</span>
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                required
                autoComplete="new-password"
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="sce-input w-full pr-9"
                placeholder="Neues Passwort"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label={showNew ? "Passwort verbergen" : "Passwort anzeigen"}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
            >
              Neues Passwort bestätigen
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                required
                autoComplete="new-password"
                minLength={12}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="sce-input w-full pr-9"
                placeholder="Neues Passwort wiederholen"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label={showConfirm ? "Passwort verbergen" : "Passwort anzeigen"}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={isPending}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              <Save className="h-3 w-3" />
              {isPending ? "Speichern…" : "Passwort speichern"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AccountPageClient({
  user,
  linkedPerson,
  tenantName,
}: AccountPageClientProps) {
  const router = useRouter();

  // Derive display name: prefer Person, fall back to User
  const effectiveFirstName = linkedPerson?.firstName ?? user.firstName;
  const effectiveLastName = linkedPerson?.lastName ?? user.lastName;
  const displayName = `${effectiveFirstName} ${effectiveLastName}`.trim() || "Mein Konto";
  const initials = `${effectiveFirstName.charAt(0)}${effectiveLastName.charAt(0)}`
    .toUpperCase()
    .slice(0, 2);

  // Form state — initialise from canonical source
  const [firstName, setFirstName] = useState(effectiveFirstName);
  const [lastName, setLastName] = useState(effectiveLastName);
  const [phone, setPhone] = useState(linkedPerson?.phone ?? "");
  const [imageUrl, setImageUrl] = useState(linkedPerson?.imageUrl ?? null);

  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [formFeedback, setFormFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty =
    firstName !== effectiveFirstName ||
    lastName !== effectiveLastName ||
    (linkedPerson !== null && phone !== (linkedPerson.phone ?? ""));

  // ── Image upload / remove ────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImgError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/account/profile-image", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setImgError(data.error ?? "Upload fehlgeschlagen.");
        } else {
          setImageUrl(data.imageUrl);
          router.refresh();
        }
      } catch {
        setImgError("Upload fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [router],
  );

  const handleRemove = useCallback(async () => {
    if (!imageUrl) return;
    setImgError(null);
    setRemoving(true);
    try {
      const res = await fetch("/api/account/profile-image", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setImgError(data.error ?? "Entfernen fehlgeschlagen.");
      } else {
        setImageUrl(null);
        router.refresh();
      }
    } catch {
      setImgError("Entfernen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setRemoving(false);
    }
  }, [imageUrl, router]);

  // Wire the hidden file input's change event
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void handleFileChange(e);
    },
    [handleFileChange],
  );

  // ── Profile form submit ──────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setFormFeedback(null);

    startTransition(async () => {
      try {
        const body: Record<string, string> = { firstName, lastName };
        if (linkedPerson) body.phone = phone;

        const res = await fetch("/api/account/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          setFormFeedback({ type: "error", message: data.error ?? "Speichern fehlgeschlagen." });
          return;
        }

        setFormFeedback({ type: "success", message: "Profil erfolgreich gespeichert." });
        router.refresh();
      } catch {
        setFormFeedback({
          type: "error",
          message: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
        });
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageHeader
        eyebrow="Konto"
        title="Mein Konto"
        description="Persönliche Daten und Einstellungen verwalten."
      />

      {/* ── Profil card ─────────────────────────────────────────────────── */}
      <Card title="Profil">
        <div className="flex gap-6">
          {/* Left: avatar (only when Person linked — avatar is person-specific) */}
          {linkedPerson && (
            <div className="shrink-0">
              <ProfileAvatar
                imageUrl={imageUrl}
                initials={initials}
                displayName={displayName}
                onUpload={() => fileRef.current?.click()}
                onRemove={handleRemove}
                uploading={uploading}
                removing={removing}
                fileRef={fileRef}
              />
              {/* Wire the real file input here so ProfileAvatar doesn't need it inline */}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleFileInputChange}
              />
            </div>
          )}

          {/* Right: linked-person status + editable fields */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* Linked person badge */}
            <div className="flex items-center gap-2">
              <UserCheck className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Verknüpftes Profil
              </span>
              {linkedPerson ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[0.65rem] font-semibold text-green-700">
                  Verknüpft mit Person-Profil
                </span>
              ) : (
                <span className="text-[0.7rem] text-[var(--muted)]">
                  Kein Profil in diesem Verein
                </span>
              )}
            </div>

            {imgError && <FeedbackBanner type="error" message={imgError} />}

            {/* Editable name + phone */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="account-firstName"
                    className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                  >
                    Vorname
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      id="account-firstName"
                      type="text"
                      required
                      maxLength={100}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="sce-input w-full pl-8"
                      placeholder="Vorname"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="account-lastName"
                    className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                  >
                    Nachname
                  </label>
                  <input
                    id="account-lastName"
                    type="text"
                    required
                    maxLength={100}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="sce-input w-full"
                    placeholder="Nachname"
                  />
                </div>
              </div>

              {linkedPerson && (
                <div>
                  <label
                    htmlFor="account-phone"
                    className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                  >
                    Telefonnummer{" "}
                    <span className="font-normal text-[var(--muted)]">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      id="account-phone"
                      type="tel"
                      maxLength={50}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="sce-input w-full pl-8"
                      placeholder="+41 79 000 00 00"
                    />
                  </div>
                </div>
              )}

              {formFeedback && (
                <FeedbackBanner type={formFeedback.type} message={formFeedback.message} />
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!isDirty || isPending}
                >
                  <Save className="h-3.5 w-3.5" />
                  {isPending ? "Speichern…" : "Speichern"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* ── Konto card ──────────────────────────────────────────────────── */}
      <Card title="Konto">
        <div className="space-y-3">
          <ReadOnlyField
            icon={Mail}
            label="Login-E-Mail"
            value={user.email}
            hint="E-Mail-Adresse kann nicht selbst geändert werden."
          />
          {tenantName && (
            <ReadOnlyField
              icon={Building2}
              label="Aktueller Verein"
              value={tenantName}
              hint="Aktiver Verein in dieser Sitzung."
            />
          )}
        </div>
      </Card>

      {/* ── Sicherheit card ─────────────────────────────────────────────── */}
      <Card title="Sicherheit">
        <PasswordChangeForm />
      </Card>
    </div>
  );
}
