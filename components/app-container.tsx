"use client";

import React, { useState, useCallback, useEffect } from "react";
import { CreateSandbox } from "./create-sandbox";
import { SimpleChat } from "./simple-chat";
import { ErrorBoundary } from "./error-boundary";
import { TopBar } from "./top-bar";
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

type AppMode = "create" | "chat";

export function AppContainer() {
  const [mode, setMode] = useState<AppMode>("create");
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [remainingTimeMs, setRemainingTimeMs] = useState<number | null>(null);
  const [isStoppingSandbox, setIsStoppingSandbox] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<string>("");

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
        console.log("Sandbox expired, setting expired state");
        setRemainingTimeMs(null);
        setIsExpired(true);
        // Don't switch modes - keep user in chat interface
      } else {
        setRemainingTimeMs(remaining);
        setIsExpired(false);
      }
    };

    // Update immediately
    updateTimer();
    
    // Update every second
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [sandbox?.createdAt, sandbox?.timeoutMs]);

  // Handle sandbox creation success
  const handleSandboxCreateStart = useCallback((usedApiKey: string, tool: AITool) => {
    console.log("Sandbox creation started, switching to chat mode immediately");
    setApiKey(usedApiKey);
    // Create a temporary sandbox object to represent the creating state
    const tempSandbox: SandboxInfo = {
      id: null,
      createdAt: new Date().toISOString(),
      tool: tool,
      toolName: tool === "claude-code" ? "Claude Code" : "Cursor CLI",
      session: { id: null, resumed: false }
    };
    setSandbox(tempSandbox);
    setMode("chat");
  }, []);

  const handleSandboxCreated = useCallback((createdSandbox: SandboxInfo, usedApiKey: string) => {
    console.log("Sandbox created successfully, updating sandbox data", createdSandbox);
    setSandbox(createdSandbox);
    setApiKey(usedApiKey);
    // Already in chat mode from handleSandboxCreateStart
  }, []);

  const handleStreamingMessages = useCallback((messages: string) => {
    setStreamingMessages(messages);
  }, []);

  // Handle switching back to create mode
  const handleNewSandbox = useCallback(() => {
    setSandbox(null);
    setApiKey("");
    setRemainingTimeMs(null);
    setIsExpired(false);
    setStreamingMessages("");
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
        setIsExpired(false);
        setMode("create");
      } else {
        const data = await response.json();
        console.error('Failed to stop sandbox:', data.error);
        // For now, just switch to create mode anyway
        setSandbox(null);
        setRemainingTimeMs(null);
        setIsExpired(false);
        setMode("create");
      }
    } catch (error) {
      console.error('Failed to stop sandbox:', error);
      // For now, just switch to create mode anyway
      setSandbox(null);
      setRemainingTimeMs(null);
      setIsExpired(false);
      setMode("create");
    } finally {
      setIsStoppingSandbox(false);
    }
  }, [sandbox?.id, isStoppingSandbox]);

  // Removed debug logging to prevent console spam

  if (mode === "chat" && sandbox) {
    return (
      <div className="flex h-screen flex-col">
        <ErrorBoundary>
          <SimpleChat
            sandbox={sandbox}
            apiKey={apiKey}
            onNewSandbox={handleNewSandbox}
            remainingTimeMs={remainingTimeMs}
            formatTime={formatTime}
            onStopSandbox={handleStopSandbox}
            isStoppingSandbox={isStoppingSandbox}
            isExpired={isExpired}
            streamingMessages={streamingMessages}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar title="CLI on the Cloud" subtitle="Create AI-powered sandboxes with Claude Code or Cursor CLI" />
      <div className="flex-1 flex items-center justify-center p-8">
        <CreateSandbox 
          onSandboxCreated={handleSandboxCreated} 
          onSandboxCreateStart={handleSandboxCreateStart}
          onStreamingMessages={handleStreamingMessages}
        />
      </div>
    </div>
  );
}