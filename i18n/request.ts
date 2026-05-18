/**
 * i18n/request.ts — next-intl integration stub
 *
 * STATUS: Placeholder. next-intl is NOT yet installed.
 *
 * ─── HOW TO ACTIVATE (Sprint 4+) ───────────────────────────────────────────
 *
 * 1. Install next-intl:
 *      npm install next-intl
 *
 * 2. Add the plugin to next.config.ts:
 *      import createNextIntlPlugin from "next-intl/plugin";
 *      const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
 *      export default withNextIntl(nextConfig);
 *
 * 3. Replace the stub below with the real next-intl getRequestConfig:
 *
 *      import { getRequestConfig } from "next-intl/server";
 *      import { DEFAULT_LOCALE } from "@/messages";
 *
 *      export default getRequestConfig(async ({ requestLocale }) => {
 *        const locale = (await requestLocale) ?? DEFAULT_LOCALE;
 *        const messages = (await import(`../messages/${locale}.ts`)).default;
 *        return { locale, messages };
 *      });
 *
 * 4. After activating next-intl, replace direct `deChMessages` imports in
 *    client components with `useTranslations()`:
 *      - components/admin/layout/AdminSidebar.tsx
 *      - components/admin/layout/SignOutButton.tsx
 *      - components/admin/layout/StopImpersonationButton.tsx
 *      - components/admin/layout/AdminPageActions.tsx
 *
 *    And replace direct imports in server components with `getTranslations()`:
 *      - components/admin/layout/AdminShellChrome.tsx
 *
 * ─── ROUTING NOTE ────────────────────────────────────────────────────────────
 * Do NOT move routes into /[locale]/... yet. Use next-intl's
 * "without i18n routing" setup first (navigation.ts, middleware.ts optional).
 * Route migration is a separate sprint decision.
 *
 * ─── CURRENT APPROACH ────────────────────────────────────────────────────────
 * All strings are sourced by direct import of deChMessages from @/messages.
 * This works correctly for de-CH only and is intentionally temporary.
 * Switching to next-intl hooks is a drop-in replacement at each call site.
 */

export {};
