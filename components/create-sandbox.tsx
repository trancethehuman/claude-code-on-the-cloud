"use client";

import { useState } from "react";

type SandboxInfo = {
  id: string | null;
  createdAt: string;
  claudeSDK?: {
    claudeSDK: { installed: boolean; version: string | null; error: string | null };
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

  async function handleCreateSandboxClick() {
    if (!apiKey.trim()) {
      setErrorMessage("Please enter your Anthropic API key");
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
        body: JSON.stringify({ apiKey: apiKey.trim() })
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
  }

  return (
    <div className="w-full max-w-xl space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="api-key" className="text-sm font-medium text-foreground">
            Anthropic API Key
          </label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Your API key is used only for this session and is not stored
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreateSandboxClick}
            disabled={isLoading || !apiKey.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating & Installing Claude..." : "Create sandbox with Claude SDK"}
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
          </div>

          {sandbox.claudeSDK && (
            <div className="border-t border-muted pt-3 space-y-2">
              <div className="text-sm font-medium text-foreground">Claude Code SDK Status</div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Installation:</span>
                  {sandbox.claudeSDK.claudeSDK.installed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      Installed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      Failed
                    </span>
                  )}
                </div>
                
                {sandbox.claudeSDK.claudeSDK.version && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Version:</span>
                    <span className="text-sm font-mono text-foreground">{sandbox.claudeSDK.claudeSDK.version}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Environment:</span>
                  {sandbox.claudeSDK.environment.configured ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600">
                      <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></span>
                      Not configured
                    </span>
                  )}
                </div>
                
                {(sandbox.claudeSDK.claudeSDK.error || sandbox.claudeSDK.environment.error) && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {sandbox.claudeSDK.claudeSDK.error && (
                      <div>SDK Error: {sandbox.claudeSDK.claudeSDK.error}</div>
                    )}
                    {sandbox.claudeSDK.environment.error && (
                      <div>Env Error: {sandbox.claudeSDK.environment.error}</div>
                    )}
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
