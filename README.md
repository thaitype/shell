# @thaitype/shell

[![CI](https://github.com/thaitype/shell/actions/workflows/main.yml/badge.svg)](https://github.com/thaitype/shell/actions/workflows/main.yml) [![codecov](https://codecov.io/gh/thaitype/shell/graph/badge.svg?token=TUE7DJ6NKX)](https://codecov.io/gh/thaitype/shell) [![NPM Version](https://img.shields.io/npm/v/@thaitype/shell)](https://www.npmjs.com/package/@thaitype/shell) [![npm downloads](https://img.shields.io/npm/dt/@thaitype/shell)](https://www.npmjs.com/@thaitype/shell)

A lightweight, type-safe wrapper around [execa](https://github.com/sindresorhus/execa) for running shell commands with an elegant fluent API and flexible output modes.

## Why @thaitype/shell?

Running shell commands in Node.js often involves repetitive boilerplate and dealing with low-level stdio configuration. `@thaitype/shell` provides a modern, fluent API that makes shell scripting in TypeScript/JavaScript feel natural and enjoyable.

**Modern Fluent API:**
```typescript
import { createShell } from '@thaitype/shell';

const $ = createShell().asFluent();

// Simple and elegant
const output = await $`echo hello world`;

// Chain operations
const lines = await $`ls -la`.toLines();

// Parse JSON with validation
const pkg = await $`cat package.json`.parse(schema);

// Handle errors gracefully
const result = await $`some-command`.result();
if (!result.success) {
  console.error('Failed:', result.stderr);
}
```

**Key Features:**

- **Fluent API** - Elegant tagged template syntax and chainable methods
- **Type-safe** - Full TypeScript support with automatic type inference
- **Flexible output modes** - Capture, stream live, or both simultaneously
- **Schema validation** - Built-in JSON parsing with Standard Schema (Zod, Valibot, etc.)
- **Smart error handling** - Choose between throwing or non-throwing APIs
- **Lazy execution** - Commands don't run until consumed
- **Memoization** - Multiple consumptions share the same execution
- **Dry-run mode** - Test scripts without executing commands
- **Verbose logging** - Debug with automatic command logging

## Installation

```bash
npm install @thaitype/shell
# or
pnpm add @thaitype/shell
# or
yarn add @thaitype/shell
# or
bun add @thaitype/shell
```

## Compatibility

This package is **ESM only** and requires:

- **Node.js** >= 20
- **ESM** module system (not CommonJS)

Following the same philosophy as [execa](https://github.com/sindresorhus/execa), this package is pure ESM. Please [read this](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) if you need help migrating from CommonJS.

## Quick Start

### Basic Usage - Fluent API

```typescript
import { createShell } from '@thaitype/shell';

// Create a fluent shell function
const $ = createShell().asFluent();

// Execute and get output
const output = await $`echo "Hello World"`;
console.log(output); // "Hello World"

// Use function call syntax
const result = await $('ls -la');
console.log(result);

// Array syntax for precise arguments
const files = await $(['echo', 'file with spaces.txt']);
```

## Fluent API Guide

The fluent API provides an elegant, modern way to run shell commands with powerful features like lazy execution, memoization, and chainable operations.

### Tagged Templates

Use backticks for natural command syntax with interpolation:

```typescript
const $ = createShell().asFluent();

const name = 'world';
const greeting = await $`echo hello ${name}`;
console.log(greeting); // "hello world"

// Works with any shell command
const files = await $`ls -la /tmp`;
const branch = await $`git rev-parse --abbrev-ref HEAD`;
```

### Function Call Syntax

For dynamic commands or when you need to pass options:

```typescript
const $ = createShell().asFluent();

// String command
const output = await $('echo hello');

// Array command (recommended for arguments with spaces)
const result = await $(['echo', 'hello world']);

// With options
const output = await $('npm run build', { outputMode: 'all' });
```

### Non-Throwable Execution with `.result()`

Handle failures gracefully without try-catch:

```typescript
const $ = createShell().asFluent();

const result = await $`some-command-that-might-fail`.result();

if (!result.success) {
  console.error(`Command failed with exit code ${result.exitCode}`);
  console.error(`Error: ${result.stderr}`);
} else {
  console.log(`Output: ${result.stdout}`);
}
```

### Working with Lines - `.toLines()`

Split output into an array of lines:

```typescript
const $ = createShell().asFluent();

// Get directory listing as lines
const files = await $`ls -1 /tmp`.toLines();
files.forEach(file => console.log(`File: ${file}`));

// Read and process file lines
const lines = await $`cat /etc/hosts`.toLines();
const nonEmpty = lines.filter(line => line.trim() !== '');
```

### JSON Parsing with Validation - `.parse()`

Parse and validate JSON output with Standard Schema:

```typescript
import { createShell } from '@thaitype/shell';
import { z } from 'zod';

const $ = createShell().asFluent();

// Define schema
const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string()).optional(),
});

// Parse and validate (throws on error)
const pkg = await $`cat package.json`.parse(packageSchema);
console.log(`Package: ${pkg.name}@${pkg.version}`);

// API response example
const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
});

const user = await $`curl -s https://api.example.com/user/1`.parse(userSchema);
console.log(`User: ${user.username} (${user.email})`);
```

### Non-Throwable Parsing - `.safeParse()`

Parse JSON without throwing exceptions:

```typescript
const $ = createShell().asFluent();

const schema = z.object({
  status: z.string(),
  data: z.array(z.any()),
});

const result = await $`curl -s https://api.example.com/data`.safeParse(schema);

if (result.success) {
  console.log('Data:', result.data.data);
} else {
  console.error('Validation failed:', result.error);
  // Handle error gracefully - could be:
  // - Command failed
  // - Invalid JSON
  // - Schema validation failed
}
```

### Lazy Execution and Memoization

Commands don't execute until consumed, and multiple consumptions share execution:

```typescript
const $ = createShell().asFluent();

// Create handle - command hasn't run yet
const handle = $`echo expensive operation`;

// First consumption - executes command
const output1 = await handle;

// Second consumption - reuses first execution
const output2 = await handle;

// Works across different methods too
const result = await handle.result(); // Still same execution!

// All three share the same memoized result
console.log(output1 === output2); // true
```

### Output Modes

Control how command output is handled:

```typescript
const shell = createShell({ outputMode: 'capture' }); // Default
const $ = shell.asFluent();

// Capture mode: Output is captured for programmatic use
const output = await $`npm run build`;
console.log(output);

// All mode: Both capture AND stream to console
const shell2 = createShell({ outputMode: 'all' });
const $2 = shell2.asFluent();

const result = await $2`npm test`.result();
// Test output appears in real-time on console
// AND is available in result.stdout

// Override mode per command
const output2 = await $(['npm', 'install'], { outputMode: 'all' });
```

**Important:** Fluent API does not support `'live'` mode (streaming only, no capture) because fluent operations require stdout for chaining, parsing, and memoization. Use the traditional Shell API if you need live-only mode.

## Example Use Cases

### 1. Build Script with Progress

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell({
  outputMode: 'all',  // Show output + capture
  verbose: true        // Log commands
});

const $ = shell.asFluent();

console.log('🏗️  Building project...');

// Clean
await $`rm -rf dist`;

// Build
const buildResult = await $`npm run build`.result();
if (!buildResult.success) {
  console.error('❌ Build failed!');
  process.exit(1);
}

// Test
await $`npm test`;

console.log('✅ Build complete!');
```

### 2. Git Workflow Helper

```typescript
import { createShell } from '@thaitype/shell';

const $ = createShell().asFluent();

// Get current branch
const branch = await $`git rev-parse --abbrev-ref HEAD`;
console.log(`Current branch: ${branch}`);

// Check for uncommitted changes
const status = await $`git status --porcelain`.result();
if (status.stdout.trim() !== '') {
  console.log('⚠️  You have uncommitted changes');
}

// Get recent commits as lines
const commits = await $`git log --oneline -5`.toLines();
console.log('Recent commits:');
commits.forEach(commit => console.log(`  ${commit}`));
```

### 3. System Information Gathering

```typescript
import { createShell } from '@thaitype/shell';
import { z } from 'zod';

const $ = createShell().asFluent();

// Parse JSON output
const pkgSchema = z.object({
  name: z.string(),
  version: z.string(),
  engines: z.object({
    node: z.string(),
  }).optional(),
});

const pkg = await $`cat package.json`.parse(pkgSchema);

// Get Node version
const nodeVersion = await $`node --version`;

// Get system info as lines
const osInfo = await $`uname -a`.toLines();

console.log(`Project: ${pkg.name}@${pkg.version}`);
console.log(`Node: ${nodeVersion}`);
console.log(`OS: ${osInfo[0]}`);
```

### 4. Safe Command Execution

```typescript
import { createShell } from '@thaitype/shell';

const $ = createShell().asFluent();

async function deployApp() {
  // Test connection
  const ping = await $`curl -s https://api.example.com/health`.result();
  if (!ping.success) {
    console.error('❌ API is not reachable');
    return false;
  }

  // Run tests
  const tests = await $`npm test`.result();
  if (!tests.success) {
    console.error('❌ Tests failed');
    return false;
  }

  // Deploy
  const deploy = await $`npm run deploy`.result();
  if (!deploy.success) {
    console.error('❌ Deployment failed');
    console.error(deploy.stderr);
    return false;
  }

  console.log('✅ Deployment successful!');
  return true;
}

await deployApp();
```

### 5. Dry-Run Mode for Testing

Test your automation scripts without actually executing commands:

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell({
  dryRun: true,   // Commands logged but not executed
  verbose: true
});

const $ = shell.asFluent();

// These commands will be logged but not executed
await $`rm -rf node_modules`;
// Output: $ rm -rf node_modules
// (nothing is actually deleted)

await $`git push origin main`;
// Output: $ git push origin main
// (nothing is actually pushed)

console.log('✅ Dry run complete - no actual changes made!');
```

## Traditional Shell API

For cases where you need more control or don't want the fluent API, use the traditional methods:

### `shell.run()` - Throws on Error

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell();

try {
  const result = await shell.run('npm test');
  console.log('Tests passed!', result.stdout);
} catch (error) {
  console.error('Tests failed:', error.message);
}
```

### `shell.safeRun()` - Never Throws

```typescript
const shell = createShell();

const result = await shell.safeRun('npm test');

if (!result.success) {
  console.error('Command failed with exit code:', result.exitCode);
  console.error('Error output:', result.stderr);
} else {
  console.log('Success:', result.stdout);
}
```

### Output Modes

```typescript
const shell = createShell();

// Capture mode (default): Capture output for programmatic use
const result1 = await shell.run('ls -la', { outputMode: 'capture' });
console.log('Files:', result1.stdout);

// Live mode: Stream output to console in real-time (no capture)
await shell.run('npm test', { outputMode: 'live' });
// Output appears in real-time, stdout/stderr will be null

// All mode: Both capture AND stream simultaneously
const result2 = await shell.run('npm run build', { outputMode: 'all' });
// Output streams to console AND is captured
console.log('Build output was:', result2.stdout);
```

### Schema Validation

```typescript
import { createShell } from '@thaitype/shell';
import { z } from 'zod';

const shell = createShell();

const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

// Throws on error
const pkg = await shell.runParse('cat package.json', packageSchema);
console.log(`${pkg.name}@${pkg.version}`);

// Never throws
const result = await shell.safeRunParse('cat package.json', packageSchema);
if (result.success) {
  console.log(`${result.data.name}@${result.data.version}`);
} else {
  console.error('Validation failed:', result.error);
}
```

## API Reference

### Factory Function

#### `createShell(options?)`

Creates a new Shell instance with better type inference (recommended).

```typescript
const shell = createShell({
  outputMode: 'capture',  // 'capture' | 'live' | 'all'
  dryRun: false,
  verbose: false,
  throwMode: 'simple',    // 'simple' | 'raw'
  logger: {
    debug: (msg, ctx) => console.debug(msg),
    warn: (msg, ctx) => console.warn(msg),
  },
  execaOptions: {
    env: { NODE_ENV: 'production' },
    timeout: 30000,
    cwd: '/app',
  },
});
```

### Fluent API

#### `shell.asFluent()`

Returns a fluent shell function that supports tagged templates and function calls.

```typescript
const $ = shell.asFluent();

// Tagged template
await $`command`;

// Function calls
await $('command');
await $(['command', 'arg']);
await $(command, options);
```

**Returns:** `DollarFunction` that creates `LazyCommandHandle` instances.

**Throws:** Error if shell has `outputMode: 'live'` (fluent API requires output capture).

#### `LazyCommandHandle`

Handle returned by fluent API with lazy execution and memoization.

**Direct await - Throwable:**
```typescript
const output: string = await $`command`;
```

**Methods:**

- **`.result()`** - Non-throwable execution
  ```typescript
  const result = await $`command`.result();
  // result: { success: boolean, stdout: string, stderr: string, exitCode: number | undefined }
  ```

- **`.toLines()`** - Split output into lines (throws on error)
  ```typescript
  const lines: string[] = await $`command`.toLines();
  ```

- **`.parse<T>(schema)`** - Parse and validate JSON (throws on error)
  ```typescript
  const data: T = await $`command`.parse(schema);
  ```

- **`.safeParse<T>(schema)`** - Parse and validate JSON (never throws)
  ```typescript
  const result = await $`command`.safeParse(schema);
  // result: { success: true, data: T } | { success: false, error: Error[] }
  ```

### Traditional Shell Methods

#### `shell.run(command, options?)`

Execute command that throws on error.

**Returns:** `Promise<StrictResult>`
```typescript
{ stdout: string | null, stderr: string | null }
```

#### `shell.safeRun(command, options?)`

Execute command that never throws.

**Returns:** `Promise<SafeResult>`
```typescript
{
  stdout: string | null,
  stderr: string | null,
  exitCode: number | undefined,
  success: boolean
}
```

#### `shell.runParse(command, schema, options?)`

Execute, parse, and validate JSON (throws on error).

**Returns:** `Promise<T>` (inferred from schema)

#### `shell.safeRunParse(command, schema, options?)`

Execute, parse, and validate JSON (never throws).

**Returns:** `Promise<ValidationResult<T>>`
```typescript
{ success: true, data: T } | { success: false, error: Error[] }
```

### Options

#### `ShellOptions`

```typescript
interface ShellOptions {
  outputMode?: 'capture' | 'live' | 'all';  // default: 'capture'
  dryRun?: boolean;                          // default: false
  verbose?: boolean;                         // default: false
  throwMode?: 'simple' | 'raw';              // default: 'simple'
  logger?: ShellLogger;
  execaOptions?: ExecaOptions;               // Merged with command options
}
```

#### `RunOptions`

```typescript
interface RunOptions extends ExecaOptions {
  outputMode?: 'capture' | 'live' | 'all';
  verbose?: boolean;
  dryRun?: boolean;
}
```

All options from [execa](https://github.com/sindresorhus/execa#options) are supported. Shell-level and command-level options are deep merged.

## Advanced Usage

### Custom Logger Integration

```typescript
import { createShell } from '@thaitype/shell';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const shell = createShell({
  verbose: true,
  logger: {
    debug: (message, context) => {
      logger.debug(message, {
        command: context.command,
        cwd: context.execaOptions.cwd
      });
    },
    warn: (message, context) => {
      logger.warn(message, { command: context.command });
    }
  }
});

const $ = shell.asFluent();
await $`npm install`;
// Commands logged via Winston with context
```

### Deep Merge Options

```typescript
const shell = createShell({
  execaOptions: {
    env: { API_KEY: 'default', NODE_ENV: 'dev' },
    timeout: 5000,
  }
});

const $ = shell.asFluent();

// Options are deep merged
const result = await $('node script.js', {
  env: { NODE_ENV: 'prod', EXTRA: 'value' },
  timeout: 30000,
});

// Resulting env: { API_KEY: 'default', NODE_ENV: 'prod', EXTRA: 'value' }
// Resulting timeout: 30000
```

## License

MIT - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/thaitype/shell.git
   cd shell
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run tests:
   ```bash
   pnpm test
   ```

4. Build:
   ```bash
   pnpm build
   ```

### Guidelines

- Ensure all tests pass before submitting PR
- Add tests for new features
- Follow the existing code style
- Update documentation as needed

## Author

Thada Wangthammang

## Links

- [GitHub Repository](https://github.com/thaitype/shell)
- [NPM Package](https://www.npmjs.com/package/@thaitype/shell)
- [Issue Tracker](https://github.com/thaitype/shell/issues)
