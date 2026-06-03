import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantDetail } from "@/lib/tenants/queries";
import { isValidHexColor } from "@/lib/tenant-runtime/branding-validation";

type RouteContext = { params: Promise<{ tenantSlug: string }> };

// ── Validation helpers ────────────────────────────────────────────────────────

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Z]{2,4})?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
// Loose IANA tz check: non-empty, no spaces
const TIMEZONE_RE = /^[A-Za-z0-9/_+-]{2,60}$/;
// Hex color validation: delegated to branding-validation.ts (canonical single source of truth)

type ConfigPatch = Partial<{
  countryCode: string | null;
  sportCategory: string | null;
  locale: string | null;
  timezone: string | null;
  currency: string | null;
  seasonStartMonth: number;
  seasonTransitionDay: number;
  seasonTransitionMonth: number;
  // Branding v1 — Slice 10.6
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}>;

// String config fields are nullable: null or empty string → store NULL.
// Non-null, non-empty values are validated. Season integers are NOT NULL.
function validateConfig(body: Record<string, unknown>):
  | { ok: true; data: ConfigPatch }
  | { ok: false; error: string } {
  const patch: ConfigPatch = {};

  if ("countryCode" in body) {
    const raw = body.countryCode;
    if (raw === null || raw === "") { patch.countryCode = null; }
    else {
      const v = String(raw).trim().toUpperCase();
      if (!COUNTRY_CODE_RE.test(v)) return { ok: false, error: "countryCode muss ein 2-stelliger ISO-Ländercode sein (z.B. CH)." };
      patch.countryCode = v;
    }
  }
  if ("sportCategory" in body) {
    const raw = body.sportCategory;
    if (raw === null || raw === "") { patch.sportCategory = null; }
    else {
      const v = String(raw).trim().toUpperCase();
      if (!v) return { ok: false, error: "sportCategory darf nicht leer sein." };
      patch.sportCategory = v;
    }
  }
  if ("locale" in body) {
    const raw = body.locale;
    if (raw === null || raw === "") { patch.locale = null; }
    else {
      const v = String(raw).trim();
      if (!LOCALE_RE.test(v)) return { ok: false, error: "locale muss ein IETF-Tag sein (z.B. de-CH, en-GB)." };
      patch.locale = v;
    }
  }
  if ("timezone" in body) {
    const raw = body.timezone;
    if (raw === null || raw === "") { patch.timezone = null; }
    else {
      const v = String(raw).trim();
      if (!TIMEZONE_RE.test(v)) return { ok: false, error: "timezone muss eine gültige IANA-Zeitzone sein (z.B. Europe/Zurich)." };
      patch.timezone = v;
    }
  }
  if ("currency" in body) {
    const raw = body.currency;
    if (raw === null || raw === "") { patch.currency = null; }
    else {
      const v = String(raw).trim().toUpperCase();
      if (!CURRENCY_RE.test(v)) return { ok: false, error: "currency muss ein 3-stelliger ISO-Währungscode sein (z.B. CHF)." };
      patch.currency = v;
    }
  }
  if ("seasonStartMonth" in body) {
    const v = Number(body.seasonStartMonth);
    if (!Number.isInteger(v) || v < 1 || v > 12) return { ok: false, error: "seasonStartMonth muss eine Zahl zwischen 1 und 12 sein." };
    patch.seasonStartMonth = v;
  }
  if ("seasonTransitionDay" in body) {
    const v = Number(body.seasonTransitionDay);
    if (!Number.isInteger(v) || v < 1 || v > 31) return { ok: false, error: "seasonTransitionDay muss eine Zahl zwischen 1 und 31 sein." };
    patch.seasonTransitionDay = v;
  }
  if ("seasonTransitionMonth" in body) {
    const v = Number(body.seasonTransitionMonth);
    if (!Number.isInteger(v) || v < 1 || v > 12) return { ok: false, error: "seasonTransitionMonth muss eine Zahl zwischen 1 und 12 sein." };
    patch.seasonTransitionMonth = v;
  }

  // Branding v1 — Slice 10.6
  if ("logoUrl" in body) {
    const raw = body.logoUrl;
    if (raw === null || raw === "") { patch.logoUrl = null; }
    else {
      const v = String(raw).trim();
      if (!v) return { ok: false, error: "logoUrl darf nicht leer sein." };
      patch.logoUrl = v;
    }
  }
  if ("primaryColor" in body) {
    const raw = body.primaryColor;
    if (raw === null || raw === "") { patch.primaryColor = null; }
    else {
      const v = String(raw).trim();
      if (!isValidHexColor(v)) return { ok: false, error: "primaryColor muss ein 6-stelliger Hex-Farbwert sein (z.B. #1a2b3c)." };
      patch.primaryColor = v.toLowerCase();
    }
  }
  if ("secondaryColor" in body) {
    const raw = body.secondaryColor;
    if (raw === null || raw === "") { patch.secondaryColor = null; }
    else {
      const v = String(raw).trim();
      if (!isValidHexColor(v)) return { ok: false, error: "secondaryColor muss ein 6-stelliger Hex-Farbwert sein (z.B. #1a2b3c)." };
      patch.secondaryColor = v.toLowerCase();
    }
  }

  return { ok: true, data: patch };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { tenantSlug } = await params;
  const tenant = await getTenantDetail(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  return NextResponse.json({ tenant });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { tenantSlug } = await params;
  const existing = await prisma.tenant.findUnique({ where: { key: tenantSlug }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  if (existing.status === "ARCHIVED") {
    return NextResponse.json({ error: "Archivierter Tenant kann nicht bearbeitet werden." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));

  // Core fields
  const name = body?.name?.trim();
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Name darf nicht leer sein." }, { status: 400 });
  }

  const validStatuses = ["ACTIVE", "INACTIVE"] as const;
  type UpdatableStatus = (typeof validStatuses)[number];
  const status: UpdatableStatus | undefined = validStatuses.includes(body?.status)
    ? (body.status as UpdatableStatus)
    : undefined;

  // Config fields
  const configResult = validateConfig(body);
  if (!configResult.ok) return NextResponse.json({ error: configResult.error }, { status: 400 });

  try {
    const tenant = await prisma.tenant.update({
      where: { key: tenantSlug },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
        ...configResult.data,
      },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        updatedAt: true,
        countryCode: true,
        sportCategory: true,
        locale: true,
        timezone: true,
        currency: true,
        seasonStartMonth: true,
        seasonTransitionDay: true,
        seasonTransitionMonth: true,
        // Branding v1 — Slice 10.6
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
      },
    });
    return NextResponse.json({ tenant });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Tenant konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { tenantSlug } = await params;
  const existing = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  if (existing.status === "ARCHIVED") {
    return NextResponse.json({ error: "Tenant ist bereits archiviert." }, { status: 409 });
  }

  // Guard: do not archive the last ACTIVE tenant — the platform would become inaccessible.
  const activeCount = await prisma.tenant.count({ where: { status: "ACTIVE" } });
  if (activeCount <= 1) {
    return NextResponse.json(
      { error: "Der letzte aktive Tenant kann nicht archiviert werden." },
      { status: 409 },
    );
  }

  await prisma.tenant.update({ where: { key: tenantSlug }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ message: "Tenant wurde archiviert." });
}
