import { getSession } from "@/lib/auth";
import { deleteMemory } from "@/lib/memory";
import { NextResponse } from "next/server";

/**
 * DELETE /api/memory/{memoryId} — Delete a single memory (own only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memoryId } = await params;
    const deleted = await deleteMemory(memoryId, session.userId);

    if (!deleted) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete memory:", error);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
