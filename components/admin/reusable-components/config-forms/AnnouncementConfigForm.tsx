"use client";

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function AnnouncementConfigForm({ config, onChange }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field label="Titel" required>
        <input
          type="text"
          value={(config.title as string) ?? ""}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Wichtige Information"
          className="fca-input"
        />
      </Field>

      <Field label="Text">
        <textarea
          value={(config.text as string) ?? ""}
          onChange={(e) => set("text", e.target.value)}
          rows={3}
          placeholder="Detaillierterer Text der Ankündigung"
          className="fca-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priorität">
          <select
            value={(config.priority as string) ?? "normal"}
            onChange={(e) => set("priority", e.target.value)}
            className="fca-input"
          >
            <option value="low">Niedrig</option>
            <option value="normal">Normal</option>
            <option value="high">Hoch</option>
            <option value="urgent">Dringend</option>
          </select>
        </Field>
        <Field label="Hintergrund-Stil">
          <select
            value={(config.backgroundStyle as string) ?? "default"}
            onChange={(e) => set("backgroundStyle", e.target.value)}
            className="fca-input"
          >
            <option value="default">Standard</option>
            <option value="info">Info (Blau)</option>
            <option value="warning">Warnung (Gelb)</option>
            <option value="error">Fehler (Rot)</option>
            <option value="success">Erfolg (Grün)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sichtbar ab">
          <input
            type="datetime-local"
            value={(config.publishFrom as string) ?? ""}
            onChange={(e) => set("publishFrom", e.target.value || null)}
            className="fca-input"
          />
        </Field>
        <Field label="Sichtbar bis">
          <input
            type="datetime-local"
            value={(config.publishUntil as string) ?? ""}
            onChange={(e) => set("publishUntil", e.target.value || null)}
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
