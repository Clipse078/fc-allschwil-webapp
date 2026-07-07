# SportClubEvo Planning — Premium Minimal Target Architecture

## Goal

Create one coherent planning workflow for club administrators.

The user should not need to understand the internal Event architecture. The interface should make the operational flow obvious:

Saison -> Woche -> Tag -> Publikation

## Current discovery summary

The current implementation has strong backend foundations but fragmented UX:

- Events, Saisonplanung, Wochenplan, and Tagesplan are presented as separate mental models.
- Event creation exists under `/dashboard/events`.
- Planner pages exist under `/dashboard/planner`.
- Wochenplan exists under `/dashboard/wochenplan`.
- A dedicated `/dashboard/tagesplan` route does not yet exist.
- Resource and allocation APIs exist.
- Publication state and tenant-safe public weekplan APIs exist.
- Wochenplan still contains demo fallback logic and should not show fake events in a real empty week.

## Product principle

Premium Minimal means:

- one clear primary action per view;
- calm surfaces and low visual noise;
- operational status over dashboard metrics;
- progressive disclosure instead of many parallel modules;
- contextual editing instead of multiple detached forms;
- direct planning language, not database language.

## Target navigation

Planning should become:

- Saisonplan
- Wochenplan
- Tagesplan
- Anfragen
- Ressourcen

The generic Events module should become an underlying data source and administration detail, not the primary operational planning entry point.

## Data ownership

Event remains the canonical source of truth.

Events contain:

- tenant scope;
- season;
- team;
- type;
- source;
- review stage;
- start and end time;
- recurrence-derived occurrences;
- visibility destinations;
- pitch allocation;
- dressing-room allocation.

The UI should not duplicate this model. It should present it through planning layers.

## Workflow

### 1. Saisonplan

Purpose: define the season baseline.

Contains:

- recurring trainings;
- imported matches;
- tournaments;
- club events;
- holiday periods;
- exceptional closures.

Primary action:

Create season entry.

Output:

A season-scoped set of planned and reviewable events.

### 2. Wochenplan

Purpose: turn the season baseline into an operational week.

Contains:

- all events in the selected week;
- unplanned events;
- pitch allocation;
- conflicts;
- variant state;
- publication readiness.

Primary action:

Prepare week.

Required UX areas:

- week navigation;
- status chip: Entwurf / Bereit / Publiziert;
- variant chips;
- planning canvas;
- unplanned lane;
- contextual detail panel;
- inline conflict markers;
- publication call-to-action.

### 3. Tagesplan

Purpose: operate one concrete day.

Contains:

- daily pitch view;
- dressing-room plan;
- matchday operational details;
- infoboard readiness.

Primary action:

Finalize day.

This should replace the current hidden/embedded Tagesplaner dialog with a first-class route.

### 4. Anfragen

Purpose: collect trainer and club requests before they become planned events.

Examples:

- friendly match request;
- pitch reservation;
- special training;
- tournament request;
- cancellation request.

Primary action:

Review request.

Approved requests become Events.

### 5. Ressourcen

Purpose: manage facilities and resources.

Contains:

- pitches;
- pitch segments;
- dressing rooms;
- halls;
- resource labels;
- availability rules.

Primary action:

Maintain resources.

## Publication model

Publication must remain explicit.

A week should move through:

Entwurf -> Bereit -> Publiziert

Publication destinations:

- Website;
- Infoboard;
- Team pages;
- Mobile App later.

Publishing a week should not be represented only by setting event booleans. The UI must explain what is being published, which variant is active, and which destinations are affected.

## Variants

Variants are not just labels.

Target concept:

Season baseline -> Week instance -> Week variant -> Publication

Examples:

- Standard
- Schlechtwetter
- Ferien
- Turnierwoche
- Benutzerdefiniert

In the Premium Minimal UI, variants should appear as clean tabs or chips, not as a heavy select dropdown.

## Conflict handling

Conflicts should be contextual and actionable.

Avoid large detached statistics panels as the primary UX.

Show conflicts:

- on the affected event card;
- on the affected grid cell;
- in the detail panel;
- in a compact readiness summary.

Conflict types:

- missing pitch;
- invalid pitch mode;
- pitch overlap;
- pitch capacity exceeded;
- missing dressing room;
- dressing-room overlap.

## UX target for Wochenplan

Layout:

1. Header
   - title
   - week selector
   - state chip
   - primary action

2. Variant bar
   - Standard
   - Schlechtwetter
   - Ferien
   - Turnierwoche
   - New variant

3. Main canvas
   - Monday to Sunday
   - compact events
   - pitch rows
   - time slots
   - unplanned lane

4. Context panel
   - selected event
   - allocation
   - publication visibility
   - conflicts
   - quick actions

5. Publication footer or top-right action
   - readiness
   - destination summary
   - publish / unpublish

## First implementation slice recommendation

Do not rebuild everything at once.

Step 3C-3F-D should implement the first safe Premium Minimal slice:

- remove demo fallback from real Wochenplan;
- add a proper empty state;
- rename and clarify the Wochenplan page header;
- make publication state clearer;
- keep existing backend/API unchanged;
- keep existing tenant isolation untouched;
- avoid schema changes;
- avoid navigation restructuring until the architecture is committed.

## Non-goals for first slice

Do not:

- change Prisma schema;
- add migrations;
- remove existing APIs;
- rebuild drag and drop;
- rewrite the conflict engine;
- change public API contracts;
- modify tenant isolation logic;
- merge Events and Planner in one large refactor.

## Acceptance criteria

The target architecture is accepted when:

- the workflow is documented;
- the first implementation slice is clear;
- no runtime behavior is changed yet;
- the next code slice can be implemented with strict file scope.
