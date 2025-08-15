"use client";

import React, { useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Square, RotateCcw } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageAvatar } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
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
        parsedJson?: any;
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

  // Removed debug logging to prevent console spam

  const onFinish = useCallback((message) => {
    console.log("Chat onFinish:", message);
    // Extract session ID from data parts
    if (message.data) {
      for (const data of message.data) {
        if (data.sessionId) {
          setCurrentSessionId(data.sessionId);
          break;
        }
      }
    }
  }, []);

  const onError = useCallback((error) => {
    console.error("Chat onError:", error);
    // Prevent navigation back to create mode on chat errors
    // The error will be displayed in the UI automatically
    // We should NOT call onNewSandbox or any navigation here
  }, []);

  const chatBody = React.useMemo(() => ({
    tool: sandbox.tool,
    apiKey: apiKey,
    sessionId: currentSessionId,
  }), [sandbox.tool, apiKey, currentSessionId]);

  let chatHookResult;
  try {
    chatHookResult = useChat({
      api: `/api/test-chat`, // Temporarily use test endpoint
      body: chatBody,
      onFinish,
      onError,
    });
    // useChat initialized successfully
  } catch (error) {
    console.error("useChat initialization error:", error);
    throw error;
  }

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, status } = chatHookResult;

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
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return <span key={index}>{part.text}</span>;
                    }
                    return null;
                  })}
                </div>
                
                {message.role === 'assistant' && message.data && (
                  <div className="mt-2 pt-2 border-t border-muted text-xs text-muted-foreground space-y-1">
                    {message.data.map((data, index) => (
                      <div key={index}>
                        {data.duration_ms && (
                          <div>Response time: {data.duration_ms}ms</div>
                        )}
                        {data.total_cost_usd && (
                          <div>Cost: ${data.total_cost_usd}</div>
                        )}
                        {data.usage && (
                          <div>Tokens: {data.usage.input_tokens || 0} in, {data.usage.output_tokens || 0} out</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </MessageContent>
            </Message>
          ))}
          
          {error && (
            <div className="mx-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm">
              Error: {error.message || error}
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
            <PromptInputSubmit status={status}>
              Send
            </PromptInputSubmit>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}