import React from "react";
import { Loader } from "./ai-elements/loader";

interface TerminalMessageProps {
  command: string;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
}

export function TerminalMessage({ command, result }: TerminalMessageProps) {
  const isLoading = result.exitCode === -1;

  return (
    <div className="mb-4 font-mono text-sm">
      {/* Command input */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-green-600">$</span>
        <span className="text-foreground">{command}</span>
      </div>
      
      {/* Command output or loading indicator */}
      <div className="ml-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader size={12} />
            <span className="text-sm">Running command...</span>
          </div>
        ) : (
          <>
            {/* Standard output */}
            {result.stdout && (
              <pre className="text-foreground whitespace-pre-wrap break-words">
                {result.stdout}
              </pre>
            )}
            
            {/* Standard error */}
            {result.stderr && (
              <pre className="text-red-600 whitespace-pre-wrap break-words">
                {result.stderr}
              </pre>
            )}
            
            {/* Exit code indicator (only show if non-zero or no output) */}
            {(result.exitCode !== 0 || (!result.stdout && !result.stderr)) && (
              <div className={`text-xs mt-1 ${result.exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
                Exit code: {result.exitCode}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}