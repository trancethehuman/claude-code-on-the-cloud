"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Square, RotateCcw } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageAvatar } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { AITool } from "@/lib/ai-tools-config";

type SandboxInfo = {
  id: string | null;
  createdAt: string;
  timeoutMs?: number;
  provider?: string;
  tool?: AITool;
  toolName?: string;
  session?: {
    id: string | null;
    resumed: boolean;
    requestedSessionId?: string;
  };
  cursorCLI?: {
    cursorCLI: { 
      installed: boolean; 
      version: string | null; 
      error: string | null;
      promptOutput?: { 
        stdout: string; 
        stderr: string; 
        exitCode: number;
        parsedJson?: Record<string, unknown>;
        sessionId?: string;
      } | null;
    };
    environment: { configured: boolean; error: string | null };
  };
};

interface SandboxChatProps {
  sandbox: SandboxInfo;
  apiKey: string;
  onNewSandbox: () => void;
  remainingTimeMs: number | null;
  formatTime: (ms: number) => string;
  onStopSandbox: () => void;
  isStoppingSandbox: boolean;
}

export function SandboxChat({ 
  sandbox, 
  apiKey, 
  onNewSandbox, 
  remainingTimeMs, 
  formatTime, 
  onStopSandbox,
  isStoppingSandbox 
}: SandboxChatProps) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sandbox.session?.id || null
  );
  const [messages, setMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string}>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/sandbox/${sandbox.id}/terminal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: sandbox.tool,
          apiKey: apiKey,
          sessionId: currentSessionId,
          prompt: input.trim()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response reader available");
      }
      
      const decoder = new TextDecoder();
      let assistantContent = "";
      
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant' as const,
        content: ""
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Use a timeout to batch updates and prevent infinite re-renders
      const updateAssistantMessage = (content: string) => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        updateTimeoutRef.current = setTimeout(() => {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content }
              : msg
          ));
        }, 50); // Update every 50ms to balance responsiveness and performance
      };
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Final update - clear timeout and update immediately
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: assistantContent }
              : msg
          ));
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text-delta') {
                assistantContent += data.delta;
                updateAssistantMessage(assistantContent);
              } else if (data.type === 'data' && data.data?.sessionId) {
                setCurrentSessionId(data.data.sessionId);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(new Error(errorMessage));
    } finally {
      // Clean up timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      setIsLoading(false);
    }
  }, [input, isLoading, sandbox.id, sandbox.tool, apiKey, currentSessionId]);

  const handleStartNewConversation = useCallback(() => {
    setCurrentSessionId(null);
    // Note: useChat doesn't expose a way to clear messages directly
    // We'll need to reload the component or use a key to reset it
    window.location.reload();
  }, []);

  return (
    <div className="flex h-screen max-h-screen flex-col">
      {/* Header with sandbox info */}
      <div className="border-b bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{sandbox.toolName || 'AI Tool'} Chat</h2>
              <span className="text-xs text-muted-foreground">
                Sandbox: {sandbox.id?.slice(0, 8)}...
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
              
              {currentSessionId && (
                <div className="flex items-center gap-1">
                  <span>Session:</span>
                  <span className="font-mono">{currentSessionId.slice(0, 8)}...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartNewConversation}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs bg-secondary hover:bg-secondary/80"
              title="Start new conversation"
            >
              <RotateCcw className="w-3 h-3" />
              New Chat
            </button>
            
            <button
              onClick={onStopSandbox}
              disabled={isStoppingSandbox}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
              title="Stop sandbox"
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
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Ready to chat!</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Your {sandbox.toolName || 'AI tool'} is set up and ready. Start a conversation below.
                </p>
                {sandbox.session?.resumed && (
                  <p className="text-xs text-blue-600">
                    {sandbox.session.id ? 'Resuming previous session' : 'Continuing latest session'}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageAvatar
                src={message.role === 'user' ? '/user-avatar.png' : '/assistant-avatar.png'}
                name={message.role === 'user' ? 'You' : sandbox.toolName || 'AI'}
              />
              <MessageContent>
                <div className="whitespace-pre-wrap">
                  {message.content}
                </div>
              </MessageContent>
            </Message>
          ))}
          
          {error && (
            <div className="mx-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
              Error: {error.message}
            </div>
          )}
        </ConversationContent>
        
        <ConversationScrollButton />
      </Conversation>

      {/* Input area */}
      <div className="border-t bg-background p-4">
        <PromptInput onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <PromptInputTextarea
            value={input}
            onChange={handleInputChange}
            placeholder={`Message ${sandbox.toolName || 'AI tool'}...`}
            disabled={isLoading}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              {/* Could add tools here like file upload, etc. */}
            </PromptInputTools>
            <PromptInputSubmit disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send'}
            </PromptInputSubmit>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}