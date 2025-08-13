import { NextResponse } from "next/server";
import { Sandbox } from "@e2b/code-interpreter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { success: false, error: "Anthropic API key is required" },
        { status: 400 }
      );
    }

    const createdSandbox: any = await Sandbox.create();

    const id = createdSandbox?.id ?? createdSandbox?.sandboxId ?? null;

    // Install Claude Code SDK and set up environment
    const installationResults = {
      claudeSDK: {
        installed: false,
        version: null as string | null,
        error: null as string | null,
      },
      environment: { configured: false, error: null as string | null },
    };

    try {
      // First, ensure we have Node.js and npm available, and update npm
      console.log("Checking Node.js and npm availability...");
      const setupResult = await createdSandbox.commands.run(
        "node --version && npm --version"
      );
      console.log("Setup result:", {
        exitCode: setupResult.exitCode,
        stdout: setupResult.stdout,
        stderr: setupResult.stderr,
      });

      if (setupResult.exitCode === 0) {
        // First test with a simple package to see if npm works at all
        console.log("Testing npm with a simple package...");
        const testInstallResult = await createdSandbox.commands.run(
          "npm install cowsay"
        );
        console.log("Test install result:", {
          exitCode: testInstallResult.exitCode,
          stdout: testInstallResult.stdout,
          stderr: testInstallResult.stderr,
        });

        // Try installing Claude Code SDK directly
        console.log("Installing Claude Code SDK...");
        const installResult = await createdSandbox.commands.run(
          "npm install @anthropic-ai/claude-code"
        );
        console.log(installResult);
        console.log("Install result:", {
          exitCode: installResult.exitCode,
          stdout: installResult.stdout,
          stderr: installResult.stderr,
        });

        if (installResult.exitCode === 0) {
          installationResults.claudeSDK.installed = true;

          // Get version information
          console.log("Getting Claude version...");
          const versionResult = await createdSandbox.commands.run(
            "claude -p 'Hello!'"
          );
          console.log("Version result:", {
            exitCode: versionResult.exitCode,
            stdout: versionResult.stdout,
            stderr: versionResult.stderr,
          });

          if (versionResult.exitCode === 0) {
            installationResults.claudeSDK.version = versionResult.stdout.trim();
          }
        } else {
          // If global install failed, try local installation as fallback
          console.log("Global install failed, trying local installation...");
          const localInstallResult = await createdSandbox.commands.run(
            "mkdir -p ~/claude-workspace && cd ~/claude-workspace && npm init -y && npm install @anthropic-ai/claude-code"
          );
          console.log("Local install result:", {
            exitCode: localInstallResult.exitCode,
            stdout: localInstallResult.stdout,
            stderr: localInstallResult.stderr,
          });

          if (localInstallResult.exitCode === 0) {
            installationResults.claudeSDK.installed = true;
            installationResults.claudeSDK.version = "installed locally";
            // Create an alias for easier access
            await createdSandbox.commands.run(
              'echo "alias claude=\\"cd ~/claude-workspace && npx @anthropic-ai/claude-code\\"" >> ~/.bashrc'
            );
          } else {
            installationResults.claudeSDK.error = `Both global and local installation failed. Global: (exit ${
              installResult.exitCode
            }): ${installResult.stderr || installResult.stdout}. Local: (exit ${
              localInstallResult.exitCode
            }): ${localInstallResult.stderr || localInstallResult.stdout}`;
          }
        }
      } else {
        installationResults.claudeSDK.error = `Node.js/npm check failed (exit ${
          setupResult.exitCode
        }): ${setupResult.stderr || setupResult.stdout}`;
      }
    } catch (error) {
      console.error("Exception during installation:", error);
      installationResults.claudeSDK.error =
        error instanceof Error ? error.message : "Unknown installation error";
    }

    // Configure environment variables with the provided API key
    try {
      console.log("Configuring environment variables...");
      // Add to both .bashrc and .profile for persistence
      const envResult = await createdSandbox.commands.run(
        `echo 'export ANTHROPIC_API_KEY="${apiKey}"' >> ~/.bashrc && echo 'export ANTHROPIC_API_KEY="${apiKey}"' >> ~/.profile`
      );
      console.log("Environment result:", {
        exitCode: envResult.exitCode,
        stdout: envResult.stdout,
        stderr: envResult.stderr,
      });

      installationResults.environment.configured = envResult.exitCode === 0;
      if (envResult.exitCode !== 0) {
        installationResults.environment.error = `Environment setup failed (exit ${
          envResult.exitCode
        }): ${envResult.stderr || envResult.stdout || "Unknown error"}`;
      }
    } catch (error) {
      console.error("Exception during environment setup:", error);
      installationResults.environment.error =
        error instanceof Error
          ? error.message
          : "Environment configuration error";
    }

    const info = {
      id,
      createdAt: new Date().toISOString(),
      claudeSDK: installationResults,
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
