"use client";

import React, { useState, useCallback, useEffect } from "react";
import { CreateSandbox } from "./create-sandbox";
import { SimpleChat } from "./simple-chat";
import { ErrorBoundary } from "./error-boundary";
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

type AppMode = "create" | "chat";

export function AppContainer() {
  const [mode, setMode] = useState<AppMode>("create");
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [remainingTimeMs, setRemainingTimeMs] = useState<number | null>(null);
  const [isStoppingSandbox, setIsStoppingSandbox] = useState(false);

  // Debug logging for state changes
  React.useEffect(() => {
    console.log("Mode changed to:", mode);
  }, [mode]);

  React.useEffect(() => {
    console.log("Sandbox changed:", sandbox ? `ID: ${sandbox.id}` : "null");
  }, [sandbox]);

  // Format time remaining as MM:SS
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Timer effect - updates remaining time every second
  useEffect(() => {
    if (!sandbox?.createdAt || !sandbox?.timeoutMs) {
      setRemainingTimeMs(null);
      return;
    }

    const createdTime = new Date(sandbox.createdAt).getTime();
    const expiryTime = createdTime + sandbox.timeoutMs;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = expiryTime - now;
      
      if (remaining <= 0) {
        console.log("Sandbox expired, switching to create mode");
        setRemainingTimeMs(null);
        setSandbox(null);
        setMode("create"); // Switch back to create mode when sandbox expires
      } else {
        setRemainingTimeMs(remaining);
      }
    };

    // Update immediately
    updateTimer();
    
    // Update every second
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [sandbox?.createdAt, sandbox?.timeoutMs]);

  // Handle sandbox creation success
  const handleSandboxCreated = useCallback((createdSandbox: SandboxInfo, usedApiKey: string) => {
    console.log("Sandbox created successfully, switching to chat mode", createdSandbox);
    setSandbox(createdSandbox);
    setApiKey(usedApiKey);
    setMode("chat");
  }, []);

  // Handle switching back to create mode
  const handleNewSandbox = useCallback(() => {
    setSandbox(null);
    setApiKey("");
    setRemainingTimeMs(null);
    setMode("create");
  }, []);

  // Stop sandbox function
  const handleStopSandbox = useCallback(async () => {
    if (!sandbox?.id || isStoppingSandbox) return;
    
    setIsStoppingSandbox(true);
    try {
      const response = await fetch(`/api/sandbox/${sandbox.id}/stop`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setSandbox(null);
        setRemainingTimeMs(null);
        setMode("create");
      } else {
        const data = await response.json();
        console.error('Failed to stop sandbox:', data.error);
        // For now, just switch to create mode anyway
        setSandbox(null);
        setRemainingTimeMs(null);
        setMode("create");
      }
    } catch (error) {
      console.error('Failed to stop sandbox:', error);
      // For now, just switch to create mode anyway
      setSandbox(null);
      setRemainingTimeMs(null);
      setMode("create");
    } finally {
      setIsStoppingSandbox(false);
    }
  }, [sandbox?.id, isStoppingSandbox]);

  // Removed debug logging to prevent console spam

  if (mode === "chat" && sandbox) {
    return (
      <ErrorBoundary>
        <SimpleChat
          sandbox={sandbox}
          apiKey={apiKey}
          onNewSandbox={handleNewSandbox}
          remainingTimeMs={remainingTimeMs}
          formatTime={formatTime}
          onStopSandbox={handleStopSandbox}
          isStoppingSandbox={isStoppingSandbox}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">CLI on the Cloud</h1>
          <p className="text-muted-foreground">
            Create AI-powered sandboxes with Claude Code or Cursor CLI
          </p>
        </div>
        <CreateSandbox onSandboxCreated={handleSandboxCreated} />
      </main>
    </div>
  );
}