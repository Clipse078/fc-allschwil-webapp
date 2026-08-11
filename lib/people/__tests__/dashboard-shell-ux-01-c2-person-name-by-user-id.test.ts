/**
 * DASHBOARD-SHELL-UX-01-C2 — getPersonNameByUserId()
 *
 * Focused unit tests for the small helper added to resolve the canonically
 * linked Person's full name (Person.userId, ADMIN-MASTERDATA-UX-01) for a
 * given User id, used by the sidebar footer identity. Prisma is mocked; this
 * does not touch a live database.
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
import { getPersonNameByUserId } from "@/lib/people/queries";

const mockPrisma = prisma as unknown as {
  person: { findUnique: ReturnType<typeof vi.fn> };
};

describe("getPersonNameByUserId", () => {
  beforeEach(() => {
    mockPrisma.person.findUnique.mockReset();
  });

  it("returns the linked Person's trimmed first and last name", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce({
      firstName: "  Michael  ",
      lastName: "  Duijster  ",
    });

    const result = await getPersonNameByUserId("user-1");

    expect(result).toEqual({ firstName: "Michael", lastName: "Duijster" });
    expect(mockPrisma.person.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { firstName: true, lastName: true },
    });
  });

  it("returns null when the User has no linked Person", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce(null);

    const result = await getPersonNameByUserId("user-2");

    expect(result).toBeNull();
  });

  it("returns null when the linked Person's first name is blank/whitespace", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce({ firstName: "   ", lastName: "Duijster" });

    const result = await getPersonNameByUserId("user-3");

    expect(result).toBeNull();
  });

  it("returns an empty last name string when the Person has no last name", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce({ firstName: "Michael", lastName: null });

    const result = await getPersonNameByUserId("user-4");

    expect(result).toEqual({ firstName: "Michael", lastName: "" });
  });
});
