import type { ReactNode } from "react";

type SectionCardVariant = "primary" | "secondary";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  variant?: SectionCardVariant;
};

export default function SectionCard({
  children,
  className = "",
  variant = "primary",
}: SectionCardProps) {
  const baseClass = variant === "secondary" ? "fca-section-card" : "fca-card";
  return (
    <div className={`${baseClass} ${className}`.trim()}>{children}</div>
  );
}
