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
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-2)]">{description}</p>
    </div>
  );
}
