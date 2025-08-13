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

    const createdSandbox: any = await Sandbox.create({
      envs: {
        ANTHROPIC_API_KEY: apiKey,
      },
      timeoutMs: 300000,
    });

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

    const toy = {
      cowsay: {
        installed: false,
        installExit: null as number | null,
        runExit: null as number | null,
        stdout: "" as string,
        stderr: "" as string,
      },
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
        // Check if environment variable is set
        console.log("Checking environment variables...");
        const envCheck = await createdSandbox.commands.run(
          "echo $ANTHROPIC_API_KEY"
        );
        console.log("Environment check:", {
          exitCode: envCheck.exitCode,
          stdout: envCheck.stdout
            ? `${envCheck.stdout.substring(0, 10)}...`
            : "empty",
          stderr: envCheck.stderr,
        });

        try {
          console.log("Installing cowsay for toy example (pre-check)...");
          const cowsayInstall = await createdSandbox.commands.run(
            "sudo -n npm install -g cowsay || npm install -g cowsay"
          );
          console.log("Cowsay install result:", {
            exitCode: cowsayInstall.exitCode,
            stdout: cowsayInstall.stdout,
            stderr: cowsayInstall.stderr,
          });
          toy.cowsay.installExit = cowsayInstall.exitCode ?? null;
          if (cowsayInstall.exitCode === 0) {
            toy.cowsay.installed = true;
            const cowsayRun = await createdSandbox.commands.run(
              'cowsay "Hello from the sandbox"'
            );
            console.log("Cowsay run result:", {
              exitCode: cowsayRun.exitCode,
              stdout: cowsayRun.stdout,
              stderr: cowsayRun.stderr,
            });
            toy.cowsay.runExit = cowsayRun.exitCode ?? null;
            toy.cowsay.stdout = cowsayRun.stdout ?? "";
            toy.cowsay.stderr = cowsayRun.stderr ?? "";
          } else {
            toy.cowsay.stderr =
              cowsayInstall.stderr ?? cowsayInstall.stdout ?? "";
          }
        } catch (e) {
          toy.cowsay.stderr = e instanceof Error ? e.message : String(e);
        }

        console.log("Installing Claude Code SDK globally with sudo...");
        const installResult = await createdSandbox.commands.run(
          "sudo npm install -g @anthropic-ai/claude-code",
          { timeout: 130000 }
        );
        console.log(installResult);
        console.log("Install result:", {
          exitCode: installResult.exitCode,
          stdout: installResult.stdout,
          stderr: installResult.stderr,
        });

        if (installResult.exitCode === 0) {
          installationResults.claudeSDK.installed = true;

          // Test if Claude command exists without running it (to avoid hanging)
          console.log("Checking if Claude command is available...");
          const testResult = await createdSandbox.commands.run("which claude");
          console.log("Claude command check:", {
            exitCode: testResult.exitCode,
            stdout: testResult.stdout,
            stderr: testResult.stderr,
          });

          // Also check if the binary is executable
          const executableResult = await createdSandbox.commands.run(
            "command -v claude && ls -la $(which claude)"
          );
          console.log("Executable check:", {
            exitCode: executableResult.exitCode,
            stdout: executableResult.stdout,
            stderr: executableResult.stderr,
          });

          // If we can find the command, consider it successfully installed
          if (testResult.exitCode === 0 && testResult.stdout.trim()) {
            installationResults.claudeSDK.version = `globally installed at ${testResult.stdout.trim()}`;
            installationResults.environment.configured = true;

            // Optional: Test with a simple prompt (with timeout and limited turns)
            console.log("Testing Claude with a simple prompt...");
            try {
              const functionalTest = await createdSandbox.commands.run(
                'timeout 30s claude -p "Say hello"',
                { timeout: 35000 }
              );
              console.log("Functional test result:", {
                exitCode: functionalTest.exitCode,
                stdout: functionalTest.stdout?.substring(0, 200) + "...", // Truncate long output
                stderr: functionalTest.stderr?.substring(0, 200) + "...",
              });

              if (functionalTest.exitCode === 0) {
                installationResults.claudeSDK.version +=
                  " (tested and working)";
              } else if (functionalTest.exitCode === 124) {
                installationResults.claudeSDK.version +=
                  " (installed, timed out during test - normal)";
              }
            } catch (error) {
              console.log(
                "Functional test timed out or failed (this is expected):",
                error
              );
              installationResults.claudeSDK.version +=
                " (installed, test timeout - normal)";
            }
          } else {
            installationResults.claudeSDK.installed = false;
            installationResults.claudeSDK.error =
              "Claude command not found in PATH";
            installationResults.environment.configured = false;
          }
        } else {
          // If global install failed, try local installation as fallback
          console.log("Global install failed, trying local installation...");
          const localInstallResult = await createdSandbox.commands.run(
            "timeout 120s mkdir -p ~/claude-workspace && cd ~/claude-workspace && npm init -y && timeout 120s npm install @anthropic-ai/claude-code",
            { timeout: 130000 }
          );
          console.log("Local install result:", {
            exitCode: localInstallResult.exitCode,
            stdout: localInstallResult.stdout,
            stderr: localInstallResult.stderr,
          });

          if (localInstallResult.exitCode === 0) {
            installationResults.claudeSDK.installed = true;
            installationResults.claudeSDK.version = "installed locally";
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

    // Environment configuration is now handled within the SDK installation process above

    const info = {
      id,
      createdAt: new Date().toISOString(),
      claudeSDK: installationResults,
      toy,
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
