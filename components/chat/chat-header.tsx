import React from "react";
import { RotateCcw, Plus, Square, AlertCircle } from "lucide-react";
import { TopBar } from "../top-bar";
import { Button } from "../ui/button";

interface ChatHeaderProps {
  remainingTimeMs: number | null;
  formatTime: (ms: number) => string;
  isExpired: boolean;
  isStoppingSandbox: boolean;
  onNewChat: () => void;
  onStopSandbox: () => void;
  onNewSandbox: () => void;
}

export function ChatHeader({
  remainingTimeMs,
  formatTime,
  isExpired,
  isStoppingSandbox,
  onNewChat,
  onStopSandbox,
  onNewSandbox,
}: ChatHeaderProps) {
  return (
    <>
      <TopBar 
        subtitle={remainingTimeMs !== null ? (
          <div className="flex items-center gap-1">
            <span>Time remaining:</span>
            <span
              className={`font-mono ${
                remainingTimeMs < 60000 ? "text-red-600" : ""
              }`}
            >
              {formatTime(remainingTimeMs)}
            </span>
          </div>
        ) : undefined}
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewChat}
            disabled={isExpired}
            title="New Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onStopSandbox}
            disabled={isStoppingSandbox || isExpired}
            title={isStoppingSandbox ? "Stopping..." : "Stop Sandbox"}
          >
            <Square className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNewSandbox}
            title="New Sandbox"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </TopBar>

      {/* Expired State Banner */}
      {isExpired && (
        <div className="border-b bg-destructive/10 border-destructive/20 px-4 py-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Sandbox has expired</span>
            <div className="flex-1" />
            <Button
              variant="destructive"
              size="sm"
              onClick={onNewSandbox}
              className="h-7"
            >
              <Plus className="w-3 h-3 mr-1" />
              Create New Sandbox
            </Button>
          </div>
        </div>
      )}
    </>
  );
}