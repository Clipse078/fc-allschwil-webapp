import type { ReactNode } from "react";

type SettingsCardProps = {
  children: ReactNode;
  className?: string;
};

export default function SettingsCard({ children, className = "" }: SettingsCardProps) {
  return (
    <div
      className={`rounded-[22px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}
