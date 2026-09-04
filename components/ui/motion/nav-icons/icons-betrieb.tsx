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

export function PlanungIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="planung" {...props}>
      <StrokeRect x="4" y="5" width="16" height="15" rx="2" className="ani-cal-frame" />
      <StrokeLine x1="4" y1="9" x2="20" y2="9" className="ani-cal-header" />
      <StrokeLine x1="8" y1="3" x2="8" y2="7" className="ani-cal-pin ani-cal-pin-1" />
      <StrokeLine x1="16" y1="3" x2="16" y2="7" className="ani-cal-pin ani-cal-pin-2" />
      <StrokeCircle cx="12" cy="14" r="1.5" className="ani-cal-marker" fill="currentColor" />
      <CopperFlow d="M8 14h8" className="ani-cal-copper" />
    </NavIconSvg>
  );
}

export function TrainingcenterIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="trainingcenter" {...props}>
      <StrokePath d="M6 10h12l-1 8H7l-1-8z" className="ani-dumbbell-bar" />
      <StrokeRect x="4" y="8" width="3" height="4" rx="1" className="ani-dumbbell-weight ani-dumbbell-weight-1" />
      <StrokeRect x="17" y="8" width="3" height="4" rx="1" className="ani-dumbbell-weight ani-dumbbell-weight-2" />
      <StrokeLine x1="12" y1="10" x2="12" y2="6" className="ani-training-pulse" />
    </NavIconSvg>
  );
}

export function MatchcenterIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="matchcenter" {...props}>
      <StrokeCircle cx="12" cy="12" r="7" className="ani-match-pitch" />
      <StrokeLine x1="12" y1="5" x2="12" y2="19" className="ani-match-center" />
      <StrokePath d="M8 12l2 2 4-4" className="ani-match-trajectory" />
    </NavIconSvg>
  );
}

export function TournamentcenterIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="tournamentcenter" {...props}>
      <StrokePath d="M8 6h8l-1 5H9L8 6z" className="ani-trophy-cup" />
      <StrokePath d="M7 11h10v2c0 2-2 4-5 4s-5-2-5-4v-2z" className="ani-trophy-base" />
      <StrokeLine x1="12" y1="17" x2="12" y2="20" className="ani-trophy-stem" />
      <StrokeLine x1="9" y1="20" x2="15" y2="20" className="ani-trophy-foot" />
      <StrokeLine x1="9" y1="7" x2="15" y2="7" className="ani-trophy-highlight" />
    </NavIconSvg>
  );
}

export function VeranstaltungenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="veranstaltungen" {...props}>
      <StrokeRect x="5" y="4" width="14" height="16" rx="2" className="ani-event-page" />
      <StrokeLine x1="8" y1="9" x2="16" y2="9" className="ani-event-line" />
      <StrokeLine x1="8" y1="13" x2="14" y2="13" className="ani-event-line ani-event-line-2" />
      <StrokeCircle cx="16" cy="17" r="1.5" className="ani-event-marker" fill="currentColor" />
    </NavIconSvg>
  );
}

export function WochenplannerIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="wochenplanner" {...props}>
      <StrokeLine x1="6" y1="6" x2="6" y2="18" className="ani-week-col ani-week-col-1" />
      <StrokeLine x1="10" y1="6" x2="10" y2="18" className="ani-week-col ani-week-col-2" />
      <StrokeLine x1="14" y1="6" x2="14" y2="18" className="ani-week-col ani-week-col-3" />
      <StrokeLine x1="18" y1="6" x2="18" y2="18" className="ani-week-col ani-week-col-4" />
      <StrokeLine x1="4" y1="6" x2="20" y2="6" className="ani-week-header" />
    </NavIconSvg>
  );
}

export function DokumenteIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="dokumente" {...props}>
      <StrokePath d="M5 7a2 2 0 0 1 2-2h6l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" className="ani-folder-body" />
      <StrokePath d="M11 5v4h4" className="ani-folder-tab" />
      <StrokeLine x1="8" y1="13" x2="16" y2="13" className="ani-folder-doc" />
      <CopperFlow d="M8 16h8" className="ani-folder-copper" />
    </NavIconSvg>
  );
}

export function AnmeldungenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="anmeldungen" {...props}>
      <StrokePath d="M4 6h16v12H4V6z" className="ani-inbox" />
      <StrokePath d="M4 6l8 6 8-6" className="ani-inbox-flap" />
      <StrokePath d="M14 14h4v4h-4z" className="ani-inbox-doc" />
    </NavIconSvg>
  );
}

export function RegistrierungenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="registrierungen" {...props}>
      <StrokeRect x="5" y="4" width="14" height="16" rx="2" className="ani-entry-form" />
      <StrokePath d="M8 12l2 2 5-5" className="ani-entry-check" />
    </NavIconSvg>
  );
}

export function WartelisteIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="warteliste" {...props}>
      <StrokeRect x="5" y="6" width="14" height="3" rx="1" className="ani-queue-item ani-queue-item-1" />
      <StrokeRect x="5" y="11" width="14" height="3" rx="1" className="ani-queue-item ani-queue-item-2" />
      <StrokeRect x="5" y="16" width="14" height="3" rx="1" className="ani-queue-item ani-queue-item-3" />
    </NavIconSvg>
  );
}

export function ArchivIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="archiv" {...props}>
      <StrokePath d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" className="ani-archive-box" />
      <StrokePath d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" className="ani-archive-lid" />
      <StrokeRect x="10" y="4" width="4" height="3" rx="0.5" className="ani-archive-item" />
    </NavIconSvg>
  );
}

export function KommunikationIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="kommunikation" {...props}>
      <StrokePath d="M4 7h16v10H4V7z" className="ani-envelope-body" />
      <StrokePath d="M4 7l8 6 8-6" className="ani-envelope-flap" />
      <CopperFlow d="M12 13c2 0 4 1 6 3" className="ani-envelope-wave" />
    </NavIconSvg>
  );
}

export function EmailAbsenderIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="email-absender" {...props}>
      <StrokePath d="M3 8h12l3 3v7H3V8z" className="ani-send-envelope" />
      <StrokeLine x1="15" y1="11" x2="21" y2="11" className="ani-send-arrow" />
      <StrokePath d="M19 9l2 2-2 2" className="ani-send-arrowhead" />
      <CopperFlow d="M15 11h6" className="ani-send-copper" />
    </NavIconSvg>
  );
}
