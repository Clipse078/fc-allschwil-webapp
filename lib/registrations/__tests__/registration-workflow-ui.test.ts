import { describe, expect, it } from "vitest";
import { RegistrationStatus } from "@prisma/client";
import {
  getRegistrationNextStep,
  resolveRegistrationWorkflowState,
} from "../registration-workflow-ui";
import { isOperationalRegistrationCoordinator } from "../coordinator-queries";

describe("registration-workflow-ui", () => {
  it("derives operational next steps from registration state", () => {
    expect(
      getRegistrationNextStep({
        status: RegistrationStatus.NEW,
        personId: null,
        assignedToUserId: null,
        targetGroupId: null,
      }),
    ).toBe("Team zuweisen oder Vereinsverwaltung prüfen");

    expect(
      getRegistrationNextStep({
        status: RegistrationStatus.CONTACTED,
        personId: "person-1",
      }),
    ).toBe("Entscheidung treffen oder auf Warteliste setzen");
  });

  it("maps registration statuses onto the shared workflow stepper", () => {
    const reviewing = resolveRegistrationWorkflowState({
      status: RegistrationStatus.REVIEWING,
      submittedAt: "2026-01-01T10:00:00.000Z",
    });
    expect(reviewing.currentIndex).toBe(1);
    expect(reviewing.terminal).toBe(false);

    const accepted = resolveRegistrationWorkflowState({
      status: RegistrationStatus.ACCEPTED,
      submittedAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-05T10:00:00.000Z",
    });
    expect(accepted.currentIndex).toBe(4);
    expect(accepted.terminal).toBe(true);
  });
});

describe("isOperationalRegistrationCoordinator", () => {
  it("accepts users with a person link or a non-system permission role", () => {
    expect(
      isOperationalRegistrationCoordinator({
        hasPersonLink: true,
        hasNonSystemPermissionRole: false,
      }),
    ).toBe(true);
    expect(
      isOperationalRegistrationCoordinator({
        hasPersonLink: false,
        hasNonSystemPermissionRole: true,
      }),
    ).toBe(true);
  });

  it("rejects service-only accounts that only qualify via isSystem roles", () => {
    expect(
      isOperationalRegistrationCoordinator({
        hasPersonLink: false,
        hasNonSystemPermissionRole: false,
      }),
    ).toBe(false);
  });
});
