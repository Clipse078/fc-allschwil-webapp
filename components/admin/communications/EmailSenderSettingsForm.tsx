"use client";

import { useState } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { useToast } from "@/hooks/use-toast";

type ProviderStatus = "VERIFIED" | "NOT_VERIFIED" | "UNKNOWN" | "NOT_CONFIGURED";

type EmailSenderSettings = {
  displayName: string | null;
  emailAddress: string | null;
  providerStatus: ProviderStatus;
  activeSource: "TENANT" | "PLATFORM";
  activeFrom: string;
  platformFallbackActive: boolean;
};

type Props = {
  initialSettings: EmailSenderSettings;
};

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function providerStatusPresentation(status: ProviderStatus) {
  switch (status) {
    case "VERIFIED":
      return {
        label: "Vereinsabsender aktiv",
        variant: "success" as const,
        message: "E-Mails werden mit dem konfigurierten Vereinsabsender versendet.",
      };
    case "NOT_VERIFIED":
      return {
        label: "SportClubEvo-Standardabsender aktiv",
        variant: "warning" as const,
        message: "Für diese Absenderadresse wird aktuell der SportClubEvo-Standardabsender verwendet.",
      };
    case "UNKNOWN":
      return {
        label: "SportClubEvo-Standardabsender aktiv",
        variant: "warning" as const,
        message:
          "Die Versandfreigabe für diese Absenderadresse konnte aktuell nicht bestätigt werden. Deshalb wird der SportClubEvo-Standardabsender verwendet.",
      };
    case "NOT_CONFIGURED":
      return {
        label: "SportClubEvo-Standardabsender aktiv",
        variant: "neutral" as const,
        message:
          "Noch ist kein Vereinsabsender konfiguriert. E-Mails werden mit dem SportClubEvo-Standardabsender versendet.",
      };
  }
}

export default function EmailSenderSettingsForm({ initialSettings }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [displayName, setDisplayName] = useState(initialSettings.displayName ?? "");
  const [emailAddress, setEmailAddress] = useState(initialSettings.emailAddress ?? "");
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    emailAddress?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setSaving(true);

    try {
      const response = await fetch("/api/admin/communications/email-sender", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, emailAddress }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        settings?: EmailSenderSettings;
        error?: string;
        field?: "displayName" | "emailAddress";
      };

      if (!response.ok || !data.settings) {
        if (data.field) {
          setFieldErrors({ [data.field]: data.error ?? "Ungültiger Wert." });
        }
        toast.danger(data.error ?? "E-Mail-Absender konnte nicht gespeichert werden.");
        return;
      }

      setSettings(data.settings);
      setDisplayName(data.settings.displayName ?? "");
      setEmailAddress(data.settings.emailAddress ?? "");
      toast.success("E-Mail-Absender aktualisiert.");
    } catch {
      toast.danger("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const status = providerStatusPresentation(settings.providerStatus);

  return (
    <SectionCard
      title="E-Mail-Absender"
      description="Legen Sie fest, welchen Namen und welche Adresse Empfänger bei Vereins-E-Mails sehen."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5" data-testid="email-sender-form">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Mail className="h-4 w-4" aria-hidden />
              <p className={labelClass}>Konfigurierter Absender</p>
            </div>
            {settings.displayName && settings.emailAddress ? (
              <>
                <p className="mt-2 font-semibold text-[var(--foreground)]">
                  {settings.displayName}
                </p>
                <p className="mt-0.5 break-all text-sm text-[var(--text-2)]">
                  {settings.emailAddress}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Noch kein Vereinsabsender hinterlegt.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              <p className={labelClass}>Versandstatus</p>
            </div>
            <div className="mt-2">
              <StatusIndicator variant={status.variant} label={status.label} />
            </div>
            <p className="mt-3 text-sm leading-5 text-[var(--text-2)]">
              {status.message}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="email-sender-display-name" className={labelClass}>
            Absendername
          </label>
          <input
            id="email-sender-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={120}
            autoComplete="organization"
            placeholder="FC Allschwil"
            disabled={saving}
            aria-invalid={!!fieldErrors.displayName}
            aria-describedby={fieldErrors.displayName ? "email-sender-display-name-error" : undefined}
            className="fca-input w-full"
          />
          {fieldErrors.displayName ? (
            <p
              id="email-sender-display-name-error"
              role="alert"
              className="mt-1 text-[11px] font-medium text-[var(--sce-danger)]"
            >
              {fieldErrors.displayName}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email-sender-address" className={labelClass}>
            Absender-E-Mail-Adresse
          </label>
          <input
            id="email-sender-address"
            type="email"
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
            maxLength={320}
            autoComplete="email"
            placeholder="info@fcallschwil.ch"
            disabled={saving}
            aria-invalid={!!fieldErrors.emailAddress}
            aria-describedby={fieldErrors.emailAddress ? "email-sender-address-error" : undefined}
            className="fca-input w-full"
          />
          {fieldErrors.emailAddress ? (
            <p
              id="email-sender-address-error"
              role="alert"
              className="mt-1 text-[11px] font-medium text-[var(--sce-danger)]"
            >
              {fieldErrors.emailAddress}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="text-sm text-[var(--text-2)]">
            Antworten werden weiterhin automatisch dem richtigen Vorgang in SportClubEvo zugeordnet.
          </p>
        </div>

        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <button type="submit" disabled={saving} className="fca-button-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Speichern…" : "E-Mail-Absender speichern"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
