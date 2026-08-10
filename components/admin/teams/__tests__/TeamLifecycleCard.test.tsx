/**
 * @vitest-environment jsdom
 *
 * components/admin/teams/__tests__/TeamLifecycleCard.test.tsx
 *
 * ADMIN-DELETE-01B — focused UI-gating tests for the permanent "Löschen"
 * action. Archive/restore (`canManage`) and permanent delete (`canDelete`)
 * are independent authority signals — this suite verifies each surfaces
 * (or hides) its own actions without redesigning TeamCenter.
 *
 * No network/fetch calls are exercised here — these tests only verify which
 * actions render given the two permission flags.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeamLifecycleCard from "@/components/admin/teams/TeamLifecycleCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const BASE_PROPS = {
  teamId: "team-1",
  teamName: "FC Allschwil Junioren B2",
  isActive: true,
};

describe("TeamLifecycleCard — ADMIN-DELETE-01B permission gating", () => {
  it("shows neither archive/restore nor Löschen when the caller has no authority", () => {
    render(<TeamLifecycleCard {...BASE_PROPS} canManage={false} canDelete={false} />);

    expect(screen.queryByText("Löschen")).toBeNull();
    expect(screen.queryByText("Archivieren")).toBeNull();
    expect(screen.queryByText("Wiederherstellen")).toBeNull();
    // Read-only status is still shown.
    expect(screen.getByText("Aktiv")).toBeTruthy();
  });

  it("shows Archivieren but hides Löschen for a teams.manage-only caller (canManage=true, canDelete=false)", () => {
    render(<TeamLifecycleCard {...BASE_PROPS} canManage={true} canDelete={false} />);

    expect(screen.getByText("Archivieren")).toBeTruthy();
    expect(screen.queryByText("Löschen")).toBeNull();
  });

  it("shows Löschen but hides Archivieren for a teams.delete-only caller (canManage=false, canDelete=true)", () => {
    render(<TeamLifecycleCard {...BASE_PROPS} canManage={false} canDelete={true} />);

    expect(screen.getByText("Löschen")).toBeTruthy();
    expect(screen.queryByText("Archivieren")).toBeNull();
    expect(screen.queryByText("Wiederherstellen")).toBeNull();
  });

  it("shows both Archivieren and Löschen when the caller has both authorities", () => {
    render(<TeamLifecycleCard {...BASE_PROPS} canManage={true} canDelete={true} />);

    expect(screen.getByText("Archivieren")).toBeTruthy();
    expect(screen.getByText("Löschen")).toBeTruthy();
  });

  it("shows Wiederherstellen (not Archivieren) for an archived Team when canManage=true", () => {
    render(
      <TeamLifecycleCard {...BASE_PROPS} isActive={false} canManage={true} canDelete={false} />,
    );

    expect(screen.getByText("Wiederherstellen")).toBeTruthy();
    expect(screen.queryByText("Archivieren")).toBeNull();
    expect(screen.queryByText("Löschen")).toBeNull();
  });
});
