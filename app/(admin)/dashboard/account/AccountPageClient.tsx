"use client";

/**
 * AccountPageClient — Mein Konto self-service UI (MEIN-KONTO-01)
 *
 * Editable fields:
 *   - First name, last name (always — Person if linked, User otherwise)
 *   - Phone (only when a Person is linked)
 *   - Profile picture (only when a Person is linked)
 *
 * Read-only:
 *   - Login email (no verified email-change flow exists)
 *   - Current club / tenant name
 *   - Linked Person status
 *
 * Not exposed:
 *   - Roles, permissions, OrgUnits, teams, tenant access
 */

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Camera,
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

// ── Profile image upload area ─────────────────────────────────────────────────

function ProfileImageSection({
  imageUrl,
  displayName,
  onImageChange,
}: {
  imageUrl: string | null;
  displayName: string;
  onImageChange: (newUrl: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = displayName
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImgError(null);
      setUploading(true);

      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/account/profile-image", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setImgError(data.error ?? "Upload fehlgeschlagen.");
        } else {
          onImageChange(data.imageUrl);
        }
      } catch {
        setImgError("Upload fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [onImageChange],
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
        onImageChange(null);
      }
    } catch {
      setImgError("Entfernen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setRemoving(false);
    }
  }, [imageUrl, onImageChange]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar circle */}
      <div className="relative">
        <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center shadow-sm">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayName}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="text-2xl font-bold text-white select-none"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}
              aria-hidden="true"
            >
              {initials}
            </span>
          )}
          {!imageUrl && (
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: "var(--tenant-primary)" }}
              aria-hidden="true"
            />
          )}
          {!imageUrl && (
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white select-none z-10">
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Upload/remove buttons */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading || removing}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Upload className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          {imageUrl ? "Ersetzen" : "Bild hochladen"}
        </Button>

        {imageUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading || removing}
            onClick={handleRemove}
          >
            {removing ? (
              <Trash2 className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Entfernen
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {imgError && (
        <FeedbackBanner type="error" message={imgError} />
      )}

      <p className="text-center text-xs text-[var(--muted)]">
        JPEG, PNG oder WebP · max. 4 MB
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
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)]">
        <Icon className="h-3.5 w-3.5 text-[var(--muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{value}</p>
        {hint && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
        )}
      </div>
      <Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--muted)] opacity-50" aria-label="Schreibgeschützt" />
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

  // Derive display name for avatar: prefer Person name, fall back to User
  const effectiveFirstName = linkedPerson?.firstName ?? user.firstName;
  const effectiveLastName = linkedPerson?.lastName ?? user.lastName;
  const displayName = `${effectiveFirstName} ${effectiveLastName}`.trim() || "Mein Konto";

  // Form state — initialise from the canonical source (Person if present)
  const [firstName, setFirstName] = useState(effectiveFirstName);
  const [lastName, setLastName] = useState(effectiveLastName);
  const [phone, setPhone] = useState(linkedPerson?.phone ?? "");
  const [imageUrl, setImageUrl] = useState(linkedPerson?.imageUrl ?? null);

  const [formFeedback, setFormFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty =
    firstName !== effectiveFirstName ||
    lastName !== effectiveLastName ||
    (linkedPerson !== null && phone !== (linkedPerson.phone ?? ""));

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
          setFormFeedback({
            type: "error",
            message: data.error ?? "Speichern fehlgeschlagen.",
          });
          return;
        }

        setFormFeedback({ type: "success", message: "Profil erfolgreich gespeichert." });

        // Refresh server components so the sidebar/topnav reflect the new name
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
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Konto"
        title="Mein Konto"
        description="Persönliche Daten und Einstellungen verwalten."
      />

      {/* ── Profil section ─────────────────────────────────────────────── */}
      <Card title="Profil">
        <div className="space-y-6">
          {/* Profile picture — only when Person is linked */}
          {linkedPerson && (
            <div className="border-b border-[var(--border)] pb-6">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Profilbild
              </p>
              <ProfileImageSection
                imageUrl={imageUrl}
                displayName={displayName}
                onImageChange={setImageUrl}
              />
            </div>
          )}

          {/* Read-only identity info */}
          <div>
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
              />
            )}
            <div className="flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)]">
                <UserCheck className="h-3.5 w-3.5 text-[var(--muted)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Verknüpftes Profil
                </p>
                {linkedPerson ? (
                  <p className="mt-0.5 text-sm font-medium text-green-700">
                    Verknüpft mit Person-Profil
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-[var(--text-2)]">
                    Kein verknüpftes Person-Profil in diesem Verein
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Editable form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <FeedbackBanner
                type={formFeedback.type}
                message={formFeedback.message}
              />
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={!isDirty || isPending}
              >
                <Save className="h-3.5 w-3.5" />
                {isPending ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* ── Sicherheit section ─────────────────────────────────────────── */}
      <Card title="Sicherheit">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">
              <KeyRound className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Passwort ändern
              </p>
              <p className="text-xs text-[var(--muted)]">
                Sicheres Passwort vergeben oder zurücksetzen.
              </p>
            </div>
          </div>
          <a
            href={`/forgot-password?email=${encodeURIComponent(user.email)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
          >
            <KeyRound className="h-3 w-3" />
            Passwort ändern
          </a>
        </div>
      </Card>
    </div>
  );
}
