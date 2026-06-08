import Image from "next/image";
import TenantLogo from "./TenantLogo";
import { cn } from "@/lib/cn";

type SceWordmarkProps = {
  size?: number;
  tenantName?: string;
  logoUrl?: string | null;
  collapsed?: boolean;
};

const PLATFORM_LOGO_SRC = "/images/branding/sportclubevo_logo.png";

export default function SceWordmark({
  size = 34,
  tenantName,
  logoUrl,
  collapsed = false,
}: SceWordmarkProps) {
  const hasTenant = !!tenantName;

  return (
    <div className="flex min-w-0 flex-col gap-3 w-full">
      <div
        className={cn(
          "flex min-w-0 items-center",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        <Image
          src={PLATFORM_LOGO_SRC}
          alt="SportClubEvo"
          width={collapsed ? 36 : 180}
          height={collapsed ? 36 : 45}
          priority
          className={cn(
            "h-auto object-contain",
            collapsed ? "w-9" : "w-[180px]"
          )}
        />
      </div>

      {hasTenant && !collapsed && (
        <div
          className="flex min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5"
          style={{
            background:
              "color-mix(in srgb, var(--tenant-primary) 6%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--tenant-primary) 12%, transparent)",
          }}
        >
          <TenantLogo
            logoUrl={logoUrl}
            size={24}
            alt={`${tenantName} logo`}
          />

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[0.8rem] font-semibold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {tenantName}
            </p>
          </div>
        </div>
      )}

      {hasTenant && collapsed && (
        <TenantLogo
          logoUrl={logoUrl}
          size={size}
          alt={`${tenantName} logo`}
        />
      )}
    </div>
  );
}