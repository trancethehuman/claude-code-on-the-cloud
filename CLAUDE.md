# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Claude Code on the Cloud" - a Next.js application that puts Claude Code headless into a sandbox environment. Built with Next.js, AI SDK 5, AI Elements, Shadcn, and E2B (sandbox).

## Development Commands

- **Development server**: `pnpm dev` (uses Turbopack for faster development)
- **Build**: `pnpm build`  
- **Production server**: `pnpm start`
- **Linting**: `pnpm lint`

This project uses pnpm as the package manager.

## Architecture & Technology Stack

### Core Technologies
- **Framework**: Next.js 15.4.6 with App Router
- **React**: 19.1.0
- **TypeScript**: Full TypeScript setup with strict mode
- **AI Integration**: AI SDK 5.0.11 and @ai-sdk/react 2.0.11 for AI functionality
- **Styling**: Tailwind CSS v4 with Shadcn/ui components
- **Sandbox Environment**: E2B for sandboxed code execution

### Project Structure
- **App Directory**: Uses Next.js 13+ App Router structure in `/app`
- **Components**: Shadcn/ui configured with "new-york" style
- **Utils**: Common utilities in `/lib/utils.ts`
- **Styling**: Modern CSS setup with CSS variables and dark mode support

### Key Dependencies
- **UI Components**: Extensive Radix UI components (@radix-ui/*)
- **Markdown**: React Markdown with syntax highlighting, math rendering (KaTeX), and GFM support
- **Validation**: Zod for schema validation
- **Carousel**: Embla Carousel for interactive components

### Key Configurations

**TypeScript Setup**: 
- Path mapping configured with `@/*` pointing to root
- Strict mode enabled
- Next.js plugin integration

**Tailwind CSS**:
- Uses Tailwind CSS v4 with inline theme configuration  
- Extensive CSS custom properties for theming
- Dark mode support with `.dark` class
- Shadcn/ui integration with cssVariables enabled

**Component System**:
- Shadcn/ui components configured with:
  - Style: "new-york"
  - Base color: neutral
  - Icon library: lucide-react
  - Aliases set for @/components, @/lib, @/ui, @/hooks

### Fonts
- **Primary**: Geist Sans (--font-geist-sans)
- **Monospace**: Geist Mono (--font-geist-mono)

## Environment Setup
- Environment variables should be placed in `.env.local` (file exists but not tracked)
- Uses standard Next.js environment variable conventions

## Code Patterns
- Utility function `cn()` in `/lib/utils.ts` for Tailwind class merging using clsx and tailwind-merge
- CSS-in-JS approach using Tailwind utility classes
- Component-first architecture following Shadcn/ui patterns
- Modern React patterns with hooks and functional components
- **ALWAYS use Tailwind CSS semantic color variables** (e.g., `bg-primary`, `text-foreground`, `border-muted`) instead of hardcoded colors (e.g., `bg-blue-500`, `text-gray-900`) to maintain theme consistency

## Documentation References

### AI SDK 5
- **Main Docs**: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
- **AI Elements**: https://ai-sdk.dev/elements/overview

### E2B Sandbox
- **Documentation**: https://e2b.dev/docs

## Important Instructions

**ALWAYS** fetch the official documentation context before working with AI SDK, AI Elements, or E2B:
- Use WebFetch to get current documentation from the above URLs
- Include relevant documentation context in your responses
- Reference the official docs when implementing features with these tools
- This ensures you're using the most up-to-date APIs and best practices