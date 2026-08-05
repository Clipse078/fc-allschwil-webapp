import { describe, expect, it } from "vitest";
import { extractGenderFromPayload } from "@/lib/registrations/classification";

describe("extractGenderFromPayload", () => {
  it("reads gender nested under person.gender (website submissions)", () => {
    // REGISTRATION-01D pipeline audit finding: website payloads nest gender
    // under `person.gender` per lib/website/integration-contract.ts, but
    // classification previously only checked top-level keys — meaning
    // gender collected on the website never reached classification/display.
    expect(extractGenderFromPayload({ person: { gender: "female" } })).toBe("F");
    expect(extractGenderFromPayload({ person: { gender: "male" } })).toBe("M");
  });

  it("still supports legacy top-level gender/geschlecht/sex keys", () => {
    expect(extractGenderFromPayload({ gender: "male" })).toBe("M");
    expect(extractGenderFromPayload({ geschlecht: "weiblich" })).toBe("F");
    expect(extractGenderFromPayload({ sex: "other" })).toBe("OTHER");
  });

  it("prefers person.gender over a top-level key when both are present", () => {
    expect(extractGenderFromPayload({ gender: "male", person: { gender: "female" } })).toBe("F");
  });

  it("returns null for missing or malformed payloads", () => {
    expect(extractGenderFromPayload(null)).toBeNull();
    expect(extractGenderFromPayload(undefined)).toBeNull();
    expect(extractGenderFromPayload([1, 2, 3])).toBeNull();
    expect(extractGenderFromPayload({ person: {} })).toBeNull();
  });
});
