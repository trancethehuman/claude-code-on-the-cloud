"use client";

import React from "react";
import { CreateSandbox } from "./create-sandbox";
import { TopBar } from "./top-bar";

export function AppContainer() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar title="CLI on the Cloud" subtitle="Create AI-powered sandboxes with Claude Code or Cursor CLI" />
      <div className="flex-1 flex items-center justify-center p-8">
        <CreateSandbox />
      </div>
    </div>
  );
}