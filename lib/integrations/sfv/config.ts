/**
 * lib/integrations/sfv/config.ts
 *
 * Server-only SFV / ClubCorner configuration reader.
 *
 * Reads and validates the four required environment variables:
 *   SFV_TOKEN_URL        — HTTPS token endpoint provided by SFV
 *   SFV_APPLICATION_KEY  — Application key / client identifier
 *   SFV_APPLICATION_PASS — Application password / client secret
 *   SFV_CLUB_ID          — Numeric club identifier assigned by SFV
 *
 * Never import this module from a client component or a NEXT_PUBLIC_* context.
 * The module only accesses process.env, which is never available in the browser
 * bundle, providing a natural server-only boundary.
 *
 * Validation is conservative: it only rejects values that are definitively wrong
 * (empty, non-HTTPS URL, non-numeric club ID). It never validates against the
 * live SFV endpoint and never logs actual values.
 */

import { SfvConfigurationError } from "./errors";
import { isExternalSideEffectConfigured } from "@/lib/server/external-side-effect-policy";

export type SfvConfig = {
  tokenUrl: string;
  applicationKey: string;
  applicationPass: string;
  clubId: string;
};

export type SfvConfigStatus = {
  hasTokenUrl: boolean;
  hasApplicationKey: boolean;
  hasApplicationPass: boolean;
  hasClubId: boolean;
  tokenUrlUsesHttps: boolean;
  clubIdFormatValid: boolean;
  providerEnabled: boolean;
  allPresent: boolean;
  allValid: boolean;
};

function readRequiredEnv(name: string): string | null {
  const value = process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateHttpsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateClubId(raw: string): boolean {
  return /^\d{1,10}$/.test(raw.trim());
}

/**
 * Returns a sanitized status object indicating which variables are present and
 * whether they pass basic format validation. Never exposes values.
 */
export function getSfvConfigStatus(): SfvConfigStatus {
  const rawTokenUrl = readRequiredEnv("SFV_TOKEN_URL");
  const rawApplicationKey = readRequiredEnv("SFV_APPLICATION_KEY");
  const rawApplicationPass = readRequiredEnv("SFV_APPLICATION_PASS");
  const rawClubId = readRequiredEnv("SFV_CLUB_ID");

  const hasTokenUrl = rawTokenUrl !== null;
  const hasApplicationKey = rawApplicationKey !== null;
  const hasApplicationPass = rawApplicationPass !== null;
  const hasClubId = rawClubId !== null;

  const tokenUrlUsesHttps = hasTokenUrl ? validateHttpsUrl(rawTokenUrl!) : false;
  const clubIdFormatValid = hasClubId ? validateClubId(rawClubId!) : false;

  const allPresent = hasTokenUrl && hasApplicationKey && hasApplicationPass && hasClubId;
  const providerEnabled = isExternalSideEffectConfigured("sfv", [
    "SFV_TOKEN_URL",
    "SFV_APPLICATION_KEY",
    "SFV_APPLICATION_PASS",
    "SFV_CLUB_ID",
  ]);
  const allValid =
    allPresent && tokenUrlUsesHttps && clubIdFormatValid && providerEnabled;

  return {
    hasTokenUrl,
    hasApplicationKey,
    hasApplicationPass,
    hasClubId,
    tokenUrlUsesHttps,
    clubIdFormatValid,
    providerEnabled,
    allPresent,
    allValid,
  };
}

/**
 * Reads the full SFV configuration.
 *
 * Throws SfvConfigurationError if any required variable is missing or invalid.
 * Never logs the actual values.
 */
export function getSfvConfig(): SfvConfig {
  const status = getSfvConfigStatus();

  if (!status.providerEnabled && status.allPresent) {
    throw new SfvConfigurationError(
      "CONFIGURATION_MISSING",
      "SFV integration is not enabled for this environment.",
    );
  }

  if (!status.hasTokenUrl) {
    throw new SfvConfigurationError("CONFIGURATION_MISSING", "SFV_TOKEN_URL is not configured.");
  }

  if (!status.hasApplicationKey) {
    throw new SfvConfigurationError(
      "CONFIGURATION_MISSING",
      "SFV_APPLICATION_KEY is not configured.",
    );
  }

  if (!status.hasApplicationPass) {
    throw new SfvConfigurationError(
      "CONFIGURATION_MISSING",
      "SFV_APPLICATION_PASS is not configured.",
    );
  }

  if (!status.hasClubId) {
    throw new SfvConfigurationError("CONFIGURATION_MISSING", "SFV_CLUB_ID is not configured.");
  }

  if (!status.tokenUrlUsesHttps) {
    throw new SfvConfigurationError(
      "CONFIGURATION_INVALID",
      "SFV_TOKEN_URL must use HTTPS. Non-HTTPS endpoints are not permitted for credential exchange.",
    );
  }

  if (!status.clubIdFormatValid) {
    throw new SfvConfigurationError(
      "CONFIGURATION_INVALID",
      "SFV_CLUB_ID must be a numeric identifier (1–10 digits).",
    );
  }

  return {
    tokenUrl: process.env["SFV_TOKEN_URL"]!.trim(),
    applicationKey: process.env["SFV_APPLICATION_KEY"]!.trim(),
    applicationPass: process.env["SFV_APPLICATION_PASS"]!.trim(),
    clubId: process.env["SFV_CLUB_ID"]!.trim(),
  };
}
