import React from 'react';
import { AITool } from '@/lib/ai-tools-config';
import { useStorage } from './use-storage';

export function useApiKeys() {
  const storage = useStorage();

  const getApiKeyStorageKey = React.useCallback((tool: AITool): string => {
    return `claude-code-cloud-${tool}-api-key`;
  }, []);

  const getApiKey = React.useCallback((tool: AITool): string | null => {
    return storage.getItem(getApiKeyStorageKey(tool));
  }, [storage, getApiKeyStorageKey]);

  const setApiKey = React.useCallback((tool: AITool, key: string): void => {
    storage.setItem(getApiKeyStorageKey(tool), key);
  }, [storage, getApiKeyStorageKey]);

  const clearApiKey = React.useCallback((tool: AITool): void => {
    storage.removeItem(getApiKeyStorageKey(tool));
  }, [storage, getApiKeyStorageKey]);

  const getAnyApiKey = React.useCallback((): string | null => {
    // Try to get any available API key
    const claudeKey = getApiKey('claude-code');
    const cursorKey = getApiKey('cursor-cli');
    return claudeKey || cursorKey;
  }, [getApiKey]);

  const getSelectedTool = React.useCallback((): AITool | null => {
    const tool = storage.getItem('claude-code-cloud-tool');
    return tool as AITool | null;
  }, [storage]);

  const setSelectedTool = React.useCallback((tool: AITool): void => {
    storage.setItem('claude-code-cloud-tool', tool);
  }, [storage]);

  return React.useMemo(() => ({
    getApiKey,
    setApiKey,
    clearApiKey,
    getAnyApiKey,
    getSelectedTool,
    setSelectedTool,
  }), [getApiKey, setApiKey, clearApiKey, getAnyApiKey, getSelectedTool, setSelectedTool]);
}