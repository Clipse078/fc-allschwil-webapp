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

export function WebsiteIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="website" {...props}>
      <StrokeCircle cx="12" cy="12" r="9" className="ani-globe-ring" />
      <StrokePath d="M3 12h18" className="ani-globe-lat ani-globe-lat-1" />
      <StrokePath d="M12 3c3 3 3 15 0 18" className="ani-globe-lon ani-globe-lon-1" />
      <StrokePath d="M12 3c-3 3-3 15 0 18" className="ani-globe-lon ani-globe-lon-2" />
      <CopperFlow d="M4 8c5 2 11 2 16 0" className="ani-globe-copper" />
    </NavIconSvg>
  );
}

export function CmsUebersichtIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="cms-uebersicht" {...props}>
      <StrokeRect x="4" y="4" width="7" height="7" rx="1" className="ani-grid-panel ani-grid-panel-1" />
      <StrokeRect x="13" y="4" width="7" height="7" rx="1" className="ani-grid-panel ani-grid-panel-2" />
      <StrokeRect x="4" y="13" width="7" height="7" rx="1" className="ani-grid-panel ani-grid-panel-3" />
      <StrokeRect x="13" y="13" width="7" height="7" rx="1" className="ani-grid-panel ani-grid-panel-4" />
    </NavIconSvg>
  );
}

export function NewsIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="news" {...props}>
      <StrokeRect x="4" y="4" width="16" height="16" rx="2" className="ani-news-doc" />
      <StrokeLine x1="8" y1="9" x2="16" y2="9" className="ani-news-line ani-news-line-1" />
      <StrokeLine x1="8" y1="13" x2="14" y2="13" className="ani-news-line ani-news-line-2" />
      <StrokeLine x1="8" y1="17" x2="12" y2="17" className="ani-news-line ani-news-line-3" />
      <StrokeCircle cx="18" cy="6" r="1.5" className="ani-news-pulse" fill="currentColor" />
    </NavIconSvg>
  );
}

export function SeitenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="seiten" {...props}>
      <StrokePath d="M7 4h8l3 3v13H7V4z" className="ani-page-back" />
      <StrokePath d="M15 4v3h3" className="ani-page-fold" />
      <StrokePath d="M9 6h4" className="ani-page-layer ani-page-layer-1" />
      <StrokePath d="M9 10h6" className="ani-page-layer ani-page-layer-2" />
    </NavIconSvg>
  );
}

export function HomepageBuilderIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="homepage-builder" {...props}>
      <StrokeRect x="4" y="6" width="6" height="5" rx="1" className="ani-block ani-block-1" />
      <StrokeRect x="11" y="6" width="9" height="5" rx="1" className="ani-block ani-block-2" />
      <StrokeRect x="4" y="13" width="16" height="5" rx="1" className="ani-block ani-block-3" />
    </NavIconSvg>
  );
}

export function NavigationIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="navigation" {...props}>
      <StrokeLine x1="5" y1="7" x2="19" y2="7" className="ani-menu-line ani-menu-line-1" />
      <StrokeLine x1="5" y1="12" x2="15" y2="12" className="ani-menu-line ani-menu-line-2" />
      <StrokeLine x1="5" y1="17" x2="19" y2="17" className="ani-menu-line ani-menu-line-3" />
    </NavIconSvg>
  );
}

export function BlockBibliothekIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="block-bibliothek" {...props}>
      <StrokeRect x="4" y="4" width="7" height="7" rx="1" className="ani-reveal-block ani-reveal-block-1" />
      <StrokeRect x="13" y="4" width="7" height="7" rx="1" className="ani-reveal-block ani-reveal-block-2" />
      <StrokeRect x="4" y="13" width="7" height="7" rx="1" className="ani-reveal-block ani-reveal-block-3" />
      <StrokeRect x="13" y="13" width="7" height="7" rx="1" className="ani-reveal-block ani-reveal-block-4" />
    </NavIconSvg>
  );
}

export function MedienIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="medien" {...props}>
      <StrokeRect x="3" y="5" width="18" height="14" rx="2" className="ani-media-frame" />
      <StrokeCircle cx="9" cy="10" r="2" className="ani-media-inner" />
      <StrokePath d="M7 17l4-4 3 3 3-4 4 5" className="ani-media-reveal" />
    </NavIconSvg>
  );
}

export function RedaktionIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="redaktion" {...props}>
      <StrokePath d="M5 19l3-9 9-3-3 9-9 3z" className="ani-pen-body" />
      <StrokeLine x1="14" y1="7" x2="17" y2="10" className="ani-pen-stroke" />
    </NavIconSvg>
  );
}

export function VeroeffentlichungenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="veroeffentlichungen" {...props}>
      <StrokeRect x="4" y="6" width="12" height="12" rx="1" className="ani-publish-source" />
      <StrokeLine x1="16" y1="12" x2="20" y2="12" className="ani-publish-arrow" />
      <StrokePath d="M18 10l2 2-2 2" className="ani-publish-arrowhead" />
      <StrokeCircle cx="20" cy="12" r="1.5" className="ani-publish-dest" fill="currentColor" />
      <CopperFlow d="M16 12h4" className="ani-publish-copper" />
    </NavIconSvg>
  );
}

export function WiederverwendbareInhalteIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="wiederverwendbare-inhalte" {...props}>
      <StrokePath d="M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" className="ani-reuse-box" />
      <StrokePath d="M10 4h6a2 2 0 0 1 2 2" className="ani-reuse-loop ani-reuse-loop-1" />
      <StrokePath d="M14 20h-6a2 2 0 0 1-2-2" className="ani-reuse-loop ani-reuse-loop-2" />
    </NavIconSvg>
  );
}

export function EinstellungenIcon(props: IconProps) {
  return (
    <NavIconSvg iconKey="einstellungen" {...props}>
      <StrokeCircle cx="12" cy="12" r="3" className="ani-gear-center" />
      <StrokePath
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        className="ani-gear-teeth"
      />
    </NavIconSvg>
  );
}
