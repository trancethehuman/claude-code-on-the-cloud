import { NextRequest } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const sendMessage = (data: Record<string, unknown>) => {
        const json = JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${json}\n\n`));
      };

      const processRequest = async () => {
        try {
          const { id: sandboxId } = await params;
          const body = await request.json();
          const { command } = body;

          console.log("Terminal API request:", { sandboxId, command });

          if (!command || typeof command !== "string") {
            sendMessage({
              type: 'text-delta',
              id: 'error',
              delta: "❌ Command is required"
            });
            sendMessage({
              type: 'data',
              id: 'error-info',
              data: { error: "Command is required" }
            });
            controller.close();
            return;
          }

          // Stream command start
          sendMessage({
            type: 'text-delta',
            id: 'terminal-output',
            delta: `$ ${command}\n`
          });

          // Connect to existing sandbox
          let sandbox;
          try {
            sandbox = await Sandbox.get({ sandboxId });
            console.log(`Connected to sandbox: ${sandboxId}`);
            
            sendMessage({
              type: 'text-delta',
              id: 'terminal-output',
              delta: `Connected to sandbox ${sandboxId}...\n`
            });
          } catch (sandboxError) {
            console.error(`Failed to connect to sandbox ${sandboxId}:`, sandboxError);
            const errorMsg = sandboxError instanceof Error ? sandboxError.message : String(sandboxError);
            
            sendMessage({
              type: 'text-delta',
              id: 'terminal-output',
              delta: `❌ Sandbox not found or unavailable: ${errorMsg}\n`
            });
            
            sendMessage({
              type: 'data',
              id: 'error-info',
              data: { error: `Sandbox not found or unavailable: ${errorMsg}` }
            });
            controller.close();
            return;
          }

          // Parse command into cmd and args
          const trimmedCommand = command.trim();
          const parts = trimmedCommand.split(/\s+/);
          const cmd = parts[0];
          const args = parts.slice(1);

          console.log(`Executing terminal command: ${cmd}`, args);

          sendMessage({
            type: 'text-delta',
            id: 'terminal-output',
            delta: `Executing command...\n\n`
          });

          // Execute command directly in sandbox
          const commandResult = await sandbox.runCommand({
            cmd: cmd,
            args: args,
            sudo: false, // Default to non-sudo, user can prefix with 'sudo' if needed
          });

          const stdout = await commandResult.stdout();
          const stderr = await commandResult.stderr();

          console.log(`Terminal command completed - exitCode: ${commandResult.exitCode}, stdout length: ${stdout?.length || 0}, stderr length: ${stderr?.length || 0}`);

          // Stream output
          if (stdout) {
            sendMessage({
              type: 'text-delta',
              id: 'terminal-output',
              delta: `**Output:**\n\`\`\`\n${stdout}\n\`\`\`\n\n`
            });
          }

          if (stderr) {
            sendMessage({
              type: 'text-delta',
              id: 'terminal-output',
              delta: `**Error:**\n\`\`\`\n${stderr}\n\`\`\`\n\n`
            });
          }

          // Stream exit code
          const exitCodeColor = commandResult.exitCode === 0 ? '✅' : '❌';
          sendMessage({
            type: 'text-delta',
            id: 'terminal-output',
            delta: `${exitCodeColor} **Exit code:** ${commandResult.exitCode}\n\n`
          });

          // Send the result data
          sendMessage({
            type: 'data',
            id: 'terminal-result',
            data: {
              success: true,
              result: {
                command: trimmedCommand,
                exitCode: commandResult.exitCode,
                stdout: stdout || "",
                stderr: stderr || "",
              }
            }
          });

          controller.close();
        } catch (error: unknown) {
          console.error("Terminal API error:", error);
          const message = error instanceof Error ? error.message : "Failed to execute command";
          
          sendMessage({
            type: 'text-delta',
            id: 'terminal-output',
            delta: `❌ **Error:** ${message}\n\n`
          });

          sendMessage({
            type: 'data',
            id: 'error-info',
            data: { error: message }
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