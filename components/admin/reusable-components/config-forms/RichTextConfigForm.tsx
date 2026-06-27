"use client";

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function RichTextConfigForm({ config, onChange }: Props) {
  const content = (config.content as string) ?? "";

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
          Inhalt <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => onChange({ ...config, content: e.target.value })}
          rows={12}
          placeholder="Formatierten Text eingeben (Markdown oder HTML)…"
          className="fca-input resize-y font-mono text-xs"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Markdown und einfaches HTML werden vom Renderer unterstützt.
          Verwendungsbeispiele: Datenschutzerklärung, Mitgliedschaftsinfos, Vereinsmission.
        </p>
      </div>
    </div>
  );
}
