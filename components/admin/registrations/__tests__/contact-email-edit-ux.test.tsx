// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";

vi.mock("@/components/admin/registrations/RegistrationWorkflowPanel", () => ({
  default: () => <div data-testid="workflow-panel" />,
}));
vi.mock("@/components/admin/registrations/RegistrationWorkflowSteps", () => ({
  RegistrationWorkflowSteps: () => <div data-testid="workflow-steps" />,
}));
vi.mock("@/components/admin/registrations/RegistrationTimelinePanel", () => ({
  default: () => <div data-testid="timeline" />,
}));
vi.mock("@/components/admin/communications/InternalCommentsPanel", () => ({
  InternalCommentsPanel: () => <div data-testid="comments" />,
}));
vi.mock("@/components/admin/communications/EmailCommunicationPanel", () => ({
  EmailCommunicationPanel: () => <div data-testid="email-panel" />,
}));
vi.mock("@/components/admin/registrations/WaitingListWorkflowSteps", () => ({
  WaitingListWorkflowSteps: () => <div data-testid="waiting-workflow" />,
}));

import RegistrationDetailDrawer from "@/components/admin/registrations/RegistrationDetailDrawer";
import { WaitingListDetailDrawer } from "@/components/admin/registrations/WaitingListDetailDrawer";

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/contact-email") && url.includes("/registrations/")) {
        return jsonResponse({ email: "correct@example.com" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

describe("COMM-03A addendum: contact email edit UX", () => {
  it("allows editing email on an archived registration without changing workflow state", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    const registration = {
      id: "reg-a",
      tenantId: "tenant-a",
      type: "PROBETRAINING",
      status: "ARCHIVED",
      firstName: "Max",
      lastName: "Mustermann",
      email: "wrong@example.com",
      phone: null,
      birthYear: null,
      birthDate: null,
      payloadJson: {},
      source: "WEBSITE",
      submittedAt: new Date("2026-08-21T10:00:00.000Z"),
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
      updatedAt: new Date("2026-08-21T10:00:00.000Z"),
      assignedToUserId: null,
      assignedToUser: null,
      targetGroupId: null,
      targetGroup: null,
      orgUnitId: null,
      orgUnit: null,
      teamSeasonId: null,
      teamSeason: null,
      duplicateIgnoredAt: null,
      duplicateIgnoredById: null,
      personId: null,
      person: null,
      duplicateReference: null,
      personMatch: null,
      contactedAt: null,
      archivedAt: new Date("2026-08-22T10:00:00.000Z"),
      message: null,
    } as unknown as ComponentProps<typeof RegistrationDetailDrawer>["registration"];

    render(
      <RegistrationDetailDrawer
        registration={registration}
        tenantSlug="fc-a"
        canEdit
        onClose={() => undefined}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("wrong@example.com")).toBeInTheDocument();
    const editButton = screen.getByRole("button", { name: "E-Mail-Adresse ändern" });
    expect(editButton).toBeEnabled();

    await user.click(editButton);

    const input = await screen.findByPlaceholderText("name@example.com");
    expect((input as HTMLInputElement).value).toBe("wrong@example.com");
    await user.clear(input);
    await user.type(input, "correct@example.com");

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "correct@example.com", status: "ARCHIVED" }),
    );
  });

  it("allows editing email from waiting list without changing entry status", async () => {
    const user = userEvent.setup();

    const initialEntry = {
      id: "wl-a",
      tenantId: "tenant-a",
      registrationId: "reg-a",
      personId: null,
      scopeType: "TARGET_GROUP",
      targetGroupId: "tg-a",
      orgUnitId: null,
      teamSeasonId: null,
      status: "ARCHIVED",
      priority: "NORMAL",
      responsibleUserId: null,
      reason: null,
      internalNote: null,
      addedAt: "2026-08-21T10:00:00.000Z",
      addedByUserId: null,
      lastContactedAt: null,
      offeredAt: null,
      resolvedAt: null,
      resolvedByUserId: null,
      createdAt: "2026-08-21T10:00:00.000Z",
      updatedAt: "2026-08-21T10:00:00.000Z",
      registration: {
        id: "reg-a",
        type: "PROBETRAINING",
        status: "WAITING",
        firstName: "Max",
        lastName: "Mustermann",
        email: "wrong@example.com",
        phone: null,
        birthYear: null,
        birthDate: null,
        message: null,
        payloadJson: {},
        source: "WEBSITE",
        submittedAt: "2026-08-21T10:00:00.000Z",
        targetGroupId: null,
        assignedToUserId: null,
        personId: null,
      },
      person: null,
      targetGroup: { id: "tg-a", key: "tg", name: "U9" },
      orgUnit: null,
      teamSeason: null,
      responsibleUser: null,
      addedByUser: null,
      resolvedByUser: null,
    } as unknown as ComponentProps<typeof WaitingListDetailDrawer>["entry"];

    function Wrapper() {
      const [entry, setEntry] = useState(initialEntry);
      return (
        <WaitingListDetailDrawer
          entry={entry}
          tenantSlug="fc-a"
          canEdit
          canDelete={false}
          eligibleCoordinators={[]}
          onClose={() => undefined}
          onUpdate={(next) => setEntry(next)}
          onDelete={() => undefined}
        />
      );
    }

    render(<Wrapper />);

    expect(await screen.findByText("wrong@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "E-Mail-Adresse ändern" }));

    const input = await screen.findByPlaceholderText("name@example.com");
    await user.clear(input);
    await user.type(input, "correct@example.com");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("correct@example.com")).toBeInTheDocument();
  });
});

