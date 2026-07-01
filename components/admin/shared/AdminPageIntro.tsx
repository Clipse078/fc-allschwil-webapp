/**
 * AdminPageIntro
 *
 * Internal WebApp headers must use the Premium SaaS typography standard.
 * Do not use tenant branding, football typography, or legacy fca-heading styles here.
 */
type AdminPageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function AdminPageIntro({
  eyebrow,
  title,
  description,
}: AdminPageIntroProps) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-[var(--muted)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] leading-tight">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-2)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
