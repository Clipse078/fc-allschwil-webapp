import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/messages";

/**
 * next-intl request configuration.
 *
 * "Without i18n routing" setup — locale is always DEFAULT_LOCALE (de-CH).
 * No [locale] route segments. No middleware.
 *
 * To add locale routing in a future sprint:
 *   1. Move pages into app/[locale]/...
 *   2. Add next-intl middleware
 *   3. Replace the hardcoded locale with: const locale = (await requestLocale) ?? DEFAULT_LOCALE
 */
export default getRequestConfig(async () => {
  return {
    locale: DEFAULT_LOCALE,
    messages: (await import("@/messages/de-CH")).default,
  };
});
