import { getRequestConfig } from "next-intl/server";

/**
 * Workspace MVP locale configuration.
 *
 * Fixed to German (Switzerland) for the FC Allschwil launch.
 * Additional locales can be added here once the routing layer is introduced.
 */
export default getRequestConfig(async () => {
  const locale = "de";

  return {
    locale,
    messages: (
      await import(`../messages/${locale}.json`)
    ).default,
  };
});
