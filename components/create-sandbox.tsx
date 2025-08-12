"use client";

import { useState } from "react";

type SandboxInfo = {
  id: string | null;
  createdAt: string;
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

  async function handleCreateSandboxClick() {
    setIsLoading(true);
    setErrorMessage(null);
    setSandbox(null);

    try {
      const response = await fetch("/api/new-sandbox", { method: "POST" });
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCreateSandboxClick}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Creating..." : "Create sandbox"}
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

      {errorMessage && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
          {errorMessage}
        </div>
      )}

      {sandbox && (
        <div className="rounded-md border border-muted bg-muted/20 p-3">
          <div className="text-sm font-medium text-foreground mb-2">Sandbox created</div>
          <pre className="whitespace-pre-wrap break-words text-sm text-foreground/90">
            {JSON.stringify(sandbox, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
