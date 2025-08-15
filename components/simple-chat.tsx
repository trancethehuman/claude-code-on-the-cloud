"use client";

import React, { useState } from "react";
import { Square, RotateCcw, Terminal, MessageSquare } from "lucide-react";
import { SessionInfo, AITool } from "@/lib/ai-tools-config";
import { TerminalMessage } from "./terminal-message";

interface SimpleChatProps {
  sandbox: { id: string; tool: string; toolName?: string; session?: { id: string | null } };
  apiKey: string;
  onNewSandbox: () => void;
  remainingTimeMs: number | null;
  formatTime: (ms: number) => string;
  onStopSandbox: () => void;
  isStoppingSandbox: boolean;
}

export function SimpleChat({ 
  sandbox, 
  apiKey, 
  onNewSandbox, 
  remainingTimeMs, 
  formatTime, 
  onStopSandbox,
  isStoppingSandbox 
}: SimpleChatProps) {
  // Save updated session to localStorage
  const saveSession = (sessionInfo: SessionInfo) => {
    const sessionsKey = `claude-code-cloud-sessions-${sandbox.tool}`;
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
    metadata?: any;
    type?: "chat" | "terminal";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    if (isTerminalMode) {
      // Terminal mode - execute command directly
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

        const data = await response.json();
        
        const terminalMessage = {
          id: `terminal_${Date.now()}`,
          role: "assistant" as const,
          content: "", // Not used for terminal messages
          type: "terminal" as const,
          terminalResult: data.result,
        };

        setMessages(prev => [...prev, terminalMessage]);
      } catch (error) {
        console.error("Terminal error:", error);
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

      try {
      const response = await fetch(`/api/sandbox/${sandbox.id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: sandbox.tool,
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
                
                if (parsed.type === 'text') {
                  assistantContent += parsed.value;
                } else if (parsed.type === 'data') {
                  assistantMetadata = parsed.value;
                  
                  // Update session ID if provided
                  if (parsed.value.sessionId) {
                    setCurrentSessionId(parsed.value.sessionId);
                    
                    // Save updated session info to localStorage
                    const sessionInfo: SessionInfo = {
                      sessionId: parsed.value.sessionId,
                      toolType: sandbox.tool as AITool,
                      sandboxId: sandbox.id,
                      createdAt: sandbox.session?.id === parsed.value.sessionId ? 
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
                Sandbox: {sandbox.id.slice(0, 8)}...
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

          <div className="flex items-center gap-2">
            {/* Terminal Mode Toggle */}
            <button
              onClick={() => setIsTerminalMode(!isTerminalMode)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs transition-colors ${
                isTerminalMode 
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {isTerminalMode ? (
                <>
                  <Terminal className="w-3 h-3" />
                  Terminal Mode
                </>
              ) : (
                <>
                  <MessageSquare className="w-3 h-3" />
                  Chat Mode
                </>
              )}
            </button>
            
            <button
              onClick={() => {
                setMessages([]);
                setCurrentSessionId(null);
                setError(null);
              }}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs bg-secondary hover:bg-secondary/80"
            >
              <RotateCcw className="w-3 h-3" />
              New Chat
            </button>
            
            <button
              onClick={onStopSandbox}
              disabled={isStoppingSandbox}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              <Square className="w-3 h-3" />
              {isStoppingSandbox ? 'Stopping...' : 'Stop'}
            </button>
            
            <button
              onClick={onNewSandbox}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              New Sandbox
            </button>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
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
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-foreground'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {message.role === 'assistant' && message.metadata && (
                  <div className="mt-2 pt-2 border-t border-muted text-xs opacity-70 space-y-1">
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
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isTerminalMode ? "Enter command (e.g., ls, pwd, cat file.txt)..." : `Message ${sandbox.toolName || 'AI tool'}...`}
            disabled={isLoading}
            className={`flex-1 px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent ${
              isTerminalMode ? 'font-mono' : ''
            }`}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (isTerminalMode ? 'Running...' : 'Sending...') : (isTerminalMode ? 'Run' : 'Send')}
          </button>
        </form>
      </div>
    </div>
  );
}