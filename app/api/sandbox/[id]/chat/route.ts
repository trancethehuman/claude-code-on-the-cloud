import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { getAIToolConfig, extractSessionIdFromResponse, getResumeCommand, getContinueCommand } from "@/lib/ai-tools-config";
import { createUIMessageStreamResponse, createUIMessageStream } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sandboxId } = await params;
    const body = await request.json();
    const { messages, tool, apiKey, sessionId } = body;

    console.log("Chat API request:", { sandboxId, tool, sessionId, messagesCount: messages?.length || 0 });

    if (!tool || !["claude-code", "cursor-cli"].includes(tool)) {
      return NextResponse.json(
        { error: "Valid AI tool is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Get the user's current message from the useChat hook
    let prompt = "";
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        prompt = lastMessage.content;
      }
    }

    if (!prompt || !prompt.trim()) {
      console.log("No prompt found in messages:", messages);
      return NextResponse.json(
        { error: "No user message provided" },
        { status: 400 }
      );
    }
    
    const toolConfig = getAIToolConfig(tool);
    console.log(`Chatting with ${toolConfig.displayName} in sandbox ${sandboxId} with prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
    
    // Connect to existing sandbox
    let sandbox;
    try {
      sandbox = await Sandbox.get({ sandboxId });
      console.log(`Connected to sandbox: ${sandboxId}`);
    } catch (sandboxError) {
      console.error(`Failed to connect to sandbox ${sandboxId}:`, sandboxError);
      return NextResponse.json(
        { error: `Sandbox not found or unavailable: ${sandboxError instanceof Error ? sandboxError.message : String(sandboxError)}` },
        { status: 404 }
      );
    }

    // Prepare command arguments
    let commandArgs: string[];
    
    if (sessionId) {
      // Resume with specific session
      commandArgs = getResumeCommand(tool, sessionId);
      commandArgs = [...commandArgs, '-p', prompt];
      console.log(`Resuming session ${sessionId} with command:`, commandArgs);
    } else {
      // Continue latest session or create new one
      commandArgs = getContinueCommand(tool);
      commandArgs = [...commandArgs, '-p', prompt];
      console.log(`Continuing session with command:`, commandArgs);
    }

    let promptResult;
    
    if (tool === "claude-code") {
      // For Claude Code, use npx with environment variable
      // Properly escape command arguments for bash
      const escapedArgs = commandArgs.map(arg => {
        // If argument contains spaces or special characters, wrap in single quotes
        if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('&') || arg.includes('|')) {
          return `'${arg.replace(/'/g, "'\"'\"'")}'`; // Escape single quotes within the string
        }
        return arg;
      }).join(" ");
      
      promptResult = await sandbox.runCommand({
        cmd: "bash",
        args: [
          "-c",
          `export ${toolConfig.apiKeyEnvVar}="${apiKey}" && npx @anthropic-ai/claude-code ${escapedArgs}`,
        ],
        sudo: false,
      });
    } else {
      // For cursor-cli, use direct execution with API key flag
      const finalArgs = commandArgs.map(
        (arg) => (arg === "CURSOR_API_KEY_PLACEHOLDER" ? apiKey : arg)
      );

      promptResult = await sandbox.runCommand({
        cmd: "cursor-agent",
        args: finalArgs,
        sudo: false,
      });
    }

    const promptOutput = await promptResult.stdout();
    const promptError = await promptResult.stderr();

    console.log(`${toolConfig.displayName} response - exitCode: ${promptResult.exitCode}, output length: ${promptOutput?.length || 0}`);

    if (promptResult.exitCode !== 0) {
      console.error(`${toolConfig.displayName} error:`, promptError || promptOutput);
      return NextResponse.json(
        { error: `AI tool error: ${promptError || promptOutput || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Parse JSON response
    let parsedOutput = null;
    let extractedSessionId = null;
    
    if (promptOutput) {
      try {
        parsedOutput = JSON.parse(promptOutput);
        extractedSessionId = extractSessionIdFromResponse(tool, parsedOutput);
        
        console.log(`${toolConfig.displayName} session ID:`, extractedSessionId);
      } catch (parseError) {
        console.error(`Failed to parse ${toolConfig.displayName} output:`, parseError);
        
        // Return raw output as AI SDK compatible stream
        const stream = createUIMessageStream({
          execute({ writer }) {
            writer.write({
              type: 'text-delta',
              id: 'error-chunk',
              delta: promptOutput || "No response received"
            });

            writer.write({
              type: 'data-error-metadata',
              data: {
                tool,
                rawOutput: true,
                exitCode: promptResult.exitCode
              }
            });
          }
        });

        return createUIMessageStreamResponse({ stream });
      }
    }

    // Convert sandbox response to AI SDK UIMessage format
    const responseContent = parsedOutput?.result || promptOutput || "No response";
    
    // Create AI SDK compatible stream
    const stream = createUIMessageStream({
      execute({ writer }) {
        // Write the main text response
        writer.write({
          type: 'text-delta',
          id: 'text-chunk',
          delta: responseContent
        });

        // Write metadata as data part
        if (extractedSessionId || parsedOutput) {
          writer.write({
            type: 'data-session-metadata',
            data: {
              sessionId: extractedSessionId,
              tool,
              duration_ms: parsedOutput?.duration_ms,
              total_cost_usd: parsedOutput?.total_cost_usd,
              usage: parsedOutput?.usage,
              exitCode: promptResult.exitCode
            }
          });
        }
      }
    });

    return createUIMessageStreamResponse({ stream });
    
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Failed to process chat";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}