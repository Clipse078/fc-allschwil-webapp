/**
 * @vitest-environment jsdom
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  createRootWorkspaceFolderAction: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock(
  "@/app/(admin)/dashboard/workspace/actions",
  () => ({
    createRootWorkspaceFolderAction:
      mocks.createRootWorkspaceFolderAction,
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    refresh: vi.fn(),
  }),
}));

// Mock next-intl so the component renders without a provider.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    (key: string, _params?: Record<string, unknown>) => `${namespace}.${key}`,
}));

import { CreateRootFolderDialog } from "@/components/admin/workspace/CreateRootFolderDialog";

function renderDialog() {
  render(<CreateRootFolderDialog />);
}

/** Helper: type into the folder name input via fireEvent. */
function typeIntoInput(value: string) {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
  return input;
}

describe("CreateRootFolderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Create Folder trigger button with translated label", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    ).toBeTruthy();
  });

  it("renders the translated button label from next-intl", () => {
    renderDialog();

    // The Create Folder button is now icon-only with aria-label.
    // Verify the trigger button exists and has the correct accessible name.
    expect(
      screen.getByRole("button", {
        name: /Workspace\.createFolder\.buttonLabel/i,
      }),
    ).toBeTruthy();
  });

  it("does not show the dialog before the trigger is clicked", () => {
    renderDialog();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the dialog when the trigger button is clicked", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Workspace.createFolder.dialogTitle")).toBeTruthy();
  });

  it("renders a visible folder-name input inside the dialog", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).type).toBe("text");
  });

  it("focuses the folder-name input after opening", async () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    const input = screen.getByRole("textbox");

    await waitFor(
      () => {
        expect(document.activeElement).toBe(input);
      },
      { timeout: 500 },
    );
  });

  it("keeps the Create button disabled when the input is empty", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    const createButton = screen.getByRole("button", {
      name: /Workspace\.createFolder\.submitButton/i,
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the Create button disabled when the input is whitespace only", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("   ");

    const createButton = screen.getByRole("button", {
      name: /Workspace\.createFolder\.submitButton/i,
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables the Create button when a non-whitespace name is entered", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    const createButton = screen.getByRole("button", {
      name: /Workspace\.createFolder\.submitButton/i,
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("closes the dialog and does not call the action when Cancel is clicked", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.cancelButton/i }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      mocks.createRootWorkspaceFolderAction,
    ).not.toHaveBeenCalled();
  });

  it("closes the dialog when Escape is pressed", async () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    expect(
      mocks.createRootWorkspaceFolderAction,
    ).not.toHaveBeenCalled();
  });

  it("trims whitespace before calling the action", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: true,
      data: { id: "folder-1" },
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("  Finance Docs  ");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(
        mocks.createRootWorkspaceFolderAction,
      ).toHaveBeenCalledTimes(1);
    });

    const formData: FormData =
      mocks.createRootWorkspaceFolderAction.mock.calls[0][0];
    expect(formData.get("name")).toBe("Finance Docs");
  });

  it("closes the dialog on successful creation", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: true,
      data: { id: "folder-new" },
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("My Folder");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("navigates to the new folder on success", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: true,
      data: { id: "folder-abc" },
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("My Folder");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(mocks.routerPush).toHaveBeenCalledWith(
        "/dashboard/workspace?folder=folder-abc",
      );
    });
  });

  it("shows inline conflict message and keeps dialog open on duplicate name", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
      message: "Workspace.createFolder.errorConflict",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance Docs");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    expect(await screen.findByRole("alert")).toBeTruthy();

    expect(
      screen.getByText(
        "Workspace.createFolder.errorConflict",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("does not close the dialog after a typed failure result", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Existing Folder");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("preserves the entered name after a conflict failure", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Finance");
  });

  it("sets aria-invalid on the input when there is an error", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("sets aria-describedby on the input pointing to the error element", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    const input = screen.getByRole("textbox");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();

    const errorElement = document.getElementById(errorId!);
    expect(errorElement).toBeTruthy();
  });

  it("clears the error message when the user edits the input", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    // Editing the input should clear the error
    typeIntoInput("Finance Updated");

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("does not show a production digest error message", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    const bodyText = document.body.textContent ?? "";
    expect(bodyText.toLowerCase()).not.toContain("digest");
    expect(bodyText.toLowerCase()).not.toContain("server component");
    expect(bodyText.toLowerCase()).not.toContain("an error occurred");
  });

  it("shows a sanitized fallback message for unexpected typed failures", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_CREATE_FAILED",
      message: "The folder could not be created. Please try again.",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("New Folder");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(
      screen.getByText(
        "The folder could not be created. Please try again.",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("clears the error message when the dialog is closed and reopened", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await screen.findByRole("alert");

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.cancelButton/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no required attribute on the folder-name input (no native browser validation)", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.required).toBe(false);
  });

  it("uses noValidate on the form to suppress browser-native validation", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    const form = document.querySelector(
      "form#create-root-folder-form",
    ) as HTMLFormElement;

    expect(form).toBeTruthy();
    expect(form.noValidate).toBe(true);
  });

  it("does not call the action a second time when already submitting", async () => {
    let resolveAction: ((v: { ok: true; data: { id: string } }) => void) | undefined;

    mocks.createRootWorkspaceFolderAction.mockReturnValue(
      new Promise<{ ok: true; data: { id: string } }>((res) => {
        resolveAction = res;
      }),
    );

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    const createButton = screen.getByRole("button", {
      name: /Workspace\.createFolder\.submitButton/i,
    });

    // First click starts the transition
    await act(async () => {
      fireEvent.click(createButton);
    });

    // During pending: the submit button caption changes to "Creating…" and is disabled
    await waitFor(() => {
      const submitButton = document.querySelector(
        "button[type='submit'][form='create-root-folder-form']",
      ) as HTMLButtonElement | null;
      expect(submitButton).toBeTruthy();
      expect(submitButton?.disabled).toBe(true);
    });

    resolveAction?.({ ok: true, data: { id: "folder-1" } });

    await waitFor(() => {
      expect(
        mocks.createRootWorkspaceFolderAction,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it("does not navigate on conflict — only navigates on success", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      ok: false,
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /Workspace\.createFolder\.buttonLabel/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Workspace\.createFolder\.submitButton/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(mocks.routerPush).not.toHaveBeenCalled();
  });
});
