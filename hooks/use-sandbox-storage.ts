import React from 'react';
import { AITool } from '@/lib/ai-tools-config';
import { useStorage } from './use-storage';

export interface SandboxInfo {
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
}

export interface CreationState {
  apiKey: string;
  tool: AITool;
  toolName: string;
  prompt: string;
  resumeSession: boolean;
  sessionId: string | null;
  aliveTimeMinutes: number;
  createdAt: string;
}

export function useSandboxStorage() {
  const storage = useStorage();

  const getSandboxStorageKey = React.useCallback((sandboxId: string): string => {
    return `sandbox-${sandboxId}`;
  }, []);

  const getSandbox = React.useCallback((sandboxId: string): SandboxInfo | null => {
    const data = storage.getItem(getSandboxStorageKey(sandboxId));
    if (!data) return null;
    try {
      return JSON.parse(data) as SandboxInfo;
    } catch {
      return null;
    }
  }, [storage, getSandboxStorageKey]);

  const setSandbox = React.useCallback((sandbox: SandboxInfo): void => {
    if (!sandbox.id) return;
    storage.setItem(getSandboxStorageKey(sandbox.id), JSON.stringify(sandbox));
  }, [storage, getSandboxStorageKey]);

  const removeSandbox = React.useCallback((sandboxId: string): void => {
    storage.removeItem(getSandboxStorageKey(sandboxId));
  }, [storage, getSandboxStorageKey]);

  const getCreationState = React.useCallback((): CreationState | null => {
    const data = storage.getItem('sandbox-creation-state');
    if (!data) return null;
    try {
      return JSON.parse(data) as CreationState;
    } catch {
      return null;
    }
  }, [storage]);

  const setCreationState = React.useCallback((state: CreationState): void => {
    storage.setItem('sandbox-creation-state', JSON.stringify(state));
  }, [storage]);

  const clearCreationState = React.useCallback((): void => {
    storage.removeItem('sandbox-creation-state');
  }, [storage]);

  return React.useMemo(() => ({
    getSandbox,
    setSandbox,
    removeSandbox,
    getCreationState,
    setCreationState,
    clearCreationState,
  }), [getSandbox, setSandbox, removeSandbox, getCreationState, setCreationState, clearCreationState]);
}