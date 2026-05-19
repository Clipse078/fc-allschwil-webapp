type PlatformBrandMarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-9 w-9 rounded-[16px] text-[0.78rem]",
  md: "h-12 w-12 text-[0.95rem]",
  lg: "h-20 w-20 rounded-[28px] text-[1.35rem]",
};

export default function PlatformBrandMark({
  className = "",
  size = "md",
}: PlatformBrandMarkProps) {
  return (
    <div className={`sce-brand-mark ${sizeClasses[size]} ${className}`.trim()}>
      <span className="font-[var(--font-display)] font-bold uppercase tracking-[-0.08em]">
        SE
      </span>
    </div>
  );
}
