import { describe, expect, it } from "vitest";
import {
  formatCompactAddressLines,
  getRegistrationDetailFields,
  type RegistrationDetailFields,
  type RegistrationRawShape,
} from "@/lib/registrations/detail-view";

function baseRegistration(overrides: Partial<RegistrationRawShape> = {}): RegistrationRawShape {
  return {
    id: "reg_1",
    firstName: "Lara",
    lastName: "Muster",
    email: "lara.muster@example.ch",
    phone: "+41 79 123 45 67",
    birthDate: "2015-03-22T00:00:00.000Z",
    birthYear: 2015,
    message: null,
    payloadJson: null,
    source: "WEBSITE",
    submittedAt: "2026-08-05T13:56:00.000Z",
    ...overrides,
  };
}

describe("getRegistrationDetailFields", () => {
  it("returns null/empty fields for a legacy registration with no payloadJson (no regression)", () => {
    const registration = baseRegistration({ payloadJson: null, phone: null });
    const fields = getRegistrationDetailFields(registration);

    expect(fields.player.firstName).toBe("Lara");
    expect(fields.player.gender).toBeNull();
    expect(fields.player.nationality).toBeNull();
    expect(fields.address).toEqual({
      street: null,
      houseNumber: null,
      postalCode: null,
      city: null,
      country: null,
    });
    expect(fields.hasAnyAddressData).toBe(false);
    expect(fields.contact.email).toBe(registration.email);
    expect(fields.contact.phone).toBeNull();
    expect(fields.parent).toBeNull();
    expect(fields.football).toBeNull();
    expect(fields.consents).toEqual({
      privacyAccepted: null,
      marketingConsent: null,
      photoConsent: null,
    });
    expect(fields.additional.additionalRawData).toEqual([]);
    expect(fields.technical.internalId).toBe("reg_1");
    expect(fields.technical.source).toBe("WEBSITE");
  });

  it("extracts every typed contract field from a full website submission payload", () => {
    const registration = baseRegistration({
      // `message` mirrors the top-level DB column (see
      // lib/registrations/public-submission.ts) — it is NOT read from
      // payloadJson.message directly.
      message: "Wir freuen uns auf die Anmeldung.",
      payloadJson: {
        type: "PLAYER",
        locale: "de-CH",
        person: {
          firstName: "Lara",
          lastName: "Muster",
          gender: "female",
          birthDate: "2015-03-22",
          email: "lara.muster@example.ch",
          phone: "+41 79 123 45 67",
        },
        address: {
          street: "Baselstrasse",
          postalCode: "4123",
          city: "Allschwil",
          country: "CH",
        },
        parentOrGuardian: {
          firstName: "Sandra",
          lastName: "Muster",
          email: "sandra.muster@example.ch",
          phone: "+41 79 987 65 43",
        },
        football: {
          currentClub: "",
          previousClub: "",
          desiredTeam: "E-Junioren",
          preferredTrainingDay: "Dienstag",
          position: "Stürmerin",
        },
        consent: {
          privacyAccepted: true,
          communicationAccepted: true,
          photoConsent: false,
        },
        message: "Wir freuen uns auf die Anmeldung.",
        rawData: {
          houseNumber: "12a",
          nationality: "CH",
          playingExperience: "2 Jahre im Verein XY",
          requestedAgeGroup: "E-Junioren (Jg. 2015)",
          remarks: "Hat Fussballschuhe Gr. 34",
          howDidYouHear: "Empfehlung",
        },
      },
    });

    const fields = getRegistrationDetailFields(registration);

    // Player — gender is read from payload.person.gender (Goal 3/4 pipeline fix).
    expect(fields.player.gender).toBe("female");
    expect(fields.player.nationality).toBe("CH");

    // Address — postcode & city (Goal 1) plus houseNumber from rawData.
    expect(fields.address).toEqual({
      street: "Baselstrasse",
      houseNumber: "12a",
      postalCode: "4123",
      city: "Allschwil",
      country: "CH",
    });
    expect(fields.hasAnyAddressData).toBe(true);

    // Parent / guardian
    expect(fields.parent).toEqual({
      name: "Sandra Muster",
      email: "sandra.muster@example.ch",
      phone: "+41 79 987 65 43",
    });

    // Football — including rawData-derived fields not in the typed contract.
    expect(fields.football).toEqual({
      requestedTeam: "E-Junioren",
      requestedAgeGroup: "E-Junioren (Jg. 2015)",
      preferredTraining: "Dienstag",
      playingExperience: "2 Jahre im Verein XY",
      currentClub: null,
      previousClub: null,
      position: "Stürmerin",
    });

    // Additional info — remarks explicitly mapped, "howDidYouHear" surfaced
    // generically as an unmapped rawData note (nothing is discarded).
    expect(fields.additional.message).toBe("Wir freuen uns auf die Anmeldung.");
    expect(fields.additional.remarks).toBe("Hat Fussballschuhe Gr. 34");
    expect(fields.additional.additionalRawData).toEqual([
      { key: "howDidYouHear", label: "How Did You Hear", value: "Empfehlung" },
    ]);

    // Consents
    expect(fields.consents).toEqual({
      privacyAccepted: true,
      marketingConsent: true,
      photoConsent: false,
    });

    // Technical
    expect(fields.technical.locale).toBe("de-CH");
    expect(fields.technical.submittedAt).toBe(registration.submittedAt);
  });

  it("never invents data — omits parent/football blocks entirely when not submitted", () => {
    const registration = baseRegistration({
      payloadJson: {
        person: { firstName: "Jonas", lastName: "Keller", email: "jonas.keller@example.ch" },
        consent: { privacyAccepted: true },
      },
    });

    const fields = getRegistrationDetailFields(registration);

    expect(fields.parent).toBeNull();
    expect(fields.football).toBeNull();
    expect(fields.address).toEqual({
      street: null,
      houseNumber: null,
      postalCode: null,
      city: null,
      country: null,
    });
    expect(fields.hasAnyAddressData).toBe(false);
    expect(fields.consents.privacyAccepted).toBe(true);
    expect(fields.consents.marketingConsent).toBeNull();
  });

  it("falls back to top-level gender/geschlecht/sex keys for non-website payloads", () => {
    const registration = baseRegistration({
      payloadJson: { geschlecht: "männlich" },
    });

    const fields = getRegistrationDetailFields(registration);
    expect(fields.player.gender).toBe("männlich");
  });

  it("is resilient to malformed payloadJson (array or primitive)", () => {
    const asArray = baseRegistration({ payloadJson: [1, 2, 3] });
    const asString = baseRegistration({ payloadJson: "not-an-object" });

    expect(() => getRegistrationDetailFields(asArray)).not.toThrow();
    expect(() => getRegistrationDetailFields(asString)).not.toThrow();
    expect(getRegistrationDetailFields(asArray).address.city).toBeNull();
    expect(getRegistrationDetailFields(asString).football).toBeNull();
  });

  // ── REGISTRATION-01E — Goal 2: duplicate flag projection ──────────────────

  it("exposes no duplicate flag when the registration was never flagged", () => {
    const registration = baseRegistration({
      payloadJson: { person: { firstName: "Jonas" }, consent: { privacyAccepted: true } },
    });
    const fields = getRegistrationDetailFields(registration);
    expect(fields.duplicate).toEqual({ isPossibleDuplicate: false, referenceId: null });
  });

  it("projects possibleDuplicate/possibleDuplicateOf without altering duplicate detection", () => {
    const registration = baseRegistration({
      payloadJson: {
        person: { firstName: "Jonas" },
        consent: { privacyAccepted: true },
        possibleDuplicate: true,
        possibleDuplicateOf: "reg_earlier",
      },
    });
    const fields = getRegistrationDetailFields(registration);
    expect(fields.duplicate).toEqual({ isPossibleDuplicate: true, referenceId: "reg_earlier" });
  });

  it("never reports a duplicate reference when the flag itself is falsy, even if a stray ID is present", () => {
    const registration = baseRegistration({
      payloadJson: {
        possibleDuplicate: false,
        possibleDuplicateOf: "reg_earlier",
      },
    });
    const fields = getRegistrationDetailFields(registration);
    expect(fields.duplicate).toEqual({ isPossibleDuplicate: false, referenceId: null });
  });

  // ── REGISTRATION-01E — Goal 5: website version (rawData lookup) ───────────

  it("surfaces websiteVersion from rawData when present, and omits it from 'notes' (no double-reporting)", () => {
    const registration = baseRegistration({
      payloadJson: {
        person: { firstName: "Jonas" },
        consent: { privacyAccepted: true },
        rawData: { websiteVersion: "2.4.1" },
      },
    });
    const fields = getRegistrationDetailFields(registration);
    expect(fields.technical.websiteVersion).toBe("2.4.1");
    expect(fields.additional.additionalRawData).toEqual([]);
  });

  it("is null when no website version was ever submitted (most registrations, incl. legacy)", () => {
    const registration = baseRegistration({ payloadJson: null });
    const fields = getRegistrationDetailFields(registration);
    expect(fields.technical.websiteVersion).toBeNull();
  });
});

// ── REGISTRATION-01E — Goal 3: compact address formatting ────────────────────

describe("formatCompactAddressLines", () => {
  function address(
    overrides: Partial<RegistrationDetailFields["address"]> = {},
  ): RegistrationDetailFields["address"] {
    return { street: null, houseNumber: null, postalCode: null, city: null, country: null, ...overrides };
  }

  it("collapses a full address into three lines", () => {
    const lines = formatCompactAddressLines(
      address({ street: "Baselstrasse", houseNumber: "12A", postalCode: "4123", city: "Allschwil", country: "CH" }),
    );
    expect(lines).toEqual(["Baselstrasse 12A", "4123 Allschwil", "CH"]);
  });

  it("omits a line entirely when none of its fields were submitted (no empty lines)", () => {
    const lines = formatCompactAddressLines(address({ street: "Baselstrasse", country: "CH" }));
    expect(lines).toEqual(["Baselstrasse", "CH"]);
  });

  it("returns an empty array when nothing was submitted — caller renders the 'Nicht angegeben' fallback", () => {
    expect(formatCompactAddressLines(address())).toEqual([]);
  });

  it("still renders a line when only one half of a pair is present", () => {
    expect(formatCompactAddressLines(address({ postalCode: "4123" }))).toEqual(["4123"]);
    expect(formatCompactAddressLines(address({ houseNumber: "12A" }))).toEqual(["12A"]);
  });
});
