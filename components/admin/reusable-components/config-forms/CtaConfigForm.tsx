"use client";

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function CtaConfigForm({ config, onChange }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field label="Headline" required>
        <input
          type="text"
          value={(config.headline as string) ?? ""}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Jetzt Mitglied werden"
          className="fca-input"
        />
      </Field>

      <Field label="Beschreibung">
        <textarea
          value={(config.description as string) ?? ""}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="Kurzer Text unter der Headline"
          className="fca-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Primärer Button-Text">
          <input
            type="text"
            value={(config.primaryLabel as string) ?? ""}
            onChange={(e) => set("primaryLabel", e.target.value)}
            placeholder="Jetzt anmelden"
            className="fca-input"
          />
        </Field>
        <Field label="Primäre Ziel-URL">
          <input
            type="url"
            value={(config.primaryUrl as string) ?? ""}
            onChange={(e) => set("primaryUrl", e.target.value)}
            placeholder="https://..."
            className="fca-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sekundärer Button-Text">
          <input
            type="text"
            value={(config.secondaryLabel as string) ?? ""}
            onChange={(e) => set("secondaryLabel", e.target.value)}
            placeholder="Mehr erfahren"
            className="fca-input"
          />
        </Field>
        <Field label="Sekundäre Ziel-URL">
          <input
            type="url"
            value={(config.secondaryUrl as string) ?? ""}
            onChange={(e) => set("secondaryUrl", e.target.value)}
            placeholder="https://..."
            className="fca-input"
          />
        </Field>
      </div>

      <Field label="Stil">
        <select
          value={(config.stylePreset as string) ?? "default"}
          onChange={(e) => set("stylePreset", e.target.value)}
          className="fca-input"
        >
          <option value="default">Standard</option>
          <option value="primary">Primär (Vereinsfarbe)</option>
          <option value="outline">Outline</option>
          <option value="ghost">Ghost</option>
        </select>
      </Field>
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
