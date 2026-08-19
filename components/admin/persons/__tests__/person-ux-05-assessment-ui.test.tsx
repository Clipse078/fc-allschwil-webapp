/**
 * @vitest-environment jsdom
 *
 * components/admin/persons/__tests__/person-ux-05-assessment-ui.test.tsx
 *
 * PERSON-UX-05 — Assessment UI tests.
 *
 * Proves:
 * 14.  unauthorized UI shows no existence hint
 * 17.  no assessment produces empty state
 * 18.  latest assessment renders
 * 21.  existing player/trainer capacity logic preserved (via PersonDetailTabs)
 * 22.  simultaneous player + trainer preserved (via PersonDetailTabs)
 * 23.  PERSON-UX-03 sensitive permission behavior preserved
 * 24.  PERSON-UX-04 membership behavior preserved
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import PersonDetailTabs from "../PersonDetailTabs";
import PersonAssessmentSection from "../PersonAssessmentSection";
import { DOMAIN_PERMISSIONS_DENIED } from "@/lib/people/person-domain-auth";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";
import type { PersonAssessmentRecord, PersonSquadMembership, PersonTrainerMembership, TenantCriterion } from "@/lib/people/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PERSON = {
  id: "person-ux-05",
  firstName: "Klaus",
  lastName: "Weber",
  displayName: null as string | null,
  email: null as string | null,
  phone: null as string | null,
  dateOfBirth: null as Date | null,
  notes: null as string | null,
  imageUrl: null as string | null,
  isActive: true,
  isPlayer: true,
  isTrainer: false,
  isFunctionary: false,
  isVolunteer: false,
  isReferee: false,
  isSponsorContact: false,
  customFunctions: [] as string[],
  tenantId: "tenant-1",
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2024-01-01"),
  street: null as string | null,
  houseNumber: null as string | null,
  postalCode: null as string | null,
  city: null as string | null,
  country: null as string | null,
  guardianFirstName: null as string | null,
  guardianLastName: null as string | null,
  guardianEmail: null as string | null,
  guardianPhone: null as string | null,
  userId: null as string | null,
  user: null as { id: string; email: string; isActive: boolean } | null,
};

const SEASON = {
  id: "season-1",
  name: "2024/25",
  key: "2024-25",
  isActive: true,
  startDate: new Date("2024-08-01"),
  endDate: new Date("2025-05-31"),
};

const TEAM_SEASON = {
  id: "ts-1",
  displayName: null as string | null,
  shortName: null as string | null,
  participationType: "COMPETITION" as const,
  team: { id: "team-1", name: "FC Test", shortName: "FCT" as string | null },
  season: { ...SEASON, endDate: new Date("2025-05-31") },
};

function makeSquad(): PersonSquadMembership {
  return {
    id: "sq-1",
    status: "ACTIVE" as const,
    shirtNumber: null,
    positionLabel: null,
    isCaptain: false,
    isViceCaptain: false,
    remarks: null,
    teamSeason: TEAM_SEASON,
  } as unknown as PersonSquadMembership;
}

function makeAssessment(overrides: Partial<PersonAssessmentRecord> = {}): PersonAssessmentRecord {
  return {
    id: "assessment-1",
    tenantId: "tenant-1",
    personId: "person-ux-05",
    seasonId: "season-1",
    teamSeasonId: null,
    assessedAt: new Date("2024-10-15"),
    assessorUserId: null,
    notes: "Gute Entwicklung gezeigt.",
    createdAt: new Date("2024-10-15"),
    updatedAt: new Date("2024-10-15"),
    season: SEASON,
    teamSeason: null,
    assessor: null,
    ratings: [
      {
        id: "r-1",
        criterionId: "c-1",
        normalizedScore: 75,
        criterionNameSnapshot: "Technik",
        criterionCategorySnapshot: "Technik",
        ratingModeSnapshot: null,
        rawValue: null,
        rawLabelSnapshot: null,
        comment: null,
        createdAt: new Date("2024-10-15"),
      },
    ],
    ...overrides,
  };
}

const CRITERIA: TenantCriterion[] = [
  {
    id: "c-1", name: "Technik", description: null, category: "Technik", sortOrder: 0,
    ratingMode: "SCORE_0_100", qualitativeLabels: null,
    showTeamBenchmark: false, showJahrgangBenchmark: false,
  },
];

const FULL_PERMISSIONS: PersonDomainPermissions = {
  canViewFinance: true,
  canManageFinance: true,
  canViewHealth: true,
  canManageHealth: true,
  canViewPrivateDocuments: true,
  canManagePrivateDocuments: true,
  canViewDevelopment: true,
  canManageDevelopment: true,
  canViewAssessments: true,
  canManageAssessments: true,
  canViewAudit: true,
      canViewContact: false,
      canManageContact: false,
};

function makeTrainer(): PersonTrainerMembership {
  return {
    id: "tr-1",
    status: "ACTIVE" as const,
    roleLabel: "Trainer",
    remarks: null,
    teamSeason: TEAM_SEASON,
  } as unknown as PersonTrainerMembership;
}

type PersonDetailTabsTestProps = Parameters<typeof PersonDetailTabs>[0];

function makePersonDetailTabsProps(
  overrides: {
    domainPermissions?: Partial<PersonDomainPermissions>;
    assessments?: PersonAssessmentRecord[];
    criteria?: TenantCriterion[];
    squadMemberships?: PersonSquadMembership[];
    trainerMemberships?: PersonTrainerMembership[];
  } = {},
): PersonDetailTabsTestProps {
  const domainPermissions: PersonDomainPermissions = {
    ...DOMAIN_PERMISSIONS_DENIED,
    ...(overrides.domainPermissions ?? {}),
  };
  const squadMemberships = overrides.squadMemberships ?? [makeSquad()];
  const trainerMemberships = overrides.trainerMemberships ?? [];
  return {
    person: {
      ...BASE_PERSON,
      // PERSON-UX-07: tab visibility uses flags; auto-set from evidence in tests.
      isPlayer: BASE_PERSON.isPlayer || squadMemberships.length > 0,
      isTrainer: BASE_PERSON.isTrainer || trainerMemberships.length > 0,
      assignments: [],
      squadMemberships,
      trainerMemberships,
    } as PersonDetailTabsTestProps["person"],
    canManage: false,
    canDelete: false,
    orgUnits: [],
    teams: [],
    activeSeason: null,
    accessRolesCard: null,
    domainPermissions,
    memberships: [],
    assessments: overrides.assessments ?? [],
    criteria: overrides.criteria ?? CRITERIA,
  };
}

// ── 14. Unauthorized UI shows no existence hint ───────────────────────────────

describe("14. Unauthorized UI shows no assessment existence hint", () => {
  it("PersonAssessmentSection is not rendered when canViewAssessments=false", () => {
    const props = makePersonDetailTabsProps({
      domainPermissions: { canViewAssessments: false },
    });
    render(<PersonDetailTabs {...props} />);
    expect(screen.queryByText("Entwicklungs-Bewertungen")).not.toBeInTheDocument();
    expect(screen.queryByText("Bewertung erfassen")).not.toBeInTheDocument();
    expect(screen.queryByText("Neueste Bewertung")).not.toBeInTheDocument();
  });
});

// ── 17. No assessment produces empty state ────────────────────────────────────

describe("17. No assessment produces empty state", () => {
  it("shows empty state heading when no assessments and viewer is authorized", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.getByText("Noch keine Bewertungen")).toBeInTheDocument();
    expect(screen.queryByText("Neueste Bewertung")).not.toBeInTheDocument();
  });

  it("does not show fabricated score in empty state", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.queryByText("75")).not.toBeInTheDocument();
  });
});

// ── 18. Latest assessment renders ────────────────────────────────────────────

describe("18. Latest assessment renders", () => {
  it("shows season name and criterion snapshot when assessment exists", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[makeAssessment()]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.getByText("2024/25")).toBeInTheDocument();
    // "Technik" appears as both category label and criterion name snapshot
    expect(screen.getAllByText("Technik").length).toBeGreaterThan(0);
    // "75" appears in overall header and as rating score
    expect(screen.getAllByText("75").length).toBeGreaterThan(0);
  });

  it("shows 'Neueste Bewertung' label for latest assessment", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[makeAssessment()]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.getByText("Neueste Bewertung")).toBeInTheDocument();
  });

  it("shows 'Aktuell' badge on latest", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[makeAssessment()]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.getByText("Aktuell")).toBeInTheDocument();
  });

  it("shows notes when present", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[makeAssessment()]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.getByText("Gute Entwicklung gezeigt.")).toBeInTheDocument();
  });

  it("shows 'Bewertung erfassen' button when canManage=true", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[]}
        criteria={CRITERIA}
        canManage
      />,
    );
    expect(screen.getByText("Bewertung erfassen")).toBeInTheDocument();
  });

  it("does NOT show 'Bewertung erfassen' when canManage=false", () => {
    render(
      <PersonAssessmentSection
        personId="person-ux-05"
        assessments={[]}
        criteria={CRITERIA}
        canManage={false}
      />,
    );
    expect(screen.queryByText("Bewertung erfassen")).not.toBeInTheDocument();
  });
});

// ── 21. Existing capacity behavior preserved ─────────────────────────────────

describe("21. Player/trainer capacity behavior preserved (PersonDetailTabs)", () => {
  it("Spieler tab visible when Person has squad memberships", () => {
    const props = makePersonDetailTabsProps({ domainPermissions: {} });
    render(<PersonDetailTabs {...props} />);
    expect(screen.getByRole("tab", { name: /Spieler/i })).toBeInTheDocument();
  });

  it("Sport tab visible when Person has sporting evidence", () => {
    const props = makePersonDetailTabsProps({ domainPermissions: {} });
    render(<PersonDetailTabs {...props} />);
    expect(screen.getByRole("tab", { name: /Sport/i })).toBeInTheDocument();
  });
});

// ── 22. Simultaneous player + trainer ────────────────────────────────────────

describe("22. Simultaneous player + trainer (PersonDetailTabs)", () => {
  it("both Spieler and Trainer tabs visible", () => {
    const props = makePersonDetailTabsProps({
      domainPermissions: {},
      trainerMemberships: [makeTrainer()],
    });
    render(<PersonDetailTabs {...props} />);
    expect(screen.getByRole("tab", { name: /Spieler/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Trainer/i })).toBeInTheDocument();
  });
});

// ── 23. PERSON-UX-03 sensitive permission behavior preserved ─────────────────

describe("23. PERSON-UX-03 sensitive permission behavior preserved", () => {
  it("Finanzen tab absent when canViewFinance=false", () => {
    const props = makePersonDetailTabsProps({
      domainPermissions: { canViewFinance: false },
    });
    render(<PersonDetailTabs {...props} />);
    expect(screen.queryByRole("tab", { name: /Finanzen/i })).not.toBeInTheDocument();
  });

  it("Finanzen tab visible when canViewFinance=true", () => {
    const props = makePersonDetailTabsProps({
      domainPermissions: { canViewFinance: true },
    });
    render(<PersonDetailTabs {...props} />);
    expect(screen.getByRole("tab", { name: /Finanzen/i })).toBeInTheDocument();
  });

  it("Gesundheit tab absent when canViewHealth=false", () => {
    const props = makePersonDetailTabsProps({
      domainPermissions: { canViewHealth: false },
    });
    render(<PersonDetailTabs {...props} />);
    expect(screen.queryByRole("tab", { name: /Gesundheit/i })).not.toBeInTheDocument();
  });
});

// ── 24. PERSON-UX-04 membership behavior preserved ───────────────────────────

describe("24. PERSON-UX-04 membership behavior preserved", () => {
  it("Mitgliedschaft tab always visible (no permission gate)", () => {
    const props = makePersonDetailTabsProps({ domainPermissions: {} });
    render(<PersonDetailTabs {...props} />);
    expect(screen.getByRole("tab", { name: /Mitgliedschaft/i })).toBeInTheDocument();
  });
});
