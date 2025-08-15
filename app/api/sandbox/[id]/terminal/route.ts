import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sandboxId } = await params;
    const body = await request.json();
    const { command } = body;

    console.log("Terminal API request:", { sandboxId, command });

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    // Connect to existing sandbox
    let sandbox;
    try {
      sandbox = await Sandbox.get({ sandboxId });
      console.log(`Connected to sandbox: ${sandboxId}, status: ${sandbox.sandbox.status}`);
    } catch (sandboxError) {
      console.error(`Failed to connect to sandbox ${sandboxId}:`, sandboxError);
      return NextResponse.json(
        { error: `Sandbox not found or unavailable: ${sandboxError instanceof Error ? sandboxError.message : String(sandboxError)}` },
        { status: 404 }
      );
    }

    // Parse command into cmd and args
    const trimmedCommand = command.trim();
    const parts = trimmedCommand.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    console.log(`Executing terminal command: ${cmd}`, args);

    // Execute command directly in sandbox
    const commandResult = await sandbox.runCommand({
      cmd: cmd,
      args: args,
      sudo: false, // Default to non-sudo, user can prefix with 'sudo' if needed
    });

    const stdout = await commandResult.stdout();
    const stderr = await commandResult.stderr();

    console.log(`Terminal command completed - exitCode: ${commandResult.exitCode}, stdout length: ${stdout?.length || 0}, stderr length: ${stderr?.length || 0}`);

    return NextResponse.json({
      success: true,
      result: {
        command: trimmedCommand,
        exitCode: commandResult.exitCode,
        stdout: stdout || "",
        stderr: stderr || "",
      }
    });
    
  } catch (error: unknown) {
    console.error("Terminal API error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute command";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}