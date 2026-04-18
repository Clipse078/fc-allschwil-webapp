# Runtime Diagnostics

## Purpose

This step adds two safe deployment diagnostics pieces without touching existing UX flows:

- a reusable STAGE environment banner component
- an internal runtime diagnostics page at `/admin/runtime`

---

## Added

### `components/admin/deployment/StageEnvironmentBanner.tsx`
Reusable component that only renders in STAGE.

### `app/admin/runtime/page.tsx`
Internal page that shows:
- current environment
- URL wiring
- secret/database presence checks
- warnings
- blocking errors

---

## Notes

This page is intentionally read-only and does not mutate anything.

It is safe because:
- no existing layout is replaced
- no auth flow is changed
- no middleware is changed
- no current pages are broken

---

## Next step

Recommended next:
1. add DB connectivity ping to `/api/health`
2. protect `/admin/runtime` behind existing admin permissions
3. inject `StageEnvironmentBanner` into the safe admin shell area
4. then wire selective fail-fast runtime assertions
