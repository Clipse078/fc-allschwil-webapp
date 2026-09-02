/**
 * lib/infoboard/screen2-body-shell-sizing.ts
 *
 * INFOBOARD-TRANSPORT-01B — deterministic three-column Screen 2 body geometry
 * for the 1920×1080 logical kiosk canvas.
 *
 * Layout: LEFT SPONSOR | CENTER CONTENT | RIGHT SPONSOR
 * Target rail share: ~19% each, center ~62%, with fixed column gaps.
 */

import {
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
} from "@/lib/infoboard/kiosk-viewport";
import {
  KIOSK_SHELL_FOOTER_HEIGHT_PX,
  KIOSK_SHELL_HEADER_BORDER_PX,
  KIOSK_SHELL_HEADER_HEIGHT_PX,
  KIOSK_SHELL_SUBTITLE_HEIGHT_PX,
} from "@/lib/infoboard/kiosk-shell-sizing";

/** Horizontal padding inside the Screen 2 body shell. */
export const SCREEN2_BODY_PADDING_X_PX = 16;

/** Vertical padding inside the Screen 2 body shell. */
export const SCREEN2_BODY_PADDING_Y_PX = 8;

/** Gap between sponsor rails and the center column. */
export const SCREEN2_BODY_COLUMN_GAP_PX = 12;

/** Target left/right rail width share of the column area (each). */
export const SCREEN2_SPONSOR_RAIL_SHARE = 0.19;

/** Target center column width share of the column area. */
export const SCREEN2_CENTER_SHARE = 0.62;

const SCREEN2_BODY_INNER_WIDTH_PX =
  KIOSK_LOGICAL_WIDTH - SCREEN2_BODY_PADDING_X_PX * 2;

const SCREEN2_BODY_COLUMNS_AREA_PX =
  SCREEN2_BODY_INNER_WIDTH_PX - SCREEN2_BODY_COLUMN_GAP_PX * 2;

/** Fixed left sponsor rail width at the logical canvas. */
export const SCREEN2_SPONSOR_RAIL_WIDTH_PX = Math.round(
  SCREEN2_BODY_COLUMNS_AREA_PX * SCREEN2_SPONSOR_RAIL_SHARE,
);

/** Fixed right sponsor rail width at the logical canvas. */
export const SCREEN2_RIGHT_SPONSOR_RAIL_WIDTH_PX = SCREEN2_SPONSOR_RAIL_WIDTH_PX;

/** Fixed center column width at the logical canvas. */
export const SCREEN2_CENTER_WIDTH_PX =
  SCREEN2_BODY_COLUMNS_AREA_PX -
  SCREEN2_SPONSOR_RAIL_WIDTH_PX -
  SCREEN2_RIGHT_SPONSOR_RAIL_WIDTH_PX;

/** Header stack height when the subtitle strip is visible. */
export const SCREEN2_HEADER_STACK_WITH_SUBTITLE_PX =
  KIOSK_SHELL_HEADER_HEIGHT_PX +
  KIOSK_SHELL_HEADER_BORDER_PX +
  KIOSK_SHELL_SUBTITLE_HEIGHT_PX;

/** Available body height inside the logical canvas (subtitle visible). */
export const SCREEN2_BODY_HEIGHT_PX =
  KIOSK_LOGICAL_HEIGHT -
  SCREEN2_HEADER_STACK_WITH_SUBTITLE_PX -
  KIOSK_SHELL_FOOTER_HEIGHT_PX;

/** Inner body height after vertical padding. */
export const SCREEN2_BODY_INNER_HEIGHT_PX =
  SCREEN2_BODY_HEIGHT_PX - SCREEN2_BODY_PADDING_Y_PX * 2;

/** Center zone available height for the Anlageplan map container. */
export const SCREEN2_CENTER_HEIGHT_PX = SCREEN2_BODY_INNER_HEIGHT_PX;

export const SCREEN2_BODY_SHELL_CSS_VARS = {
  "--screen2-body-padding-x": `${SCREEN2_BODY_PADDING_X_PX}px`,
  "--screen2-body-padding-y": `${SCREEN2_BODY_PADDING_Y_PX}px`,
  "--screen2-body-column-gap": `${SCREEN2_BODY_COLUMN_GAP_PX}px`,
  "--screen2-sponsor-rail-width": `${SCREEN2_SPONSOR_RAIL_WIDTH_PX}px`,
  "--screen2-center-width": `${SCREEN2_CENTER_WIDTH_PX}px`,
} as const satisfies Record<string, string>;

export type Screen2BodyShellMeasurementContract = {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly leftRailWidthPx: number;
  readonly centerWidthPx: number;
  readonly rightRailWidthPx: number;
  readonly columnGapPx: number;
  readonly bodyPaddingXPx: number;
  readonly bodyPaddingYPx: number;
  readonly centerHeightPx: number;
};

export const SCREEN2_BODY_SHELL_MEASUREMENT_CONTRACT: Screen2BodyShellMeasurementContract =
  {
    canvasWidth: KIOSK_LOGICAL_WIDTH,
    canvasHeight: KIOSK_LOGICAL_HEIGHT,
    leftRailWidthPx: SCREEN2_SPONSOR_RAIL_WIDTH_PX,
    centerWidthPx: SCREEN2_CENTER_WIDTH_PX,
    rightRailWidthPx: SCREEN2_RIGHT_SPONSOR_RAIL_WIDTH_PX,
    columnGapPx: SCREEN2_BODY_COLUMN_GAP_PX,
    bodyPaddingXPx: SCREEN2_BODY_PADDING_X_PX,
    bodyPaddingYPx: SCREEN2_BODY_PADDING_Y_PX,
    centerHeightPx: SCREEN2_CENTER_HEIGHT_PX,
  };
