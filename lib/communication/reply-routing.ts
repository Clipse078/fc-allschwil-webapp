type ParsedAddress = {
  raw: string;
  email: string;
};

function extractEmailAddress(raw: string): ParsedAddress | null {
  const value = raw.trim();
  if (!value) return null;

  // Handle common `Display Name <email@domain>` format.
  const angleMatch = value.match(/<([^>]+)>/);
  const email = (angleMatch?.[1] ?? value).trim();
  if (!email || !email.includes("@")) return null;

  return { raw: value, email };
}

export function buildInboundReplyToAddress(inboundReplyToken: string): string | null {
  const token = inboundReplyToken.trim();
  if (!token) return null;

  const domain = process.env.EMAIL_INBOUND_DOMAIN?.trim();
  if (!domain) return null;

  return `reply+${token}@${domain}`;
}

export function extractInboundReplyTokenFromAddresses(addresses: unknown): string | null {
  const values = Array.isArray(addresses) ? addresses : [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const parsed = extractEmailAddress(raw);
    if (!parsed) continue;

    const atIndex = parsed.email.indexOf("@");
    if (atIndex <= 0) continue;
    const localPart = parsed.email.slice(0, atIndex);

    // Accept case-insensitive prefix; token is treated as opaque.
    const match = localPart.match(/^reply\+(.+)$/i);
    if (!match?.[1]) continue;
    return match[1].trim();
  }

  return null;
}
