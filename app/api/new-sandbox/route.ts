import { NextResponse } from "next/server";
import { Sandbox } from "@e2b/code-interpreter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const createdSandbox: any = await Sandbox.create();

    const id = createdSandbox?.id ?? createdSandbox?.sandboxId ?? null;
    const info = {
      id,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, sandbox: info }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create sandbox";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
