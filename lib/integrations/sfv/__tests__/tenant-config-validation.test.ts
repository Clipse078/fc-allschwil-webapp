/**
 * lib/integrations/sfv/__tests__/tenant-config-validation.test.ts
 *
 * Focused unit tests for tenant SFV configuration validation.
 *
 * All tests are pure: no I/O, no DB access, no mocking required.
 * Tests cover all validation rules for TenantSfvConfigInput fields.
 *
 * TEST COVERAGE MAP:
 *
 * isValidClubId:
 *   1.  accepts minimum positive integer (1)
 *   2.  accepts typical SFV club ID (483)
 *   3.  accepts PostgreSQL INTEGER max (2_147_483_647)
 *   4.  rejects zero
 *   5.  rejects negative integer
 *   6.  rejects fractional number
 *   7.  rejects NaN
 *   8.  rejects Infinity
 *   9.  rejects string "483"
 *   10. rejects null
 *   11. rejects undefined
 *   12. rejects value above PG INTEGER max
 *
 * isValidDefaultSeasonId:
 *   13. accepts minimum positive integer (1)
 *   14. accepts typical SFV season ID (2027)
 *   15. accepts PostgreSQL INTEGER max (2_147_483_647)
 *   16. rejects zero
 *   17. rejects negative integer
 *   18. rejects fractional number
 *   19. rejects string "2027"
 *
 * isValidOrganisationId:
 *   20. accepts null (optional field absent)
 *   21. accepts undefined (optional field absent)
 *   22. accepts positive integer
 *   23. accepts PostgreSQL INTEGER max
 *   24. rejects zero
 *   25. rejects negative integer
 *   26. rejects fractional number
 *   27. rejects string
 *
 * validateTenantSfvConfigInput — valid inputs:
 *   28. accepts a fully valid input with organisationId present
 *   29. accepts a valid input with organisationId = null
 *   30. accepts a valid input with organisationId = undefined
 *   31. accepts enabled = false
 *   32. returns the same reference on valid input
 *
 * validateTenantSfvConfigInput — invalid inputs:
 *   33. throws SfvTenantConfigValidationError for invalid clubId
 *   34. error field is "clubId" for invalid clubId
 *   35. throws SfvTenantConfigValidationError for invalid defaultSeasonId
 *   36. error field is "defaultSeasonId" for invalid defaultSeasonId
 *   37. throws SfvTenantConfigValidationError for invalid organisationId (0)
 *   38. error field is "organisationId" for invalid organisationId
 *   39. throws SfvTenantConfigValidationError for non-boolean enabled
 *   40. error field is "enabled" for non-boolean enabled
 *   41. clubId is validated before defaultSeasonId (field order)
 *   42. defaultSeasonId is validated before organisationId (field order)
 *   43. organisationId is validated before enabled (field order)
 *   44. error name is SfvTenantConfigValidationError
 *   45. error message contains field name
 */

import { describe, it, expect } from "vitest";
import {
  isValidClubId,
  isValidDefaultSeasonId,
  isValidOrganisationId,
  validateTenantSfvConfigInput,
} from "../tenant-config-validation";
import {
  SfvTenantConfigValidationError,
  type TenantSfvConfigInput,
} from "../tenant-config-types";

const PG_INT_MAX = 2_147_483_647;
const ABOVE_PG_INT_MAX = PG_INT_MAX + 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

function validInput(overrides: Partial<TenantSfvConfigInput> = {}): TenantSfvConfigInput {
  return {
    clubId: 483,
    defaultSeasonId: 2027,
    organisationId: null,
    enabled: true,
    ...overrides,
  };
}

// ── isValidClubId ─────────────────────────────────────────────────────────────

describe("isValidClubId", () => {
  it("1 — accepts minimum positive integer (1)", () => {
    expect(isValidClubId(1)).toBe(true);
  });

  it("2 — accepts typical SFV club ID (483)", () => {
    expect(isValidClubId(483)).toBe(true);
  });

  it("3 — accepts PostgreSQL INTEGER max (2_147_483_647)", () => {
    expect(isValidClubId(PG_INT_MAX)).toBe(true);
  });

  it("4 — rejects zero", () => {
    expect(isValidClubId(0)).toBe(false);
  });

  it("5 — rejects negative integer", () => {
    expect(isValidClubId(-1)).toBe(false);
  });

  it("6 — rejects fractional number", () => {
    expect(isValidClubId(1.5)).toBe(false);
  });

  it("7 — rejects NaN", () => {
    expect(isValidClubId(NaN)).toBe(false);
  });

  it("8 — rejects Infinity", () => {
    expect(isValidClubId(Infinity)).toBe(false);
  });

  it("9 — rejects string '483'", () => {
    expect(isValidClubId("483")).toBe(false);
  });

  it("10 — rejects null", () => {
    expect(isValidClubId(null)).toBe(false);
  });

  it("11 — rejects undefined", () => {
    expect(isValidClubId(undefined)).toBe(false);
  });

  it("12 — rejects value above PG INTEGER max", () => {
    expect(isValidClubId(ABOVE_PG_INT_MAX)).toBe(false);
  });
});

// ── isValidDefaultSeasonId ────────────────────────────────────────────────────

describe("isValidDefaultSeasonId", () => {
  it("13 — accepts minimum positive integer (1)", () => {
    expect(isValidDefaultSeasonId(1)).toBe(true);
  });

  it("14 — accepts typical SFV season ID (2027)", () => {
    expect(isValidDefaultSeasonId(2027)).toBe(true);
  });

  it("15 — accepts PostgreSQL INTEGER max (2_147_483_647)", () => {
    expect(isValidDefaultSeasonId(PG_INT_MAX)).toBe(true);
  });

  it("16 — rejects zero", () => {
    expect(isValidDefaultSeasonId(0)).toBe(false);
  });

  it("17 — rejects negative integer", () => {
    expect(isValidDefaultSeasonId(-1)).toBe(false);
  });

  it("18 — rejects fractional number", () => {
    expect(isValidDefaultSeasonId(2027.5)).toBe(false);
  });

  it("19 — rejects string '2027'", () => {
    expect(isValidDefaultSeasonId("2027")).toBe(false);
  });
});

// ── isValidOrganisationId ─────────────────────────────────────────────────────

describe("isValidOrganisationId", () => {
  it("20 — accepts null (optional field absent)", () => {
    expect(isValidOrganisationId(null)).toBe(true);
  });

  it("21 — accepts undefined (optional field absent)", () => {
    expect(isValidOrganisationId(undefined)).toBe(true);
  });

  it("22 — accepts positive integer", () => {
    expect(isValidOrganisationId(100)).toBe(true);
  });

  it("23 — accepts PostgreSQL INTEGER max", () => {
    expect(isValidOrganisationId(PG_INT_MAX)).toBe(true);
  });

  it("24 — rejects zero", () => {
    expect(isValidOrganisationId(0)).toBe(false);
  });

  it("25 — rejects negative integer", () => {
    expect(isValidOrganisationId(-5)).toBe(false);
  });

  it("26 — rejects fractional number", () => {
    expect(isValidOrganisationId(1.1)).toBe(false);
  });

  it("27 — rejects string", () => {
    expect(isValidOrganisationId("100")).toBe(false);
  });
});

// ── validateTenantSfvConfigInput — valid inputs ───────────────────────────────

describe("validateTenantSfvConfigInput — valid inputs", () => {
  it("28 — accepts a fully valid input with organisationId present", () => {
    const input = validInput({ organisationId: 99 });
    expect(() => validateTenantSfvConfigInput(input)).not.toThrow();
  });

  it("29 — accepts a valid input with organisationId = null", () => {
    const input = validInput({ organisationId: null });
    expect(() => validateTenantSfvConfigInput(input)).not.toThrow();
  });

  it("30 — accepts a valid input with organisationId = undefined", () => {
    const input: TenantSfvConfigInput = {
      clubId: 483,
      defaultSeasonId: 2027,
      enabled: true,
    };
    expect(() => validateTenantSfvConfigInput(input)).not.toThrow();
  });

  it("31 — accepts enabled = false", () => {
    const input = validInput({ enabled: false });
    expect(() => validateTenantSfvConfigInput(input)).not.toThrow();
  });

  it("32 — returns the same reference on valid input", () => {
    const input = validInput();
    const result = validateTenantSfvConfigInput(input);
    expect(result).toBe(input);
  });
});

// ── validateTenantSfvConfigInput — invalid inputs ─────────────────────────────

describe("validateTenantSfvConfigInput — invalid inputs", () => {
  it("33 — throws SfvTenantConfigValidationError for invalid clubId", () => {
    const input = validInput({ clubId: 0 });
    expect(() => validateTenantSfvConfigInput(input)).toThrow(SfvTenantConfigValidationError);
  });

  it("34 — error field is 'clubId' for invalid clubId", () => {
    const input = validInput({ clubId: -1 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect(e).toBeInstanceOf(SfvTenantConfigValidationError);
      expect((e as SfvTenantConfigValidationError).field).toBe("clubId");
    }
  });

  it("35 — throws SfvTenantConfigValidationError for invalid defaultSeasonId", () => {
    const input = validInput({ defaultSeasonId: 0 });
    expect(() => validateTenantSfvConfigInput(input)).toThrow(SfvTenantConfigValidationError);
  });

  it("36 — error field is 'defaultSeasonId' for invalid defaultSeasonId", () => {
    const input = validInput({ defaultSeasonId: -100 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect(e).toBeInstanceOf(SfvTenantConfigValidationError);
      expect((e as SfvTenantConfigValidationError).field).toBe("defaultSeasonId");
    }
  });

  it("37 — throws SfvTenantConfigValidationError for invalid organisationId (0)", () => {
    const input = validInput({ organisationId: 0 });
    expect(() => validateTenantSfvConfigInput(input)).toThrow(SfvTenantConfigValidationError);
  });

  it("38 — error field is 'organisationId' for invalid organisationId", () => {
    const input = validInput({ organisationId: -1 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect(e).toBeInstanceOf(SfvTenantConfigValidationError);
      expect((e as SfvTenantConfigValidationError).field).toBe("organisationId");
    }
  });

  it("39 — throws SfvTenantConfigValidationError for non-boolean enabled", () => {
    const input = { ...validInput(), enabled: "true" as unknown as boolean };
    expect(() => validateTenantSfvConfigInput(input)).toThrow(SfvTenantConfigValidationError);
  });

  it("40 — error field is 'enabled' for non-boolean enabled", () => {
    const input = { ...validInput(), enabled: 1 as unknown as boolean };
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect(e).toBeInstanceOf(SfvTenantConfigValidationError);
      expect((e as SfvTenantConfigValidationError).field).toBe("enabled");
    }
  });

  it("41 — clubId is validated before defaultSeasonId (field order)", () => {
    const input = validInput({ clubId: 0, defaultSeasonId: 0 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect((e as SfvTenantConfigValidationError).field).toBe("clubId");
    }
  });

  it("42 — defaultSeasonId is validated before organisationId (field order)", () => {
    const input = validInput({ defaultSeasonId: 0, organisationId: 0 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect((e as SfvTenantConfigValidationError).field).toBe("defaultSeasonId");
    }
  });

  it("43 — organisationId is validated before enabled (field order)", () => {
    const input = { ...validInput({ organisationId: 0 }), enabled: "yes" as unknown as boolean };
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect((e as SfvTenantConfigValidationError).field).toBe("organisationId");
    }
  });

  it("44 — error name is SfvTenantConfigValidationError", () => {
    const input = validInput({ clubId: 0 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect((e as Error).name).toBe("SfvTenantConfigValidationError");
    }
  });

  it("45 — error message contains field name", () => {
    const input = validInput({ clubId: 0 });
    try {
      validateTenantSfvConfigInput(input);
    } catch (e) {
      expect((e as Error).message).toContain("clubId");
    }
  });
});
