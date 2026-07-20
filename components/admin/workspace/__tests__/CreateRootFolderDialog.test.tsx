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

import { CreateRootFolderDialog } from "@/components/admin/workspace/CreateRootFolderDialog";

function renderDialog(props: { buttonLabel?: string } = {}) {
  render(<CreateRootFolderDialog {...props} />);
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

  it("renders the Create Folder trigger button", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: /create folder/i }),
    ).toBeTruthy();
  });

  it("accepts a custom button label", () => {
    renderDialog({ buttonLabel: "Neuer Ordner" });

    expect(
      screen.getByRole("button", { name: /neuer ordner/i }),
    ).toBeTruthy();
  });

  it("does not show the dialog before the trigger is clicked", () => {
    renderDialog();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the dialog when the trigger button is clicked", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Create folder")).toBeTruthy();
  });

  it("renders a visible folder-name input inside the dialog", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).type).toBe("text");
  });

  it("focuses the folder-name input after opening", async () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
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
      screen.getByRole("button", { name: /create folder/i }),
    );

    const createButton = screen.getByRole("button", {
      name: /^create$/i,
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the Create button disabled when the input is whitespace only", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("   ");

    const createButton = screen.getByRole("button", {
      name: /^create$/i,
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables the Create button when a non-whitespace name is entered", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("Finance");

    const createButton = screen.getByRole("button", {
      name: /^create$/i,
    });
    expect((createButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("closes the dialog and does not call the action when Cancel is clicked", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /cancel/i }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      mocks.createRootWorkspaceFolderAction,
    ).not.toHaveBeenCalled();
  });

  it("closes the dialog when Escape is pressed", async () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
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
      id: "folder-1",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("  Finance Docs  ");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^create$/i }),
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
      id: "folder-new",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("My Folder");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^create$/i }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("navigates to the new folder on success", async () => {
    mocks.createRootWorkspaceFolderAction.mockResolvedValue({
      id: "folder-abc",
    });

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("My Folder");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^create$/i }),
      );
    });

    await waitFor(() => {
      expect(mocks.routerPush).toHaveBeenCalledWith(
        "/dashboard/workspace?folder=folder-abc",
      );
    });
  });

  it("shows a server-side error inside the dialog without closing it", async () => {
    mocks.createRootWorkspaceFolderAction.mockRejectedValue(
      new Error(
        "In diesem Ordner existiert bereits ein Ordner mit diesem Namen.",
      ),
    );

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("Finance Docs");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^create$/i }),
      );
    });

    expect(await screen.findByRole("alert")).toBeTruthy();

    expect(
      screen.getByText(
        "In diesem Ordner existiert bereits ein Ordner mit diesem Namen.",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("clears the error message when the dialog is closed and reopened", async () => {
    mocks.createRootWorkspaceFolderAction.mockRejectedValue(
      new Error("Something went wrong."),
    );

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("Finance");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^create$/i }),
      );
    });

    await screen.findByRole("alert");

    fireEvent.click(
      screen.getByRole("button", { name: /cancel/i }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has no required attribute on the folder-name input (no native browser validation)", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.required).toBe(false);
  });

  it("uses noValidate on the form to suppress browser-native validation", () => {
    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    const form = document.querySelector(
      "form#create-root-folder-form",
    ) as HTMLFormElement;

    expect(form).toBeTruthy();
    expect(form.noValidate).toBe(true);
  });

  it("does not call the action a second time when already submitting", async () => {
    let resolveAction: ((v: { id: string }) => void) | undefined;

    mocks.createRootWorkspaceFolderAction.mockReturnValue(
      new Promise<{ id: string }>((res) => {
        resolveAction = res;
      }),
    );

    renderDialog();

    fireEvent.click(
      screen.getByRole("button", { name: /create folder/i }),
    );

    typeIntoInput("Finance");

    const createButton = screen.getByRole("button", {
      name: /^create$/i,
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

    resolveAction?.({ id: "folder-1" });

    await waitFor(() => {
      expect(
        mocks.createRootWorkspaceFolderAction,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
