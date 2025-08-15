"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TerminalInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function TerminalInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "",
  className,
}: TerminalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input when component mounts
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
  };

  return (
    <div className={cn(
      "flex items-baseline bg-black text-green-400 p-3 font-mono text-sm border-none rounded-lg",
      "dark:bg-black dark:text-green-400",
      className
    )}>
      <span className="text-green-400 select-none leading-none">~/sandbox $&nbsp;</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "flex-1 bg-transparent border-none outline-none ring-0 text-green-400 placeholder-green-600/70",
          "focus:ring-0 focus:outline-none leading-none terminal-input",
          disabled && "cursor-not-allowed opacity-50"
        )}
        autoComplete="off"
        spellCheck="false"
      />
    </div>
  );
}