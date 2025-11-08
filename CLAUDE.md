# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@thaitype/shell` is a lightweight, type-safe wrapper around [execa](https://github.com/sindresorhus/execa) for running shell commands with flexible output modes. It provides a simplified API with built-in support for dry-run mode, verbose logging, and multiple output handling strategies.

**Key Dependencies:**
- `execa` (v9.6.0) - The underlying process execution library
- `string-argv` - For parsing command strings into argument arrays

**Module System:** This is an **ESM-only** package. All imports must use `.js` extensions (e.g., `./shell.js`) even though source files are `.ts`.

## Architecture

The codebase is intentionally minimal with a single-class design:

### Core Structure

```
src/
├── index.ts       # Main entry point, re-exports from shell.ts
└── shell.ts       # Shell class with all core logic
```

### Shell Class Design

The `Shell` class (`src/shell.ts`) provides three public methods:

1. **`run()`** - Recommended for most use cases. Throws on error.
   - Returns `StrictResult` with stdout and stderr only
   - Command either succeeds or throws an exception

2. **`safeRun()`** - Never throws. Returns error result instead.
   - Returns `SafeResult` with stdout, stderr, exitCode, and success flag
   - Always succeeds, check `result.success` to determine outcome

3. **`execute()`** - Low-level method with explicit throwOnError control
   - Pass `{ throwOnError: true }` for run() behavior
   - Pass `{ throwOnError: false }` for safeRun() behavior

**Implementation Details:**

1. **Output Modes** - Three strategies for handling stdout/stderr:
   - `capture`: Pipes output for programmatic access (default)
   - `live`: Inherits stdio, streams to console in real-time (returns null for stdout/stderr)
   - `all`: Combines both - captures AND streams simultaneously

   Implementation detail: Maps output modes to execa stdio configuration using a `stdioMap` object

2. **Command Parsing** - Accepts commands as either:
   - String: Parsed via `string-argv` to handle quoting/escaping
   - Array: Passed directly as [program, ...args]

3. **Error Handling** - Two throw modes:
   - `simple` (default): Throws clean error message with command, exit code, and stderr
   - `raw`: Throws the full `ExecaError` object from execa

4. **Execution Modes**:
   - Normal: Executes commands via execa
   - Dry-run: Logs commands but skips execution, returns mock success result
   - Verbose: Logs every command before execution (works with or without dry-run)

### Key Interfaces

- `ShellOptions`: Constructor configuration (defaultOutputMode, dryRun, verbose, throwMode, logger)
- `RunOptions`: Per-command overrides, extends `ExecaOptions` from execa
- `StrictResult`: Return type for `run()` (stdout, stderr)
- `SafeResult`: Return type for `safeRun()` (stdout, stderr, exitCode, success)

## Development Commands

### Building
```bash
pnpm build              # Format → Build ESM → Annotate pure calls
pnpm build-esm          # TypeScript compilation only
```

Build outputs:
- `dist/esm/` - Compiled JavaScript modules
- `dist/dts/` - TypeScript declaration files

The build uses Babel's `annotate-pure-calls` plugin for better tree-shaking.

### Testing
```bash
pnpm test               # Run tests in watch mode (Vitest)
pnpm test:ci            # Run tests once (for CI)
pnpm test:coverage      # Generate coverage report
pnpm test:coverage:feedback  # Run coverage with detailed feedback on uncovered lines
```

Tests are located in `test/shell.test.ts` and focus on Shell class logic (not execa features).

### Linting & Type Checking
```bash
pnpm lint               # Type check + ESLint + Prettier check
pnpm lint:fix           # Auto-fix linting issues
pnpm check-types        # TypeScript type checking only
pnpm format             # Format src/ with Prettier
```

### Development
```bash
pnpm dev                # Watch mode with tsx
pnpm start              # Run src/main.ts once
```

Note: `src/main.ts` is not in the repository - you'll need to create it for local testing.

### Release Process
```bash
pnpm changeset          # Create a changeset
pnpm release            # Lint → Build → Version → Publish (uses changesets)
```

## Important Patterns

### Import Extensions
All imports in source files MUST use `.js` extensions (not `.ts`) due to ESM requirements:
```typescript
export * from './shell.js';  // ✓ Correct
export * from './shell';     // ✗ Wrong
```

### Logger Pattern
The Shell class accepts an optional `logger` function that defaults to `console.log`. Use optional chaining when calling:
```typescript
this.logger?.(`$ ${args.join(' ')}`);
```

### Error Handling Strategy
Three approaches to error handling:
- `run()`: Always throws on error (uses `reject: true` in execa)
- `safeRun()`: Never throws, returns result with `success: false` (uses `reject: false` in execa)
- `execute({ throwOnError })`: Explicit control over throw behavior

When using `safeRun()` or `execute({ throwOnError: false })`, check `result.success` to determine if the command succeeded.

### Stdio Configuration
Output modes are implemented by mapping to execa's stdio arrays:
- Single values like `'pipe'` or `'inherit'`
- Arrays like `['pipe', 'inherit']` for the `all` mode (both capture and stream)

## Package Configuration Notes

- **Package Manager**: pnpm@10.11.0 (specified in packageManager field)
- **Node Version**: >=20 required
- **Published Files**: Only `dist/`, `src/`, `README.md`, `package.json` are included in npm package
- Uses `npm-run-all2` (`run-s`) for sequential script execution in package.json

## TypeScript Configuration

- Uses `"module": "nodenext"` with `verbatimModuleSyntax: true`
- Path alias: `@thaitype/shell` → `src/index.ts` (for internal imports)
- Strict mode enabled
- `noUnusedLocals` and `noUnusedParameters` are disabled (allowing unused variables)
