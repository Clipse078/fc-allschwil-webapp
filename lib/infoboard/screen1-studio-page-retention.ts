/**
 * Resolves the Studio preview page index after pagination recomputes.
 *
 * Follows the selected card by stable key when present; otherwise clamps the
 * previous numeric page index into the valid range.
 */

export type StudioPageCardRef = {
  readonly key: string;
};

export function resolveStudioPageIndex({
  pages,
  selectedKey,
  previousPageIndex,
}: {
  pages: readonly (readonly StudioPageCardRef[])[];
  selectedKey: string | null;
  previousPageIndex: number;
}): number {
  if (pages.length === 0) return 0;

  if (selectedKey != null) {
    const pageIndex = pages.findIndex((page) =>
      page.some((card) => card.key === selectedKey),
    );
    if (pageIndex >= 0) return pageIndex;
  }

  return Math.min(Math.max(0, previousPageIndex), pages.length - 1);
}
