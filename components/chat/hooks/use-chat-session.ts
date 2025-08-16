import { useState } from 'react';
import { SessionInfo, AITool } from '@/lib/ai-tools-config';
import { useSessionStorage } from '@/hooks/use-session-storage';

export function useChatSession(tool: AITool | undefined) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { saveSession: saveSessionToStorage } = useSessionStorage();

  const saveSession = (sessionInfo: SessionInfo) => {
    if (!tool) return;
    saveSessionToStorage(sessionInfo);
  };

  return {
    currentSessionId,
    setCurrentSessionId,
    saveSession,
  };
}