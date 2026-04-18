import type { ReactNode } from "react";

type AdminSurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

export default function AdminSurfaceCard({
  children,
  className = "",
}: AdminSurfaceCardProps) {
  return <div className={`fca-card ${className}`.trim()}>{children}</div>;
}
