/**
 * SidebarPlatformBrand — SCE-DESIGN-02
 *
 * Integrated SportClubEvo platform identity at the sidebar footer.
 * Deliberately larger than the previous "Powered by" treatment; secondary
 * to the tenant brand header above.
 */

import Image from "next/image";
import { cn } from "@/lib/cn";

const PLATFORM_LOGO_SRC = "/images/branding/sportclubevo_logo_alt.png";
const LOGO_ASPECT = 864 / 174;

type SidebarPlatformBrandProps = {
  collapsed?: boolean;
  className?: string;
};

export default function SidebarPlatformBrand({
  collapsed = false,
  className,
}: SidebarPlatformBrandProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-3 py-2",
        collapsed && "px-1",
        className,
      )}
      aria-label="SportClubEvo"
    >
      <Image
        src={PLATFORM_LOGO_SRC}
        alt="SportClubEvo"
        width={collapsed ? 32 : Math.round(32 * LOGO_ASPECT)}
        height={32}
        className={cn(
          "object-contain opacity-85 transition-opacity duration-[120ms] hover:opacity-100",
          collapsed ? "h-8 w-8" : "h-8 w-auto max-w-[148px]",
        )}
      />
    </div>
  );
}
