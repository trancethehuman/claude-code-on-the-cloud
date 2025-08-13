export type AITool = 'claude-code' | 'cursor-cli';

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
        args: ['--help']
      },
      promptCommand: {
        args: ['-p', 'hello', '--output-format', 'json']
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