import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  eyebrow?: string;
};

export default function SettingsSection({
  title,
  description,
  children,
  eyebrow,
}: SettingsSectionProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="pt-1">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-[0.95rem] font-bold text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
