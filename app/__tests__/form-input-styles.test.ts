import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_CSS = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("SCE form input styles", () => {
  it("overrides Chromium/WebKit autofill for shared fca-input fields with dark surfaces", () => {
    const autofillStates = [
      ":-webkit-autofill",
      ":-webkit-autofill:hover",
      ":-webkit-autofill:focus",
      ":-webkit-autofill:active",
    ];

    for (const state of autofillStates) {
      expect(GLOBALS_CSS).toContain(`.fca-input${state}`);
      expect(GLOBALS_CSS).toContain(`.fca-textarea${state}`);
    }

    expect(GLOBALS_CSS).toMatch(
      /\.fca-input:-webkit-autofill[^{]*\{[^}]*-webkit-text-fill-color:\s*var\(--foreground\)\s*!important/s,
    );
    expect(GLOBALS_CSS).toMatch(
      /\.fca-input:-webkit-autofill[^{]*\{[^}]*box-shadow:\s*0 0 0 1000px var\(--surface\) inset\s*!important/s,
    );
  });
});
