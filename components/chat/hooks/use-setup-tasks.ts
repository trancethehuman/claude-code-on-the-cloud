import { useState, useEffect } from 'react';
import { SetupTask, TaskStatus } from '../../setup-status';
import { getAIToolConfig } from '@/lib/ai-tools-config';

interface SandboxData {
  id: string | null;
  toolName?: string;
  tool?: string;
  session?: { id: string | null };
  cursorCLI?: {
    cursorCLI?: {
      installed?: boolean;
      error?: string;
      version?: string;
      promptOutput?: {
        sessionId?: string;
        parsedJson?: {
          result?: string;
          duration_ms?: number;
          total_cost_usd?: number;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
          };
        };
      };
    };
    environment?: { configured?: boolean; error?: string };
  };
}

export function useSetupTasks(sandbox: SandboxData, streamingMessages?: string) {
  const [setupTasks, setSetupTasks] = useState<SetupTask[]>([]);

  // Initialize and update setup tasks based on sandbox state
  useEffect(() => {
    if (!sandbox.id && sandbox.toolName) {
      // This means we're in the creation process - initialize setup tasks
      const toolConfig = sandbox.tool ? getAIToolConfig(sandbox.tool as 'claude-code' | 'cursor-cli') : null;
      const displayName = toolConfig?.displayName || sandbox.toolName;
      
      const initialTasks: SetupTask[] = [
        {
          id: "create-sandbox",
          title: "Create Vercel Sandbox",
          status: "in-progress",
          description: "Initializing sandbox environment...",
        },
        {
          id: "install-tool",
          title: `Install ${displayName}`,
          status: "pending",
          description: "Downloading and configuring...",
        },
        {
          id: "test-connection",
          title: "Processing Initial Request",
          status: "pending",
          description: "Processing your request...",
        },
      ];

      setSetupTasks(initialTasks);
    } else if (sandbox.id && setupTasks.length > 0) {
      // Update tasks based on current sandbox state
      const toolInstalled = sandbox.cursorCLI?.cursorCLI?.installed;
      const envConfigured = sandbox.cursorCLI?.environment?.configured;
      const hasError =
        sandbox.cursorCLI?.cursorCLI?.error ||
        sandbox.cursorCLI?.environment?.error;

      setSetupTasks((prev) =>
        prev.map((task) => {
          if (task.id === "create-sandbox") {
            return {
              ...task,
              status: "completed" as TaskStatus,
              description: `Sandbox created successfully`,
            };
          } else if (task.id === "install-tool") {
            if (hasError && !toolInstalled) {
              return {
                ...task,
                status: "failed" as TaskStatus,
                error: sandbox.cursorCLI?.cursorCLI?.error,
                description: "Installation failed",
              };
            } else if (toolInstalled) {
              return {
                ...task,
                status: "completed" as TaskStatus,
                description: `${sandbox.toolName} installed successfully`,
              };
            } else {
              return {
                ...task,
                status: "in-progress" as TaskStatus,
                description: "Installing and configuring...",
              };
            }
          } else if (task.id === "test-connection") {
            if (hasError && toolInstalled) {
              return {
                ...task,
                status: "failed" as TaskStatus,
                error: sandbox.cursorCLI?.environment?.error,
                description: "Request processing failed",
              };
            } else if (toolInstalled && envConfigured) {
              const initialPrompt = (
                sandbox as typeof sandbox & { initialPrompt?: string }
              ).initialPrompt;
              return {
                ...task,
                status: "completed" as TaskStatus,
                description: "Request processed successfully",
                details: initialPrompt ? [`Working on: "${initialPrompt}"`] : undefined,
              };
            } else if (toolInstalled) {
              return {
                ...task,
                status: "in-progress" as TaskStatus,
                description: "Processing your request...",
              };
            } else {
              return task;
            }
          }
          return task;
        })
      );
    } else if (sandbox.id && setupTasks.length === 0) {
      // Sandbox already exists and no setup tasks - this is a resumed session or direct navigation
      setSetupTasks([]);
    }
  }, [sandbox, setupTasks.length]);

  // Parse streaming messages to update task status in real-time
  useEffect(() => {
    if (!streamingMessages || setupTasks.length === 0) return;

    setSetupTasks((prev) =>
      prev.map((task) => {
        if (task.id === "create-sandbox") {
          if (
            streamingMessages.includes("✅ **Sandbox created successfully**")
          ) {
            return {
              ...task,
              status: "completed" as TaskStatus,
              description: "Sandbox created successfully",
            };
          } else if (streamingMessages.includes("Creating Vercel Sandbox")) {
            return {
              ...task,
              status: "in-progress" as TaskStatus,
              description: "Creating sandbox environment...",
            };
          }
        } else if (task.id === "install-tool") {
          if (
            streamingMessages.includes(
              `✅ **${sandbox.toolName} installed successfully**`
            )
          ) {
            return {
              ...task,
              status: "completed" as TaskStatus,
              description: `${sandbox.toolName} installed successfully`,
            };
          } else if (
            streamingMessages.includes(
              `⚠️ **Installation completed with warnings**`
            )
          ) {
            return {
              ...task,
              status: "completed" as TaskStatus,
              description: "Installation completed with warnings",
            };
          } else if (
            streamingMessages.includes(`Installing ${sandbox.toolName}`) ||
            streamingMessages.includes(`📦 Installing ${sandbox.toolName}`)
          ) {
            return {
              ...task,
              status: "in-progress" as TaskStatus,
              description: `Installing ${sandbox.toolName}...`,
            };
          } else if (
            streamingMessages.includes("❌") &&
            streamingMessages.includes("setup")
          ) {
            return {
              ...task,
              status: "failed" as TaskStatus,
              error: "Installation failed",
              description: "Installation failed",
            };
          }
        } else if (task.id === "test-connection") {
          if (
            streamingMessages.includes(
              `✅ **${sandbox.toolName} is working perfectly!**`
            )
          ) {
            const promptMatch = streamingMessages.match(
              /🔗 Tested with prompt: "([^"]+)"/
            );
            const prompt = promptMatch ? promptMatch[1] : "";
            return {
              ...task,
              status: "completed" as TaskStatus,
              description: "Request processed successfully",
              details: prompt ? [`Working on: "${prompt}"`] : ["Ready to use"],
            };
          } else if (
            streamingMessages.includes(`❌ **${sandbox.toolName} test failed**`)
          ) {
            return {
              ...task,
              status: "failed" as TaskStatus,
              error: "Request processing failed",
              description: "Request processing failed",
            };
          } else if (
            streamingMessages.includes(
              `Testing ${sandbox.toolName} Connection`
            ) ||
            streamingMessages.includes(
              `🧪 Testing ${sandbox.toolName} Connection`
            )
          ) {
            return {
              ...task,
              status: "in-progress" as TaskStatus,
              description: "Processing your request...",
            };
          }
        }
        return task;
      })
    );
  }, [streamingMessages, setupTasks.length, sandbox.toolName]);

  return {
    setupTasks,
    setSetupTasks,
  };
}