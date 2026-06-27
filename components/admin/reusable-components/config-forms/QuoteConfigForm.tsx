"use client";

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function QuoteConfigForm({ config, onChange }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field label="Zitat" required>
        <textarea
          value={(config.quote as string) ?? ""}
          onChange={(e) => set("quote", e.target.value)}
          rows={4}
          placeholder="«Der FC Allschwil ist mehr als ein Verein — er ist eine Gemeinschaft.»"
          className="fca-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Autor">
          <input
            type="text"
            value={(config.author as string) ?? ""}
            onChange={(e) => set("author", e.target.value)}
            placeholder="Max Mustermann"
            className="fca-input"
          />
        </Field>
        <Field label="Organisation">
          <input
            type="text"
            value={(config.organisation as string) ?? ""}
            onChange={(e) => set("organisation", e.target.value)}
            placeholder="FC Allschwil"
            className="fca-input"
          />
        </Field>
      </div>

      <Field label="Autoren-Bild-URL">
        <input
          type="url"
          value={(config.imageUrl as string) ?? ""}
          onChange={(e) => set("imageUrl", e.target.value)}
          placeholder="https://cdn.example.com/author.jpg"
          className="fca-input"
        />
      </Field>

      <Field label="Stil">
        <select
          value={(config.stylePreset as string) ?? "default"}
          onChange={(e) => set("stylePreset", e.target.value)}
          className="fca-input"
        >
          <option value="default">Standard</option>
          <option value="large">Gross</option>
          <option value="minimal">Minimal</option>
          <option value="accent">Akzent (Vereinsfarbe)</option>
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
