# TEAM-COCKPIT-PREMIUM-01J-C — Team Document Authorization

Slice **01J-C** adds team-scoped authorization for private Team Documents. Documents remain owned by `Team` (not `TeamSeason`), but person access follows the team's **current-season** sporting roster.

## TEAM DOCUMENT AUTHORIZATION

| Topic | Implementation |
|---|---|
| **User → Person mapping** | Canonical `Person.userId` (1:1, nullable). Resolved via `resolvePersonIdForUser(userId, tenantId)` in `lib/teams/team-document-auth.ts`. No email inference. |
| **Canonical team allocation source** | `PlayerSquadMember` and `TrainerTeamMember` on the team's current `TeamSeason` (`season.isActive = true` via `currentTeamSeasonWhere()`). Not `OrgUnitMembership`, not `PersonAssignment`, not capacity flags alone. |
| **Current-season handling** | `resolvePersonCurrentTeamAllocation()` queries `teamSeason.findFirst({ teamId, season: { isActive: true } })`, then membership on that `teamSeasonId` only. Historical seasons do not grant access after rollover. |
| **Player/member access** | Active `PlayerSquadMember` (`status` ∈ `ACTIVE`, `INJURED`, `ABSENT`) on current season → `canViewDocuments = true`, `canManageDocuments = false`. |
| **Trainer/staff access** | Active `TrainerTeamMember` (`status = ACTIVE`) on current season → `canViewDocuments = true`, `canManageDocuments = true`. Distinguished from players via separate roster table (not `roleLabel` heuristics). |
| **Club Admin detection** | `UserRole` with canonical `club_admin__<tenantKey>` (`getTenantClubAdminRoleKey`) + active `TenantMembership` in that tenant. Tenant-scoped; no hard-coded IDs. |
| **SCE Superadmin detection** | `UserRole` with `role.key = super_admin` and `role.scope = PLATFORM`. Reuses existing platform-admin role semantics. |
| **Generic `teams.view` access** | **Does NOT grant** Team Document access. Cockpit layout may still use `requireTeamCockpitAccess()`, but documents are a separate boundary. |
| **Generic `teams.manage` access** | **Does NOT grant** Team Document access unless the user is also Club Admin, Superadmin, or an allocated trainer on the team. |
| **Central helper** | `resolveTeamDocumentAccess()` — single authoritative resolver. Page guard: `requireTeamDocumentAccess()`. API guard: `requireApiTeamDocumentAccess()`. |
| **Page protected** | `app/(admin)/dashboard/teams/[teamId]/dokumente/page.tsx` uses `requireTeamDocumentAccess()` (not cockpit permission alone). Denied → `notFound()`. |
| **List protected** | `GET /api/teams/[teamId]/documents` calls `requireApiTeamDocumentAccess()` before `listTeamDocuments()`. |
| **Download protected** | `GET /api/teams/[teamId]/documents/[documentId]/download` independently verifies team document view access + `tenantId`/`teamId`/`documentId` scoping in service layer. |
| **Upload protected** | `POST /api/teams/[teamId]/documents` requires `requireApiTeamDocumentAccess({ requireManage: true })`. |
| **Rename protected** | `PATCH /api/teams/[teamId]/documents/[documentId]` requires manage access. |
| **Delete protected** | `DELETE /api/teams/[teamId]/documents/[documentId]` requires manage access. |

## ACCESS MATRIX

| Scenario | Result |
|---|---|
| Allocated Team A → Team A | **ALLOWED** (view; manage if trainer) |
| Allocated Team A → Team B | **DENIED** (404, non-enumerable) |
| Historical allocation only | **DENIED** (current-season roster required) |
| Club Admin own tenant | **ALLOWED** (view + manage) |
| Club Admin other tenant | **DENIED** (team not in tenant scope) |
| SCE Superadmin | **ALLOWED** (view + manage per platform-admin semantics) |
| Unallocated `teams.view` user | **DENIED** |
| Unallocated `teams.manage` user | **DENIED** (unless also Club Admin) |
| Player mutation | **DENIED** (403 on manage endpoints) |
| Trainer mutation | **ALLOWED** (upload/rename/delete) |
| Cross-team document guessing | **DENIED** (service returns `DOCUMENT_NOT_FOUND` → 404) |
| Cross-tenant document guessing | **DENIED** (`resolveDocument` tenant/team mismatch → 404) |

## Files

- `lib/teams/team-document-auth.ts` — central authorization helper
- `lib/teams/__tests__/team-document-auth.test.ts` — security acceptance matrix
- `app/api/teams/[teamId]/documents/**` — authenticated API routes
- `app/api/teams/[teamId]/documents/__tests__/route.test.ts` — route-level auth tests
- `app/(admin)/dashboard/teams/[teamId]/dokumente/page.tsx` — document-specific page guard

## Limitations (v1)

- Management staff modeled only via `TrainerTeamMember` (canonical sporting roster). `PersonAssignment` org labels are not used for document authorization.
- Users without a linked `Person` record cannot access via team allocation (fail-closed). Club Admin and Superadmin paths remain available.
