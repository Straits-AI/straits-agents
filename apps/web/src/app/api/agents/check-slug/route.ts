import { getDB } from "@/lib/db";
import { RESERVED_SLUGS } from "@/lib/agentTemplates";
import { NextResponse } from "next/server";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "slug parameter required" }, { status: 400 });
    }

    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json({
        available: false,
        reason: "Invalid format. Use 3-50 lowercase letters, numbers, and hyphens.",
      });
    }

    if (RESERVED_SLUGS.includes(slug)) {
      // Suggest an alternative
      const suggestion = `my-${slug}`;
      return NextResponse.json({
        available: false,
        reason: "This slug is reserved.",
        suggestion: SLUG_REGEX.test(suggestion) ? suggestion : undefined,
      });
    }

    const db = await getDB();
    const existing = await db
      .prepare("SELECT id FROM agents WHERE slug = ? AND is_active = 1")
      .bind(slug)
      .first<{ id: string }>();

    if (existing) {
      // Try appending a number
      for (let i = 2; i <= 10; i++) {
        const alt = `${slug}-${i}`;
        if (!SLUG_REGEX.test(alt)) break;
        const altExists = await db
          .prepare("SELECT id FROM agents WHERE slug = ? AND is_active = 1")
          .bind(alt)
          .first<{ id: string }>();
        if (!altExists) {
          return NextResponse.json({
            available: false,
            reason: "This slug is already taken.",
            suggestion: alt,
          });
        }
      }
      return NextResponse.json({
        available: false,
        reason: "This slug is already taken.",
      });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error("Failed to check slug:", error);
    return NextResponse.json(
      { error: "Failed to check slug" },
      { status: 500 }
    );
  }
}
