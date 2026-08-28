import {
  formatTime,
  type TenantFormatConfig,
} from "@/lib/tenant-runtime/formatters";

export function formatMatchDateLine(
  date: Date,
  cfg: TenantFormatConfig,
): string {
  try {
    const datePart = new Intl.DateTimeFormat(cfg.locale ?? "de-CH", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: cfg.timezone ?? "Europe/Zurich",
    }).format(date);
    return `${datePart} · ${formatTime(date, cfg)}`;
  } catch {
    return date.toISOString();
  }
}

export function formatResultDateLine(
  date: Date,
  cfg: TenantFormatConfig,
): string {
  try {
    return new Intl.DateTimeFormat(cfg.locale ?? "de-CH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: cfg.timezone ?? "Europe/Zurich",
    }).format(date);
  } catch {
    return date.toISOString().split("T")[0] ?? "";
  }
}
