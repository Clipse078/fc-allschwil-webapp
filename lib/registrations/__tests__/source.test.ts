import { describe, expect, it } from "vitest";
import { getRegistrationSourceInfo } from "@/lib/registrations/source";

describe("getRegistrationSourceInfo", () => {
  it("returns null for missing/empty source (legacy & minimal registrations)", () => {
    expect(getRegistrationSourceInfo(null)).toBeNull();
    expect(getRegistrationSourceInfo(undefined)).toBeNull();
    expect(getRegistrationSourceInfo("")).toBeNull();
    expect(getRegistrationSourceInfo("   ")).toBeNull();
  });

  it("maps the only source in production use today: WEBSITE", () => {
    expect(getRegistrationSourceInfo("WEBSITE")).toEqual({ key: "WEBSITE", label: "Website" });
    // Case-insensitive, defensive against future variance.
    expect(getRegistrationSourceInfo("website")).toEqual({ key: "WEBSITE", label: "Website" });
  });

  it("maps future intake channels prepared by Goal 6 (presentation-only, unused today)", () => {
    expect(getRegistrationSourceInfo("MOBILE_APP")).toEqual({ key: "MOBILE_APP", label: "Mobile App" });
    expect(getRegistrationSourceInfo("MOBILE")).toEqual({ key: "MOBILE_APP", label: "Mobile App" });
    expect(getRegistrationSourceInfo("MANUAL")).toEqual({ key: "MANUAL", label: "Manuell" });
    expect(getRegistrationSourceInfo("CSV_IMPORT")).toEqual({ key: "CSV_IMPORT", label: "CSV-Import" });
    expect(getRegistrationSourceInfo("CSV")).toEqual({ key: "CSV_IMPORT", label: "CSV-Import" });
    expect(getRegistrationSourceInfo("API")).toEqual({ key: "API", label: "API" });
  });

  it("never discards an unrecognised source string — falls back to OTHER with the raw value as label", () => {
    expect(getRegistrationSourceInfo("SOME_FUTURE_CHANNEL")).toEqual({
      key: "OTHER",
      label: "SOME_FUTURE_CHANNEL",
    });
  });
});
