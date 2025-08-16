"use client";

import React, { useState, useEffect } from "react";
import { SessionInfo, AITool } from "@/lib/ai-tools-config";
import { ChatHeader } from "./chat/chat-header";
import { ChatMessages } from "./chat/chat-messages";
import { ChatInput } from "./chat/chat-input";
import { useChatSession } from "./chat/hooks/use-chat-session";
import { useSetupTasks } from "./chat/hooks/use-setup-tasks";

import { SandboxInfo } from "@/hooks/use-sandbox-storage";

interface SimpleChatProps {
  sandbox: SandboxInfo;
  apiKey: string;
  onNewSandbox: () => void;
  remainingTimeMs: number | null;
  formatTime: (ms: number) => string;
  onStopSandbox: () => void;
  isStoppingSandbox: boolean;
  isExpired?: boolean;
  streamingMessages?: string;
  initialPrompt?: string;
}

export function SimpleChat({
  sandbox,
  apiKey,
  onNewSandbox,
  remainingTimeMs,
  formatTime,
  onStopSandbox,
  isStoppingSandbox,
  isExpired = false,
  streamingMessages,
  initialPrompt,
}: SimpleChatProps) {
  // Use custom hooks
  const { currentSessionId, setCurrentSessionId, saveSession } = useChatSession(sandbox.tool as AITool);
  const { setupTasks } = useSetupTasks(sandbox, streamingMessages);

  // State declarations
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      metadata?: {
        sessionId?: string;
        duration_ms?: number;
        total_cost_usd?: number;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
        exitCode?: number;
      };
      type?: "chat" | "terminal" | "setup";
      terminalResult?: {
        command: string;
        exitCode: number;
        stdout: string;
        stderr: string;
      };
    }>
  >([]);

  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize session ID from sandbox
  useEffect(() => {
    if (sandbox.session?.id && !currentSessionId) {
      setCurrentSessionId(sandbox.session.id);
    }
  }, [sandbox.session?.id, currentSessionId, setCurrentSessionId]);

  // Add initial message from sandbox creation if available
  useEffect(() => {
    if (sandbox.cursorCLI?.cursorCLI.promptOutput && initialPrompt) {
      const promptOutput = sandbox.cursorCLI.cursorCLI.promptOutput;
      
      // Only add initial messages if we don't have any messages yet
      if (messages.length === 0) {
        const initialMessages = [
          {
            id: `initial_user_${Date.now()}`,
            role: "user" as const,
            content: initialPrompt,
            type: "chat" as const,
          },
          {
            id: `initial_assistant_${Date.now()}`,
            role: "assistant" as const,
            content: promptOutput.parsedJson?.result ? String(promptOutput.parsedJson.result) : promptOutput.stdout,
            type: "chat" as const,
            metadata: {
              sessionId: promptOutput.sessionId,
              duration_ms: promptOutput.parsedJson?.duration_ms ? Number(promptOutput.parsedJson.duration_ms) : undefined,
              total_cost_usd: promptOutput.parsedJson?.total_cost_usd ? Number(promptOutput.parsedJson.total_cost_usd) : undefined,
              usage: promptOutput.parsedJson?.usage ? {
                input_tokens: promptOutput.parsedJson.usage.input_tokens ? Number(promptOutput.parsedJson.usage.input_tokens) : undefined,
                output_tokens: promptOutput.parsedJson.usage.output_tokens ? Number(promptOutput.parsedJson.usage.output_tokens) : undefined,
              } : undefined,
              exitCode: promptOutput.exitCode,
            },
          },
        ];
        setMessages(initialMessages);
      }
    }
  }, [sandbox.cursorCLI?.cursorCLI.promptOutput, initialPrompt, messages.length]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    if (isTerminalMode) {
      // Terminal mode - execute command directly
      if (!sandbox.id) {
        setError("Sandbox ID is missing");
        setInput(currentInput);
        setIsLoading(false);
        return;
      }

      // Add the command echo and loading state immediately
      const loadingMessageId = `terminal_loading_${Date.now()}`;
      const loadingMessage = {
        id: loadingMessageId,
        role: "assistant" as const,
        content: "", // Not used for terminal messages
        type: "terminal" as const,
        terminalResult: {
          command: currentInput,
          exitCode: -1, // Special code to indicate loading
          stdout: "",
          stderr: "",
        },
      };

      setMessages((prev) => [...prev, loadingMessage]);

      try {
        const response = await fetch(`/api/sandbox/${sandbox.id}/terminal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command: currentInput,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Terminal command failed");
        }

        // Parse SSE streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let terminalResult = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  // Look for the terminal result data
                  if (
                    parsed.type === "data" &&
                    parsed.id === "terminal-result" &&
                    parsed.data?.result
                  ) {
                    terminalResult = parsed.data.result;
                  }
                } catch (e) {
                  console.warn("Failed to parse SSE chunk:", data, e);
                }
              }
            }
          }
        }

        // If we didn't get a result from the stream, throw an error
        if (!terminalResult) {
          throw new Error("No terminal result received from stream");
        }

        // Replace the loading message with the actual result
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  terminalResult: {
                    command: currentInput,
                    ...terminalResult,
                  },
                }
              : msg
          )
        );
      } catch (error) {
        console.error("Terminal error:", error);
        // Replace loading message with error result
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  terminalResult: {
                    command: currentInput,
                    exitCode: 1,
                    stdout: "",
                    stderr:
                      error instanceof Error
                        ? error.message
                        : "Failed to execute command",
                  },
                }
              : msg
          )
        );
        setError(
          error instanceof Error ? error.message : "Failed to execute command"
        );
        setInput(currentInput);
      }
    } else {
      // Chat mode - existing logic
      const userMessage = {
        id: `user_${Date.now()}`,
        role: "user" as const,
        content: currentInput,
        type: "chat" as const,
      };

      setMessages((prev) => [...prev, userMessage]);

      if (!sandbox.id) {
        setError("Sandbox ID is missing");
        setInput(currentInput);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/sandbox/${sandbox.id}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tool: sandbox.tool || "unknown",
            apiKey: apiKey,
            sessionId: currentSessionId,
            messages: [userMessage],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Chat request failed");
        }

        // Parse streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let assistantMetadata = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.type === "text-delta") {
                    assistantContent += parsed.delta;
                  } else if (
                    parsed.type === "data-session-metadata" ||
                    parsed.type === "data-error-metadata"
                  ) {
                    assistantMetadata = parsed.data;

                    // Update session ID if provided
                    if (parsed.data.sessionId) {
                      setCurrentSessionId(parsed.data.sessionId);

                      // Save updated session info to localStorage
                      const sessionInfo: SessionInfo = {
                        sessionId: parsed.data.sessionId,
                        toolType: (sandbox.tool || "unknown") as AITool,
                        sandboxId: sandbox.id!,
                        createdAt:
                          sandbox.session?.id === parsed.data.sessionId
                            ? new Date().toISOString() // This is a new session
                            : new Date().toISOString(), // For now, use current time - could be improved
                        lastUsedAt: new Date().toISOString(),
                      };
                      saveSession(sessionInfo);
                    }
                  }
                } catch (e) {
                  console.warn("Failed to parse chunk:", data, e);
                }
              }
            }
          }
        }

        const assistantMessage = {
          id: `assistant_${Date.now()}`,
          role: "assistant" as const,
          content: assistantContent || "No response received",
          metadata: assistantMetadata,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Chat error:", error);
        setError(
          error instanceof Error ? error.message : "Failed to send message"
        );
        setInput(currentInput);
      }
    }

    setIsLoading(false);
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
  };

  return (
    <div className="flex h-screen max-h-screen flex-col">
      <ChatHeader
        remainingTimeMs={remainingTimeMs}
        formatTime={formatTime}
        isExpired={isExpired}
        isStoppingSandbox={isStoppingSandbox}
        onNewChat={handleNewChat}
        onStopSandbox={onStopSandbox}
        onNewSandbox={onNewSandbox}
      />

      <ChatMessages
        messages={messages}
        setupTasks={setupTasks}
        toolName={sandbox.toolName}
        isTerminalMode={isTerminalMode}
        error={error}
      />

      <ChatInput
        isTerminalMode={isTerminalMode}
        setIsTerminalMode={setIsTerminalMode}
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        isExpired={isExpired}
        toolName={sandbox.toolName}
      />
    </div>
  );
}
