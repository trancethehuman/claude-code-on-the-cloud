import React from "react";

interface TerminalMessageProps {
  command: string;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
}

export function TerminalMessage({ command, result }: TerminalMessageProps) {
  return (
    <div className="mb-4 font-mono text-sm">
      {/* Command input */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-green-600">$</span>
        <span className="text-foreground">{command}</span>
      </div>
      
      {/* Command output */}
      <div className="ml-4">
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
      </div>
    </div>
  );
}