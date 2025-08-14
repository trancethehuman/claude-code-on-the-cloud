import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import { AITool, getAIToolConfig } from "@/lib/ai-tools-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, tool = "cursor-cli" } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
    }

    if (
      !tool ||
      typeof tool !== "string" ||
      !["claude-code", "cursor-cli"].includes(tool)
    ) {
      return NextResponse.json(
        { success: false, error: "Valid AI tool selection is required" },
        { status: 400 }
      );
    }

    const toolConfig = getAIToolConfig(tool as AITool);

    console.log(`Creating Vercel sandbox with ${toolConfig.displayName}...`);
    const createdSandbox = await Sandbox.create({
      resources: { vcpus: 2 },
      runtime: "node22",
      timeout: ms("5m"),
    });

    const id = createdSandbox.sandboxId;

    // Install Cursor CLI and verify availability
    const verificationResults = {
      cursorCLI: {
        installed: false,
        version: null as string | null,
        error: null as string | null,
        promptOutput: null as {
          stdout: string;
          stderr: string;
          exitCode: number;
          parsedJson?: any;
        } | null,
      },
      environment: { configured: false, error: null as string | null },
    };

    try {
      // Install AI tool
      console.log(`Installing ${toolConfig.displayName}...`);
      const installResult = await createdSandbox.runCommand({
        cmd: toolConfig.installation.command,
        args: toolConfig.installation.args,
        sudo: toolConfig.installation.sudo,
      });
      const installOutput = await installResult.stdout();
      const installError = await installResult.stderr();
      console.log(`${toolConfig.displayName} installation result:`, {
        exitCode: installResult.exitCode,
        output: installOutput
          ? installOutput.substring(0, 200) + "..."
          : "none",
        error: installError ? installError.substring(0, 200) + "..." : "none",
      });

      // Test the tool directly with a prompt
      console.log(`Testing ${toolConfig.displayName} with prompt...`);

      let promptResult;
      if (tool === "claude-code") {
        // For Claude Code, use npx with environment variable
        promptResult = await createdSandbox.runCommand({
          cmd: "bash",
          args: [
            "-c",
            `export ${
              toolConfig.apiKeyEnvVar
            }="${apiKey}" && npx @anthropic-ai/claude-code ${toolConfig.verification.promptCommand.args.join(
              " "
            )}`,
          ],
          sudo: true,
        });
      } else {
        // For cursor-cli, use direct execution with API key flag
        const promptArgs = toolConfig.verification.promptCommand.args.map(
          (arg) => (arg === "CURSOR_API_KEY_PLACEHOLDER" ? apiKey : arg)
        );

        promptResult = await createdSandbox.runCommand({
          cmd: "cursor-agent",
          args: promptArgs,
          sudo: true,
        });
      }

      const promptOutput = await promptResult.stdout();
      const promptError = await promptResult.stderr();

      // Parse and log JSON output
      let parsedOutput = null;
      if (promptOutput) {
        try {
          parsedOutput = JSON.parse(promptOutput);
          console.log(
            `${toolConfig.displayName} PARSED JSON:`,
            JSON.stringify(parsedOutput, null, 2)
          );
        } catch (parseError) {
          console.log(
            `${toolConfig.displayName} RAW OUTPUT (not JSON):`,
            promptOutput
          );
        }
      }

      if (promptError) {
        console.log(`${toolConfig.displayName} ERROR OUTPUT:`, promptError);
      }

      if (promptResult.exitCode === 0) {
        verificationResults.cursorCLI.installed = true;
        verificationResults.environment.configured = true;
        verificationResults.cursorCLI.version = `${toolConfig.displayName} working (exit ${promptResult.exitCode})`;
        verificationResults.cursorCLI.promptOutput = {
          stdout: promptOutput || "",
          stderr: promptError || "",
          exitCode: promptResult.exitCode,
          parsedJson: parsedOutput,
        };
      } else {
        verificationResults.cursorCLI.installed = false;
        verificationResults.cursorCLI.error = `${
          toolConfig.displayName
        } test failed (exit ${promptResult.exitCode}): ${
          promptError || promptOutput || "no output"
        }`;
        verificationResults.environment.configured = false;
      }
    } catch (error) {
      console.error(
        `Exception during ${toolConfig.displayName} installation/verification:`,
        error
      );
      verificationResults.cursorCLI.error =
        error instanceof Error
          ? error.message
          : `Unknown verification error: ${String(error)}`;
    }

    const info = {
      id,
      createdAt: new Date().toISOString(),
      cursorCLI: verificationResults,
      provider: "vercel",
      tool: tool,
      toolName: toolConfig.displayName,
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
