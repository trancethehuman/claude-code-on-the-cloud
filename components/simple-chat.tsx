"use client";

import React, { useState, useMemo } from "react";
import { Square, RotateCcw, Plus, AlertCircle } from "lucide-react";
import { SessionInfo, AITool } from "@/lib/ai-tools-config";
import { TerminalMessage } from "./terminal-message";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
// Removed Tooltip imports to fix infinite re-render issue
import { Loader } from "./ai-elements/loader";
import { 
  PromptInput, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit,
  PromptInputTools 
} from "./ai-elements/prompt-input";
import { Response } from "./ai-elements/response";
import { SetupProgress, SetupTask, TaskStatus } from "./setup-progress";

interface SimpleChatProps {
  sandbox: { id: string | null; tool?: string; toolName?: string; session?: { id: string | null } };
  apiKey: string;
  onNewSandbox: () => void;
  remainingTimeMs: number | null;
  formatTime: (ms: number) => string;
  onStopSandbox: () => void;
  isStoppingSandbox: boolean;
  isExpired?: boolean;
  streamingMessages?: string;
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
  streamingMessages
}: SimpleChatProps) {
  // Save updated session to localStorage
  const saveSession = (sessionInfo: SessionInfo) => {
    const tool = sandbox.tool || 'unknown';
    const sessionsKey = `claude-code-cloud-sessions-${tool}`;
    const currentSessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]') as SessionInfo[];
    
    // Remove existing session with same ID if it exists
    const existingIndex = currentSessions.findIndex(s => s.sessionId === sessionInfo.sessionId);
    if (existingIndex >= 0) {
      currentSessions[existingIndex] = sessionInfo;
    } else {
      currentSessions.push(sessionInfo);
    }
    
    // Keep only the 10 most recent sessions
    currentSessions.sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
    const limitedSessions = currentSessions.slice(0, 10);
    
    localStorage.setItem(sessionsKey, JSON.stringify(limitedSessions));
  };
  const [messages, setMessages] = useState<Array<{
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
  }>>([]);

  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sandbox.session?.id || null
  );
  const [setupTasks, setSetupTasks] = useState<SetupTask[]>([]);

  // Initialize and update setup tasks based on sandbox state
  React.useEffect(() => {
    if (!sandbox.id && sandbox.toolName) {
      // This means we're in the creation process - initialize setup tasks
      const initialTasks: SetupTask[] = [
        {
          id: 'create-sandbox',
          title: 'Create Vercel Sandbox',
          status: 'in-progress',
          description: 'Initializing sandbox environment...',
        },
        {
          id: 'install-tool',
          title: `Install ${sandbox.toolName}`,
          status: 'pending',
          description: 'Downloading and configuring...',
        },
        {
          id: 'test-connection',
          title: 'Test Connection',
          status: 'pending',
          description: 'Verifying installation and API connection...',
        },
      ];
      
      setSetupTasks(initialTasks);
      setMessages([]);
    } else if (sandbox.id && setupTasks.length > 0) {
      // Update tasks based on current sandbox state
      const sandboxData = sandbox as typeof sandbox & {
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
      };
      const toolInstalled = sandboxData.cursorCLI?.cursorCLI?.installed;
      const envConfigured = sandboxData.cursorCLI?.environment?.configured;
      const hasError = sandboxData.cursorCLI?.cursorCLI?.error || sandboxData.cursorCLI?.environment?.error;
      
      setSetupTasks(prev => prev.map(task => {
        if (task.id === 'create-sandbox') {
          return {
            ...task,
            status: 'completed' as TaskStatus,
            description: `Sandbox created successfully`,
            details: [`Sandbox ID: ${sandbox.id}`]
          };
        } else if (task.id === 'install-tool') {
          if (hasError && !toolInstalled) {
            return {
              ...task,
              status: 'failed' as TaskStatus,
              error: sandboxData.cursorCLI?.cursorCLI?.error,
              description: 'Installation failed'
            };
          } else if (toolInstalled) {
            return {
              ...task,
              status: 'completed' as TaskStatus,
              description: `${sandbox.toolName} installed successfully`,
              details: sandboxData.cursorCLI?.cursorCLI?.version ? [`Version: ${sandboxData.cursorCLI.cursorCLI.version}`] : undefined
            };
          } else {
            return {
              ...task,
              status: 'in-progress' as TaskStatus,
              description: 'Installing and configuring...'
            };
          }
        } else if (task.id === 'test-connection') {
          if (hasError && toolInstalled) {
            return {
              ...task,
              status: 'failed' as TaskStatus,
              error: sandboxData.cursorCLI?.environment?.error,
              description: 'Connection test failed'
            };
          } else if (toolInstalled && envConfigured) {
            const sessionId = sandbox.session?.id;
            return {
              ...task,
              status: 'completed' as TaskStatus,
              description: 'Connection verified and session established',
              details: sessionId ? [`Session ID: ${sessionId}`] : ['Ready to use']
            };
          } else if (toolInstalled) {
            return {
              ...task,
              status: 'in-progress' as TaskStatus,
              description: 'Testing connection and API setup...'
            };
          } else {
            return task;
          }
        }
        return task;
      }));
      
      // If setup is complete and we have an initial prompt response, add it to messages
      const isSetupComplete = toolInstalled && envConfigured && !hasError;
      if (isSetupComplete && messages.length === 0) {
        const promptOutput = sandboxData.cursorCLI?.cursorCLI?.promptOutput;
        if (promptOutput?.parsedJson?.result) {
          const initialResponse = {
            id: 'initial-response',
            role: "assistant" as const,
            content: String(promptOutput.parsedJson.result),
            metadata: {
              sessionId: promptOutput.sessionId,
              duration_ms: promptOutput.parsedJson.duration_ms,
              total_cost_usd: promptOutput.parsedJson.total_cost_usd,
              usage: promptOutput.parsedJson.usage
            }
          };
          
          setMessages([initialResponse]);
        }
      }
    } else if (sandbox.id && setupTasks.length === 0) {
      // Sandbox already exists and no setup tasks - this is a resumed session or direct navigation
      setSetupTasks([]);
    }
  }, [sandbox.id, sandbox.toolName, sandbox.session?.id, JSON.stringify((sandbox as typeof sandbox & {
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
  }).cursorCLI)]);

  // Parse streaming messages to update task status in real-time
  React.useEffect(() => {
    if (!streamingMessages || setupTasks.length === 0) return;

    setSetupTasks(prev => prev.map(task => {
      if (task.id === 'create-sandbox') {
        if (streamingMessages.includes('✅ **Sandbox created successfully**')) {
          const sandboxIdMatch = streamingMessages.match(/ID: `([^`]+)`/);
          const sandboxId = sandboxIdMatch ? sandboxIdMatch[1] : '';
          return {
            ...task,
            status: 'completed' as TaskStatus,
            description: 'Sandbox created successfully',
            details: sandboxId ? [`Sandbox ID: ${sandboxId}`] : undefined
          };
        } else if (streamingMessages.includes('Creating Vercel Sandbox')) {
          return {
            ...task,
            status: 'in-progress' as TaskStatus,
            description: 'Creating sandbox environment...'
          };
        }
      } else if (task.id === 'install-tool') {
        if (streamingMessages.includes(`✅ **${sandbox.toolName} installed successfully**`)) {
          return {
            ...task,
            status: 'completed' as TaskStatus,
            description: `${sandbox.toolName} installed successfully`
          };
        } else if (streamingMessages.includes(`⚠️ **Installation completed with warnings**`)) {
          return {
            ...task,
            status: 'completed' as TaskStatus,
            description: 'Installation completed with warnings'
          };
        } else if (streamingMessages.includes(`Installing ${sandbox.toolName}`) || 
                   streamingMessages.includes(`📦 Installing ${sandbox.toolName}`)) {
          return {
            ...task,
            status: 'in-progress' as TaskStatus,
            description: `Installing ${sandbox.toolName}...`
          };
        } else if (streamingMessages.includes('❌') && streamingMessages.includes('setup')) {
          return {
            ...task,
            status: 'failed' as TaskStatus,
            error: 'Installation failed',
            description: 'Installation failed'
          };
        }
      } else if (task.id === 'test-connection') {
        if (streamingMessages.includes(`✅ **${sandbox.toolName} is working perfectly!**`)) {
          const sessionMatch = streamingMessages.match(/🔗 Session ID: `([^`]+)`/);
          const sessionId = sessionMatch ? sessionMatch[1] : '';
          return {
            ...task,
            status: 'completed' as TaskStatus,
            description: 'Connection verified and session established',
            details: sessionId ? [`Session ID: ${sessionId}`] : ['Ready to use']
          };
        } else if (streamingMessages.includes(`❌ **${sandbox.toolName} test failed**`)) {
          return {
            ...task,
            status: 'failed' as TaskStatus,
            error: 'Connection test failed',
            description: 'Connection test failed'
          };
        } else if (streamingMessages.includes(`Testing ${sandbox.toolName} Connection`) || 
                   streamingMessages.includes(`🧪 Testing ${sandbox.toolName} Connection`)) {
          return {
            ...task,
            status: 'in-progress' as TaskStatus,
            description: 'Testing connection and API setup...'
          };
        }
      }
      return task;
    }));
  }, [streamingMessages, setupTasks.length, sandbox.toolName]);

  // Memoize props to prevent infinite re-renders in PromptInputSubmit
  const submitStatus = useMemo(() => {
    return isLoading ? "streaming" : "ready";
  }, [isLoading]);

  const isSubmitDisabled = useMemo(() => {
    return isLoading || !input.trim() || isExpired;
  }, [isLoading, input, isExpired]);

  const submitButtonText = useMemo(() => {
    if (isLoading) {
      return isTerminalMode ? 'Running...' : 'Sending...';
    }
    return isTerminalMode ? 'Run' : 'Send';
  }, [isLoading, isTerminalMode]);

  // Memoize Switch props to prevent re-renders
  const isSwitchDisabled = useMemo(() => {
    return isLoading || isExpired;
  }, [isLoading, isExpired]);

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

      setMessages(prev => [...prev, loadingMessage]);
      
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
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Look for the terminal result data
                  if (parsed.type === 'data' && parsed.id === 'terminal-result' && parsed.data?.result) {
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
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMessageId 
            ? {
                ...msg,
                terminalResult: {
                  command: currentInput,
                  ...terminalResult
                }
              }
            : msg
        ));
      } catch (error) {
        console.error("Terminal error:", error);
        // Replace loading message with error result
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMessageId 
            ? {
                ...msg,
                terminalResult: {
                  command: currentInput,
                  exitCode: 1,
                  stdout: "",
                  stderr: error instanceof Error ? error.message : "Failed to execute command"
                }
              }
            : msg
        ));
        setError(error instanceof Error ? error.message : "Failed to execute command");
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

      setMessages(prev => [...prev, userMessage]);

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
          tool: sandbox.tool || 'unknown',
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
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'text-delta') {
                  assistantContent += parsed.delta;
                } else if (parsed.type === 'data-session-metadata' || parsed.type === 'data-error-metadata') {
                  assistantMetadata = parsed.data;
                  
                  // Update session ID if provided
                  if (parsed.data.sessionId) {
                    setCurrentSessionId(parsed.data.sessionId);
                    
                    // Save updated session info to localStorage
                    const sessionInfo: SessionInfo = {
                      sessionId: parsed.data.sessionId,
                      toolType: (sandbox.tool || 'unknown') as AITool,
                      sandboxId: sandbox.id!,
                      createdAt: sandbox.session?.id === parsed.data.sessionId ? 
                        new Date().toISOString() : // This is a new session
                        new Date().toISOString(), // For now, use current time - could be improved
                      lastUsedAt: new Date().toISOString()
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

      setMessages(prev => [...prev, assistantMessage]);

      } catch (error) {
        console.error("Chat error:", error);
        setError(error instanceof Error ? error.message : "Failed to send message");
        setInput(currentInput);
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen max-h-screen flex-col">
      {/* Header with sandbox info */}
      <div className="border-b bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{sandbox.toolName || 'AI Tool'} Chat</h2>
              <span className="text-xs text-muted-foreground">
                Sandbox: {sandbox.id ? sandbox.id.slice(0, 8) + '...' : 'N/A'}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {remainingTimeMs !== null && (
                <div className="flex items-center gap-1">
                  <span>Time remaining:</span>
                  <span className={`font-mono ${remainingTimeMs < 60000 ? 'text-red-600' : ''}`}>
                    {formatTime(remainingTimeMs)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            <div className="h-4 w-px bg-border" />
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setMessages([]);
                  setCurrentSessionId(null);
                  setError(null);
                }}
                disabled={isExpired}
                title="New Chat"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost" 
                size="icon"
                onClick={onStopSandbox}
                disabled={isStoppingSandbox || isExpired}
                title={isStoppingSandbox ? 'Stopping...' : 'Stop Sandbox'}
              >
                <Square className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost" 
                size="icon"
                onClick={onNewSandbox}
                title="New Sandbox"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Expired State Banner */}
      {isExpired && (
        <div className="border-b bg-destructive/10 border-destructive/20 px-4 py-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Sandbox has expired</span>
            <div className="flex-1" />
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={onNewSandbox}
              className="h-7"
            >
              <Plus className="w-3 h-3 mr-1" />
              Create New Sandbox
            </Button>
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Show setup progress if we have setup tasks */}
        {setupTasks.length > 0 && (
          <div className="mb-6">
            <SetupProgress tasks={setupTasks} toolName={sandbox.toolName || 'AI Tool'} />
          </div>
        )}
        
        {messages.length === 0 && setupTasks.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">
                {isTerminalMode ? "Terminal ready!" : "Ready to chat!"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {isTerminalMode 
                  ? "Execute commands directly in your sandbox. Try 'ls', 'pwd', or 'cat filename.txt'."
                  : `Your ${sandbox.toolName || 'AI tool'} is set up and ready. Start a conversation below.`
                }
              </p>
            </div>
          </div>
        )}
        
        {messages.map((message) => {
          if (message.type === "terminal" && message.terminalResult) {
            return (
              <TerminalMessage
                key={message.id}
                command={message.terminalResult.command}
                result={message.terminalResult}
              />
            );
          }

          return (
            <div key={message.id} className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'user' ? (
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary text-primary-foreground">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              ) : (
                <div className="max-w-[80%]">
                  <Response 
                    className="rounded-lg bg-secondary text-foreground p-4"
                    parseIncompleteMarkdown={true}
                  >
                    {message.content}
                  </Response>
                  
                  {message.metadata && (
                    <div className="mt-2 pt-2 border-t border-muted text-xs opacity-70 space-y-1 px-4">
                      {message.metadata.duration_ms && (
                        <div>Response time: {message.metadata.duration_ms}ms</div>
                      )}
                      {message.metadata.total_cost_usd && (
                        <div>Cost: ${message.metadata.total_cost_usd}</div>
                      )}
                      {message.metadata.usage && (
                        <div>Tokens: {message.metadata.usage.input_tokens || 0} in, {message.metadata.usage.output_tokens || 0} out</div>
                      )}
                      {message.metadata.sessionId && (
                        <div>Session: {message.metadata.sessionId.slice(0, 8)}...</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {error && (
          <div className="mx-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
            Error: {error}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background p-4">
        <PromptInput onSubmit={handleSubmit} className="relative">
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isExpired 
                ? "Sandbox expired - create a new sandbox to continue"
                : isTerminalMode 
                  ? "Enter command (e.g., ls, pwd, cat file.txt)..." 
                  : `Message ${sandbox.toolName || 'AI tool'}...`
            }
            disabled={isLoading || isExpired}
            className={`resize-none ${isTerminalMode ? 'font-mono' : ''} ${isExpired ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}`}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              {/* Mode Switch */}
              <div className="flex items-center gap-2 px-2">
                <Switch
                  checked={isTerminalMode}
                  onCheckedChange={setIsTerminalMode}
                  disabled={isSwitchDisabled}
                />
                <span className="text-xs text-muted-foreground">
                  {isTerminalMode ? "Terminal" : "Chat"}
                </span>
              </div>
            </PromptInputTools>
            <PromptInputSubmit
              className="relative"
              disabled={isSubmitDisabled}
              status={submitStatus}
            >
              {isLoading && <Loader size={12} className="mr-1" />}
              {submitButtonText}
            </PromptInputSubmit>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}