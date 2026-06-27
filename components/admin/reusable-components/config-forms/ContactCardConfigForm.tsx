"use client";

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function ContactCardConfigForm({ config, onChange }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field label="Name" required>
        <input
          type="text"
          value={(config.personName as string) ?? ""}
          onChange={(e) => set("personName", e.target.value)}
          placeholder="Max Mustermann"
          className="fca-input"
        />
      </Field>

      <Field label="Rolle / Funktion">
        <input
          type="text"
          value={(config.role as string) ?? ""}
          onChange={(e) => set("role", e.target.value)}
          placeholder="Vereinspräsident"
          className="fca-input"
        />
      </Field>

      <Field label="Bild-URL">
        <input
          type="url"
          value={(config.imageUrl as string) ?? ""}
          onChange={(e) => set("imageUrl", e.target.value)}
          placeholder="https://cdn.example.com/person.jpg"
          className="fca-input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefon">
          <input
            type="tel"
            value={(config.phone as string) ?? ""}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+41 79 123 45 67"
            className="fca-input"
          />
        </Field>
        <Field label="E-Mail">
          <input
            type="email"
            value={(config.email as string) ?? ""}
            onChange={(e) => set("email", e.target.value)}
            placeholder="max@fcallschwil.ch"
            className="fca-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA-Text">
          <input
            type="text"
            value={(config.ctaLabel as string) ?? ""}
            onChange={(e) => set("ctaLabel", e.target.value)}
            placeholder="Kontakt aufnehmen"
            className="fca-input"
          />
        </Field>
        <Field label="CTA-URL">
          <input
            type="url"
            value={(config.ctaUrl as string) ?? ""}
            onChange={(e) => set("ctaUrl", e.target.value)}
            placeholder="https://..."
            className="fca-input"
          />
        </Field>
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
