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
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadWorkspaceFile: vi.fn(),
  routerRefresh: vi.fn(),
  onUploadComplete: vi.fn(),
}));

vi.mock(
  "@/lib/workspace/upload-client",
  () => ({
    uploadWorkspaceFile: mocks.uploadWorkspaceFile,
    WorkspaceUploadError: class WorkspaceUploadError extends Error {
      readonly code: string | undefined;

      constructor(message: string, code?: string) {
        super(message);
        this.name = "WorkspaceUploadError";
        this.code = code;
      }
    },
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.routerRefresh,
    push: vi.fn(),
  }),
}));

import { WorkspaceUploadControls } from "@/components/admin/workspace/WorkspaceUploadControls";

function renderControls(folderId = "folder-1") {
  render(
    <WorkspaceUploadControls
      folderId={folderId}
      onUploadComplete={mocks.onUploadComplete}
    />,
  );
}

function getFileInput(): HTMLInputElement {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="file"]',
  );
  if (inputs.length === 0) throw new Error("No file input found");
  return inputs[0];
}

function makeFile(
  name = "report.pdf",
  type = "application/pdf",
): File {
  return new File(["content"], name, { type });
}

describe("WorkspaceUploadControls – upload flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a file input for browsing", () => {
    renderControls();

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(fileInputs.length).toBeGreaterThan(0);
  });

  it("renders the dropzone area", () => {
    renderControls();

    expect(
      screen.getByText(/datei hier ablegen oder klicken/i),
    ).toBeTruthy();
  });

  it("calls uploadWorkspaceFile with the file and folderId on file selection", async () => {
    mocks.uploadWorkspaceFile.mockResolvedValue({ document: {} });

    renderControls("folder-test");

    const input = getFileInput();
    const file = makeFile();

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(
        mocks.uploadWorkspaceFile,
      ).toHaveBeenCalledWith({
        file,
        folderId: "folder-test",
      });
    });
  });

  it("calls onUploadComplete after a successful upload", async () => {
    mocks.uploadWorkspaceFile.mockResolvedValue({
      document: { id: "doc-123", name: "report.pdf" },
    });

    renderControls();

    const input = getFileInput();

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      expect(mocks.onUploadComplete).toHaveBeenCalledWith(
        "doc-123",
      );
    });
  });

  it("resets the file input after a successful upload", async () => {
    mocks.uploadWorkspaceFile.mockResolvedValue({ document: {} });

    renderControls();

    const input = getFileInput();
    Object.defineProperty(input, "value", {
      writable: true,
      value: "C:\\fakepath\\report.pdf",
    });

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("resets the file input after a failed upload", async () => {
    mocks.uploadWorkspaceFile.mockRejectedValue(
      new Error("Upload fehlgeschlagen."),
    );

    renderControls();

    const input = getFileInput();
    Object.defineProperty(input, "value", {
      writable: true,
      value: "C:\\fakepath\\report.pdf",
    });

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("shows an error message when the upload fails", async () => {
    mocks.uploadWorkspaceFile.mockRejectedValue(
      new Error("Die Datei konnte nicht gespeichert werden."),
    );

    renderControls();

    const input = getFileInput();

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("alert").length,
      ).toBeGreaterThan(0);
    });
  });

  it("does not call onUploadComplete after a failed upload", async () => {
    mocks.uploadWorkspaceFile.mockRejectedValue(
      new Error("Upload failed."),
    );

    renderControls();

    await act(async () => {
      fireEvent.change(getFileInput(), {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      expect(
        screen.getAllByRole("alert").length,
      ).toBeGreaterThan(0);
    });

    expect(mocks.onUploadComplete).not.toHaveBeenCalled();
  });

  it("shows the storage-not-configured error code message", async () => {
    const { WorkspaceUploadError } = await import(
      "@/lib/workspace/upload-client"
    );

    mocks.uploadWorkspaceFile.mockRejectedValue(
      new WorkspaceUploadError(
        "raw",
        "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
      ),
    );

    renderControls();

    await act(async () => {
      fireEvent.change(getFileInput(), {
        target: { files: [makeFile()] },
      });
    });

    await waitFor(() => {
      const alerts = screen
        .getAllByRole("alert")
        .map((el: HTMLElement) => el.textContent ?? "");

      expect(
        alerts.some((t: string) =>
          t.includes("Administrator"),
        ),
      ).toBe(true);
    });
  });

  it("enforces one file at a time (single file input, no multiple attribute)", () => {
    renderControls();

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    );
    for (const input of fileInputs) {
      expect(input.multiple).toBe(false);
    }
  });

  it("does not start a new upload while one is already in progress (button input)", async () => {
    let resolveUpload: (() => void) | undefined;

    mocks.uploadWorkspaceFile.mockReturnValue(
      new Promise<{ document: unknown }>((res) => {
        resolveUpload = () => res({ document: {} });
      }),
    );

    renderControls();

    const uploadButton = screen.getByRole("button", {
      name: /datei hochladen/i,
    });

    fireEvent.click(uploadButton);
    fireEvent.click(uploadButton);

    resolveUpload?.();

    await waitFor(() => {
      expect(
        mocks.uploadWorkspaceFile,
      ).toHaveBeenCalledTimes(0);
    });
  });
});
