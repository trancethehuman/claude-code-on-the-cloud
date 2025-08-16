import React, { useMemo } from "react";
import { MessageSquare, Terminal, ArrowUp } from "lucide-react";
import { TerminalInput } from "../terminal-input";
import { Button } from "../ui/button";
import { Loader } from "../ai-elements/loader";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputTools,
} from "../ai-elements/prompt-input";

interface ChatInputProps {
  isTerminalMode: boolean;
  setIsTerminalMode: (mode: boolean) => void;
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isExpired: boolean;
  toolName?: string;
}

export function ChatInput({
  isTerminalMode,
  setIsTerminalMode,
  input,
  setInput,
  onSubmit,
  isLoading,
  isExpired,
  toolName,
}: ChatInputProps) {
  // Memoize props to prevent infinite re-renders
  const submitStatus = useMemo(() => {
    return isLoading ? "streaming" : "ready";
  }, [isLoading]);

  const isSubmitDisabled = useMemo(() => {
    return isLoading || !input.trim() || isExpired;
  }, [isLoading, input, isExpired]);

  const isSwitchDisabled = useMemo(() => {
    return isLoading || isExpired;
  }, [isLoading, isExpired]);

  return (
    <div className="border-t bg-background p-4">
      {isTerminalMode ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted rounded-md p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsTerminalMode(false)}
              disabled={isSwitchDisabled}
            >
              <MessageSquare className="size-4" />
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 w-8 p-0 text-primary-foreground"
              onClick={() => setIsTerminalMode(true)}
              disabled={isSwitchDisabled}
            >
              <Terminal className="size-4" />
            </Button>
          </div>
          <TerminalInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSubmit={(command) => {
              if (!command.trim() || isLoading) return;
              const event = new Event('submit', { bubbles: true, cancelable: true }) as unknown as React.FormEvent;
              onSubmit(event);
            }}
            disabled={isLoading || isExpired}
            placeholder={isExpired ? "Sandbox expired" : ""}
            className="flex-1"
          />
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex items-center bg-muted rounded-md p-0.5 mt-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 w-8 p-0 text-primary-foreground"
              onClick={() => setIsTerminalMode(false)}
              disabled={isSwitchDisabled}
            >
              <MessageSquare className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsTerminalMode(true)}
              disabled={isSwitchDisabled}
            >
              <Terminal className="size-4" />
            </Button>
          </div>
          <PromptInput onSubmit={onSubmit} className="relative flex-1">
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isExpired
                  ? "Sandbox expired - create a new sandbox to continue"
                  : `Message ${toolName || "AI tool"}...`
              }
              disabled={isLoading || isExpired}
              className={`resize-none ${
                isExpired
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : ""
              }`}
            />
            <PromptInputToolbar>
              <PromptInputTools>
                {/* Empty tools area */}
              </PromptInputTools>
              <PromptInputSubmit
                className="relative"
                disabled={isSubmitDisabled}
                status={submitStatus}
              >
                {isLoading ? (
                  <Loader size={16} />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </PromptInputSubmit>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      )}
    </div>
  );
}