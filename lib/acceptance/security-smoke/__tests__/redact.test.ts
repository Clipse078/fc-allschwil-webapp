import { describe, expect, it } from "vitest";
import { redactSmokeSecrets } from "@/lib/acceptance/security-smoke/redact";

describe("redactSmokeSecrets", () => {
  it("redacts database URLs and password env values", () => {
    const input =
      "postgresql://acceptance:super-secret@acceptance-db.example.com:5432/sce_acceptance ACCEPTANCE_ALPHA_ADMIN_PASSWORD=abc123";
    expect(redactSmokeSecrets(input)).toBe(
      "postgresql://acceptance:***@acceptance-db.example.com:5432/sce_acceptance ACCEPTANCE_ALPHA_ADMIN_PASSWORD=***",
    );
  });

  it("redacts session cookies and csrf tokens", () => {
    const input =
      'csrfToken="abc123" authjs.session-token=token-value next-auth.session-token=legacy';
    expect(redactSmokeSecrets(input)).not.toContain("abc123");
    expect(redactSmokeSecrets(input)).not.toContain("token-value");
    expect(redactSmokeSecrets(input)).not.toContain("legacy");
  });
});
