/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeamDocumentsView from "../TeamDocumentsView";
import type { TeamDocumentListItem } from "@/lib/teams/team-document-list";

function createDocument(
  overrides: Partial<TeamDocumentListItem> = {},
): TeamDocumentListItem {
  return {
    id: "doc-1",
    title: "Saisonplan 2026/27",
    originalFilename: "saisonplan.pdf",
    fileTypeLabel: "PDF",
    fileTypeCategory: "pdf",
    sizeLabel: "824 KB",
    uploadedAtLabel: "28.08.2026",
    uploadedByLabel: "Max Muster",
    showOriginalFilename: true,
    ...overrides,
  };
}

describe("TEAM-COCKPIT-PREMIUM-01J-B — TeamDocumentsView", () => {
  it("E. renders page heading and supporting text", () => {
    render(<TeamDocumentsView documents={[]} />);

    expect(screen.getByText("Team Workspace")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-page-heading")).toHaveTextContent(
      "Dokumente",
    );
    expect(
      screen.getByText("Teaminterne Dokumente und Dateien."),
    ).toBeInTheDocument();
  });

  it("F. renders document title as primary element", () => {
    render(<TeamDocumentsView documents={[createDocument()]} />);

    expect(screen.getAllByText("Saisonplan 2026/27").length).toBeGreaterThan(0);
  });

  it("G. shows original filename only when title differs", () => {
    const { rerender } = render(
      <TeamDocumentsView documents={[createDocument({ showOriginalFilename: true })]} />,
    );

    expect(screen.getAllByText("saisonplan.pdf").length).toBeGreaterThan(0);

    rerender(
      <TeamDocumentsView
        documents={[
          createDocument({
            title: "saisonplan.pdf",
            showOriginalFilename: false,
          }),
        ]}
      />,
    );

    expect(screen.queryByTestId("team-document-filename-doc-1")).not.toBeInTheDocument();
  });

  it("H/I/J/K. renders type, size, date, and uploader metadata", () => {
    render(
      <TeamDocumentsView
        documents={[
          createDocument({
            showOriginalFilename: false,
            title: "saisonplan.pdf",
          }),
        ]}
      />,
    );

    expect(screen.getByTestId("team-document-type-doc-1")).toHaveTextContent("PDF");
    expect(screen.getByTestId("team-document-size-doc-1")).toHaveTextContent("824 KB");
    expect(screen.getByTestId("team-document-date-doc-1")).toHaveTextContent(
      "28.08.2026",
    );
    expect(screen.getByTestId("team-document-uploader-doc-1")).toHaveTextContent(
      "Max Muster",
    );
  });

  it("L. uses neutral fallback when uploader is missing", () => {
    render(
      <TeamDocumentsView
        documents={[createDocument({ uploadedByLabel: null })]}
      />,
    );

    expect(screen.getByTestId("team-document-uploader-doc-1")).toHaveTextContent("—");
    expect(
      screen.queryByTestId("team-document-mobile-uploader-doc-1"),
    ).not.toBeInTheDocument();
  });

  it("M. renders multiple documents in provided order", () => {
    render(
      <TeamDocumentsView
        documents={[
          createDocument({ id: "doc-a", title: "Alpha" }),
          createDocument({ id: "doc-b", title: "Beta" }),
        ]}
      />,
    );

    const rows = screen.getAllByTestId(/^team-document-row-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "team-document-row-doc-a",
      "team-document-row-doc-b",
    ]);
  });

  it("N. renders premium empty state without upload CTA", () => {
    render(<TeamDocumentsView documents={[]} />);

    expect(screen.getByTestId("team-documents-empty")).toHaveTextContent(
      "Keine Dokumente vorhanden.",
    );
    expect(screen.getByTestId("team-documents-empty")).toHaveTextContent(
      "Dateien für dieses Team werden hier angezeigt.",
    );
    expect(screen.queryByRole("button", { name: /hochladen/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Datei hochladen/i)).not.toBeInTheDocument();
  });

  it("O/P. does not render storage keys or blob URLs", () => {
    const { container } = render(
      <TeamDocumentsView
        documents={[
          createDocument({
            title: "Interner Bericht",
            originalFilename: "bericht.pdf",
          }),
        ]}
      />,
    );

    expect(container.innerHTML).not.toContain("storageKey");
    expect(container.innerHTML).not.toMatch(/blob:/i);
    expect(container.innerHTML).not.toMatch(/vercel-storage/i);
    expect(container.innerHTML).not.toContain("_storageKey");
  });

  it("Q/R/S/T. does not render mutation or download controls", () => {
    render(<TeamDocumentsView documents={[createDocument()]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/löschen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/umbenennen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/herunterladen/i)).not.toBeInTheDocument();
  });

  it("U. preserves mobile title/type/size/date structure", () => {
    render(<TeamDocumentsView documents={[createDocument()]} />);

    const mobileItem = screen.getByTestId("team-document-mobile-doc-1");
    expect(within(mobileItem).getByText("Saisonplan 2026/27")).toBeInTheDocument();
    expect(screen.getByTestId("team-document-mobile-type-doc-1")).toHaveTextContent(
      "PDF",
    );
    expect(screen.getByTestId("team-document-mobile-size-doc-1")).toHaveTextContent(
      "824 KB",
    );
    expect(screen.getByTestId("team-document-mobile-date-doc-1")).toHaveTextContent(
      "28.08.2026",
    );
  });

  it("uses semantic table structure on desktop", () => {
    render(<TeamDocumentsView documents={[createDocument()]} />);

    expect(screen.getByTestId("team-documents-table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Grösse" })).toBeInTheDocument();
  });

  it("renders workspace-style navigation and details panels on desktop", () => {
    render(<TeamDocumentsView documents={[createDocument()]} />);

    expect(screen.getByTestId("team-documents-workspace-grid")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-nav-panel")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-nav-all")).toHaveTextContent(
      "Alle Dokumente",
    );
    expect(screen.getByTestId("team-documents-details-panel")).toBeInTheDocument();
    expect(screen.getByTestId("team-documents-no-selection")).toHaveTextContent(
      "Kein Dokument ausgewählt.",
    );
    expect(screen.getByTestId("team-documents-center-panel")).toBeInTheDocument();
  });

  it("uses list semantics on mobile", () => {
    render(<TeamDocumentsView documents={[createDocument()]} />);

    expect(screen.getByTestId("team-documents-mobile-list")).toBeInTheDocument();
  });
});
