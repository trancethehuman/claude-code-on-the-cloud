"use client";

import React from "react";
import { ThemeToggle } from "./theme-toggle";

interface TopBarProps {
  title?: string;
  subtitle?: string | React.ReactNode;
  children?: React.ReactNode;
}

export function TopBar({ title, subtitle, children }: TopBarProps) {
  return (
    <div className="border-b bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1">
          {title && (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
          )}
          {subtitle && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {typeof subtitle === 'string' ? subtitle : <>{subtitle}</>}
            </div>
          )}
        </div>

        {children && (
          <div className="flex items-center gap-3">
            {children}
            <div className="h-4 w-px bg-border" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}