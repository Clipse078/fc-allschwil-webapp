/**
 * lib/registrations/__tests__/person-match.test.ts
 *
 * REGISTRATION-01F — Goal 2: automatic person lookup by email / phone /
 * first+last name, with a conservative confidence classification and
 * safe fallbacks (never invents a match; never crashes on malformed data).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: { findMany: mocks.personFindMany },
  },
}));

import {
  findPersonMatches,
  attachPersonMatchSummaries,
  normalizePhone,
} from "@/lib/registrations/person-match";

beforeEach(() => {
  vi.clearAllMocks();
});

function person(overrides: Record<string, unknown> = {}) {
  return {
    id: "person-1",
    firstName: "Lara",
    lastName: "Muster",
    displayName: null,
    email: "lara.muster@example.ch",
    phone: "+41 79 123 45 67",
    dateOfBirth: null,
    ...overrides,
  };
}

describe("normalizePhone", () => {
  it("normalizes Swiss local/international formats to the same tail", () => {
    expect(normalizePhone("+41 79 123 45 67")).toBe("791234567");
    expect(normalizePhone("079 123 45 67")).toBe("791234567");
    expect(normalizePhone("0041 79 123 45 67")).toBe("791234567");
  });

  it("returns null for empty/missing input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
  });
});

describe("findPersonMatches", () => {
  it("returns NONE with no candidates when nothing matches", async () => {
    mocks.personFindMany.mockResolvedValueOnce([]);
    const result = await findPersonMatches({
      email: "unknown@example.ch",
      phone: null,
      firstName: "Nobody",
      lastName: "Here",
    });
    expect(result).toEqual({ status: "NONE", candidates: [] });
  });

  it("returns CONFIRMED on an exact (case-insensitive) email match", async () => {
    mocks.personFindMany.mockResolvedValueOnce([person({ email: "LARA.MUSTER@example.ch" })]);
    const result = await findPersonMatches({
      email: "lara.muster@example.ch",
      phone: null,
      firstName: "Someone",
      lastName: "Else",
    });
    expect(result.status).toBe("CONFIRMED");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons).toContain("EMAIL");
  });

  it("returns POSSIBLE on a name-only match (no email/phone overlap)", async () => {
    mocks.personFindMany.mockResolvedValueOnce([person({ email: "different@example.ch", phone: null })]);
    const result = await findPersonMatches({
      email: "new-email@example.ch",
      phone: null,
      firstName: "Lara",
      lastName: "Muster",
    });
    expect(result.status).toBe("POSSIBLE");
    expect(result.candidates[0].reasons).toEqual(["NAME"]);
  });

  it("returns POSSIBLE on a phone-only match despite differing formatting", async () => {
    mocks.personFindMany.mockResolvedValueOnce([
      person({ email: "different@example.ch", firstName: "Someone", lastName: "Else", phone: "079 123 45 67" }),
    ]);
    const result = await findPersonMatches({
      email: "new@example.ch",
      phone: "+41791234567",
      firstName: "Not",
      lastName: "Matching",
    });
    expect(result.status).toBe("POSSIBLE");
    expect(result.candidates[0].reasons).toEqual(["PHONE"]);
  });

  it("ranks EMAIL matches ahead of PHONE/NAME-only matches", async () => {
    mocks.personFindMany.mockResolvedValueOnce([
      person({ id: "name-match", email: "other@example.ch", phone: null }),
      person({ id: "email-match", firstName: "Zzz", lastName: "Zzz" }),
    ]);
    const result = await findPersonMatches({
      email: "lara.muster@example.ch",
      phone: null,
      firstName: "Lara",
      lastName: "Muster",
    });
    expect(result.status).toBe("CONFIRMED");
    expect(result.candidates[0].id).toBe("email-match");
  });

  it("never throws on empty phone input", async () => {
    mocks.personFindMany.mockResolvedValueOnce([]);
    await expect(
      findPersonMatches({ email: "a@b.ch", phone: null, firstName: "A", lastName: "B" }),
    ).resolves.toBeDefined();
  });
});

describe("attachPersonMatchSummaries", () => {
  it("short-circuits to LINKED without querying when personId is already set", async () => {
    const regs = [
      { personId: "person-1", email: "x@y.ch", phone: null, firstName: "X", lastName: "Y" },
    ];
    const result = await attachPersonMatchSummaries(regs);
    expect(result[0].personMatch).toEqual({ status: "LINKED", candidates: [] });
    expect(mocks.personFindMany).not.toHaveBeenCalled();
  });

  it("batches a single Person query across multiple unlinked registrations", async () => {
    mocks.personFindMany.mockResolvedValueOnce([person()]);
    const regs = [
      { personId: null, email: "lara.muster@example.ch", phone: null, firstName: "Lara", lastName: "Muster" },
      { personId: null, email: "someone-else@example.ch", phone: null, firstName: "Someone", lastName: "Else" },
    ];
    const result = await attachPersonMatchSummaries(regs);
    expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
    expect(result[0].personMatch.status).toBe("CONFIRMED");
    expect(result[1].personMatch.status).toBe("NONE");
  });

  it("returns NONE for every registration and skips the query when the list is empty", async () => {
    const result = await attachPersonMatchSummaries([]);
    expect(result).toEqual([]);
    expect(mocks.personFindMany).not.toHaveBeenCalled();
  });
});
