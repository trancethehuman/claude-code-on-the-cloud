"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Square } from "lucide-react";
import { AITool, getAllAITools, getAIToolConfig } from "@/lib/ai-tools-config";

type SandboxInfo = {
  id: string | null;
  createdAt: string;
  timeoutMs?: number;
  provider?: string;
  tool?: string;
  toolName?: string;
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
      } | null;
    };
    environment: { configured: boolean; error: string | null };
  };
};

type NewSandboxResponse = {
  success: boolean;
  sandbox?: SandboxInfo;
  error?: string;
};

export function CreateSandbox() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [selectedTool, setSelectedTool] = useState<AITool>("cursor-cli");
  const [remainingTimeMs, setRemainingTimeMs] = useState<number | null>(null);
  const [isStoppingSandbox, setIsStoppingSandbox] = useState(false);
  
  const aiTools = getAllAITools();
  const currentToolConfig = getAIToolConfig(selectedTool);

  // Format time remaining as MM:SS
  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Stop sandbox function
  const stopSandbox = useCallback(async () => {
    if (!sandbox?.id || isStoppingSandbox) return;
    
    setIsStoppingSandbox(true);
    try {
      const response = await fetch(`/api/sandbox/${sandbox.id}/stop`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setSandbox(null);
        setRemainingTimeMs(null);
      } else {
        const data = await response.json();
        setErrorMessage(data.error || 'Failed to stop sandbox');
      }
    } catch (error) {
      setErrorMessage('Failed to stop sandbox');
    } finally {
      setIsStoppingSandbox(false);
    }
  }, [sandbox?.id, isStoppingSandbox]);

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
        setSandbox(null); // Sandbox has expired
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

  // Load saved API key and tool selection on component mount
  React.useEffect(() => {
    const savedTool = localStorage.getItem('claude-code-cloud-tool') as AITool;
    if (savedTool && ['claude-code', 'cursor-cli'].includes(savedTool)) {
      setSelectedTool(savedTool);
    }
  }, []);

  // Load saved API key when tool changes
  React.useEffect(() => {
    const storageKey = `claude-code-cloud-apikey-${selectedTool}`;
    const savedApiKey = localStorage.getItem(storageKey);
    if (savedApiKey) {
      setApiKey(savedApiKey);
    } else {
      setApiKey(''); // Clear if no saved key for this tool
    }
  }, [selectedTool]);

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    const storageKey = `claude-code-cloud-apikey-${selectedTool}`;
    if (newApiKey.trim()) {
      localStorage.setItem(storageKey, newApiKey);
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  // Save tool selection to localStorage when it changes
  const handleToolChange = (newTool: AITool) => {
    setSelectedTool(newTool);
    localStorage.setItem('claude-code-cloud-tool', newTool);
  };

  // Helper function to format output (JSON if possible, otherwise plain text)
  const formatOutput = (output: string) => {
    try {
      const parsed = JSON.parse(output);
      return {
        isJSON: true,
        formatted: JSON.stringify(parsed, null, 2)
      };
    } catch {
      return {
        isJSON: false,
        formatted: output
      };
    }
  };

  async function handleCreateSandboxClick() {
    if (!apiKey.trim()) {
      setErrorMessage(`Please enter your ${currentToolConfig.apiKeyLabel.toLowerCase()}`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSandbox(null);

    try {
      const response = await fetch("/api/new-sandbox", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: apiKey.trim(), tool: selectedTool })
      });
      const data: NewSandboxResponse = await response.json();

      if (!response.ok || !data.success) {
        const message = data.error ?? `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      setSandbox(data.sandbox ?? null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleResetClick() {
    setErrorMessage(null);
    setSandbox(null);
    setRemainingTimeMs(null);
  }

  return (
    <div className="w-full max-w-xl space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="ai-tool" className="text-sm font-medium text-foreground">
            AI Tool
          </label>
          <select
            id="ai-tool"
            value={selectedTool}
            onChange={(e) => handleToolChange(e.target.value as AITool)}
            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            disabled={isLoading}
          >
            {aiTools.map((tool) => (
              <option key={tool.value} value={tool.value}>
                {tool.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Choose which AI coding tool to install in the sandbox
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="api-key" className="text-sm font-medium text-foreground">
            {currentToolConfig.apiKeyLabel}
          </label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={selectedTool === 'claude-code' ? 'sk-ant-xxx...' : 'cur_xxx...'}
            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            API key is saved locally in your browser for convenience
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreateSandboxClick}
            disabled={isLoading || !apiKey.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
{isLoading ? `Creating ${currentToolConfig.displayName} Sandbox...` : `Create ${currentToolConfig.displayName} Sandbox`}
          </button>
          {(sandbox || errorMessage) && (
            <button
              type="button"
              onClick={handleResetClick}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
          {errorMessage}
        </div>
      )}

      {sandbox && (
        <div className="rounded-md border border-muted bg-muted/20 p-3 space-y-3">
          <div className="text-sm font-medium text-foreground">Sandbox created</div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">ID:</span>
              <span className="text-sm font-mono text-foreground">{sandbox.id}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Created:</span>
              <span className="text-sm text-foreground">{new Date(sandbox.createdAt).toLocaleString()}</span>
            </div>
            
            {remainingTimeMs !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Time remaining:</span>
                <span className={`text-sm font-mono ${remainingTimeMs < 60000 ? 'text-red-600' : 'text-foreground'}`}>
                  {formatTime(remainingTimeMs)}
                </span>
                <button
                  onClick={stopSandbox}
                  disabled={isStoppingSandbox}
                  className="inline-flex items-center justify-center w-6 h-6 rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Stop sandbox"
                >
                  <Square className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {sandbox.cursorCLI && (
            <div className="border-t border-muted pt-3 space-y-2">
              <div className="text-sm font-medium text-foreground">{sandbox.toolName || 'AI Tool'} Status</div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Installation:</span>
                  {sandbox.cursorCLI.cursorCLI.installed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      Installed & Working
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      Failed
                    </span>
                  )}
                </div>
                
                {sandbox.cursorCLI.cursorCLI.version && (
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Details:</span>
                      <span className="text-xs text-foreground break-all">{sandbox.cursorCLI.cursorCLI.version}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Environment:</span>
                  {sandbox.cursorCLI.environment.configured ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      API Key Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600">
                      <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                      Not configured
                    </span>
                  )}
                </div>

                {sandbox.provider && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Provider:</span>
                    <span className="text-xs text-foreground capitalize">{sandbox.provider} Sandbox</span>
                  </div>
                )}
                
                {(sandbox.cursorCLI.cursorCLI.error || sandbox.cursorCLI.environment.error) && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {sandbox.cursorCLI.cursorCLI.error && (
                      <div>Error: {sandbox.cursorCLI.cursorCLI.error}</div>
                    )}
                    {sandbox.cursorCLI.environment.error && (
                      <div>Env Error: {sandbox.cursorCLI.environment.error}</div>
                    )}
                  </div>
                )}

                {sandbox.cursorCLI.cursorCLI.installed && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="text-xs font-medium text-green-700 mb-1">Ready to Use!</div>
                    <div className="text-xs text-green-600">
                      {sandbox.toolName || 'AI Tool'} is installed and both --help and prompt commands are working. 
                      The sandbox is ready for AI-assisted coding.
                    </div>
                  </div>
                )}

                {sandbox.cursorCLI.cursorCLI.promptOutput && (
                  <div className="mt-2 space-y-2">
                    {/* Show parsed JSON response if available */}
                    {sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <div className="text-xs font-medium text-green-700 mb-2">AI Response</div>
                        {sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson.result && (
                          <div className="text-sm text-green-800">
                            {sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson.result}
                          </div>
                        )}
                        {sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson.duration_ms && (
                          <div className="text-xs text-green-600 mt-1">
                            Response time: {sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson.duration_ms}ms
                          </div>
                        )}
                        {sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson.total_cost_usd && (
                          <div className="text-xs text-green-600">
                            Cost: ${sandbox.cursorCLI.cursorCLI.promptOutput.parsedJson.total_cost_usd}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                        Show Raw Output
                      </summary>
                      <div className="mt-2 p-2 bg-muted/50 border border-muted rounded text-xs">
                        <div className="space-y-2">
                          <div>
                            <span className="font-medium">Exit Code:</span> {sandbox.cursorCLI.cursorCLI.promptOutput.exitCode}
                          </div>
                          {sandbox.cursorCLI.cursorCLI.promptOutput.stdout && (
                            <div>
                              <span className="font-medium">
                                Output{(() => {
                                  const formatted = formatOutput(sandbox.cursorCLI.cursorCLI.promptOutput.stdout);
                                  return formatted.isJSON ? " (JSON)" : "";
                                })()}:
                              </span>
                              <pre className="mt-1 p-2 bg-background border rounded text-xs overflow-auto max-h-32">
                                {formatOutput(sandbox.cursorCLI.cursorCLI.promptOutput.stdout).formatted}
                              </pre>
                            </div>
                          )}
                          {sandbox.cursorCLI.cursorCLI.promptOutput.stderr && (
                            <div>
                              <span className="font-medium">
                                Error Output{(() => {
                                  const formatted = formatOutput(sandbox.cursorCLI.cursorCLI.promptOutput.stderr);
                                  return formatted.isJSON ? " (JSON)" : "";
                                })()}:
                              </span>
                              <pre className="mt-1 p-2 bg-background border rounded text-xs overflow-auto max-h-32">
                                {formatOutput(sandbox.cursorCLI.cursorCLI.promptOutput.stderr).formatted}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
