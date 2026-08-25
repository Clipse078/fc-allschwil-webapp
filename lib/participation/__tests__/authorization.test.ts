/**
 * TEAM-COCKPIT-03A — participation authorization tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: { findFirst: vi.fn() },
    guardianRelationship: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  assertActorCanRespondForPerson,
  getAuthorizedPersonIdsForUser,
} from "../authorization";
import { ParticipationUnauthorizedError } from "../errors";

const TENANT_A = "tenant-a";
const ACTOR_USER = "user-01";
const PLAYER_PERSON = "person-player";
const PARENT_PERSON = "person-parent";
const OTHER_PERSON = "person-other";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TEAM-COCKPIT-03A — participation authorization", () => {
  it("allows player to respond for self", async () => {
    vi.mocked(prisma.person.findFirst).mockResolvedValue({ id: PLAYER_PERSON } as never);

    const result = await assertActorCanRespondForPerson(TENANT_A, ACTOR_USER, PLAYER_PERSON);
    expect(result.source).toBe("PLAYER");
  });

  it("allows parent to respond for child via guardian relationship", async () => {
    vi.mocked(prisma.person.findFirst).mockResolvedValue({ id: PARENT_PERSON } as never);
    vi.mocked(prisma.guardianRelationship.findFirst).mockResolvedValue({ id: "gr-01" } as never);

    const result = await assertActorCanRespondForPerson(TENANT_A, ACTOR_USER, PLAYER_PERSON);
    expect(result.source).toBe("PARENT");
  });

  it("rejects unauthorized actor attempting to respond for another player", async () => {
    vi.mocked(prisma.person.findFirst).mockResolvedValue({ id: OTHER_PERSON } as never);
    vi.mocked(prisma.guardianRelationship.findFirst).mockResolvedValue(null);

    await expect(
      assertActorCanRespondForPerson(TENANT_A, ACTOR_USER, PLAYER_PERSON),
    ).rejects.toBeInstanceOf(ParticipationUnauthorizedError);
  });

  it("returns authorized person ids for self and guardian children", async () => {
    vi.mocked(prisma.person.findFirst).mockResolvedValue({ id: PARENT_PERSON } as never);
    vi.mocked(prisma.guardianRelationship.findMany).mockResolvedValue([
      { childPersonId: PLAYER_PERSON },
    ] as never);

    const ids = await getAuthorizedPersonIdsForUser(TENANT_A, ACTOR_USER);
    expect(ids).toEqual(expect.arrayContaining([PARENT_PERSON, PLAYER_PERSON]));
  });
});
