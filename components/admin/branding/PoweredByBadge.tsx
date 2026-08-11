/**
 * PoweredByBadge — DASHBOARD-SHELL-UX-01
 *
 * Subtle "Powered by SportClubEvo" platform attribution for the sidebar
 * footer. Deliberately small and muted — the tenant (see
 * SidebarBrandHeader) is the dominant identity, SportClubEvo is secondary.
 */

import Image from "next/image";
import { cn } from "@/lib/cn";

const PLATFORM_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

type PoweredByBadgeProps = {
  collapsed?: boolean;
  className?: string;
};

export default function PoweredByBadge({
  collapsed = false,
  className,
}: PoweredByBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 px-2 py-1 text-[0.65rem] font-medium text-[var(--muted)]",
        className,
      )}
      title="Powered by SportClubEvo"
    >
      {!collapsed && <span>Powered by</span>}
      <Image
        src={PLATFORM_LOGO_SRC}
        alt="SportClubEvo"
        width={72}
        height={18}
        className="h-[13px] w-auto object-contain opacity-70"
      />
    </div>
  );
}
