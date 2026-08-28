import type { TeamCockpitMatch } from "@/lib/teams/team-cockpit-sporting-data";
import {
  formatTime,
  type TenantFormatConfig,
} from "@/lib/tenant-runtime/formatters";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
};

export function formatFixtureDateLine(
  date: Date,
  cfg: TenantFormatConfig,
): string {
  try {
    return new Intl.DateTimeFormat(cfg.locale ?? "de-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: cfg.timezone ?? "Europe/Zurich",
    }).format(date);
  } catch {
    return date.toISOString().split("T")[0] ?? "";
  }
}

export function formatFixtureTime(
  date: Date,
  cfg: TenantFormatConfig,
): string {
  return formatTime(date, cfg);
}

export function resolveFixtureStatusLabel(match: TeamCockpitMatch): string | null {
  const normalizedStatus = match.status.trim().toUpperCase();

  if (normalizedStatus === "SCHEDULED" && match.lifecycle === "UPCOMING") {
    return null;
  }

  if (match.lifecycle === "LIVE" || normalizedStatus === "LIVE") {
    return STATUS_LABELS.LIVE ?? "Live";
  }

  if (match.lifecycle === "POSTPONED" || normalizedStatus === "POSTPONED") {
    return STATUS_LABELS.POSTPONED ?? "Verschoben";
  }

  return STATUS_LABELS[normalizedStatus] ?? null;
}

export function resolveHomeAwayLabel(side: TeamCockpitMatch["side"]): string {
  return side === "HOME" ? "Heimspiel" : "Auswärtsspiel";
}

export function resolveFixtureVenueLabel(match: TeamCockpitMatch): string | null {
  const venueName = match.venueName?.trim();
  if (venueName) {
    return venueName;
  }

  const location = match.location?.trim();
  return location && location.length > 0 ? location : null;
}
