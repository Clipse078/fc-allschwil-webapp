/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClubEvent } from "@/lib/events/club-events-service";
import VeranstaltungenOverview from "@/components/admin/veranstaltungen/VeranstaltungenOverview";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function createEvent(overrides: Partial<ClubEvent> = {}): ClubEvent {
  return {
    id: overrides.id ?? "event-1",
    title: overrides.title ?? "Generalversammlung",
    description: null,
    location: "Clubhaus",
    startAt: new Date("2026-10-01T18:00:00.000Z"),
    endAt: null,
    organizerName: "Vorstand",
    remarks: null,
    status: overrides.status ?? "SCHEDULED",
    reviewStage: "APPROVED",
    source: "MANUAL",
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: false,
    trainingsplanVisible: false,
    teamPageVisible: false,
    tenantId: "tenant-1",
    seasonId: "season-1",
    teamId: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    season: { id: "season-1", key: "2026-27", name: "2026/27" },
    ...overrides,
  };
}

describe("VeranstaltungenOverview", () => {
  it("renders Aktiv/Archiv tabs with aligned counts and no legacy hero chrome", () => {
    const events = [
      createEvent({ id: "active-1", title: "Trainersitzung" }),
      createEvent({ id: "active-2", title: "Sponsorenanlass" }),
      createEvent({ id: "archived-1", title: "Altanlass", status: "ARCHIVED" }),
    ];

    render(
      <VeranstaltungenOverview
        events={events}
        tab="AKTIV"
        canManage
        canDelete={false}
      />,
    );

    expect(screen.getByTestId("veranstaltungen-tab-aktiv")).toHaveTextContent("Aktiv2");
    expect(screen.getByTestId("veranstaltungen-tab-archiv")).toHaveTextContent("Archiv1");
    expect(screen.queryByText("Vereinsanlässe")).toBeNull();
    expect(screen.queryByText("Alle Veranstaltungen")).toBeNull();
    expect(screen.queryByText("TOTAL")).toBeNull();
    expect(screen.queryByRole("link", { name: /Erstellen/i })).toBeNull();
    expect(screen.getByTestId("veranstaltungen-list-aktiv")).toBeInTheDocument();
    expect(screen.getByText("Trainersitzung")).toBeInTheDocument();
    expect(screen.getByText("Sponsorenanlass")).toBeInTheDocument();
    expect(screen.queryByText("Altanlass")).toBeNull();
  });

  it("shows archived events on the Archiv tab with restore/delete affordances", () => {
    const events = [
      createEvent({ id: "active-1", title: "Trainersitzung" }),
      createEvent({ id: "archived-1", title: "Altanlass", status: "ARCHIVED" }),
    ];

    render(
      <VeranstaltungenOverview
        events={events}
        tab="ARCHIV"
        canManage
        canDelete
      />,
    );

    expect(screen.getByTestId("veranstaltungen-list-archiv")).toBeInTheDocument();
    expect(screen.getByText("Altanlass")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wiederherstellen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Endgültig löschen/i })).toBeInTheDocument();
  });

  it("keeps edit and archive actions on active event cards", () => {
    const events = [createEvent({ id: "active-1", title: "Trainersitzung" })];

    render(
      <VeranstaltungenOverview
        events={events}
        tab="AKTIV"
        canManage
        canDelete={false}
      />,
    );

    expect(screen.getByRole("link", { name: /Bearbeiten/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archivieren/i })).toBeInTheDocument();
  });

  it("offers a single create action only in the empty Aktiv state", () => {
    render(
      <VeranstaltungenOverview
        events={[]}
        tab="AKTIV"
        canManage
        canDelete={false}
      />,
    );

    expect(screen.getAllByRole("link", { name: /Veranstaltung erstellen/i })).toHaveLength(1);
  });
});
