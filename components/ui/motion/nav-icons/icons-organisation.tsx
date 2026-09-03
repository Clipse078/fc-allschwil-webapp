import type { NavIconSvgProps } from "../motion-primitives";
import {
  CopperFlow,
  NavIconSvg,
  StrokeCircle,
  StrokeLine,
  StrokePath,
  StrokeRect,
} from "../motion-primitives";

type IconProps = Omit<NavIconSvgProps, "iconKey" | "children">;

export function DashboardIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="dashboard" {...props}>
      <StrokeRect x="3" y="3" width="7" height="7" rx="1" className="ani-dash-tile ani-dash-tile-1" />
      <StrokeRect x="14" y="3" width="7" height="5" rx="1" className="ani-dash-tile ani-dash-tile-2" />
      <StrokeRect x="14" y="11" width="7" height="10" rx="1" className="ani-dash-tile ani-dash-tile-3" />
      <StrokeRect x="3" y="13" width="7" height="8" rx="1" className="ani-dash-tile ani-dash-tile-4" />
      <CopperFlow d="M3 10h18" className="ani-dash-copper" />
    </NavIconSvg>
  );
}

export function OrganisationIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="organisation" {...props}>
      <StrokeCircle cx="8" cy="8" r="2.5" className="ani-org-node ani-org-node-1" />
      <StrokeCircle cx="16" cy="8" r="2.5" className="ani-org-node ani-org-node-2" />
      <StrokeCircle cx="12" cy="16" r="2.5" className="ani-org-node ani-org-node-3" />
      <StrokeLine x1="9.5" y1="9.5" x2="10.5" y2="14" className="ani-org-link ani-org-link-1" />
      <StrokeLine x1="14.5" y1="9.5" x2="13.5" y2="14" className="ani-org-link ani-org-link-2" />
      <CopperFlow d="M10 12h4" className="ani-org-copper" />
    </NavIconSvg>
  );
}

export function OrganisationseinheitenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="organisationseinheiten" {...props}>
      <StrokeLine x1="12" y1="4" x2="12" y2="10" className="ani-hier-trunk" />
      <StrokeLine x1="12" y1="10" x2="6" y2="16" className="ani-hier-branch ani-hier-branch-1" />
      <StrokeLine x1="12" y1="10" x2="18" y2="16" className="ani-hier-branch ani-hier-branch-2" />
      <StrokeCircle cx="12" cy="4" r="1.5" className="ani-hier-node ani-hier-node-root" />
      <StrokeCircle cx="6" cy="17" r="1.5" className="ani-hier-node ani-hier-node-1" />
      <StrokeCircle cx="18" cy="17" r="1.5" className="ani-hier-node ani-hier-node-2" />
    </NavIconSvg>
  );
}

export function ZielgruppenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="zielgruppen" {...props}>
      <StrokeCircle cx="12" cy="12" r="8" className="ani-target-ring ani-target-ring-outer" />
      <StrokeCircle cx="12" cy="12" r="5" className="ani-target-ring ani-target-ring-mid" />
      <StrokeCircle cx="12" cy="12" r="1.5" className="ani-target-ring ani-target-center" fill="currentColor" />
    </NavIconSvg>
  );
}

export function TeamsIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="teams" {...props}>
      <StrokeCircle cx="9" cy="8" r="2.5" className="ani-team-node ani-team-node-1" />
      <StrokeCircle cx="15" cy="8" r="2.5" className="ani-team-node ani-team-node-2" />
      <StrokePath d="M5 18c0-2.5 2-4 4-4" className="ani-team-body ani-team-body-1" />
      <StrokePath d="M19 18c0-2.5-2-4-4-4" className="ani-team-body ani-team-body-2" />
      <StrokePath d="M9 18c0-2-1.5-3.5-3-3.5" className="ani-team-body ani-team-body-3" />
    </NavIconSvg>
  );
}

export function AnbieterMappingIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="anbieter-mapping" {...props}>
      <StrokeCircle cx="6" cy="12" r="2.5" className="ani-map-endpoint ani-map-endpoint-1" />
      <StrokeCircle cx="18" cy="12" r="2.5" className="ani-map-endpoint ani-map-endpoint-2" />
      <StrokeLine x1="8.5" y1="12" x2="15.5" y2="12" className="ani-map-line" />
      <CopperFlow d="M8 12h8" className="ani-map-copper" />
    </NavIconSvg>
  );
}

export function VereineIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="vereine" {...props}>
      <StrokePath d="M12 3l7 4v10H5V7l7-4z" className="ani-club-crest" />
      <StrokeLine x1="9" y1="14" x2="15" y2="14" className="ani-club-highlight" />
      <StrokeLine x1="12" y1="7" x2="12" y2="11" className="ani-club-highlight ani-club-highlight-2" />
    </NavIconSvg>
  );
}

export function PersonenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="personen" {...props}>
      <StrokeCircle cx="12" cy="8" r="3" className="ani-person-head" />
      <StrokePath d="M6 19c0-3 2.5-5 6-5s6 2 6 5" className="ani-person-body" />
    </NavIconSvg>
  );
}

export function WettkaempfeIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="wettkaempfe" {...props}>
      <StrokeLine x1="5" y1="12" x2="10" y2="12" className="ani-compete-stroke ani-compete-left" />
      <StrokeLine x1="14" y1="12" x2="19" y2="12" className="ani-compete-stroke ani-compete-right" />
      <StrokeLine x1="10" y1="9" x2="14" y2="15" className="ani-compete-clash" />
      <StrokeLine x1="10" y1="15" x2="14" y2="9" className="ani-compete-clash ani-compete-clash-2" />
    </NavIconSvg>
  );
}
