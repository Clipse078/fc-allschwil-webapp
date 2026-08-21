import { describe, expect, it } from "vitest";
import { getRegistrationApplicantMetadata } from "../applicant-metadata";
import type { RegistrationRawShape } from "../detail-view";

function baseRegistration(overrides: Partial<RegistrationRawShape> = {}): RegistrationRawShape {
  return {
    id: "reg_1",
    firstName: "Lara",
    lastName: "Muster",
    email: "lara.muster@example.ch",
    phone: null,
    birthDate: null,
    birthYear: null,
    message: null,
    payloadJson: null,
    source: "WEBSITE",
    submittedAt: "2026-08-05T13:56:00.000Z",
    ...overrides,
  };
}

describe("getRegistrationApplicantMetadata", () => {
  it("prefers birthYear and extracts PLZ/Ort from payloadJson.address", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        birthYear: 2018,
        payloadJson: {
          address: {
            postalCode: "4123",
            city: "Allschwil",
          },
        },
      }),
    );

    expect(metadata).toEqual({
      birthYear: 2018,
      postalCode: "4123",
      city: "Allschwil",
    });
  });

  it("derives birth year from birthDate when birthYear is absent", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        birthDate: "2015-03-22T00:00:00.000Z",
      }),
    );

    expect(metadata.birthYear).toBe(2015);
    expect(metadata.postalCode).toBeNull();
    expect(metadata.city).toBeNull();
  });

  it("derives birth year from date-only birthDate without timezone drift", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        birthDate: "2019-08-15",
      }),
    );

    expect(metadata.birthYear).toBe(2019);
  });

  it("falls back to payloadJson.person.birthDate when top-level fields are empty", () => {
    const metadata = getRegistrationApplicantMetadata(
      baseRegistration({
        payloadJson: {
          person: {
            birthDate: "2017-06-10",
          },
        },
      }),
    );

    expect(metadata.birthYear).toBe(2017);
  });

  it("omits unavailable values instead of fabricating placeholders", () => {
    const metadata = getRegistrationApplicantMetadata(baseRegistration());

    expect(metadata).toEqual({
      birthYear: null,
      postalCode: null,
      city: null,
    });
  });
});
