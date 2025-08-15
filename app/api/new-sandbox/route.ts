import { Sandbox } from "@vercel/sandbox";
import { AITool, getAIToolConfig, extractSessionIdFromResponse, getResumeCommand, getContinueCommand } from "@/lib/ai-tools-config";
import { SANDBOX_ALIVE_TIME_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const sendMessage = (data: Record<string, unknown>) => {
        const json = JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${json}\n\n`));
      };

      const processRequest = async () => {
        try {
          const body = await request.json();
          const { apiKey, tool = "cursor-cli", sessionId, prompt = "hello", resumeSession = false } = body;

          if (!apiKey || typeof apiKey !== "string") {
            sendMessage({
              type: 'text-delta',
              id: 'error',
              delta: "❌ API key is required"
            });
            controller.close();
            return;
          }

          if (
            !tool ||
            typeof tool !== "string" ||
            !["claude-code", "cursor-cli"].includes(tool)
          ) {
            sendMessage({
              type: 'text-delta',
              id: 'error',
              delta: "❌ Valid AI tool selection is required"
            });
            controller.close();
            return;
          }

          const toolConfig = getAIToolConfig(tool as AITool);

          // Stream task start
          sendMessage({
            type: 'text-delta',
            id: 'setup-tasks',
            delta: `## Setting up ${toolConfig.displayName} Environment\n\n`
          });

          // Step 1: Creating sandbox
          sendMessage({
            type: 'text-delta',
            id: 'setup-tasks',
            delta: `### 🚀 Creating Vercel Sandbox\n\nInitializing sandbox environment...\n\n`
          });

          console.log(`Creating Vercel sandbox with ${toolConfig.displayName}...`);
          const createdSandbox = await Sandbox.create({
            resources: { vcpus: 2 },
            runtime: "node22",
            timeout: SANDBOX_ALIVE_TIME_MS,
          });

          const id = createdSandbox.sandboxId;
          
          sendMessage({
            type: 'text-delta',
            id: 'setup-tasks',
            delta: `✅ **Sandbox created successfully** (ID: \`${id}\`)\n\n`
          });

          // Initialize verification results
          const verificationResults = {
            cursorCLI: {
              installed: false,
              version: null as string | null,
              error: null as string | null,
              promptOutput: null as {
                stdout: string;
                stderr: string;
                exitCode: number;
                parsedJson?: Record<string, unknown>;
              } | null,
            },
            environment: { configured: false, error: null as string | null },
          };

          let extractedSessionId: string | null = null;

          try {
            // Step 2: Install AI tool
            sendMessage({
              type: 'text-delta',
              id: 'setup-tasks',
              delta: `### 📦 Installing ${toolConfig.displayName}\n\nDownloading and configuring ${toolConfig.displayName}...\n\n`
            });

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

            if (installResult.exitCode === 0) {
              sendMessage({
                type: 'text-delta',
                id: 'setup-tasks',
                delta: `✅ **${toolConfig.displayName} installed successfully**\n\n`
              });
            } else {
              sendMessage({
                type: 'text-delta',
                id: 'setup-tasks',
                delta: `⚠️ **Installation completed with warnings** (exit code: ${installResult.exitCode})\n\n`
              });
            }

            // Step 3: Test AI tool
            sendMessage({
              type: 'text-delta',
              id: 'setup-tasks',
              delta: `### 🧪 Testing ${toolConfig.displayName} Connection\n\n${resumeSession ? 'Resuming previous session...' : 'Establishing new session...'}\n\n`
            });

            console.log(`Testing ${toolConfig.displayName} with prompt${resumeSession ? ' (resuming session)' : ''}...`);

            let promptResult;
            let commandArgs: string[];

            if (resumeSession && sessionId) {
              // Resume existing session
              commandArgs = getResumeCommand(tool as AITool, sessionId);
              commandArgs = [...commandArgs, '-p', prompt];
            } else if (resumeSession && !sessionId) {
              // Continue latest session
              commandArgs = getContinueCommand(tool as AITool);
              commandArgs = [...commandArgs, '-p', prompt];
            } else {
              // New session with prompt
              commandArgs = [...toolConfig.verification.promptCommand.args];
              commandArgs = commandArgs.map(arg => arg === 'hello' ? prompt : arg);
            }

            if (tool === "claude-code") {
              // For Claude Code, use npx with environment variable (no sudo for prompts)
              promptResult = await createdSandbox.runCommand({
                cmd: "bash",
                args: [
                  "-c",
                  `export ${
                    toolConfig.apiKeyEnvVar
                  }="${apiKey}" && npx @anthropic-ai/claude-code ${commandArgs.join(" ")}`,
                ],
                sudo: false,
              });
            } else {
              // For cursor-cli, use direct execution with API key flag
              const finalArgs = commandArgs.map(
                (arg) => (arg === "CURSOR_API_KEY_PLACEHOLDER" ? apiKey : arg)
              );

              promptResult = await createdSandbox.runCommand({
                cmd: "cursor-agent",
                args: finalArgs,
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
                
                // Extract session ID from response
                extractedSessionId = extractSessionIdFromResponse(tool as AITool, parsedOutput);
                if (extractedSessionId) {
                  console.log(`${toolConfig.displayName} SESSION ID:`, extractedSessionId);
                }
              } catch {
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
                ...(extractedSessionId && { sessionId: extractedSessionId }),
              };

              sendMessage({
                type: 'text-delta',
                id: 'setup-tasks',
                delta: `✅ **${toolConfig.displayName} is working perfectly!**\n\n🔗 Tested with prompt: "${prompt}"\n\n`
              });
            } else {
              verificationResults.cursorCLI.installed = false;
              verificationResults.cursorCLI.error = `${
                toolConfig.displayName
              } test failed (exit ${promptResult.exitCode}): ${
                promptError || promptOutput || "no output"
              }`;
              verificationResults.environment.configured = false;

              sendMessage({
                type: 'text-delta',
                id: 'setup-tasks',
                delta: `❌ **${toolConfig.displayName} test failed** (exit code: ${promptResult.exitCode})\n\n`
              });
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

            sendMessage({
              type: 'text-delta',
              id: 'setup-tasks',
              delta: `❌ **Error during setup**: ${error instanceof Error ? error.message : String(error)}\n\n`
            });
          }

          // Step 4: Completion
          const info = {
            id,
            createdAt: new Date().toISOString(),
            timeoutMs: SANDBOX_ALIVE_TIME_MS,
            cursorCLI: verificationResults,
            provider: "vercel",
            tool: tool,
            toolName: toolConfig.displayName,
            initialPrompt: prompt,
            session: {
              id: extractedSessionId,
              resumed: resumeSession,
              requestedSessionId: sessionId,
            },
          };

          sendMessage({
            type: 'text-delta',
            id: 'setup-tasks',
            delta: `### 🎉 Setup Complete!\n\nYour ${toolConfig.displayName} environment is ready to use. You can now start chatting!\n\n---\n\n`
          });

          // Send the sandbox info as data
          sendMessage({
            type: 'data',
            id: 'sandbox-info',
            data: { success: true, sandbox: info }
          });

          controller.close();
        } catch (error: unknown) {
          console.error("Error in sandbox creation:", error);
          const message =
            error instanceof Error ? error.message : "Failed to create sandbox";
          
          sendMessage({
            type: 'text-delta',
            id: 'error',
            delta: `❌ **Setup failed**: ${message}\n\nPlease try again or check your API key.`
          });

          sendMessage({
            type: 'data',
            id: 'error-info',
            data: { success: false, error: message }
          });

          controller.close();
        }
      };

      // Start processing
      processRequest().catch((error) => {
        console.error("Unhandled error in processRequest:", error);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}