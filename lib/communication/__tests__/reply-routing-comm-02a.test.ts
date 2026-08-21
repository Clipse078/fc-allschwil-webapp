import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateInboundReplyToken } from "@/lib/communication/inbound-token";
import {
  buildInboundReplyToAddress,
  extractInboundReplyTokenFromAddresses,
} from "@/lib/communication/reply-routing";

const DOMAIN = "gaupreniet.resend.app";

describe("COMM-02A inbound reply token + routing address constraints", () => {
  const originalEnv = process.env.EMAIL_INBOUND_DOMAIN;

  beforeEach(() => {
    process.env.EMAIL_INBOUND_DOMAIN = DOMAIN;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EMAIL_INBOUND_DOMAIN;
    } else {
      process.env.EMAIL_INBOUND_DOMAIN = originalEnv;
    }
    vi.restoreAllMocks();
  });

  it("generates a token whose Reply-To local-part is <= 64 characters", () => {
    const token = generateInboundReplyToken();
    const address = buildInboundReplyToAddress(token);
    expect(address).toBe(`reply+${token}@${DOMAIN}`);

    const localPart = address?.split("@")[0] ?? "";
    expect(localPart.length).toBeLessThanOrEqual(64);
  });

  it("generates lower-case hex tokens with expected length", () => {
    const token = generateInboundReplyToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token.length).toBeLessThanOrEqual(58);
  });

  it("produces no duplicates in a meaningful sample (sanity check)", () => {
    const sampleSize = 1000;
    const tokens = Array.from({ length: sampleSize }, () => generateInboundReplyToken());
    expect(new Set(tokens).size).toBe(sampleSize);
  });

  it("round-trips a generated Reply-To address back to the exact token", () => {
    const token = generateInboundReplyToken();
    const address = buildInboundReplyToAddress(token);
    expect(address).not.toBeNull();

    const extracted = extractInboundReplyTokenFromAddresses([`Sender <${address}>`]);
    expect(extracted).toBe(token);
  });

  it("parses legacy 64-character tokens for backward compatibility", () => {
    const legacyToken = "a".repeat(64);
    const extracted = extractInboundReplyTokenFromAddresses([`reply+${legacyToken}@${DOMAIN}`]);
    expect(extracted).toBe(legacyToken);
  });

  it("parses current 48-character tokens (COMM-02A compatibility)", () => {
    const token48 = "b".repeat(48);
    const extracted = extractInboundReplyTokenFromAddresses([`reply+${token48}@${DOMAIN}`]);
    expect(extracted).toBe(token48);
  });

  it("returns null when EMAIL_INBOUND_DOMAIN is missing", () => {
    delete process.env.EMAIL_INBOUND_DOMAIN;
    expect(buildInboundReplyToAddress(generateInboundReplyToken())).toBeNull();
  });
});

