import Link from "next/link";

type Screen1AcceptancePreviewNavProps = {
  active: "mixed" | "tournament";
};

/**
 * Unobtrusive scenario switcher for the Screen 1 acceptance preview routes.
 * Fixed in the corner so the 1920×1080 board layout stays representative.
 */
export function Screen1AcceptancePreviewNav({
  active,
}: Screen1AcceptancePreviewNavProps) {
  return (
    <nav
      aria-label="Preview scenarios"
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 9999,
        display: "flex",
        gap: 8,
        fontSize: 12,
        opacity: 0.55,
      }}
    >
      <Link
        href="/infoboard/screen-1/preview"
        aria-current={active === "mixed" ? "page" : undefined}
      >
        Mixed
      </Link>
      <Link
        href="/infoboard/screen-1/preview/tournament"
        aria-current={active === "tournament" ? "page" : undefined}
      >
        4-Team Turnier
      </Link>
    </nav>
  );
}
