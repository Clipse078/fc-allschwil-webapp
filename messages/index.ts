/**
 * i18n message catalog registry.
 *
 * Architecture prepared for de-CH (default), en-GB, nl-NL.
 * Sprint 1: de-CH only. Do NOT add other locales until Sprint 2 i18n module.
 *
 * Integration path (Sprint 2+):
 *   - Install next-intl
 *   - Replace this index with next-intl's `getMessages()` / `getRequestConfig()`
 *   - Keep the Messages type in ./types.ts as the contract
 */
import deChMessages from "./de-CH";
import type { Messages } from "./types";

export type SupportedLocale = "de-CH";

export const SUPPORTED_LOCALES: SupportedLocale[] = ["de-CH"];
export const DEFAULT_LOCALE: SupportedLocale = "de-CH";

const catalog: Record<SupportedLocale, Messages> = {
  "de-CH": deChMessages,
};

export function getMessages(locale: SupportedLocale = DEFAULT_LOCALE): Messages {
  return catalog[locale] ?? catalog[DEFAULT_LOCALE];
}

export { deChMessages };
export type { Messages };
