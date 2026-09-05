import { describe, expect, it } from "vitest";
import {
  EXTERNAL_SIDE_EFFECT_PROVIDERS,
  isExternalSideEffectConfigured,
} from "../external-side-effect-policy";

const ACCEPTANCE_ENV = {
  NODE_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "acceptance",
  PROVIDER_CREDENTIAL: "configured",
};

describe("external side-effect policy", () => {
  it.each(EXTERNAL_SIDE_EFFECT_PROVIDERS)(
    "keeps %s fail-closed in Acceptance without explicit provider enablement",
    (provider) => {
      expect(
        isExternalSideEffectConfigured(
          provider,
          ["PROVIDER_CREDENTIAL"],
          ACCEPTANCE_ENV,
        ),
      ).toBe(false);
    },
  );

  it("requires credentials even when an Acceptance provider is allowlisted", () => {
    expect(
      isExternalSideEffectConfigured(
        "resend",
        ["MISSING_CREDENTIAL"],
        {
          ...ACCEPTANCE_ENV,
          ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS: "resend",
        },
      ),
    ).toBe(false);
  });

  it("enables only the explicitly configured Acceptance provider", () => {
    const env = {
      ...ACCEPTANCE_ENV,
      ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS: " resend, workspace-blob ",
    };

    expect(
      isExternalSideEffectConfigured(
        "resend",
        ["PROVIDER_CREDENTIAL"],
        env,
      ),
    ).toBe(true);
    expect(
      isExternalSideEffectConfigured(
        "workspace-blob",
        ["PROVIDER_CREDENTIAL"],
        env,
      ),
    ).toBe(true);
    expect(
      isExternalSideEffectConfigured(
        "public-blob",
        ["PROVIDER_CREDENTIAL"],
        env,
      ),
    ).toBe(false);
  });

  it("preserves credential-based behavior outside Acceptance", () => {
    expect(
      isExternalSideEffectConfigured(
        "resend",
        ["PROVIDER_CREDENTIAL"],
        {
          NODE_ENV: "production",
          APP_ENV: "stage",
          VERCEL: "1",
          VERCEL_ENV: "production",
          PROVIDER_CREDENTIAL: "configured",
        },
      ),
    ).toBe(true);
  });
});
