import { NextRequest, NextResponse } from "next/server";
import { getPublishedSnapshot } from "@/lib/website/page-queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantKey = searchParams.get("tenantKey")?.trim();
    const slug = searchParams.get("slug")?.trim();
    const locale = searchParams.get("locale")?.trim() ?? "de";

    if (!tenantKey || !slug) {
      return NextResponse.json(
        { error: "tenantKey and slug are required." },
        { status: 400 },
      );
    }

    const snapshot = await getPublishedSnapshot(tenantKey, slug, locale);

    if (!snapshot) {
      return NextResponse.json(
        { error: "Page not found or not published." },
        { status: 404 },
      );
    }

    return NextResponse.json({ tenantKey, locale, page: snapshot });
  } catch (error) {
    console.error("Public website page API failed:", error);
    return NextResponse.json(
      { error: "Could not load page." },
      { status: 500 },
    );
  }
}
