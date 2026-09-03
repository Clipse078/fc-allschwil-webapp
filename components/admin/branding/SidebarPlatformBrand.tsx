/**
 * SidebarPlatformBrand — SCE-DESIGN-02
 *
 * Integrated SportClubEvo platform identity at the sidebar footer.
 * Deliberately larger than the previous "Powered by" treatment; secondary
 * to the tenant brand header above.
 */

import Image from "next/image";
import { cn } from "@/lib/cn";

const PLATFORM_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

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
        width={collapsed ? 28 : 120}
        height={collapsed ? 28 : 28}
        className={cn(
          "object-contain opacity-90",
          collapsed ? "h-7 w-7" : "h-7 w-auto max-w-[140px]",
        )}
      />
    </div>
  );
}
