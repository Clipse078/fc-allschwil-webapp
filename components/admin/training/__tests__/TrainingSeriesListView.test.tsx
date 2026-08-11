/**
 * @vitest-environment jsdom
 *
 * components/admin/training/__tests__/TrainingSeriesListView.test.tsx
 *
 * ADMIN-DELETE-02A-C1 — root-cause regression test: the actual
 * Serien-Verwaltung list (/dashboard/training?tab=serien) — not just the
 * deeper per-series edit page — must expose the permanent "Endgültig
 * löschen" action to a trainings.delete holder, independent of
 * trainings.manage (Ressourcen/Bearbeiten/Archivieren) and independent of
 * archive status.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrainingSeriesListView from "@/components/admin/training/TrainingSeriesListView";
import type { TrainingSeriesDto } from "@/lib/training/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function makeSeries(overrides: Partial<TrainingSeriesDto> = {}): TrainingSeriesDto {
  return {
    id: "series-1",
    tenantId: "tenant-a",
    teamSeasonId: "team-season-1",
    title: "U13 Dienstag/Donnerstag",
    description: null,
    status: "ACTIVE",
    startsAt: "18:00",
    endsAt: "19:30",
    timezone: "Europe/Zurich",
    weekdays: ["TUESDAY", "THURSDAY"],
    weekdaySchedules: [
      { weekday: "TUESDAY", startsAt: "18:00", endsAt: "19:30" },
      { weekday: "THURSDAY", startsAt: "18:00", endsAt: "19:30" },
    ],
    validFrom: null,
    validUntil: null,
    archivedAt: null,
    sessionCount: 8,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TrainingSeriesListView — ADMIN-DELETE-02A-C1 root-cause fix", () => {
  it("shows Ressourcen/Bearbeiten/Archivieren but NOT the delete action for a trainings.manage-only caller", () => {
    render(
      <TrainingSeriesListView allSeries={[makeSeries()]} showArchived={false} canManage={true} canDelete={false} />,
    );

    expect(screen.getByText("Ressourcen")).toBeTruthy();
    expect(screen.getByText("Bearbeiten")).toBeTruthy();
    expect(screen.getByText("Archivieren")).toBeTruthy();
    expect(screen.queryByTestId("training-series-delete-inline")).toBeNull();
  });

  it("shows the delete action for a trainings.delete-only caller (canManage=false) — the previously-missing action", () => {
    render(
      <TrainingSeriesListView allSeries={[makeSeries()]} showArchived={false} canManage={false} canDelete={true} />,
    );

    expect(screen.getByTestId("training-series-delete-inline")).toBeTruthy();
    // Manage-gated actions must stay hidden for a delete-only caller.
    expect(screen.queryByText("Ressourcen")).toBeNull();
    expect(screen.queryByText("Bearbeiten")).toBeNull();
    expect(screen.queryByText("Archivieren")).toBeNull();
  });

  it("shows both manage actions and the delete action when the caller holds both authorities", () => {
    render(
      <TrainingSeriesListView allSeries={[makeSeries()]} showArchived={false} canManage={true} canDelete={true} />,
    );

    expect(screen.getByText("Bearbeiten")).toBeTruthy();
    expect(screen.getByTestId("training-series-delete-inline")).toBeTruthy();
  });

  it("still shows the delete action for an ARCHIVED series (permanent delete is not blocked by lifecycle status)", () => {
    render(
      <TrainingSeriesListView
        allSeries={[makeSeries({ status: "ARCHIVED" })]}
        showArchived={true}
        canManage={true}
        canDelete={true}
      />,
    );

    // Manage row actions (Ressourcen/Bearbeiten/Archivieren) are hidden for
    // an archived series (existing, unchanged behavior)...
    expect(screen.queryByText("Bearbeiten")).toBeNull();
    // ...but the permanent-delete action must still be reachable.
    expect(screen.getByTestId("training-series-delete-inline")).toBeTruthy();
  });

  it("renders no action row at all when the caller holds neither authority", () => {
    render(
      <TrainingSeriesListView allSeries={[makeSeries()]} showArchived={false} canManage={false} canDelete={false} />,
    );

    expect(screen.queryByText("Bearbeiten")).toBeNull();
    expect(screen.queryByTestId("training-series-delete-inline")).toBeNull();
  });
});
