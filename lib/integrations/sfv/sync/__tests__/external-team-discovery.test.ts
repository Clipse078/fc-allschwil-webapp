/**
 * lib/integrations/sfv/sync/__tests__/external-team-discovery.test.ts
 *
 * CLUB-DIRECTORY-02 — unit tests for the SFV-side adapter that wires
 * discoverExternalTeamFromProvider into schedule sync.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDiscoverExternalTeamFromProvider = vi.fn();
vi.mock("@/lib/club-directory/discovery-service", () => ({
  discoverExternalTeamFromProvider: (...args: unknown[]) =>
    mockDiscoverExternalTeamFromProvider(...args),
}));

const mockCreateClubDirectoryMutationDatabase = vi.fn().mockReturnValue({ fake: "database" });
vi.mock("@/lib/club-directory/prisma-mutation-adapter", () => ({
  createClubDirectoryMutationDatabase: (...args: unknown[]) =>
    mockCreateClubDirectoryMutationDatabase(...args),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { fake: "prisma-client" } }));

const { createExternalOpponentResolver } = await import("../external-team-discovery");

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClubDirectoryMutationDatabase.mockReturnValue({ fake: "database" });
});

describe("createExternalOpponentResolver", () => {
  it("resolves the discovered ExternalTeam id", async () => {
    mockDiscoverExternalTeamFromProvider.mockResolvedValueOnce({
      club: { id: "club-1" },
      team: { id: "ext-team-1" },
      discovered: true,
    });

    const resolve = createExternalOpponentResolver("tenant-1", new Date("2026-08-01T00:00:00.000Z"));
    const result = await resolve(51234, "SV Muttenz B1");

    expect(result).toBe("ext-team-1");
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledWith(
      { fake: "database" },
      {
        tenantId: "tenant-1",
        provider: "SFV",
        providerTeamId: 51234,
        providerTeamName: "SV Muttenz B1",
        // No real Prisma client is wired in this test (prisma is mocked to
        // `{ fake: "prisma-client" }`), so the CLUB-DIRECTORY-02B logo
        // pre-check throws internally and is swallowed — see
        // external-team-discovery-logo-enrichment.test.ts for dedicated,
        // properly-mocked coverage of the enrichment behaviour itself.
        providerLogoUrl: null,
      },
      new Date("2026-08-01T00:00:00.000Z"),
    );
  });

  it("memoizes per SFV teamId within one resolver instance (one sync run)", async () => {
    mockDiscoverExternalTeamFromProvider.mockResolvedValue({
      club: { id: "club-1" },
      team: { id: "ext-team-1" },
      discovered: true,
    });

    const resolve = createExternalOpponentResolver("tenant-1", new Date());
    await resolve(51234, "SV Muttenz B1");
    await resolve(51234, "SV Muttenz B1");
    await resolve(51234, "SV Muttenz B1");

    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledOnce();
  });

  it("resolves independently per distinct SFV teamId", async () => {
    mockDiscoverExternalTeamFromProvider
      .mockResolvedValueOnce({ club: { id: "club-1" }, team: { id: "ext-team-1" }, discovered: true })
      .mockResolvedValueOnce({ club: { id: "club-2" }, team: { id: "ext-team-2" }, discovered: true });

    const resolve = createExternalOpponentResolver("tenant-1", new Date());
    const first = await resolve(51234, "SV Muttenz B1");
    const second = await resolve(60000, "FC Concordia Basel B1");

    expect(first).toBe("ext-team-1");
    expect(second).toBe("ext-team-2");
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledTimes(2);
  });

  it("never throws — a discovery failure resolves to null (best-effort)", async () => {
    mockDiscoverExternalTeamFromProvider.mockRejectedValueOnce(new Error("DB unavailable"));

    const resolve = createExternalOpponentResolver("tenant-1", new Date());
    await expect(resolve(51234, "SV Muttenz B1")).resolves.toBeNull();
  });

  it("caches a failed lookup too, so a persistently-failing team isn't retried every call within the run", async () => {
    mockDiscoverExternalTeamFromProvider.mockRejectedValue(new Error("DB unavailable"));

    const resolve = createExternalOpponentResolver("tenant-1", new Date());
    await resolve(51234, "SV Muttenz B1");
    await resolve(51234, "SV Muttenz B1");

    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledOnce();
  });

  it("uses a fresh mutation database per resolver instance, scoped to one sync run", () => {
    createExternalOpponentResolver("tenant-1", new Date());
    createExternalOpponentResolver("tenant-2", new Date());

    expect(mockCreateClubDirectoryMutationDatabase).toHaveBeenCalledTimes(2);
  });
});
