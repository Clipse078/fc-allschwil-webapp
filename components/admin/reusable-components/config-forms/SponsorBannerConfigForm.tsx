"use client";

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function SponsorBannerConfigForm({ config, onChange }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field label="Sponsor-Name" required>
        <input
          type="text"
          value={(config.sponsorName as string) ?? ""}
          onChange={(e) => set("sponsorName", e.target.value)}
          placeholder="Musterfirma AG"
          className="fca-input"
        />
      </Field>

      <Field label="Logo-URL">
        <input
          type="url"
          value={(config.logoUrl as string) ?? ""}
          onChange={(e) => set("logoUrl", e.target.value)}
          placeholder="https://cdn.example.com/logo.svg"
          className="fca-input"
        />
      </Field>

      <Field label="Headline">
        <input
          type="text"
          value={(config.headline as string) ?? ""}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Unser Hauptsponsor"
          className="fca-input"
        />
      </Field>

      <Field label="Text">
        <textarea
          value={(config.text as string) ?? ""}
          onChange={(e) => set("text", e.target.value)}
          rows={2}
          className="fca-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA-Text">
          <input
            type="text"
            value={(config.ctaLabel as string) ?? ""}
            onChange={(e) => set("ctaLabel", e.target.value)}
            placeholder="Website besuchen"
            className="fca-input"
          />
        </Field>
        <Field label="CTA-URL">
          <input
            type="url"
            value={(config.ctaUrl as string) ?? ""}
            onChange={(e) => set("ctaUrl", e.target.value)}
            placeholder="https://sponsor.ch"
            className="fca-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kampagnenstart">
          <input
            type="date"
            value={(config.campaignStart as string) ?? ""}
            onChange={(e) => set("campaignStart", e.target.value || null)}
            className="fca-input"
          />
        </Field>
        <Field label="Kampagnenende">
          <input
            type="date"
            value={(config.campaignEnd as string) ?? ""}
            onChange={(e) => set("campaignEnd", e.target.value || null)}
            className="fca-input"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="click-tracking"
          checked={(config.clickTrackingEnabled as boolean) ?? false}
          onChange={(e) => set("clickTrackingEnabled", e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        <label htmlFor="click-tracking" className="text-xs text-[var(--foreground)]">
          Click-Tracking aktivieren
        </label>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
