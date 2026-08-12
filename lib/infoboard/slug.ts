/**
 * lib/infoboard/slug.ts
 *
 * Stable kiosk URL slug generation for Infoboards.
 *
 * Rules:
 *   - Lowercase only.
 *   - ASCII letters, digits, and hyphens only.
 *   - Multiple consecutive hyphens collapsed to one.
 *   - Leading/trailing hyphens stripped.
 *   - Umlauts and common special chars transliterated.
 *   - Max 80 chars (kiosk URL safe).
 *
 * The slug is generated ONCE at creation and is NEVER changed on rename.
 * Renaming an Infoboard (name field) does not affect the slug field.
 */

const TRANSLITERATION_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
  ß: "ss",
  é: "e",
  è: "e",
  ê: "e",
  à: "a",
  â: "a",
  î: "i",
  ï: "i",
  ô: "o",
  û: "u",
  ù: "u",
  ç: "c",
  ñ: "n",
};

/**
 * Generates a URL-safe slug from a display name.
 *
 * @example
 *   generateInfoboardSlug("Clubhaus Eingang") // "clubhaus-eingang"
 *   generateInfoboardSlug("KR 2 – Display")   // "kr-2-display"
 *   generateInfoboardSlug("Büro")             // "buero"
 */
export function generateInfoboardSlug(name: string): string {
  let result = name;

  // Transliterate known special characters
  for (const [char, replacement] of Object.entries(TRANSLITERATION_MAP)) {
    result = result.split(char).join(replacement);
  }

  result = result
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ") // replace non-alphanum with space
    .trim()
    .replace(/[\s_]+/g, "-") // spaces/underscores to hyphens
    .replace(/-+/g, "-") // collapse consecutive hyphens
    .replace(/^-+|-+$/g, "") // strip leading/trailing hyphens
    .slice(0, 80);

  return result || "infoboard";
}

/**
 * Makes a slug unique within a set of existing slugs by appending a counter.
 *
 * @example
 *   ensureUniqueSlug("clubhaus", new Set(["clubhaus"]))    // "clubhaus-2"
 *   ensureUniqueSlug("clubhaus", new Set(["clubhaus-2"]))  // "clubhaus"
 */
export function ensureUniqueSlug(
  base: string,
  existingSlugs: Set<string>,
): string {
  if (!existingSlugs.has(base)) return base;
  let counter = 2;
  while (existingSlugs.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}
