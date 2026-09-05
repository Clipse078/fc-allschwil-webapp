import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  playerFindUnique: vi.fn(),
  playerCreate: vi.fn(),
  trainerFindUnique: vi.fn(),
  trainerCreate: vi.fn(),
  logAction: vi.fn(),
  revalidatePath: vi.fn(),
  jahrgang: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: { findFirst: mocks.teamSeasonFindFirst },
    person: { findFirst: mocks.personFindFirst },
    playerSquadMember: {
      findUnique: mocks.playerFindUnique,
      create: mocks.playerCreate,
    },
    trainerTeamMember: {
      findUnique: mocks.trainerFindUnique,
      create: mocks.trainerCreate,
    },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/teams/jahrgang-rules", () => ({
  isBirthYearAllowedForTeamSeason: mocks.jahrgang,
}));

import { POST as addPlayer } from "../[teamId]/team-seasons/[teamSeasonId]/squad-members/route";
import { POST as addTrainer } from "../[teamId]/team-seasons/[teamSeasonId]/trainer-members/route";

const TENANT_A = "tenant-a";
const TEAM_A = "team-a";
const TEAM_SEASON_A = "team-season-a";
const PERSON_A = "person-a";

function access(activeTenantId: string | null = TENANT_A) {
  return {
    ok: true,
    session: { user: { id: "user-a", activeTenantId } },
  };
}

function request(personId = PERSON_A) {
  return new Request("http://localhost/api/teams/roster", {
    method: "POST",
    body: JSON.stringify({ personId }),
  });
}

function context(teamId = TEAM_A, teamSeasonId = TEAM_SEASON_A) {
  return { params: Promise.resolve({ teamId, teamSeasonId }) };
}

const TEAM_SEASON = {
  id: TEAM_SEASON_A,
  teamId: TEAM_A,
  team: {
    id: TEAM_A,
    name: "Tenant A Team",
    slug: "tenant-a-team",
    ageGroup: null,
  },
  season: {
    id: "season-1",
    key: "2026-27",
    name: "2026/27",
    startDate: new Date("2026-07-01T00:00:00Z"),
  },
};

const PLAYER = {
  id: PERSON_A,
  firstName: "Alice",
  lastName: "A",
  displayName: "Alice A",
  email: null,
  phone: null,
  dateOfBirth: null,
  isActive: true,
  isPlayer: true,
};

const TRAINER = {
  id: PERSON_A,
  firstName: "Alice",
  lastName: "A",
  displayName: "Alice A",
  isActive: true,
  isTrainer: true,
};

describe("SECURITY-GO-LIVE-01H-C — roster relationship isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue(access());
    mocks.teamSeasonFindFirst.mockResolvedValue(TEAM_SEASON);
    mocks.personFindFirst.mockResolvedValue(PLAYER);
    mocks.playerFindUnique.mockResolvedValue(null);
    mocks.trainerFindUnique.mockResolvedValue(null);
    mocks.jahrgang.mockReturnValue({
      ok: true,
      allowedBirthYears: [],
      birthYear: null,
    });
    mocks.playerCreate.mockResolvedValue({
      id: "player-member-a",
      status: "ACTIVE",
      shirtNumber: null,
      positionLabel: null,
      isCaptain: false,
      isViceCaptain: false,
      isWebsiteVisible: true,
      sortOrder: 0,
      remarks: null,
      person: PLAYER,
    });
    mocks.trainerCreate.mockResolvedValue({
      id: "trainer-member-a",
      status: "ACTIVE",
      roleLabel: null,
      isWebsiteVisible: true,
      sortOrder: 0,
      remarks: null,
      person: TRAINER,
    });
  });

  it("adds a Tenant A player to a Tenant A TeamSeason", async () => {
    const response = await addPlayer(request(), context());

    expect(response.status).toBe(201);
    expect(mocks.playerCreate).toHaveBeenCalledOnce();
    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TEAM_SEASON_A,
          teamId: TEAM_A,
          team: { tenantId: TENANT_A },
        },
      }),
    );
    expect(mocks.personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERSON_A, tenantId: TENANT_A } }),
    );
  });

  it("rejects Tenant A TeamSeason plus Tenant B Person", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    const response = await addPlayer(request("person-b"), context());

    expect(response.status).toBe(404);
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("rejects Tenant B TeamSeason plus Tenant A Person", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);

    const response = await addPlayer(request(), context(TEAM_A, "team-season-b"));

    expect(response.status).toBe(404);
    expect(mocks.personFindFirst).not.toHaveBeenCalled();
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("rejects Tenant B TeamSeason plus Tenant B Person for Tenant A", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);
    mocks.personFindFirst.mockResolvedValue(null);

    const response = await addPlayer(
      request("person-b"),
      context("team-b", "team-season-b"),
    );

    expect(response.status).toBe(404);
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("adds a Tenant A trainer to a Tenant A TeamSeason", async () => {
    mocks.personFindFirst.mockResolvedValue(TRAINER);

    const response = await addTrainer(request(), context());

    expect(response.status).toBe(201);
    expect(mocks.trainerCreate).toHaveBeenCalledOnce();
    expect(mocks.personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PERSON_A, tenantId: TENANT_A } }),
    );
  });

  it("rejects a Tenant B Person as trainer", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    const response = await addTrainer(request("person-b"), context());

    expect(response.status).toBe(404);
    expect(mocks.trainerCreate).not.toHaveBeenCalled();
  });

  it("rejects trainer assignment through a Tenant B TeamSeason", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);

    const response = await addTrainer(request(), context("team-b", "team-season-b"));

    expect(response.status).toBe(404);
    expect(mocks.personFindFirst).not.toHaveBeenCalled();
    expect(mocks.trainerCreate).not.toHaveBeenCalled();
  });

  it("fails roster mutations closed without an active tenant", async () => {
    mocks.requireApiPermission.mockResolvedValue(access(null));

    const [playerResponse, trainerResponse] = await Promise.all([
      addPlayer(request(), context()),
      addTrainer(request(), context()),
    ]);

    expect(playerResponse.status).toBe(403);
    expect(trainerResponse.status).toBe(403);
    expect(mocks.teamSeasonFindFirst).not.toHaveBeenCalled();
  });
});
