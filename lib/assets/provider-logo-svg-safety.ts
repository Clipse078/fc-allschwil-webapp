/**
 * lib/assets/provider-logo-svg-safety.ts
 *
 * MEDIA-LOGO-01C — fail-closed SVG sanitization before sharp rasterization.
 * Rejects active content and external resource references while allowing safe
 * internal fragment identifiers required for ordinary crest rendering.
 */

const SVG_BASIC_UNSAFE_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /javascript:/i,
  /<foreignObject/i,
  /\bon[a-z]+\s*=/i,
];

const HREF_ATTRIBUTE_PATTERN =
  /\b(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi;
const URL_FUNCTION_PATTERN = /url\s*\(\s*(["']?)([\s\S]*?)\1\s*\)/gi;

function isUnsafeSvgReferenceValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed.startsWith("#")) {
    return false;
  }

  if (/^https?:/i.test(trimmed)) {
    return true;
  }

  if (/^\/\//.test(trimmed)) {
    return true;
  }

  if (/^file:/i.test(trimmed)) {
    return true;
  }

  if (/^javascript:/i.test(trimmed)) {
    return true;
  }

  if (/^data:/i.test(trimmed)) {
    return true;
  }

  // Reject relative / bare external paths (e.g. crest.png, ../asset.svg).
  return true;
}

function hasUnsafeSvgExternalReferences(text: string): boolean {
  for (const match of text.matchAll(HREF_ATTRIBUTE_PATTERN)) {
    if (isUnsafeSvgReferenceValue(match[2])) {
      return true;
    }
  }

  for (const match of text.matchAll(URL_FUNCTION_PATTERN)) {
    if (isUnsafeSvgReferenceValue(match[2])) {
      return true;
    }
  }

  if (/@import\b/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Returns true when SVG bytes must be rejected before rasterization.
 */
export function isUnsafeSvgPayload(buffer: Buffer): boolean {
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 256_000));

  if (SVG_BASIC_UNSAFE_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return hasUnsafeSvgExternalReferences(text);
}
