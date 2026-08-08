/**
 * lib/integrations/sfv/sync/__tests__/external-team-discovery-logo-enrichment.test.ts
 *
 * CLUB-DIRECTORY-02B — dedicated coverage for the SFV logo pre-check/fetch
 * wiring added to createExternalOpponentResolver (external-team-discovery.ts).
 *
 * external-team-discovery.test.ts already covers the pre-existing
 * discover/memoize/never-throw behaviour with a fully-mocked prisma client
 * (so the logo pre-check silently no-ops there). This file properly mocks
 * `findExternalTeamByProviderIdentity` and `resolveProviderLogoDataUri` to
 * prove the enrichment decision logic itself:
 *
 *   - a brand-new opponent (no existing mapping) triggers a logo fetch and
 *     forwards the result as providerLogoUrl;
 *   - an opponent whose ExternalClub already has a logo skips the SFV fetch
 *     entirely (idempotent, avoids unnecessary provider/network calls);
 *   - an opponent whose ExternalClub still has no logo (mapping exists, but
 *     never enriched) retries the fetch;
 *   - a failed picture fetch (resolveProviderLogoDataUri -> null) still lets
 *     discovery/link proceed with providerLogoUrl: null — never blocks;
 *   - a pre-check (DB read) failure never blocks discovery either;
 *   - the pre-check is tenant-scoped (tenant isolation);
 *   - within one resolver/run, the outer per-teamId memoization means the
 *     pre-check + fetch only ever run once per opponent, regardless of how
 *     many schedule entries reference it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDiscoverExternalTeamFromProvider = vi.fn();
vi.mock("@/lib/club-directory/discovery-service", () => ({
  discoverExternalTeamFromProvider: (...args: unknown[]) =>
    mockDiscoverExternalTeamFromProvider(...args),
}));

vi.mock("@/lib/club-directory/prisma-mutation-adapter", () => ({
  createClubDirectoryMutationDatabase: () => ({ fake: "mutation-database" }),
}));

vi.mock("@/lib/club-directory/prisma-adapter", () => ({
  createClubDirectoryQueryDatabase: () => ({ fake: "query-database" }),
}));

const mockFindExternalTeamByProviderIdentity = vi.fn();
const mockFindExternalClubByProviderClubId = vi.fn();
vi.mock("@/lib/club-directory/query-service", () => ({
  findExternalTeamByProviderIdentity: (...args: unknown[]) =>
    mockFindExternalTeamByProviderIdentity(...args),
  findExternalClubByProviderClubId: (...args: unknown[]) =>
    mockFindExternalClubByProviderClubId(...args),
}));

const mockResolveProviderLogoDataUri = vi.fn();
vi.mock("../team-logo", () => ({
  resolveProviderLogoDataUri: (...args: unknown[]) => mockResolveProviderLogoDataUri(...args),
  // Mirrors the real resolveClubLogoFromCandidateTeamIds (team-logo.ts) —
  // tries each candidate via the mocked resolveProviderLogoDataUri, in
  // order, stopping at the first non-null result — so this wiring test
  // exercises the exact same call pattern external-team-discovery.ts
  // depends on, without re-testing team-logo.ts's own logic (see
  // lib/integrations/sfv/sync/__tests__/team-logo.test.ts for that).
  resolveClubLogoFromCandidateTeamIds: async (candidateTeamIds: number[]) => {
    const attemptedTeamIds: number[] = [];
    for (const teamId of candidateTeamIds) {
      attemptedTeamIds.push(teamId);
      const logoUrl = await mockResolveProviderLogoDataUri(teamId);
      if (logoUrl !== null && logoUrl !== undefined) {
        return { logoUrl, attemptedTeamIds };
      }
    }
    return { logoUrl: null, attemptedTeamIds };
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { fake: "prisma-client" } }));

const { createExternalOpponentResolver } = await import("../external-team-discovery");

const SYNCED_AT = new Date("2026-08-07T00:00:00.000Z");

function discoveryResult(overrides: { clubId?: string; logoUrl?: string | null } = {}) {
  return {
    club: { id: overrides.clubId ?? "club-1", logoUrl: overrides.logoUrl ?? null },
    team: { id: "ext-team-1" },
    discovered: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDiscoverExternalTeamFromProvider.mockResolvedValue(discoveryResult());
  mockFindExternalClubByProviderClubId.mockResolvedValue(null);
});

describe("createExternalOpponentResolver — CLUB-DIRECTORY-02B logo enrichment", () => {
  it("fetches a fresh logo for a brand-new opponent (no existing mapping) and forwards it", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValueOnce(null);
    mockResolveProviderLogoDataUri.mockResolvedValueOnce("data:image/gif;base64,R0lGOD==");

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");

    expect(mockFindExternalTeamByProviderIdentity).toHaveBeenCalledWith(
      { fake: "query-database" },
      { tenantId: "tenant-1", provider: "SFV", providerTeamId: 51234 },
    );
    expect(mockFindExternalClubByProviderClubId).not.toHaveBeenCalled();
    expect(mockResolveProviderLogoDataUri).toHaveBeenCalledWith(51234);
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      {
        tenantId: "tenant-1",
        provider: "SFV",
        providerTeamId: 51234,
        providerTeamName: "SV Muttenz B1",
        providerClubId: null,
        providerLogoUrl: "data:image/gif;base64,R0lGOD==",
        providerLeagueName: null,
        providerGroupName: null,
      },
      SYNCED_AT,
    );
  });

  it("fetches a fresh logo when a mapping exists but the club has no logo yet (idempotent enrichment target)", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValueOnce({
      id: "ext-team-1",
      externalClub: { id: "club-1", logoUrl: null },
    });
    mockResolveProviderLogoDataUri.mockResolvedValueOnce("data:image/gif;base64,AAA=");

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");

    expect(mockResolveProviderLogoDataUri).toHaveBeenCalledWith(51234);
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      expect.objectContaining({ providerLogoUrl: "data:image/gif;base64,AAA=" }),
      SYNCED_AT,
    );
  });

  it("skips the SFV fetch entirely once the club already has a logo (avoids unnecessary provider calls)", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValueOnce({
      id: "ext-team-1",
      externalClub: { id: "club-1", logoUrl: "https://cdn.example.com/existing.png" },
    });

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");

    expect(mockResolveProviderLogoDataUri).not.toHaveBeenCalled();
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      expect.objectContaining({ providerLogoUrl: null }),
      SYNCED_AT,
    );
  });

  it("this is true whether the existing logo is tenant-uploaded or previously provider-filled — either way it counts as 'already enriched'", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValueOnce({
      id: "ext-team-1",
      externalClub: { id: "club-1", logoUrl: "data:image/gif;base64,alreadyThere==" },
    });

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");

    expect(mockResolveProviderLogoDataUri).not.toHaveBeenCalled();
  });

  it("proceeds with providerLogoUrl: null (never blocks discovery) when the picture fetch itself fails", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValueOnce(null);
    mockResolveProviderLogoDataUri.mockResolvedValueOnce(null);

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    const result = await resolve(51234, "SV Muttenz B1");

    expect(result).toBe("ext-team-1");
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      expect.objectContaining({ providerLogoUrl: null }),
      SYNCED_AT,
    );
  });

  it("proceeds with discovery when the pre-check (DB read) itself throws — never blocks", async () => {
    mockFindExternalTeamByProviderIdentity.mockRejectedValueOnce(new Error("DB unavailable"));

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    const result = await resolve(51234, "SV Muttenz B1");

    expect(result).toBe("ext-team-1");
    expect(mockResolveProviderLogoDataUri).not.toHaveBeenCalled();
    expect(mockDiscoverExternalTeamFromProvider).toHaveBeenCalledWith(
      { fake: "mutation-database" },
      expect.objectContaining({ providerLogoUrl: null }),
      SYNCED_AT,
    );
  });

  it("scopes the pre-check lookup to the resolver's own tenantId (tenant isolation)", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValueOnce(null);
    mockResolveProviderLogoDataUri.mockResolvedValueOnce(null);

    const resolve = createExternalOpponentResolver("tenant-acme", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");

    expect(mockFindExternalTeamByProviderIdentity).toHaveBeenCalledWith(
      { fake: "query-database" },
      expect.objectContaining({ tenantId: "tenant-acme" }),
    );
  });

  it("only runs the pre-check/fetch once per SFV teamId per resolver instance (per-run memoization)", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValue(null);
    mockResolveProviderLogoDataUri.mockResolvedValue("data:image/gif;base64,X==");

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");
    await resolve(51234, "SV Muttenz B1");
    await resolve(51234, "SV Muttenz B1");

    expect(mockFindExternalTeamByProviderIdentity).toHaveBeenCalledOnce();
    expect(mockResolveProviderLogoDataUri).toHaveBeenCalledOnce();
  });

  it("runs an independent pre-check/fetch per distinct SFV teamId", async () => {
    mockFindExternalTeamByProviderIdentity.mockResolvedValue(null);
    mockResolveProviderLogoDataUri.mockResolvedValue(null);
    mockDiscoverExternalTeamFromProvider
      .mockResolvedValueOnce(discoveryResult({ clubId: "club-1" }))
      .mockResolvedValueOnce(discoveryResult({ clubId: "club-2" }));

    const resolve = createExternalOpponentResolver("tenant-1", SYNCED_AT);
    await resolve(51234, "SV Muttenz B1");
    await resolve(60000, "FC Concordia Basel B1");

    expect(mockFindExternalTeamByProviderIdentity).toHaveBeenCalledTimes(2);
    expect(mockResolveProviderLogoDataUri).toHaveBeenCalledTimes(2);
  });
});
