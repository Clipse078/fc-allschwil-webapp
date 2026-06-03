/**
 * @deprecated Import directly from "@/lib/tenant-runtime/formatters" instead.
 *
 * This file is a backward-compatibility re-export shim.
 * All formatting logic lives in lib/tenant-runtime/formatters.ts.
 */
export type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
export {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatCurrency,
  formatTime,
  formatTodayDate,
  getCurrentSeasonLabel,
} from "@/lib/tenant-runtime/formatters";

// Backward-compat alias: formatShortDate → formatDateShort
export { formatDateShort as formatShortDate } from "@/lib/tenant-runtime/formatters";
