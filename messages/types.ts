/**
 * Platform message catalog type.
 * All locales must satisfy this shape.
 * Architecture prepared for: de-CH (default), en-GB, nl-NL
 */
export type Messages = {
  platform: {
    name: string;
    tagline: string;
    metaTitle: string;
    metaDescription: string;
  };
  nav: {
    dashboard: string;
    vereinsleitung: string;
    meetings: string;
    initiativen: string;
    kpis: string;
    saisons: string;
    saisonplanner: string;
    wochenplanner: string;
    tagesplanner: string;
    teams: string;
    events: string;
    personen: string;
    spieler: string;
    trainer: string;
    benutzer: string;
    abmelden: string;
    abmelden_short: string;
    menuEinklappen: string;
    menuErweitern: string;
  };
  pageHeaders: {
    dashboard: { eyebrow: string; title: string; description: string };
    planner: { eyebrow: string; title: string; description: string };
    plannerWeek: { eyebrow: string; title: string; description: string };
    plannerDay: { eyebrow: string; title: string; description: string };
    meetings: { eyebrow: string; title: string; description: string };
    meetingDetail: { eyebrow: string; title: string; description: string };
    initiativen: { eyebrow: string; title: string; description: string };
    initiativeDetail: { eyebrow: string; title: string; description: string };
    kpis: { eyebrow: string; title: string; description: string };
    vereinsleitung: { eyebrow: string; title: string; description: string };
    saisons: { eyebrow: string; title: string; description: string };
    events: { eyebrow: string; title: string; description: string };
    teams: { eyebrow: string; title: string; description: string };
    users: { eyebrow: string; title: string; description: string };
    personen: { eyebrow: string; title: string; description: string };
    spieler: { eyebrow: string; title: string; description: string };
    trainer: { eyebrow: string; title: string; description: string };
  };
  auth: {
    login: string;
    loginTitle: string;
    loginDescription: string;
    signOut: string;
    impersonationActive: string;
    impersonationDescription: string;
    stopImpersonation: string;
    stopImpersonationLoading: string;
    unknownAdmin: string;
  };
  actions: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    back: string;
    confirm: string;
    loading: string;
  };
  status: {
    active: string;
    inactive: string;
    draft: string;
    published: string;
    archived: string;
    pending: string;
    running: string;
    planned: string;
    completed: string;
    cancelled: string;
  };
  emptyStates: {
    noData: string;
    noDataDescription: string;
    noResults: string;
    noResultsDescription: string;
  };
  tenant: {
    activeTenant: string;
    platform: string;
  };
  pageActions: {
    plannerOpen: string;
    seasonsManage: string;
    seasonDelete: string;
    seasonPlanNew: string;
    plannerEntryNew: string;
    backToPlanner: string;
    backToMeetings: string;
    seasonSwitch: string;
    teamNew: string;
    eventNew: string;
    meetingPlan: string;
    edit: string;
    decisionMake: string;
    initiativeNew: string;
    taskNew: string;
  };
};
