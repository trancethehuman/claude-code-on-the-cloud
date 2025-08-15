# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"CLI on the Cloud" - A Next.js application that creates Vercel Sandbox environments and installs AI coding tools (Claude Code or Cursor CLI) for headless operation. Built with Next.js, Shadcn, and Vercel Sandbox.

## Development Commands

- **Development server**: `pnpm dev` (auto-syncs Vercel OIDC token, uses Turbopack)
- **Development server (no sync)**: `pnpm dev:no-sync` (skips token sync)
- **Build**: `pnpm build`
- **Production server**: `pnpm start`
- **Linting**: `pnpm lint` (ESLint + TypeScript checking)
- **Type checking**: `npx tsc --noEmit` (TypeScript compiler type checking)
- **Sync Vercel environment**: `pnpm sync-env`

This project uses pnpm as the package manager.

## Architecture & Technology Stack

### Core Technologies

- **Framework**: Next.js 15.4.6 with App Router
- **React**: 19.1.0 
- **TypeScript**: Full TypeScript setup with strict mode
- **Styling**: Tailwind CSS v4 with Shadcn/ui components
- **Sandbox Environment**: Vercel Sandbox for isolated code execution
- **AI Tools**: Claude Code (npx) and Cursor CLI with JSON output

### Key Features

- **AI Tool Selection**: Dropdown to choose between Claude Code or Cursor CLI
- **API Key Persistence**: Saves API keys to localStorage by tool type
- **Sandbox Management**: Automated Vercel Sandbox creation and tool installation
- **Token Management**: Auto-sync fresh Vercel OIDC tokens via `scripts/sync-vercel-env.js`
- **JSON Response Parsing**: Structured AI responses with cost/timing metrics
- **Environment Preservation**: Script maintains existing `.env.local` variables

## Implementation Details

**AI Tool Configuration** (`lib/ai-tools-config.ts`):
- Claude Code: Uses `npx @anthropic-ai/claude-code` with `ANTHROPIC_API_KEY` env var
- Cursor CLI: Uses `cursor-agent -a <key>` with command-line API key flag  
- Both tools output JSON with `--output-format json` parameter

**API Route** (`app/api/new-sandbox/route.ts`):
- Creates Vercel Sandbox, installs tools, tests with "hello" prompt
- Parses JSON responses and logs structured output to console
- Returns parsed responses to frontend for display

**Frontend** (`components/create-sandbox.tsx`):
- localStorage persistence for API keys (per tool) and tool selection
- JSON response parsing with pretty-printing and metadata display
- Collapsible raw output section for debugging

## Environment Setup

- **VERCEL_OIDC_TOKEN**: Auto-synced via `scripts/sync-vercel-env.js` 
- **API Keys**: Stored in browser localStorage, not server-side
- **Environment Preservation**: Sync script maintains all existing `.env.local` variables

## Code Patterns

- Shadcn/ui components with Tailwind CSS semantic variables
- TypeScript with strict mode and path mapping (`@/*`)
- Component-first architecture with React hooks
- JSON-first AI tool integration with structured response parsing

## Code Quality Rules

**IMPORTANT**: Always run the linter after writing or modifying code:

1. **After making any code changes**, run: `pnpm lint`
2. **For TypeScript-only checking**, run: `npx tsc --noEmit` 
3. **Fix all linting errors** before considering the task complete
4. **Never commit code** with linting or TypeScript errors

This ensures code quality, consistency, and prevents runtime errors.
