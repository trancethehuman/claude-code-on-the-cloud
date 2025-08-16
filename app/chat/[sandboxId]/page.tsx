"use client";

import React, { useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { SimpleChat } from "@/components/simple-chat";
import { ErrorBoundary } from "@/components/error-boundary";
import { useSandboxStorage, SandboxInfo, CreationState } from "@/hooks/use-sandbox-storage";
import { useApiKeys } from "@/hooks/use-api-keys";


interface ChatPageProps {
  params: Promise<{
    sandboxId: string;
  }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { sandboxId } = use(params);
  const router = useRouter();
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  
  // Use storage hooks
  const sandboxStorage = useSandboxStorage();
  const apiKeyStorage = useApiKeys();

  // Function to handle sandbox creation when navigating to a creating-* URL
  const startSandboxCreation = useCallback(async (creationState: CreationState) => {
    try {
      const response = await fetch("/api/new-sandbox", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          apiKey: creationState.apiKey, 
          tool: creationState.tool,
          prompt: creationState.prompt,
          resumeSession: creationState.resumeSession,
          sessionId: creationState.sessionId,
          aliveTimeMinutes: creationState.aliveTimeMinutes
        })
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response reader available");
      }

      const decoder = new TextDecoder();
      let accumulatedMessages = "";
      let sandboxData: SandboxInfo | null = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text-delta') {
                accumulatedMessages += data.delta;
                setStreamingMessages(accumulatedMessages);
              } else if (data.type === 'data' && data.id === 'sandbox-info') {
                if (data.data.success && data.data.sandbox) {
                  sandboxData = data.data.sandbox;
                } else if (!data.data.success) {
                  throw new Error(data.data.error || "Sandbox creation failed");
                }
              }
            } catch (parseError) {
              console.warn("Failed to parse streaming chunk:", parseError);
            }
          }
        }
      }

      if (sandboxData && sandboxData.id) {
        // Update sandbox data and navigate to actual ID
        setSandbox(sandboxData);
        sandboxStorage.setSandbox(sandboxData);
        sandboxStorage.clearCreationState();
        router.replace(`/chat/${sandboxData.id}`);
      }
    } catch (error) {
      console.error('Sandbox creation failed:', error);
      router.push('/');
    }
  }, [router, sandboxStorage]);
  const [apiKey, setApiKey] = useState<string>("");
  const [remainingTimeMs, setRemainingTimeMs] = useState<number | null>(null);
  const [isStoppingSandbox, setIsStoppingSandbox] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamingMessages, setStreamingMessages] = useState<string>("");
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);

  // Format time remaining as MM:SS
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Load sandbox data and API key from localStorage or API
  useEffect(() => {
    const loadSandboxData = async () => {
      try {
        // Check if this is a creating state
        if (sandboxId.startsWith('creating-')) {
          // Load creation state from storage
          const creationState = sandboxStorage.getCreationState();
          if (!creationState) {
            router.push('/');
            return;
          }

          setApiKey(creationState.apiKey);
          setInitialPrompt(creationState.prompt);

          // Create a temporary sandbox object for the creation state
          const tempSandbox: SandboxInfo = {
            id: null, // null ID indicates creation in progress
            createdAt: creationState.createdAt,
            timeoutMs: creationState.aliveTimeMinutes * 60 * 1000,
            tool: creationState.tool,
            toolName: creationState.toolName,
            session: { id: null, resumed: false }
          };

          setSandbox(tempSandbox);
          
          // Start the sandbox creation process
          startSandboxCreation(creationState);
          
        } else {
          // Try to load existing sandbox data by ID
          const sandboxData = sandboxStorage.getSandbox(sandboxId);
          if (sandboxData) {
            setSandbox(sandboxData);
            // Load API key based on tool
            const key = sandboxData.tool ? apiKeyStorage.getApiKey(sandboxData.tool) : apiKeyStorage.getAnyApiKey();
            setApiKey(key || '');
            // Set initial prompt if available
            setInitialPrompt(sandboxData.initialPrompt);
          } else {
            // Sandbox not found in storage - redirect to home
            console.warn(`Sandbox ${sandboxId} not found in storage`);
            router.push('/');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load sandbox data:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    loadSandboxData();
  }, [sandboxId, router, startSandboxCreation, sandboxStorage, apiKeyStorage]);

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
        setRemainingTimeMs(null);
        setIsExpired(true);
        // Clear expired sandbox data
        sandboxStorage.removeSandbox(sandboxId);
      } else {
        setRemainingTimeMs(remaining);
        setIsExpired(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [sandbox?.createdAt, sandbox?.timeoutMs, sandboxId, sandboxStorage]);

  // Handle switching back to create mode
  const handleNewSandbox = useCallback(() => {
    // Clear the current sandbox data
    sandboxStorage.removeSandbox(sandboxId);
    sandboxStorage.clearCreationState();
    router.push('/');
  }, [router, sandboxId, sandboxStorage]);

  // Stop sandbox function
  const handleStopSandbox = useCallback(async () => {
    if (!sandbox?.id || isStoppingSandbox) return;
    
    setIsStoppingSandbox(true);
    try {
      const response = await fetch(`/api/sandbox/${sandbox.id}/stop`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Clear the sandbox data from storage
        sandboxStorage.removeSandbox(sandboxId);
        sandboxStorage.clearCreationState();
        router.push('/');
      } else {
        const data = await response.json();
        console.error('Failed to stop sandbox:', data.error);
        // Clear data anyway and switch to create mode
        sandboxStorage.removeSandbox(sandboxId);
        sandboxStorage.clearCreationState();
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to stop sandbox:', error);
      // Clear data anyway and switch to create mode
      sandboxStorage.removeSandbox(sandboxId);
      sandboxStorage.clearCreationState();
      router.push('/');
    } finally {
      setIsStoppingSandbox(false);
    }
  }, [sandbox?.id, isStoppingSandbox, router, sandboxId, sandboxStorage]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading sandbox...</div>
          <div className="text-sm text-muted-foreground">ID: {sandboxId}</div>
        </div>
      </div>
    );
  }

  if (!sandbox) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Sandbox not found</div>
          <div className="text-sm text-muted-foreground">ID: {sandboxId}</div>
        </div>
      </div>
    );
  }

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
          initialPrompt={initialPrompt}
        />
      </ErrorBoundary>
    </div>
  );
}