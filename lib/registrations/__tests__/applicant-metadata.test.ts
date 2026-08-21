import { describe, expect, it } from "vitest";
import {
  deriveBirthYearFromDate,
  formatApplicantReceivedDate,
  getRegistrationApplicantMetadata,
  payloadPersonBirthYear,
  resolveRegistrationBirthYear,
} from "../applicant-metadata";
import type { RegistrationRawShape } from "../detail-view";

function baseRegistration(overrides: Partial<RegistrationRawShape> = {}): RegistrationRawShape {
  return {
    id: "reg_1",
    firstName: "Gustaw",
    lastName: "Adamusiak",
    email: "gustaw.adamusiak@example.ch",
    phone: null,
    birthDate: null,
    birthYear: null,
    message: null,
    payloadJson: null,
    source: "WEBSITE",
    submittedAt: "2026-08-21T10:15:00.000Z",
    ...overrides,
  };
}

describe("getRegistrationApplicantMetadata", () => {
  it("A: renders Jahrgang from birthYear", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        birthYear: 2019,
        payloadJson: {
          address: { postalCode: "4123", city: "Allschwil" },
        },
      }),
    );

    expect(metadata.birthYear).toBe(2019);
    expect(metadata.postalCode).toBe("4123");
    expect(metadata.city).toBe("Allschwil");
  });

  it("B: derives Jahrgang from birthDate when birthYear is absent", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        birthDate: "2015-03-22T00:00:00.000Z",
      }),
    );

    expect(metadata.birthYear).toBe(2015);
  });

  it("C: falls back to payloadJson.person birth fields when top-level fields are empty", () => {
    const fromBirthDate = getRegistrationApplicantMetadata(
      baseRegistration({
        payloadJson: {
          person: { birthDate: "2017-06-10" },
        },
      }),
    );
    expect(fromBirthDate.birthYear).toBe(2017);

    const fromBirthYear = getRegistrationApplicantMetadata(
      baseRegistration({
        payloadJson: {
          person: { birthYear: 2019 },
          address: { postalCode: "4123", city: "Allschwil" },
        },
      }),
    );
    expect(fromBirthYear.birthYear).toBe(2019);
  });

  it("D: omits Jahrgang when no structured birth information exists", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        payloadJson: {
          address: { postalCode: "4123", city: "Allschwil" },
        },
      }),
    );

    expect(metadata.birthYear).toBeNull();
    expect(metadata.postalCode).toBe("4123");
    expect(metadata.city).toBe("Allschwil");
  });

  it("E: formats entry date as Eingegangen label using de-CH conventions", () => {
    const metadata = getRegistrationApplicantMetadata(baseRegistration());

    expect(metadata.receivedAtLabel).toBe("21.08.2026");
    expect(formatApplicantReceivedDate("2026-08-21T10:15:00.000Z", { locale: "de-CH", timezone: "Europe/Zurich" })).toBe(
      "21.08.2026",
    );
  });

  it("F: omits missing PLZ/Ort instead of fabricating placeholders", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        birthYear: 2019,
      }),
    );

    expect(metadata).toEqual({
      birthYear: 2019,
      postalCode: null,
      city: null,
      receivedAtLabel: "21.08.2026",
    });
  });

  it("G: compact metadata excludes email from helper output", () => {
    const metadata = getRegistrationApplicantMetadata(baseRegistration({ birthYear: 2019 }));

    expect(metadata).not.toHaveProperty("email");
    expect(Object.keys(metadata)).toEqual(["birthYear", "postalCode", "city", "receivedAtLabel"]);
  });

  it("derives birth year from Swiss date-only birthDate without timezone drift", () => {
    expect(deriveBirthYearFromDate("2019-08-15")).toBe(2019);
    expect(deriveBirthYearFromDate("15.08.2019")).toBe(2019);
  });

  it("resolveRegistrationBirthYear uses linked person dateOfBirth as final fallback", () => {
    const year = resolveRegistrationBirthYear(
      { birthYear: null, birthDate: null, payloadJson: null },
      undefined,
      "2019-06-12T00:00:00.000Z",
    );

    expect(year).toBe(2019);
  });

  it("payloadPersonBirthYear accepts numeric and string values", () => {
    expect(payloadPersonBirthYear({ person: { birthYear: 2019 } })).toBe(2019);
    expect(payloadPersonBirthYear({ person: { birthYear: "2019" } })).toBe(2019);
  });
});
