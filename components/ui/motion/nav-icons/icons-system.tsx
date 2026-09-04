import type { NavIconSvgProps } from "../motion-primitives";
import {
  NavIconSvg,
  StrokeCircle,
  StrokeLine,
  StrokePath,
  StrokeRect,
} from "../motion-primitives";

type IconProps = Omit<NavIconSvgProps, "iconKey" | "children">;

export function InfoboardIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="infoboard" {...props}>
      <StrokeRect x="3" y="5" width="18" height="12" rx="2" className="ani-monitor-frame" />
      <StrokeLine x1="8" y1="19" x2="16" y2="19" className="ani-monitor-stand" />
      <StrokeLine x1="12" y1="17" x2="12" y2="19" className="ani-monitor-neck" />
      <StrokeLine x1="7" y1="10" x2="17" y2="10" className="ani-monitor-content" />
    </NavIconSvg>
  );
}

export function UebersichtIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="uebersicht" {...props}>
      <StrokeRect x="4" y="4" width="7" height="5" rx="1" className="ani-overview-tile ani-overview-tile-1" />
      <StrokeRect x="13" y="4" width="7" height="5" rx="1" className="ani-overview-tile ani-overview-tile-2" />
      <StrokeRect x="4" y="11" width="16" height="9" rx="1" className="ani-overview-tile ani-overview-tile-3" />
    </NavIconSvg>
  );
}

export function VorschauIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="vorschau" {...props}>
      <StrokeRect x="3" y="6" width="14" height="10" rx="2" className="ani-preview-screen" />
      <StrokePath d="M17 10l4-2v8l-4-2" className="ani-preview-play" />
    </NavIconSvg>
  );
}

export function MeetingsIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="meetings" {...props}>
      <StrokePath d="M6 4h12v16H6V4z" className="ani-scroll-body" />
      <StrokeLine x1="9" y1="9" x2="15" y2="9" className="ani-scroll-line ani-scroll-line-1" />
      <StrokeLine x1="9" y1="13" x2="15" y2="13" className="ani-scroll-line ani-scroll-line-2" />
      <StrokePath d="M6 4c0-1 1-2 2-2" className="ani-scroll-top" />
    </NavIconSvg>
  );
}

export function ClubEntwicklungIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="club-entwicklung" {...props}>
      <StrokePath d="M4 18L12 6l8 12" className="ani-trend-line" />
      <StrokeCircle cx="12" cy="6" r="1.5" className="ani-trend-point ani-trend-point-1" fill="currentColor" />
      <StrokeCircle cx="18" cy="14" r="1.5" className="ani-trend-point ani-trend-point-2" fill="currentColor" />
    </NavIconSvg>
  );
}

export function ZieleIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="ziele" {...props}>
      <StrokeCircle cx="12" cy="12" r="7" className="ani-goal-ring" />
      <StrokeLine x1="12" y1="5" x2="12" y2="12" className="ani-goal-arrow" />
      <StrokeLine x1="12" y1="12" x2="16" y2="16" className="ani-goal-arrow ani-goal-arrow-2" />
    </NavIconSvg>
  );
}

export function InitiativenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="initiativen" {...props}>
      <StrokeLine x1="6" y1="18" x2="12" y2="6" className="ani-flag-pole" />
      <StrokePath d="M12 6h6l-2 4 2 4h-6" className="ani-flag-cloth" />
    </NavIconSvg>
  );
}

export function ProzesseAufgabenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="prozesse-aufgaben" {...props}>
      <StrokeRect x="5" y="4" width="14" height="16" rx="2" className="ani-clipboard" />
      <StrokeLine x1="9" y1="9" x2="15" y2="9" className="ani-clipboard-line ani-clipboard-line-1" />
      <StrokeLine x1="9" y1="13" x2="15" y2="13" className="ani-clipboard-line ani-clipboard-line-2" />
      <StrokePath d="M9 17h4" className="ani-clipboard-line ani-clipboard-line-3" />
    </NavIconSvg>
  );
}

export function MaterialInventarIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="material-inventar" {...props}>
      <StrokePath d="M12 3l8 4v10l-8 4-8-4V7l8-4z" className="ani-package-box" />
      <StrokeLine x1="12" y1="11" x2="12" y2="17" className="ani-package-seam" />
      <StrokeLine x1="8" y1="9" x2="16" y2="9" className="ani-package-tape" />
    </NavIconSvg>
  );
}

export function FinanzenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="finanzen" {...props}>
      <StrokePath d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" className="ani-wallet-body" />
      <StrokePath d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" className="ani-wallet-fold" />
      <StrokeCircle cx="16" cy="13" r="1.5" className="ani-wallet-clasp" />
    </NavIconSvg>
  );
}

export function SponsoringIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="sponsoring" {...props}>
      <StrokePath d="M8 12a4 4 0 0 1 8 0" className="ani-handshake-1" />
      <StrokePath d="M7 14c1 2 3 3 5 3s4-1 5-3" className="ani-handshake-2" />
      <StrokeLine x1="6" y1="10" x2="8" y2="12" className="ani-handshake-connect" />
      <StrokeLine x1="18" y1="10" x2="16" y2="12" className="ani-handshake-connect ani-handshake-connect-2" />
    </NavIconSvg>
  );
}

export function AdministrationIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="administration" {...props}>
      <StrokeRect x="4" y="4" width="16" height="16" rx="2" className="ani-admin-frame" />
      <StrokeCircle cx="12" cy="12" r="3" className="ani-admin-gear" />
      <StrokePath
        d="M12 7v1M12 16v1M7 12h1M16 12h1"
        className="ani-admin-gear-teeth"
      />
    </NavIconSvg>
  );
}

export function RollenBerechtigungenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="rollen-berechtigungen" {...props}>
      <StrokePath d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" className="ani-shield" />
      <StrokePath d="M9 12l2 2 4-4" className="ani-shield-check" />
    </NavIconSvg>
  );
}

export function SaisonsIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="saisons" {...props}>
      <StrokeRect x="4" y="6" width="16" height="14" rx="2" className="ani-season-cal" />
      <StrokeLine x1="4" y1="10" x2="20" y2="10" className="ani-season-divider" />
      <StrokeLine x1="8" y1="4" x2="8" y2="8" className="ani-season-pin" />
      <StrokeLine x1="16" y1="4" x2="16" y2="8" className="ani-season-pin ani-season-pin-2" />
    </NavIconSvg>
  );
}

export function AnlagenRessourcenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="anlagen-ressourcen" {...props}>
      <StrokePath d="M5 18V8l7-4 7 4v10" className="ani-facility-building" />
      <StrokeRect x="9" y="12" width="6" height="6" className="ani-facility-door" />
      <StrokeLine x1="12" y1="4" x2="12" y2="8" className="ani-facility-antenna" />
    </NavIconSvg>
  );
}

export function DarstellungIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="darstellung" {...props}>
      <StrokeCircle cx="12" cy="12" r="8" className="ani-palette-ring" />
      <StrokeCircle cx="9" cy="10" r="1.5" className="ani-palette-dot ani-palette-dot-1" fill="currentColor" />
      <StrokeCircle cx="14" cy="9" r="1.5" className="ani-palette-dot ani-palette-dot-2" fill="currentColor" />
      <StrokeCircle cx="15" cy="14" r="1.5" className="ani-palette-dot ani-palette-dot-3" fill="currentColor" />
    </NavIconSvg>
  );
}

export function BenutzerIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="benutzer" {...props}>
      <StrokeCircle cx="9" cy="8" r="2.5" className="ani-users-head ani-users-head-1" />
      <StrokeCircle cx="15" cy="9" r="2" className="ani-users-head ani-users-head-2" />
      <StrokePath d="M5 18c0-2 1.5-3.5 4-3.5" className="ani-users-body ani-users-body-1" />
      <StrokePath d="M19 18c0-1.5-1-2.5-2.5-2.5" className="ani-users-body ani-users-body-2" />
    </NavIconSvg>
  );
}

export function RollenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="rollen" {...props}>
      <StrokePath d="M12 4l6 3v5c0 3.5-2.5 6-6 8-3.5-2-6-4.5-6-8V7l6-3z" className="ani-role-shield" />
      <StrokeLine x1="12" y1="9" x2="12" y2="14" className="ani-role-mark" />
    </NavIconSvg>
  );
}

export function TenantsIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="tenants" {...props}>
      <StrokeCircle cx="12" cy="12" r="8" className="ani-tenant-globe" />
      <StrokePath d="M4 12h16" className="ani-tenant-lat" />
      <StrokePath d="M12 4c2.5 2.5 2.5 13.5 0 16" className="ani-tenant-lon" />
    </NavIconSvg>
  );
}

export function IntegrationenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="integrationen" {...props}>
      <StrokeRect x="3" y="8" width="6" height="8" rx="1" className="ani-plug ani-plug-1" />
      <StrokeRect x="15" y="8" width="6" height="8" rx="1" className="ani-plug ani-plug-2" />
      <StrokeLine x1="9" y1="12" x2="15" y2="12" className="ani-plug-connector" />
      <StrokeCircle cx="12" cy="12" r="1" className="ani-plug-node" fill="currentColor" />
    </NavIconSvg>
  );
}
