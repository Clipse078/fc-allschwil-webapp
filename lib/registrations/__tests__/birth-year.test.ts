import { describe, expect, it } from "vitest";
import {
  deriveBirthYearFromDate,
  payloadPersonBirthDate,
  payloadPersonBirthYear,
  resolveRegistrationBirthYear,
} from "../birth-year";

describe("birth-year resolution", () => {
  it("prefers registration.birthYear over payload fallbacks", () => {
    const year = resolveRegistrationBirthYear({
      birthYear: 2018,
      birthDate: null,
      payloadJson: { person: { birthYear: 2019, birthDate: "2019-01-01" } },
    });

    expect(year).toBe(2018);
  });

  it("derives year from payload person birthDate when top-level columns are empty", () => {
    const year = resolveRegistrationBirthYear({
      birthYear: null,
      birthDate: null,
      payloadJson: { person: { birthDate: "2019-08-15" } },
    });

    expect(year).toBe(2019);
  });

  it("reads payload person birthYear when birthDate is absent", () => {
    expect(payloadPersonBirthYear({ person: { birthYear: 2019 } })).toBe(2019);
    expect(
      resolveRegistrationBirthYear({
        birthYear: null,
        birthDate: null,
        payloadJson: { person: { birthYear: 2019 } },
      }),
    ).toBe(2019);
  });

  it("handles de-CH birthDate strings", () => {
    expect(deriveBirthYearFromDate("21.08.2019")).toBe(2019);
    expect(payloadPersonBirthDate({ person: { birthDate: "21.08.2019" } })).toBe("21.08.2019");
    expect(
      resolveRegistrationBirthYear({
        birthYear: null,
        birthDate: null,
        payloadJson: { person: { birthDate: "21.08.2019" } },
      }),
    ).toBe(2019);
  });
});
