import React from 'react';
import { AITool, SessionInfo } from '@/lib/ai-tools-config';
import { useStorage } from './use-storage';
import { getSessionsKey, MAX_SESSIONS } from '@/components/chat/constants';

export function useSessionStorage() {
  const storage = useStorage();

  const getSessions = React.useCallback((tool: AITool): SessionInfo[] => {
    const data = storage.getItem(getSessionsKey(tool));
    if (!data) return [];
    try {
      return JSON.parse(data) as SessionInfo[];
    } catch {
      return [];
    }
  }, [storage]);

  const saveSession = React.useCallback((session: SessionInfo): void => {
    const tool = session.toolType;
    const currentSessions = getSessions(tool);

    // Remove existing session with same ID if it exists
    const existingIndex = currentSessions.findIndex(
      (s) => s.sessionId === session.sessionId
    );
    if (existingIndex >= 0) {
      currentSessions[existingIndex] = session;
    } else {
      currentSessions.push(session);
    }

    // Keep only the most recent sessions
    currentSessions.sort(
      (a, b) =>
        new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
    );
    const limitedSessions = currentSessions.slice(0, MAX_SESSIONS);

    storage.setItem(getSessionsKey(tool), JSON.stringify(limitedSessions));
  }, [storage, getSessions]);

  const clearSessions = React.useCallback((tool: AITool): void => {
    storage.removeItem(getSessionsKey(tool));
  }, [storage]);

  return React.useMemo(() => ({
    getSessions,
    saveSession,
    clearSessions,
  }), [getSessions, saveSession, clearSessions]);
}