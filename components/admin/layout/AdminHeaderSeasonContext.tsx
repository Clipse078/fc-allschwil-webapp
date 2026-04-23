type AdminHeaderSeasonContextProps = {
  seasonLabel?: string;
  currentSeasonLabel?: string;
  className?: string;
};

export default function AdminHeaderSeasonContext({
  seasonLabel,
  currentSeasonLabel,
  className,
}: AdminHeaderSeasonContextProps) {
  const resolvedSeasonLabel = seasonLabel ?? currentSeasonLabel ?? "—";

  return (
    <div className={className}>
      <p className="fca-eyebrow">Saison</p>
      <p className="mt-2 font-[var(--font-display)] text-[2rem] font-bold tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.15rem]">
        {resolvedSeasonLabel}
      </p>
    </div>
  );
}