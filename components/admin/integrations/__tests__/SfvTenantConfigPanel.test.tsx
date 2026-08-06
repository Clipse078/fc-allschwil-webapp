// @vitest-environment jsdom
/**
 * Focused tests for SfvTenantConfigPanel
 *
 * Covers:
 *   - Initial loading (no config)
 *   - Configuration displayed (with existing config)
 *   - Form validation (clubId, defaultSeasonId, organisationId)
 *   - Save success
 *   - Save failure (API error, network error)
 *   - Connection status (configured, not configured, disabled)
 *   - Diagnostics button (enabled/disabled)
 *   - Diagnostics loading
 *   - Diagnostics success (healthy)
 *   - Diagnostics degraded
 *   - Diagnostics unhealthy
 *   - Diagnostics API failures (404, 409, network)
 *   - Disabled state during save
 *
 * All API interactions are mocked via vi.fn() on globalThis.fetch.
 * No backend mocking beyond the API fetch layer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { TenantSfvConfig } from "@/lib/integrations/sfv/tenant-config-types";
import type { SfvAdminDiagnostics } from "@/lib/integrations/sfv/admin-diagnostics-service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockToastSuccess = vi.fn();
const mockToastDanger = vi.fn();
const mockToastWarning = vi.fn();
const mockToastInfo = vi.fn();
const mockToastNeutral = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: {
      success: mockToastSuccess,
      danger: mockToastDanger,
      warning: mockToastWarning,
      info: mockToastInfo,
      neutral: mockToastNeutral,
    },
  }),
}));

// Import after mocks
const { default: SfvTenantConfigPanel } = await import("../SfvTenantConfigPanel");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "clx-tenant-test";

function makeConfig(overrides: Partial<TenantSfvConfig> = {}): TenantSfvConfig {
  return {
    id: "clx-sfv-config-1",
    tenantId: TENANT_ID,
    clubId: 483,
    defaultSeasonId: 2027,
    organisationId: null,
    enabled: true,
    lastTeamSyncAt: null,
    lastScheduleSyncAt: null,
    lastMatchDetailSyncAt: null,
    lastCompetitionSyncAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeDiagnostics(
  health: SfvAdminDiagnostics["health"] = "healthy",
  overrides: Partial<SfvAdminDiagnostics> = {},
): SfvAdminDiagnostics {
  return {
    health,
    clubId: 483,
    seasonId: 2027,
    seasonName: "2026/2027",
    seasonShortName: "26/27",
    generatedAt: new Date().toISOString(),
    totalDurationMs: 1234,
    timings: [
      { stage: "resolve-common-ids", durationMs: 200, success: true },
      { stage: "load-club-season-data", durationMs: 1034, success: true },
    ],
    counts: {
      ownTeams: 3,
      scheduleRows: 42,
      rankingRows: 18,
      resolvedScheduleRows: 40,
      scheduleBothOwnRows: 0,
      scheduleNoOwnTeamRows: 0,
      scheduleInvalidRows: 0,
      scheduleFailedRows: 0,
      rankingOwnTeamRows: 3,
      rankingOpponentRows: 15,
      rankingInvalidRows: 0,
      rankingFailedRows: 0,
      uniqueOpponentTeams: 12,
      picturesRequested: 12,
      picturesPresent: 10,
      picturesMissing: 0,
      pictureFailures: 0,
    },
    issues: [],
    ...overrides,
  };
}

function makeDegradedDiagnostics(): SfvAdminDiagnostics {
  return makeDiagnostics("degraded", {
    counts: {
      ownTeams: 0,
      scheduleRows: 5,
      rankingRows: 3,
      resolvedScheduleRows: 3,
      scheduleBothOwnRows: 0,
      scheduleNoOwnTeamRows: 2,
      scheduleInvalidRows: 0,
      scheduleFailedRows: 0,
      rankingOwnTeamRows: 0,
      rankingOpponentRows: 3,
      rankingInvalidRows: 0,
      rankingFailedRows: 0,
      uniqueOpponentTeams: 5,
      picturesRequested: 5,
      picturesPresent: 3,
      picturesMissing: 2,
      pictureFailures: 0,
    },
    issues: [
      {
        severity: "warning",
        code: "SFV_NO_OWN_TEAMS",
        message: "No own teams found for this club and season.",
      },
      {
        severity: "warning",
        code: "SFV_SCHEDULE_NO_OWN_TEAM",
        message: "2 schedule row(s) matched neither team as an own team.",
        count: 2,
      },
      {
        severity: "info",
        code: "SFV_MISSING_PICTURES",
        message: "2 opponent team(s) returned no picture from SFV (204 — valid state, not a failure).",
        count: 2,
      },
    ],
  });
}

function makeUnhealthyDiagnostics(): SfvAdminDiagnostics {
  return makeDiagnostics("unhealthy", {
    seasonName: null,
    seasonShortName: null,
    counts: {
      ownTeams: 0,
      scheduleRows: 0,
      rankingRows: 0,
      resolvedScheduleRows: 0,
      scheduleBothOwnRows: 0,
      scheduleNoOwnTeamRows: 0,
      scheduleInvalidRows: 0,
      scheduleFailedRows: 0,
      rankingOwnTeamRows: 0,
      rankingOpponentRows: 0,
      rankingInvalidRows: 0,
      rankingFailedRows: 0,
      uniqueOpponentTeams: 0,
      picturesRequested: 0,
      picturesPresent: 0,
      picturesMissing: 0,
      pictureFailures: 0,
    },
    issues: [
      {
        severity: "error",
        code: "SFV_AUTH_FAILURE",
        message: "Authentication failed.",
        retryable: false,
      },
    ],
  });
}

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function mockFetchSuccess(data: unknown, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status: number, data: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValueOnce(new Error("Network error"));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Initial loading
// ═════════════════════════════════════════════════════════════════════════════

describe("Initial loading", () => {
  it("INIT-1. renders with no initial config — empty form fields", () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    const clubIdInput = screen.getByTestId("input-club-id") as HTMLInputElement;
    const seasonIdInput = screen.getByTestId("input-season-id") as HTMLInputElement;
    const orgIdInput = screen.getByTestId("input-org-id") as HTMLInputElement;

    expect(clubIdInput.value).toBe("");
    expect(seasonIdInput.value).toBe("");
    expect(orgIdInput.value).toBe("");
  });

  it("INIT-2. renders with no initial config — enabled toggle is ON by default", () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    const toggle = screen.getByTestId("toggle-enabled");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("INIT-3. renders with no initial config — shows 'Nicht konfiguriert' status", () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    const status = screen.getByTestId("connection-status");
    expect(status.textContent).toContain("Nicht konfiguriert");
  });

  it("INIT-4. renders with no initial config — diagnostics button is disabled", () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    const btn = screen.getByTestId("btn-run-diagnostics");
    expect(btn).toBeDisabled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Configuration displayed
// ═════════════════════════════════════════════════════════════════════════════

describe("Configuration displayed", () => {
  it("CFG-1. populates form fields from initial config", () => {
    const config = makeConfig({ clubId: 483, defaultSeasonId: 2027 });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const clubIdInput = screen.getByTestId("input-club-id") as HTMLInputElement;
    const seasonIdInput = screen.getByTestId("input-season-id") as HTMLInputElement;

    expect(clubIdInput.value).toBe("483");
    expect(seasonIdInput.value).toBe("2027");
  });

  it("CFG-2. populates organisationId when present", () => {
    const config = makeConfig({ organisationId: 100 });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const orgIdInput = screen.getByTestId("input-org-id") as HTMLInputElement;
    expect(orgIdInput.value).toBe("100");
  });

  it("CFG-3. leaves organisationId empty when null in config", () => {
    const config = makeConfig({ organisationId: null });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const orgIdInput = screen.getByTestId("input-org-id") as HTMLInputElement;
    expect(orgIdInput.value).toBe("");
  });

  it("CFG-4. reflects enabled=true on toggle", () => {
    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const toggle = screen.getByTestId("toggle-enabled");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("CFG-5. reflects enabled=false on toggle", () => {
    const config = makeConfig({ enabled: false });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const toggle = screen.getByTestId("toggle-enabled");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("CFG-6. shows 'Konfiguriert' status for enabled config", () => {
    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const status = screen.getByTestId("connection-status");
    expect(status.textContent).toContain("Konfiguriert");
  });

  it("CFG-7. shows 'Deaktiviert' status for disabled config", () => {
    const config = makeConfig({ enabled: false });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const status = screen.getByTestId("connection-status");
    expect(status.textContent).toContain("Deaktiviert");
  });

  it("CFG-8. diagnostics button is enabled for configured and enabled tenant", () => {
    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const btn = screen.getByTestId("btn-run-diagnostics");
    expect(btn).not.toBeDisabled();
  });

  it("CFG-9. diagnostics button is disabled for disabled config", () => {
    const config = makeConfig({ enabled: false });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    const btn = screen.getByTestId("btn-run-diagnostics");
    expect(btn).toBeDisabled();
  });

  it("CFG-10. connection status card shows club ID from config", () => {
    const config = makeConfig({ clubId: 999 });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    expect(screen.getByText("999")).toBeTruthy();
  });

  it("CFG-11. shows neutral values when no synchronization has completed", () => {
    const config = makeConfig({
      lastTeamSyncAt: null,
      lastScheduleSyncAt: null,
      lastMatchDetailSyncAt: null,
    });

    render(<SfvTenantConfigPanel initialConfig={config} />);

    expect(screen.getByTestId("last-team-sync").textContent).toContain(
      "Noch nie synchronisiert",
    );
    expect(screen.getByTestId("last-schedule-sync").textContent).toContain(
      "Noch nie synchronisiert",
    );
    expect(screen.getByTestId("last-detail-sync").textContent).toContain(
      "Noch nie synchronisiert",
    );
  });

  it("CFG-12. formats persisted last-sync timestamps with the de-CH locale", () => {
    const teamTimestamp = new Date("2026-07-21T10:15:00.000Z");
    const scheduleTimestamp = new Date("2026-07-21T11:30:00.000Z");
    const detailTimestamp = new Date("2026-07-21T12:45:00.000Z");

    const config = makeConfig({
      lastTeamSyncAt: teamTimestamp,
      lastScheduleSyncAt: scheduleTimestamp,
      lastMatchDetailSyncAt: detailTimestamp,
    });

    render(<SfvTenantConfigPanel initialConfig={config} />);

    expect(screen.getByTestId("last-team-sync").textContent).toContain(
      teamTimestamp.toLocaleString("de-CH"),
    );
    expect(screen.getByTestId("last-schedule-sync").textContent).toContain(
      scheduleTimestamp.toLocaleString("de-CH"),
    );
    expect(screen.getByTestId("last-detail-sync").textContent).toContain(
      detailTimestamp.toLocaleString("de-CH"),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Form validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Form validation", () => {
  it("VAL-1. shows error when clubId is empty on submit", async () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    const seasonIdInput = screen.getByTestId("input-season-id");
    fireEvent.change(seasonIdInput, { target: { value: "2027" } });

    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-club-id")).toBeTruthy();
    });
  });

  it("VAL-2. shows error when defaultSeasonId is empty on submit", async () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    const clubIdInput = screen.getByTestId("input-club-id");
    fireEvent.change(clubIdInput, { target: { value: "483" } });

    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-season-id")).toBeTruthy();
    });
  });

  it("VAL-3. shows error when clubId is 0", async () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "0" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-club-id")).toBeTruthy();
    });
  });

  it("VAL-4. shows error when clubId is negative", async () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "-1" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-club-id")).toBeTruthy();
    });
  });

  it("VAL-5. shows error when organisationId is invalid (0)", async () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.change(screen.getByTestId("input-org-id"), { target: { value: "0" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-org-id")).toBeTruthy();
    });
  });

  it("VAL-6. does NOT show org ID error when organisationId is empty", async () => {
    globalThis.fetch = mockFetchSuccess({ config: makeConfig() });
    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    // organisationId left empty
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.queryByTestId("error-org-id")).toBeNull();
    });
  });

  it("VAL-7. does not call fetch when validation fails", async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    render(<SfvTenantConfigPanel initialConfig={null} />);
    // Leave clubId empty to trigger validation error
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-club-id")).toBeTruthy();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("VAL-8. clears field error when user edits the field", async () => {
    render(<SfvTenantConfigPanel initialConfig={null} />);

    // Trigger validation error on clubId
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-club-id")).toBeTruthy();
    });

    // Edit the field — error should disappear
    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "1" } });

    await waitFor(() => {
      expect(screen.queryByTestId("error-club-id")).toBeNull();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Save success
// ═════════════════════════════════════════════════════════════════════════════

describe("Save success", () => {
  it("SAVE-1. calls POST /api/admin/integrations/sfv/config with correct body", async () => {
    const mockFetch = mockFetchSuccess({ config: makeConfig() });
    globalThis.fetch = mockFetch;

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/integrations/sfv/config");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body.clubId).toBe(483);
    expect(body.defaultSeasonId).toBe(2027);
    expect(body.enabled).toBe(true);
  });

  it("SAVE-2. shows toast.success after successful save", async () => {
    globalThis.fetch = mockFetchSuccess({ config: makeConfig() });

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Konfiguration gespeichert.");
    });
  });

  it("SAVE-3. updates connection status to 'Konfiguriert' after successful save", async () => {
    globalThis.fetch = mockFetchSuccess({ config: makeConfig({ enabled: true }) });

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      const status = screen.getByTestId("connection-status");
      expect(status.textContent).toContain("Konfiguriert");
    });
  });

  it("SAVE-4. sends organisationId as number when provided", async () => {
    const mockFetch = mockFetchSuccess({ config: makeConfig({ organisationId: 42 }) });
    globalThis.fetch = mockFetch;

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.change(screen.getByTestId("input-org-id"), { target: { value: "42" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.organisationId).toBe(42);
  });

  it("SAVE-5. sends organisationId as null when field is empty", async () => {
    const mockFetch = mockFetchSuccess({ config: makeConfig() });
    globalThis.fetch = mockFetch;

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    // organisationId left empty
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.organisationId).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Save failure
// ═════════════════════════════════════════════════════════════════════════════

describe("Save failure", () => {
  it("FAIL-1. shows toast.danger when API returns error", async () => {
    globalThis.fetch = mockFetchError(400, { error: "Invalid clubId", field: "clubId" });

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockToastDanger).toHaveBeenCalled();
    });
  });

  it("FAIL-2. shows field error when API returns field validation error", async () => {
    globalThis.fetch = mockFetchError(400, { error: "Invalid clubId", field: "clubId" });

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("error-club-id")).toBeTruthy();
    });
  });

  it("FAIL-3. shows toast.danger on network error during save", async () => {
    globalThis.fetch = mockFetchNetworkError();

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockToastDanger).toHaveBeenCalled();
    });
  });

  it("FAIL-4. does not show toast.success on save failure", async () => {
    globalThis.fetch = mockFetchError(500, { error: "Internal server error" });

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(mockToastDanger).toHaveBeenCalled();
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Disabled save (loading state)
// ═════════════════════════════════════════════════════════════════════════════

describe("Disabled save during saving", () => {
  it("DSAV-1. save button is disabled while saving", async () => {
    let resolveFetch!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve; }),
    );

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    // While fetch is pending, button should be disabled
    await waitFor(() => {
      expect(screen.getByTestId("btn-save")).toBeDisabled();
    });

    // Resolve to clean up
    act(() => {
      resolveFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ config: makeConfig() }),
      });
    });
  });

  it("DSAV-2. form inputs are disabled while saving", async () => {
    let resolveFetch!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve; }),
    );

    render(<SfvTenantConfigPanel initialConfig={null} />);

    fireEvent.change(screen.getByTestId("input-club-id"), { target: { value: "483" } });
    fireEvent.change(screen.getByTestId("input-season-id"), { target: { value: "2027" } });
    fireEvent.submit(screen.getByTestId("sfv-config-form"));

    await waitFor(() => {
      expect(screen.getByTestId("input-club-id")).toBeDisabled();
    });

    act(() => {
      resolveFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ config: makeConfig() }),
      });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Diagnostics
// ═════════════════════════════════════════════════════════════════════════════

describe("Diagnostics", () => {
  it("DIAG-1. calls POST /api/admin/integrations/sfv/diagnostics when button clicked", async () => {
    const mockFetch = mockFetchSuccess({ diagnostics: makeDiagnostics() });
    globalThis.fetch = mockFetch;

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/integrations/sfv/diagnostics");
    expect(options.method).toBe("POST");
  });

  it("DIAG-2. shows loading state while diagnostics are running", async () => {
    let resolveFetch!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve; }),
    );

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.getByTestId("diagnostics-loading")).toBeTruthy();
    });

    act(() => {
      resolveFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ diagnostics: makeDiagnostics() }),
      });
    });
  });

  it("DIAG-3. shows diagnostics result on healthy response", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDiagnostics("healthy") });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.getByTestId("diagnostics-result")).toBeTruthy();
    });
  });

  it("DIAG-4. shows health 'Gesund' for healthy result", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDiagnostics("healthy") });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      const health = screen.getByTestId("diagnostics-health");
      expect(health.textContent).toContain("Gesund");
    });
  });

  it("DIAG-5. shows health 'Beeinträchtigt' for degraded result", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDegradedDiagnostics() });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      const health = screen.getByTestId("diagnostics-health");
      expect(health.textContent).toContain("Beeinträchtigt");
    });
  });

  it("DIAG-6. shows health 'Fehlerhaft' for unhealthy result", async () => {
    globalThis.fetch = mockFetchError(502, { diagnostics: makeUnhealthyDiagnostics() });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      const health = screen.getByTestId("diagnostics-health");
      expect(health.textContent).toContain("Fehlerhaft");
    });
  });

  it("DIAG-7. shows issue list for degraded result", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDegradedDiagnostics() });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      const issues = screen.getByTestId("diagnostics-issues");
      expect(issues).toBeTruthy();
    });
  });

  it("DIAG-8. shows SFV_NO_OWN_TEAMS issue code in degraded result", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDegradedDiagnostics() });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("SFV_NO_OWN_TEAMS")).toBeTruthy();
    });
  });

  it("DIAG-9. shows no issues message for healthy result", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDiagnostics("healthy") });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.getByText("Keine Probleme gefunden.")).toBeTruthy();
    });
  });

  it("DIAG-10. shows error message on 404 (no config found)", async () => {
    globalThis.fetch = mockFetchError(404, { error: "No SFV configuration found for this tenant" });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      const errEl = screen.getByTestId("diagnostics-error");
      expect(errEl.textContent).toContain("Keine SFV-Konfiguration gefunden");
    });
  });

  it("DIAG-11. shows error message on 409 (integration disabled)", async () => {
    globalThis.fetch = mockFetchError(409, { error: "SFV integration is disabled" });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      const errEl = screen.getByTestId("diagnostics-error");
      expect(errEl.textContent).toContain("deaktiviert");
    });
  });

  it("DIAG-12. shows error message on network failure", async () => {
    globalThis.fetch = mockFetchNetworkError();

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.getByTestId("diagnostics-error")).toBeTruthy();
    });
  });

  it("DIAG-13. diagnostics button is disabled while diagnostics are loading", async () => {
    let resolveFetch!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve; }),
    );

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.getByTestId("btn-run-diagnostics")).toBeDisabled();
    });

    act(() => {
      resolveFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ diagnostics: makeDiagnostics() }),
      });
    });
  });

  it("DIAG-14. does not show diagnostics loading text after result arrives", async () => {
    globalThis.fetch = mockFetchSuccess({ diagnostics: makeDiagnostics("healthy") });

    const config = makeConfig({ enabled: true });
    render(<SfvTenantConfigPanel initialConfig={config} />);

    fireEvent.click(screen.getByTestId("btn-run-diagnostics"));

    await waitFor(() => {
      expect(screen.queryByTestId("diagnostics-loading")).toBeNull();
    });
  });
});
// ═══════════════════════════════════════════════════════════════════════════════
// Last-sync timestamp refresh
// ═══════════════════════════════════════════════════════════════════════════════

describe("Last-sync timestamp refresh", () => {
  it("SYNC-TIME-1. updates the team timestamp after a fully successful team sync", async () => {
    const finishedAt = "2026-07-21T13:00:00.000Z";

    globalThis.fetch = mockFetchSuccess({
      result: {
        tenantId: TENANT_ID,
        clubId: 483,
        seasonId: 2027,
        startedAt: "2026-07-21T12:59:59.000Z",
        finishedAt,
        durationMs: 1000,
        fetched: 1,
        created: 1,
        updated: 0,
        unchanged: 0,
        markedInactive: 0,
        failed: 0,
        errors: [],
      },
    });

    render(<SfvTenantConfigPanel initialConfig={makeConfig()} />);

    fireEvent.click(screen.getByTestId("btn-team-sync"));

    await waitFor(() => {
      expect(screen.getByTestId("last-team-sync").textContent).toContain(
        new Date(finishedAt).toLocaleString("de-CH"),
      );
    });
  });

  it("SYNC-TIME-2. updates the schedule timestamp after a fully successful schedule sync", async () => {
    const finishedAt = "2026-07-21T13:10:00.000Z";

    globalThis.fetch = mockFetchSuccess({
      result: {
        tenantId: TENANT_ID,
        clubId: 483,
        seasonId: 2027,
        dateFrom: "2026-06-21",
        dateTo: "2026-10-19",
        startedAt: "2026-07-21T13:09:59.000Z",
        finishedAt,
        durationMs: 1000,
        fetched: 1,
        created: 1,
        updated: 0,
        unchanged: 0,
        failed: 0,
        scoresUpdated: 0,
        kickoffChanges: 0,
        statusChanges: 0,
        unresolvedLocalTeamRefs: 0,
        externalOpponents: 1,
        errors: [],
      },
    });

    render(<SfvTenantConfigPanel initialConfig={makeConfig()} />);

    fireEvent.click(screen.getByTestId("btn-schedule-sync"));

    await waitFor(() => {
      expect(screen.getByTestId("last-schedule-sync").textContent).toContain(
        new Date(finishedAt).toLocaleString("de-CH"),
      );
    });
  });

  it("SYNC-TIME-3. updates the detail timestamp after a fully successful detail sync", async () => {
    const finishedAt = "2026-07-21T13:20:00.000Z";

    globalThis.fetch = mockFetchSuccess({
      result: {
        tenantId: TENANT_ID,
        startedAt: "2026-07-21T13:19:59.000Z",
        finishedAt,
        durationMs: 1000,
        processed: 1,
        updated: 1,
        unchanged: 0,
        failed: 0,
        errors: [],
      },
    });

    render(<SfvTenantConfigPanel initialConfig={makeConfig()} />);

    fireEvent.click(screen.getByTestId("btn-detail-sync"));

    await waitFor(() => {
      expect(screen.getByTestId("last-detail-sync").textContent).toContain(
        new Date(finishedAt).toLocaleString("de-CH"),
      );
    });
  });

  it("SYNC-TIME-4. does not update the team timestamp when the result contains failures", async () => {
    const originalTimestamp = new Date("2026-07-20T10:00:00.000Z");

    globalThis.fetch = mockFetchSuccess({
      result: {
        tenantId: TENANT_ID,
        clubId: 483,
        seasonId: 2027,
        startedAt: "2026-07-21T12:59:59.000Z",
        finishedAt: "2026-07-21T13:00:00.000Z",
        durationMs: 1000,
        fetched: 1,
        created: 0,
        updated: 0,
        unchanged: 0,
        markedInactive: 0,
        failed: 1,
        errors: [
          {
            code: "TEAM_CREATE_FAILED",
            message: "Team could not be created.",
          },
        ],
      },
    });

    render(
      <SfvTenantConfigPanel
        initialConfig={makeConfig({ lastTeamSyncAt: originalTimestamp })}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-team-sync"));

    await waitFor(() => {
      expect(screen.getByTestId("team-sync-result")).toBeTruthy();
    });

    expect(screen.getByTestId("last-team-sync").textContent).toContain(
      originalTimestamp.toLocaleString("de-CH"),
    );
  });

  it("SYNC-TIME-5. updates the schedule timestamp when synchronization succeeds despite unresolved local team references", async () => {
    const originalTimestamp = new Date("2026-07-20T11:00:00.000Z");
    const finishedAt = "2026-07-21T13:10:00.000Z";

    globalThis.fetch = mockFetchSuccess({
      result: {
        tenantId: TENANT_ID,
        clubId: 483,
        seasonId: 2027,
        dateFrom: "2026-06-21",
        dateTo: "2026-10-19",
        startedAt: "2026-07-21T13:09:59.000Z",
        finishedAt,
        durationMs: 1000,
        fetched: 1,
        created: 1,
        updated: 0,
        unchanged: 0,
        failed: 0,
        scoresUpdated: 0,
        kickoffChanges: 0,
        statusChanges: 0,
        unresolvedLocalTeamRefs: 1,
        externalOpponents: 1,
        errors: [],
      },
    });

    render(
      <SfvTenantConfigPanel
        initialConfig={makeConfig({ lastScheduleSyncAt: originalTimestamp })}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-schedule-sync"));

    await waitFor(() => {
      expect(screen.getByTestId("last-schedule-sync").textContent).toContain(
        new Date(finishedAt).toLocaleString("de-CH"),
      );
    });

    expect(screen.getByTestId("last-schedule-sync").textContent).not.toContain(
      originalTimestamp.toLocaleString("de-CH"),
    );
  });
  it("SYNC-TIME-6. does not update the detail timestamp when the result contains errors", async () => {
    const originalTimestamp = new Date("2026-07-20T12:00:00.000Z");

    globalThis.fetch = mockFetchSuccess({
      result: {
        tenantId: TENANT_ID,
        startedAt: "2026-07-21T13:19:59.000Z",
        finishedAt: "2026-07-21T13:20:00.000Z",
        durationMs: 1000,
        processed: 1,
        updated: 0,
        unchanged: 0,
        failed: 1,
        errors: [
          {
            code: "MATCH_DETAIL_FAILED",
            message: "Match detail could not be synchronized.",
          },
        ],
      },
    });

    render(
      <SfvTenantConfigPanel
        initialConfig={makeConfig({ lastMatchDetailSyncAt: originalTimestamp })}
      />,
    );

    fireEvent.click(screen.getByTestId("btn-detail-sync"));

    await waitFor(() => {
      expect(screen.getByTestId("detail-sync-result")).toBeTruthy();
    });

    expect(screen.getByTestId("last-detail-sync").textContent).toContain(
      originalTimestamp.toLocaleString("de-CH"),
    );
  });
});