import React from "react";
import { TerminalMessage } from "../terminal-message";
import { MessageMetadataDisplay } from "./message-metadata";
import { SetupStatus } from "../setup-status";
import { Response } from "../ai-elements/response";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../ai-elements/conversation";

interface Message {
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
}

interface SetupTask {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  description?: string;
  error?: string;
  details?: string[];
}

interface ChatMessagesProps {
  messages: Message[];
  setupTasks: SetupTask[];
  toolName?: string;
  isTerminalMode: boolean;
  error: string | null;
}

export function ChatMessages({
  messages,
  setupTasks,
  toolName,
  isTerminalMode,
  error,
}: ChatMessagesProps) {
  return (
    <Conversation className="flex-1 overflow-hidden">
      <ConversationContent>
        {/* Show setup progress if we have setup tasks */}
        {setupTasks.length > 0 && (
          <div className="mb-6">
            <SetupStatus
              tasks={setupTasks}
              toolName={toolName || "AI Tool"}
            />
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
                  : `Your ${
                      toolName || "AI tool"
                    } is set up and ready. Start a conversation below.`}
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
            <div
              key={message.id}
              className={`mb-12 flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "user" ? (
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
                    <MessageMetadataDisplay metadata={message.metadata} />
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
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}