export function redactSmokeSecrets(value: string): string {
  let redacted = value.replace(
    /(postgres(?:ql)?:\/\/)([^:@/]+):([^@/]+)@/gi,
    (_match, prefix: string, user: string) => `${prefix}${user}:***@`,
  );

  const otherPatterns: Array<[RegExp, string]> = [
    [/(ACCEPTANCE_[A-Z0-9_]*PASSWORD=)([^\s"'`]+)/gi, "$1***"],
    [/(password["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi, "$1***"],
    [/(csrfToken["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi, "$1***"],
    [/(session-token=)([^;\s]+)/gi, "$1***"],
    [/(authjs\.session-token=)([^;\s]+)/gi, "$1***"],
    [/(__Secure-authjs\.session-token=)([^;\s]+)/gi, "$1***"],
    [/(next-auth\.session-token=)([^;\s]+)/gi, "$1***"],
  ];

  for (const [pattern, replacement] of otherPatterns) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

export function isSafeSmokeLogValue(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.includes("password")) return false;
  if (lower.includes("csrf")) return false;
  if (lower.includes("session-token")) return false;
  if (lower.includes("postgres://") || lower.includes("postgresql://")) return false;
  return true;
}
