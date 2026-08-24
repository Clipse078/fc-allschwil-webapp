import Link from "next/link";

type Screen1AcceptancePreviewNavProps = {
  active:
    | "mixed"
    | "simple-match"
    | "richer-match"
    | "small-tournament"
    | "tournament"
    | "dense";
};

const SCENARIOS = [
  { key: "simple-match", href: "/infoboard/screen-1/preview/simple-match", label: "A Simple" },
  { key: "richer-match", href: "/infoboard/screen-1/preview/richer-match", label: "B Richer" },
  { key: "small-tournament", href: "/infoboard/screen-1/preview/small-tournament", label: "C Small T." },
  { key: "tournament", href: "/infoboard/screen-1/preview/tournament", label: "D 4-Team" },
  { key: "mixed", href: "/infoboard/screen-1/preview", label: "F Mixed" },
  { key: "dense", href: "/infoboard/screen-1/preview/dense", label: "G Dense" },
] as const;

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
        flexWrap: "wrap",
        justifyContent: "flex-end",
        gap: 8,
        maxWidth: 360,
        fontSize: 12,
        opacity: 0.55,
      }}
    >
      {SCENARIOS.map((scenario) => (
        <Link
          key={scenario.key}
          href={scenario.href}
          aria-current={active === scenario.key ? "page" : undefined}
        >
          {scenario.label}
        </Link>
      ))}
    </nav>
  );
}
