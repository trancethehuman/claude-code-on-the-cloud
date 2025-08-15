export type AITool = 'claude-code' | 'cursor-cli';

export interface SessionInfo {
  sessionId: string;
  toolType: AITool;
  sandboxId: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface Message {
  type: 'system' | 'user' | 'assistant' | 'result' | 'error';
  subtype?: string;
  content?: string;
  session_id?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface SessionConfig {
  resumeCommand: (sessionId: string) => string[];
  continueCommand: string[];
  listCommand?: string[];
  extractSessionId: (response: any) => string | null;
}

export interface AIToolConfig {
  name: string;
  displayName: string;
  apiKeyLabel: string;
  apiKeyEnvVar: string;
  installation: {
    command: string;
    args: string[];
    sudo: boolean;
  };
  executable: {
    name: string;
    commonPaths: string[];
  };
  verification: {
    helpCommand: {
      args: string[];
    };
    promptCommand: {
      args: string[];
    };
  };
  sessionConfig: SessionConfig;
}

export const AI_TOOLS_CONFIG: Record<AITool, AIToolConfig> = {
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    apiKeyLabel: 'Anthropic API Key',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    installation: {
      command: 'bash',
      args: ['-c', 'npm install -g @anthropic-ai/claude-code'],
      sudo: true
    },
    executable: {
      name: 'claude',
      commonPaths: [
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        '/root/.npm-global/bin/claude',
        '/home/vercel-sandbox/.npm-global/bin/claude',
        '/usr/local/lib/node_modules/@anthropic-ai/claude-code/dist/cli.js'
      ]
    },
    verification: {
      helpCommand: {
        args: ['--help', '--dangerously-skip-permissions']
      },
      promptCommand: {
        args: ['-p', 'hello', '--output-format', 'json', '--dangerously-skip-permissions']
      }
    },
    sessionConfig: {
      resumeCommand: (sessionId: string) => ['--resume', sessionId, '--output-format', 'json', '--dangerously-skip-permissions'],
      continueCommand: ['--continue', '--output-format', 'json', '--dangerously-skip-permissions'],
      extractSessionId: (response: any) => {
        if (typeof response === 'string') {
          try {
            response = JSON.parse(response);
          } catch {
            return null;
          }
        }
        if (Array.isArray(response)) {
          for (const message of response) {
            if (message.session_id) {
              return message.session_id;
            }
          }
        } else if (response?.session_id) {
          return response.session_id;
        }
        return null;
      }
    }
  },
  'cursor-cli': {
    name: 'cursor-cli',
    displayName: 'Cursor CLI',
    apiKeyLabel: 'Cursor API Key',
    apiKeyEnvVar: 'CURSOR_API_KEY',
    installation: {
      command: 'bash',
      args: ['-c', 'curl -fsSL https://cursor.com/install | bash'],
      sudo: true
    },
    executable: {
      name: 'cursor-agent',
      commonPaths: [
        '/usr/local/bin/cursor-agent',
        '/usr/bin/cursor-agent',
        '/opt/cursor/cursor-agent',
        '/home/vercel-sandbox/.local/bin/cursor-agent',
        '/root/.local/share/cursor-agent/versions/*/cursor-agent'
      ]
    },
    verification: {
      helpCommand: {
        args: ['--help']
      },
      promptCommand: {
        args: ['-a', 'CURSOR_API_KEY_PLACEHOLDER', '-p', 'hello', '--output-format', 'json']
      }
    },
    sessionConfig: {
      resumeCommand: (sessionId: string) => ['-a', 'CURSOR_API_KEY_PLACEHOLDER', '--resume', sessionId, '--output-format', 'json'],
      continueCommand: ['-a', 'CURSOR_API_KEY_PLACEHOLDER', 'resume', '--output-format', 'json'],
      listCommand: ['ls'],
      extractSessionId: (response: any) => {
        if (typeof response === 'string') {
          try {
            response = JSON.parse(response);
          } catch {
            return null;
          }
        }
        if (response?.chat_id || response?.id) {
          return response.chat_id || response.id;
        }
        if (Array.isArray(response)) {
          for (const message of response) {
            if (message.chat_id || message.id) {
              return message.chat_id || message.id;
            }
          }
        }
        return null;
      }
    }
  }
};

export function getAIToolConfig(tool: AITool): AIToolConfig {
  return AI_TOOLS_CONFIG[tool];
}

export function getAllAITools(): { value: AITool; label: string }[] {
  return Object.entries(AI_TOOLS_CONFIG).map(([key, config]) => ({
    value: key as AITool,
    label: config.displayName
  }));
}

export function extractSessionIdFromResponse(tool: AITool, response: any): string | null {
  const config = getAIToolConfig(tool);
  return config.sessionConfig.extractSessionId(response);
}

export function getResumeCommand(tool: AITool, sessionId: string): string[] {
  const config = getAIToolConfig(tool);
  return config.sessionConfig.resumeCommand(sessionId);
}

export function getContinueCommand(tool: AITool): string[] {
  const config = getAIToolConfig(tool);
  return config.sessionConfig.continueCommand;
}

export function getListSessionsCommand(tool: AITool): string[] | null {
  const config = getAIToolConfig(tool);
  return config.sessionConfig.listCommand || null;
}