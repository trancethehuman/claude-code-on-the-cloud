import React from "react";
import { Clock, DollarSign, Hash, Info } from "lucide-react";
import { Actions, Action } from "../ai-elements/actions";

interface MessageMetadata {
  sessionId?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  exitCode?: number;
}

interface MessageMetadataProps {
  metadata: MessageMetadata;
}

export function MessageMetadataDisplay({ metadata }: MessageMetadataProps) {
  return (
    <Actions className="mt-2 px-4">
      {metadata.duration_ms && (
        <Action
          tooltip={`Response time: ${metadata.duration_ms}ms`}
          label="Response time"
        >
          <Clock className="size-4" />
        </Action>
      )}
      {metadata.total_cost_usd && (
        <Action
          tooltip={`Cost: $${metadata.total_cost_usd}`}
          label="Cost"
        >
          <DollarSign className="size-4" />
        </Action>
      )}
      {metadata.usage && (
        <Action
          tooltip={`Tokens: ${
            metadata.usage.input_tokens || 0
          } in, ${
            metadata.usage.output_tokens || 0
          } out`}
          label="Token usage"
        >
          <Hash className="size-4" />
        </Action>
      )}
      {metadata.sessionId && (
        <Action
          tooltip={`Session: ${metadata.sessionId}`}
          label="Session info"
        >
          <Info className="size-4" />
        </Action>
      )}
    </Actions>
  );
}