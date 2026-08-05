/**
 * lib/registrations/workflow-types.ts
 *
 * REGISTRATION-01F — client-safe shared prop types for the registration
 * workflow UI (drawer + full detail page + inbox). Kept separate from
 * queries.ts / person-match.ts so client components can import these
 * without pulling in any server-only module.
 */

export type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type TargetGroupOption = {
  id: string;
  name: string;
  key: string;
};
