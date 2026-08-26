/**
 * MEDIA-LOGO-01C — SVG hardening tests.
 */

import { describe, expect, it } from "vitest";

import { isUnsafeSvgPayload } from "../provider-logo-svg-safety";
import { normalizeProviderLogoBytes } from "../provider-logo-normalization";

function svg(content: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100" viewBox="0 0 100 100">${content}</svg>`,
    "utf8",
  );
}

describe("SVG security — rejected payloads", () => {
  it("J. SVG with <script> → rejected", async () => {
    const payload = svg("<script>alert(1)</script>");
    expect(isUnsafeSvgPayload(payload)).toBe(true);
    expect(await normalizeProviderLogoBytes(payload)).toBeNull();
  });

  it("K. SVG with javascript: → rejected", () => {
    expect(isUnsafeSvgPayload(svg('<a href="javascript:alert(1)"/>'))).toBe(true);
  });

  it("L. SVG with <foreignObject> → rejected", () => {
    expect(isUnsafeSvgPayload(svg('<foreignObject width="10" height="10"/>'))).toBe(true);
  });

  it("M. SVG with onload/onerror event handler → rejected", () => {
    expect(isUnsafeSvgPayload(svg('<rect width="10" height="10" onload="evil()"/>'))).toBe(true);
    expect(isUnsafeSvgPayload(svg('<rect width="10" height="10" onerror="evil()"/>'))).toBe(true);
  });

  it("N. SVG with href=\"https://...\" → rejected", () => {
    expect(
      isUnsafeSvgPayload(svg('<image href="https://remote.example/asset.png" width="10" height="10"/>')),
    ).toBe(true);
  });

  it("O. SVG with xlink:href=\"https://...\" → rejected", () => {
    expect(
      isUnsafeSvgPayload(
        svg('<use xlink:href="https://remote.example/asset.svg#icon" width="10" height="10"/>'),
      ),
    ).toBe(true);
  });

  it("P. SVG with protocol-relative external reference → rejected", () => {
    expect(isUnsafeSvgPayload(svg('<image href="//remote.example/asset.png" width="10" height="10"/>'))).toBe(
      true,
    );
    expect(
      isUnsafeSvgPayload(svg('<rect fill="url(//remote.example/pattern.png)" width="10" height="10"/>')),
    ).toBe(true);
  });

  it("Q. SVG with external url(https://...) → rejected", () => {
    expect(
      isUnsafeSvgPayload(svg('<rect fill="url(https://remote.example/pattern.png)" width="10" height="10"/>')),
    ).toBe(true);
  });

  it("R. SVG with external @import → rejected", () => {
    expect(
      isUnsafeSvgPayload(svg('<style>@import url("https://remote.example/style.css");</style>')),
    ).toBe(true);
  });
});

describe("SVG security — accepted safe internal references", () => {
  it("S. SVG with safe href=\"#internal\" → accepted", async () => {
    const payload = svg(
      '<defs><linearGradient id="gradient1"><stop offset="0%" stop-color="red"/></linearGradient></defs><rect fill="url(#gradient1)" width="50" height="50"/>',
    );

    expect(isUnsafeSvgPayload(payload)).toBe(false);
    const result = await normalizeProviderLogoBytes(payload);
    expect(result).not.toBeNull();
  });

  it("T. SVG with safe url(#internal) → accepted", async () => {
    const payload = svg(
      '<defs><clipPath id="clipPath"><rect width="40" height="40"/></clipPath></defs><rect clip-path="url(#clipPath)" width="40" height="40" fill="blue"/>',
    );

    expect(isUnsafeSvgPayload(payload)).toBe(false);
    const result = await normalizeProviderLogoBytes(payload);
    expect(result).not.toBeNull();
  });
});

describe("SVG security — additional unsafe references", () => {
  it("rejects file: references", () => {
    expect(isUnsafeSvgPayload(svg('<image href="file:///etc/passwd" width="10" height="10"/>'))).toBe(true);
  });

  it("rejects data: references", () => {
    expect(
      isUnsafeSvgPayload(
        svg('<image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/>'),
      ),
    ).toBe(true);
  });

  it("rejects relative external paths", () => {
    expect(isUnsafeSvgPayload(svg('<image href="crest.png" width="10" height="10"/>'))).toBe(true);
  });
});
