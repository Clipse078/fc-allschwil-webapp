/**
 * lib/infoboard/widget-types.ts
 *
 * Minimal reusable widget contract for the Infoboard Designer.
 *
 * Design goals:
 *   - Generic enough to support future widgets (Sportanlage, News, etc.)
 *   - Controlled grid model — 12-column, row-based sizing
 *   - No overlapping widgets unless explicitly supported later
 *   - Widget config stores presentation/layout only
 *   - Public renderer resolves live operational data at runtime
 *
 * Anti-patterns avoided:
 *   - No free-form pixel positioning
 *   - No duplication of canonical data (feed, training, match records)
 *   - No arbitrary HTML/CSS editing
 */

// ── Widget types ──────────────────────────────────────────────────────────────

export type WidgetType = "HEADER" | "ACTIVITIES" | "ANNOUNCEMENT";

export const WIDGET_LABELS: Record<WidgetType, string> = {
  HEADER: "Kopfzeile",
  ACTIVITIES: "Tagesübersicht",
  ANNOUNCEMENT: "Hinweisleiste",
};

export const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  HEADER: "Vereinslogo, Name, Uhrzeit und Datum",
  ACTIVITIES: "Heutige Trainings, Spiele und Turniere",
  ANNOUNCEMENT: "Laufende Hinweise und Meldungen",
};

// ── Grid model ────────────────────────────────────────────────────────────────

export const GRID_COLUMNS = 12;
export const WIDGET_MIN_WIDTH = 2;
export const WIDGET_MAX_WIDTH = 12;
export const WIDGET_MIN_HEIGHT = 1;

// ── Widget position / size ────────────────────────────────────────────────────

export type WidgetPosition = {
  /** 0-based column index (0..11 in a 12-column grid) */
  col: number;
  /** 0-based row index */
  row: number;
};

// ── Per-widget settings objects ───────────────────────────────────────────────

/** Settings for the HEADER widget */
export type HeaderWidgetSettings = {
  subtitleEnabled: boolean;
  /** null = use default ("HEUTE AUF DER SPORTANLAGE") */
  subtitleText: string | null;
  showTime: boolean;
  showDate: boolean;
};

/** Settings for the ACTIVITIES widget (no user-configurable settings in Designer-01) */
export type ActivitiesWidgetSettings = Record<string, never>;

/** Settings for the ANNOUNCEMENT widget */
export type AnnouncementWidgetSettings = {
  text: string | null;
  bgColor: string | null;
  textColor: string | null;
};

/** Union of all widget-specific settings */
export type AnyWidgetSettings =
  | HeaderWidgetSettings
  | ActivitiesWidgetSettings
  | AnnouncementWidgetSettings;

// ── Widget instance ───────────────────────────────────────────────────────────

/**
 * A single widget instance in the board layout.
 *
 * Each field:
 *   id       — stable local identifier (not db-generated; just a unique string)
 *   type     — the widget type
 *   enabled  — whether this widget is rendered
 *   position — grid column + row (0-based)
 *   width    — column span (1..12)
 *   height   — row span (1..N)
 *   variant  — controlled design variant ("default" for now)
 *   settings — widget-type-specific config (presentation only)
 */
export type WidgetInstance = {
  id: string;
  type: WidgetType;
  enabled: boolean;
  position: WidgetPosition;
  width: number;
  height: number;
  variant: string;
  settings: Record<string, unknown>;
};

// ── Layout ────────────────────────────────────────────────────────────────────

/**
 * The full layout configuration for a board.
 * Stored as JSON in the Infoboard.layoutJson column.
 */
export type InboardLayout = {
  version: 1;
  widgets: WidgetInstance[];
};

// ── Default layout builder ────────────────────────────────────────────────────

/**
 * Returns the canonical default layout for a TAGESUEBERSICHT board.
 * Derived from the board's existing flat-field settings.
 *
 * Layout for Screen 1:
 *   Row 0: HEADER   (full width, 1 row)
 *   Row 1: ACTIVITIES (full width, 8 rows)
 *   Row 9: ANNOUNCEMENT (full width, 1 row)
 */
export function getDefaultLayout(board: {
  headerSubtitleEnabled: boolean;
  headerSubtitleText: string | null;
  headerShowTime: boolean;
  headerShowDate: boolean;
  announcementEnabled: boolean;
  announcementText: string | null;
  announcementBgColor: string | null;
  announcementTextColor: string | null;
}): InboardLayout {
  return {
    version: 1,
    widgets: [
      {
        id: "w-header",
        type: "HEADER",
        enabled: true,
        position: { col: 0, row: 0 },
        width: 12,
        height: 1,
        variant: "default",
        settings: {
          subtitleEnabled: board.headerSubtitleEnabled,
          subtitleText: board.headerSubtitleText,
          showTime: board.headerShowTime,
          showDate: board.headerShowDate,
        } satisfies HeaderWidgetSettings,
      },
      {
        id: "w-activities",
        type: "ACTIVITIES",
        enabled: true,
        position: { col: 0, row: 1 },
        width: 12,
        height: 8,
        variant: "default",
        settings: {} satisfies ActivitiesWidgetSettings,
      },
      {
        id: "w-announcement",
        type: "ANNOUNCEMENT",
        enabled: board.announcementEnabled,
        position: { col: 0, row: 9 },
        width: 12,
        height: 1,
        variant: "default",
        settings: {
          text: board.announcementText,
          bgColor: board.announcementBgColor,
          textColor: board.announcementTextColor,
        } satisfies AnnouncementWidgetSettings,
      },
    ],
  };
}

/**
 * Parses a layoutJson string into an InboardLayout.
 * Falls back to the default layout on parse error or version mismatch.
 */
export function parseLayoutJson(
  json: string | null | undefined,
  boardDefaults: {
    headerSubtitleEnabled: boolean;
    headerSubtitleText: string | null;
    headerShowTime: boolean;
    headerShowDate: boolean;
    announcementEnabled: boolean;
    announcementText: string | null;
    announcementBgColor: string | null;
    announcementTextColor: string | null;
  },
): InboardLayout {
  if (!json) return getDefaultLayout(boardDefaults);
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Record<string, unknown>).version !== 1 ||
      !Array.isArray((parsed as Record<string, unknown>).widgets)
    ) {
      return getDefaultLayout(boardDefaults);
    }
    return parsed as InboardLayout;
  } catch {
    return getDefaultLayout(boardDefaults);
  }
}

/**
 * Finds a widget by type in a layout. Returns null if not found.
 */
export function findWidget(
  layout: InboardLayout,
  type: WidgetType,
): WidgetInstance | null {
  return layout.widgets.find((w) => w.type === type) ?? null;
}

/**
 * Returns an updated layout with the widget for `type` replaced by `updated`.
 * If no widget of that type exists, returns the layout unchanged.
 */
export function updateWidget(
  layout: InboardLayout,
  type: WidgetType,
  updates: Partial<Omit<WidgetInstance, "id" | "type">>,
): InboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((w) =>
      w.type === type ? { ...w, ...updates } : w,
    ),
  };
}

/**
 * Validates a layout for basic invariants:
 *   - Version is 1
 *   - Widgets array is non-empty
 *   - No widget exceeds grid width
 *   - No negative positions
 *
 * Returns null if valid, or an error string if invalid.
 */
export function validateLayout(layout: InboardLayout): string | null {
  if (layout.version !== 1) return "Ungültige Layout-Version.";
  if (!Array.isArray(layout.widgets)) return "Widgets müssen ein Array sein.";
  for (const w of layout.widgets) {
    if (w.position.col < 0 || w.position.row < 0) {
      return `Widget ${w.id}: Position darf nicht negativ sein.`;
    }
    if (w.width < WIDGET_MIN_WIDTH || w.width > WIDGET_MAX_WIDTH) {
      return `Widget ${w.id}: Breite muss zwischen ${WIDGET_MIN_WIDTH} und ${WIDGET_MAX_WIDTH} liegen.`;
    }
    if (w.height < WIDGET_MIN_HEIGHT) {
      return `Widget ${w.id}: Höhe muss mindestens ${WIDGET_MIN_HEIGHT} sein.`;
    }
    if (w.position.col + w.width > GRID_COLUMNS) {
      return `Widget ${w.id}: Widget überläuft das Grid (${GRID_COLUMNS} Spalten).`;
    }
  }
  return null;
}

// ── Designer-02: grid / placement helpers ─────────────────────────────────────

/** Default total rows for the 3-widget Screen-1 layout (rows 0..9). */
export const GRID_ROWS_DEFAULT = 10;

/**
 * Per-widget-type movement and resize constraints for the canvas editor.
 *
 *   fixedWidth  — width is always GRID_COLUMNS; cannot be changed
 *   fixedCol    — column is always 0; cannot be changed
 *   canResize   — whether the resize handle is shown
 *   minWidth/maxWidth  — allowed width range in grid columns
 *   minHeight/maxHeight — allowed height range in grid rows
 */
export const WIDGET_CONSTRAINTS: Record<
  WidgetType,
  {
    fixedWidth: boolean;
    fixedCol: boolean;
    canResize: boolean;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  }
> = {
  HEADER: {
    fixedWidth: true,
    fixedCol: true,
    canResize: false,
    minWidth: GRID_COLUMNS,
    maxWidth: GRID_COLUMNS,
    minHeight: 1,
    maxHeight: 2,
  },
  ACTIVITIES: {
    fixedWidth: false,
    fixedCol: false,
    canResize: true,
    minWidth: 4,
    maxWidth: GRID_COLUMNS,
    minHeight: 3,
    maxHeight: 9,
  },
  ANNOUNCEMENT: {
    fixedWidth: false,
    fixedCol: false,
    canResize: true,
    minWidth: 6,
    maxWidth: GRID_COLUMNS,
    minHeight: 1,
    maxHeight: 2,
  },
};

/**
 * Default grid placement for each widget type.
 * Used when restoring a widget that was disabled and re-enabled.
 */
export const DEFAULT_WIDGET_POSITIONS: Record<
  WidgetType,
  { col: number; row: number; width: number; height: number }
> = {
  HEADER: { col: 0, row: 0, width: 12, height: 1 },
  ACTIVITIES: { col: 0, row: 1, width: 12, height: 8 },
  ANNOUNCEMENT: { col: 0, row: 9, width: 12, height: 1 },
};

/**
 * Returns true if widget `a` and widget `b` occupy overlapping grid cells.
 * Disabled widgets are still checked — callers should filter by `.enabled`.
 */
export function widgetsOverlap(a: WidgetInstance, b: WidgetInstance): boolean {
  const aR = a.position.col + a.width;
  const aB = a.position.row + a.height;
  const bR = b.position.col + b.width;
  const bB = b.position.row + b.height;
  return (
    a.position.col < bR &&
    aR > b.position.col &&
    a.position.row < bB &&
    aB > b.position.row
  );
}

/**
 * Returns true if placing `widget` at `newPos` with `newWidth`×`newHeight`
 * would overlap any *other* enabled widget in `allWidgets`.
 */
export function hasOverlapWithOthers(
  widget: WidgetInstance,
  newPos: WidgetPosition,
  newWidth: number,
  newHeight: number,
  allWidgets: WidgetInstance[],
): boolean {
  const proposed: WidgetInstance = {
    ...widget,
    position: newPos,
    width: newWidth,
    height: newHeight,
  };
  return allWidgets
    .filter((w) => w.id !== widget.id && w.enabled)
    .some((w) => widgetsOverlap(proposed, w));
}

/**
 * Computes the total number of rows used by the layout (for canvas scaling).
 * Never returns less than GRID_ROWS_DEFAULT.
 */
export function getLayoutTotalRows(layout: InboardLayout): number {
  const enabled = layout.widgets.filter((w) => w.enabled);
  if (enabled.length === 0) return GRID_ROWS_DEFAULT;
  return Math.max(
    GRID_ROWS_DEFAULT,
    ...enabled.map((w) => w.position.row + w.height),
  );
}
