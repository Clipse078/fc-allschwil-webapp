import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_CSS = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("SCE login input styles", () => {
  it("defines dark login surface tokens scoped to .sce-login", () => {
    expect(GLOBALS_CSS).toMatch(/\.sce-login\s*\{[^}]*--sce-login-input-bg:/s);
    expect(GLOBALS_CSS).toMatch(/--sce-login-input-bg-hover:/);
    expect(GLOBALS_CSS).toMatch(/--sce-login-input-bg-focus:/);
  });

  it("keeps warm-white text and dark caret on base login inputs", () => {
    expect(GLOBALS_CSS).toMatch(/\.sce-login-input\s*\{[^}]*color:\s*var\(--foreground\)/s);
    expect(GLOBALS_CSS).toMatch(/\.sce-login-input\s*\{[^}]*caret-color:\s*var\(--foreground\)/s);
  });

  it("overrides Chromium/WebKit autofill with dark inset surfaces in all states", () => {
    const autofillStates = [
      ":-webkit-autofill",
      ":-webkit-autofill:hover",
      ":-webkit-autofill:focus",
      ":-webkit-autofill:active",
    ];

    for (const state of autofillStates) {
      expect(GLOBALS_CSS).toContain(`.sce-login-input${state}`);
    }

    expect(GLOBALS_CSS).toMatch(
      /\.sce-login-input:-webkit-autofill[^{]*\{[^}]*-webkit-text-fill-color:\s*var\(--foreground\)\s*!important/s,
    );
    expect(GLOBALS_CSS).toMatch(
      /\.sce-login-input:-webkit-autofill[^{]*\{[^}]*box-shadow:\s*0 0 0 1000px var\(--sce-login-input-bg\) inset\s*!important/s,
    );
    expect(GLOBALS_CSS).toMatch(
      /\.sce-login-input:-webkit-autofill:focus[^{]*\{[^}]*var\(--sce-primary\)/s,
    );
  });
});
