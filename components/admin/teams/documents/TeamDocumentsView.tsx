import { FileText, FolderClosed, FolderOpen } from "lucide-react";
import { WorkspaceFileIcon } from "@/components/admin/workspace/WorkspaceFileIcon";
import type { TeamDocumentListItem } from "@/lib/teams/team-document-list";

type Props = {
  documents: TeamDocumentListItem[];
};

function documentCountLabel(count: number): string {
  if (count === 1) return "1 Dokument";
  return `${count} Dokumente`;
}

function TeamDocumentDesktopRow({ document }: { document: TeamDocumentListItem }) {
  return (
    <tr
      data-testid={`team-document-row-${document.id}`}
      className="border-t border-[var(--border)]"
    >
      <td className="w-10 pl-4 pr-1 py-2.5">
        <WorkspaceFileIcon category={document.fileTypeCategory} size="md" />
      </td>
      <td className="min-w-0 px-2 py-2.5 align-top">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-snug text-[var(--text)]">
            {document.title}
          </p>
          {document.showOriginalFilename ? (
            <p
              className="text-xs text-[var(--muted)]"
              data-testid={`team-document-filename-${document.id}`}
            >
              {document.originalFilename}
            </p>
          ) : (
            <p
              className="text-xs text-[var(--muted)]"
              data-testid={`team-document-type-${document.id}`}
            >
              {document.fileTypeLabel}
            </p>
          )}
        </div>
      </td>
      <td
        className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--text-2)]"
        data-testid={`team-document-date-${document.id}`}
      >
        {document.uploadedAtLabel}
      </td>
      <td
        className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-[var(--text-2)]"
        data-testid={`team-document-size-${document.id}`}
      >
        {document.sizeLabel}
      </td>
      <td
        className="px-4 py-2.5 text-xs text-[var(--text-2)]"
        data-testid={`team-document-uploader-${document.id}`}
      >
        {document.uploadedByLabel ?? "—"}
      </td>
    </tr>
  );
}

function TeamDocumentMobileItem({ document }: { document: TeamDocumentListItem }) {
  return (
    <li
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
      data-testid={`team-document-mobile-${document.id}`}
    >
      <article className="flex gap-3">
        <WorkspaceFileIcon
          category={document.fileTypeCategory}
          size="md"
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {document.title}
          </h3>
          {document.showOriginalFilename ? (
            <p
              className="text-xs text-[var(--muted)]"
              data-testid={`team-document-mobile-filename-${document.id}`}
            >
              {document.originalFilename}
            </p>
          ) : null}
          <p
            className="text-sm text-[var(--text-2)]"
            data-testid={`team-document-mobile-meta-${document.id}`}
          >
            <span data-testid={`team-document-mobile-type-${document.id}`}>
              {document.fileTypeLabel}
            </span>
            <span aria-hidden="true"> · </span>
            <span data-testid={`team-document-mobile-size-${document.id}`}>
              {document.sizeLabel}
            </span>
          </p>
          <p
            className="text-sm text-[var(--text-2)]"
            data-testid={`team-document-mobile-date-${document.id}`}
          >
            {document.uploadedAtLabel}
          </p>
          {document.uploadedByLabel ? (
            <p
              className="text-sm text-[var(--muted)]"
              data-testid={`team-document-mobile-uploader-${document.id}`}
            >
              Hochgeladen von {document.uploadedByLabel}
            </p>
          ) : null}
        </div>
      </article>
    </li>
  );
}

function TeamDocumentsEmptyState() {
  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"
      data-testid="team-documents-empty"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--blue)]">
        <FileText className="h-8 w-8" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-base font-semibold text-[var(--text)]">
        Keine Dokumente vorhanden.
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-2)]">
        Dateien für dieses Team werden hier angezeigt.
      </p>
    </div>
  );
}

function TeamDocumentsCenterPanel({ documents }: { documents: TeamDocumentListItem[] }) {
  return (
    <section
      className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      data-testid="team-documents-center-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <p className="text-xs text-[var(--muted)]">
          {documentCountLabel(documents.length)}
        </p>
      </div>

      <div className="flex-1">
        {documents.length === 0 ? (
          <TeamDocumentsEmptyState />
        ) : (
          <>
            <div
              className="hidden overflow-x-auto xl:block"
              data-testid="team-documents-table-wrapper"
            >
              <table
                className="w-full border-collapse text-left"
                data-testid="team-documents-table"
              >
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <th className="w-10 pl-4 pr-2 py-2.5">
                      <span className="sr-only">Dateityp</span>
                    </th>
                    <th className="px-2 py-2.5" scope="col">
                      Name
                    </th>
                    <th className="px-4 py-2.5" scope="col">
                      Hochgeladen
                    </th>
                    <th className="px-4 py-2.5" scope="col">
                      Grösse
                    </th>
                    <th className="px-4 py-2.5" scope="col">
                      Von
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <TeamDocumentDesktopRow key={document.id} document={document} />
                  ))}
                </tbody>
              </table>
            </div>

            <ul
              className="space-y-3 p-4 xl:hidden"
              data-testid="team-documents-mobile-list"
              aria-label="Teamdokumente"
            >
              {documents.map((document) => (
                <TeamDocumentMobileItem key={document.id} document={document} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * TEAM-COCKPIT-PREMIUM-01J-B — read-only team document workspace.
 * Visually aligned with the tenant-level /dashboard/workspace family.
 */
export default function TeamDocumentsView({ documents }: Props) {
  return (
    <div className="space-y-5" data-testid="team-documents-view">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
          Team Workspace
        </p>
        <h2
          className="text-lg font-semibold text-[var(--foreground)]"
          data-testid="team-documents-page-heading"
        >
          Dokumente
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Teaminterne Dokumente und Dateien.
        </p>
      </header>

      <div
        className="grid min-h-[620px] gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]"
        data-testid="team-documents-workspace-grid"
      >
        <aside
          className="hidden flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:flex"
          data-testid="team-documents-nav-panel"
        >
          <div className="shrink-0 border-b border-[var(--border)] px-3 py-3">
            <div className="flex items-center gap-2">
              <FolderClosed
                className="h-4 w-4 text-[var(--muted)]"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-[var(--text)]">Ansicht</h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div
              className="flex items-center gap-2 rounded-md bg-[var(--blue)] px-2 py-1.5 text-sm font-semibold text-white"
              data-testid="team-documents-nav-all"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden="true" />
              <span>Alle Dokumente</span>
            </div>
          </div>
        </aside>

        <TeamDocumentsCenterPanel documents={documents} />

        <aside
          className="hidden flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:flex"
          data-testid="team-documents-details-panel"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-5 py-3.5">
            <FolderClosed className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Details</h3>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 py-8">
            <p
              className="text-sm text-[var(--text-2)]"
              data-testid="team-documents-no-selection"
            >
              Kein Dokument ausgewählt.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
