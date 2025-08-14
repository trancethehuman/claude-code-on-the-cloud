import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Sandbox ID is required" },
        { status: 400 }
      );
    }

    console.log(`Stopping sandbox with ID: ${id}`);
    
    // Get the sandbox instance by ID
    const sandbox = await Sandbox.get({ sandboxId: id });
    
    // Stop the sandbox
    await sandbox.stop();
    
    console.log(`Successfully stopped sandbox: ${id}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error stopping sandbox:", error);
    const message =
      error instanceof Error ? error.message : "Failed to stop sandbox";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}