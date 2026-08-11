/**
 * DASHBOARD-SHELL-UX-01-C1 — getPersonFirstNameByUserId()
 *
 * Focused unit tests for the small helper added to resolve the canonically
 * linked Person's first name (Person.userId, ADMIN-MASTERDATA-UX-01) for a
 * given User id, used by the dashboard greeting. Prisma is mocked; this does
 * not touch a live database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getPersonFirstNameByUserId } from "@/lib/people/queries";

const mockPrisma = prisma as unknown as {
  person: { findUnique: ReturnType<typeof vi.fn> };
};

describe("getPersonFirstNameByUserId", () => {
  beforeEach(() => {
    mockPrisma.person.findUnique.mockReset();
  });

  it("returns the linked Person's trimmed first name", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce({ firstName: "  Michael  " });

    const result = await getPersonFirstNameByUserId("user-1");

    expect(result).toBe("Michael");
    expect(mockPrisma.person.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { firstName: true },
    });
  });

  it("returns null when the User has no linked Person", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce(null);

    const result = await getPersonFirstNameByUserId("user-2");

    expect(result).toBeNull();
  });

  it("returns null when the linked Person's first name is blank/whitespace", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce({ firstName: "   " });

    const result = await getPersonFirstNameByUserId("user-3");

    expect(result).toBeNull();
  });
});
