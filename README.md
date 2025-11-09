# @thaitype/shell

[![CI](https://github.com/thaitype/shell/actions/workflows/main.yml/badge.svg)](https://github.com/thaitype/shell/actions/workflows/main.yml) [![codecov](https://codecov.io/gh/thaitype/shell/graph/badge.svg?token=TUE7DJ6NKX)](https://codecov.io/gh/thaitype/shell) [![NPM Version](https://img.shields.io/npm/v/@thaitype/shell)](https://www.npmjs.com/package/@thaitype/shell) [![npm downloads](https://img.shields.io/npm/dt/@thaitype/shell)](https://www.npmjs.com/@thaitype/shell) 

A lightweight, type-safe wrapper around [execa](https://github.com/sindresorhus/execa) for running shell commands with flexible output modes and better developer experience.

## Why @thaitype/shell?

Running shell commands in Node.js often involves repetitive boilerplate and dealing with low-level stdio configuration. While `execa` is a powerful library, common tasks like logging commands, handling dry-run mode, or switching between capturing and streaming output require manual setup each time.

`@thaitype/shell` solves this by providing:

- **Simplified API** - Run commands with a single, intuitive interface
- **Flexible output modes** - Easily switch between capturing, streaming, or both
- **Built-in dry-run** - Test scripts without actually executing commands
- **Automatic logging** - Optional verbose mode for debugging
- **Smart error handling** - Choose between simple error messages or full error objects
- **Type safety** - Full TypeScript support with comprehensive type definitions

## Features

- **Multiple output modes**: Capture output, stream live, or do both simultaneously
- **Dry-run mode**: Test your scripts without executing actual commands
- **Verbose logging**: Automatically log all executed commands with contextual information
- **Flexible error handling**: Choose to throw on errors or handle them gracefully
- **Schema validation**: Parse and validate JSON output with Standard Schema (Zod, Valibot, etc.)
- **Custom logger support**: Integrate with your preferred logging solution (debug/warn methods with context)
- **Deep merge options**: Shell-level defaults are deep merged with command-level options
- **Type-safe**: Written in TypeScript with full type definitions
- **ESM-first**: Modern ES modules support
- **Zero configuration**: Sensible defaults that work out of the box

## Compatibility

This package is **ESM only** and requires:

- **Node.js** >= 20
- **ESM** module system (not CommonJS)

Following the same philosophy as [execa](https://github.com/sindresorhus/execa), this package is pure ESM. Please [read this](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) if you need help migrating from CommonJS.

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

## Basic Usage

```typescript
import { createShell } from '@thaitype/shell';

// Create a shell instance
const shell = createShell();

// Run a command
const result = await shell.run('echo "Hello World"');

console.log(result.stdout); // "Hello World"
```

## Example Usage

### 1. Verbose Mode for Debugging

Perfect for build scripts and CI/CD pipelines where you want to see what's being executed:

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell({
  verbose: true  // Logs every command before execution
});

await shell.run('npm install');
// Output: $ npm install
// (then shows npm install output)

await shell.run('npm run build');
// Output: $ npm run build
// (then shows build output)
```

### 2. Dry-Run Mode for Testing

Test your automation scripts without actually executing commands:

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell({
  dryRun: true,   // Commands are logged but not executed
  verbose: true
});

// These commands will be logged but not executed
await shell.run('rm -rf node_modules');
// Output: $ rm -rf node_modules
// (nothing is actually deleted)

await shell.run('git push origin main');
// Output: $ git push origin main
// (nothing is actually pushed)

console.log('Dry run complete - no actual changes made!');
```

### 3. Different Output Modes

Control how command output is handled:

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell();

// Capture mode (default): Capture output for programmatic use
const result1 = await shell.run('ls -la', { outputMode: 'capture' });
console.log('Files:', result1.stdout);

// Live mode: Stream output to console in real-time
await shell.run('npm test', { outputMode: 'live' });
// Output appears in real-time as the command runs

// All mode: Both capture AND stream simultaneously
const result2 = await shell.run('npm run build', { outputMode: 'all' });
// Output streams to console AND is captured in result2.stdout
console.log('Build output was:', result2.stdout);
```

### 4. Graceful Error Handling

Handle command failures without throwing exceptions using `safeRun()`:

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell();

// safeRun() never throws, returns error result instead
const result = await shell.safeRun('some-command-that-might-fail');

if (!result.success) {
  console.error('Command failed with exit code:', result.exitCode);
  console.error('Error output:', result.stderr);
  // Handle the error gracefully
} else {
  console.log('Success:', result.stdout);
}
```

### 5. Schema Validation with JSON Output

Parse and validate JSON output from commands using Standard Schema:

```typescript
import { createShell } from '@thaitype/shell';
import { z } from 'zod';

const shell = createShell();

// Define a schema for package.json
const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string()).optional(),
});

// Parse and validate - throws if invalid
const pkg = await shell.runParse('cat package.json', packageSchema);
console.log(`Package: ${pkg.name}@${pkg.version}`);

// Safe parse - returns result object
const apiSchema = z.object({
  status: z.string(),
  data: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
});

const result = await shell.safeRunParse(
  'curl -s https://api.example.com/users',
  apiSchema
);

if (result.success) {
  result.data.data.forEach(user => {
    console.log(`User: ${user.name} (${user.id})`);
  });
} else {
  console.error('API validation failed:', result.error);
}
```

## API

### `createShell(options?)` (Recommended)

Factory function to create a new Shell instance with better type inference.

**Recommended:** Use `createShell()` instead of `new Shell()` for better developer experience and automatic type inference of the default output mode.

```typescript
import { createShell } from '@thaitype/shell';

// Type inference automatically detects 'live' as default mode
const shell = createShell({ outputMode: 'live' });
```

### `new Shell(options?)`

Alternative constructor for creating a Shell instance.

#### Options

```typescript
interface ShellOptions {
  /** Default output mode applied to all runs unless overridden */
  outputMode?: OutputMode; // 'capture' | 'live' | 'all', default: 'capture'

  /** If true, print commands but skip actual execution */
  dryRun?: boolean; // default: false

  /** If true, log every executed command */
  verbose?: boolean; // default: false

  /**
   * Controls how errors are thrown when a command fails.
   * - "simple" → Throws a short, human-readable error message
   * - "raw" → Throws the full ExecaError object with complete details
   */
  throwMode?: 'simple' | 'raw'; // default: 'simple'

  /**
   * Optional custom logger for command output and diagnostics.
   * Provides two logging methods:
   * - debug(message, context) - Called for verbose command logging
   * - warn(message, context) - Called for warnings
   *
   * The context parameter includes the command and final execa options.
   */
  logger?: ShellLogger;

  /**
   * Default execa options applied to all command executions.
   * When command-level execaOptions are provided, they are deep merged
   * with shell-level options. Command-level options override shell-level.
   */
  execaOptions?: ExecaOptions;
}

interface ShellLogger {
  /** Called for verbose command logging. Defaults to console.debug */
  debug?(message: string, context: ShellLogContext): void;

  /** Called for warnings. Defaults to console.warn */
  warn?(message: string, context: ShellLogContext): void;
}

interface ShellLogContext {
  /** The command being executed */
  command: string | string[];

  /** Execa options used for the command execution */
  execaOptions: ExecaOptions;
}
```

### `shell.run(command, options?)`

Executes a shell command that **throws on error**. Recommended for most use cases where you want to fail fast.

#### Parameters

- `command: string | string[]` - The command to execute. Can be a string (with automatic parsing) or an array of arguments.
- `options?: RunOptions` - Optional execution options.

#### Returns

```typescript
interface StrictResult {
  /** Captured stdout output, or null if not captured */
  stdout: string | null;

  /** Captured stderr output, or null if not captured */
  stderr: string | null;
}
```

**Throws**: Error when command exits with non-zero code (format depends on `throwMode`).

### `shell.safeRun(command, options?)`

Executes a shell command that **never throws**. Returns error result instead.

Use this when you want to handle errors programmatically without try/catch.

#### Parameters

- `command: string | string[]` - The command to execute.
- `options?: RunOptions` - Optional execution options.

#### Returns

```typescript
interface SafeResult {
  /** Captured stdout output, or null if not captured */
  stdout: string | null;

  /** Captured stderr output, or null if not captured */
  stderr: string | null;

  /** Exit code returned by the executed process */
  exitCode: number | undefined;

  /** True if command exited with code 0 */
  success: boolean;
}
```

### `shell.execute(command, options?)`

Low-level method with explicit `throwOnError` control.

#### Parameters

- `command: string | string[]` - The command to execute.
- `options?: RunOptions & { throwOnError?: boolean }` - Optional execution options including throwOnError flag.

#### RunOptions

```typescript
interface RunOptions extends ExecaOptions {
  /** Override the output behavior for this specific command */
  outputMode?: OutputMode; // 'capture' | 'live' | 'all'

  /** Override verbose logging for this specific command */
  verbose?: boolean;

  /** Override dry-run mode for this specific command */
  dryRun?: boolean;
}
```

Inherits all options from [execa's Options](https://github.com/sindresorhus/execa#options).

**Deep Merge Behavior:** When both shell-level `execaOptions` and command-level options are provided, they are deep merged using the `deepmerge` library. Command-level options take precedence over shell-level options. For objects like `env`, the properties are merged. For primitives like `timeout`, the command-level value overrides the shell-level value.

### `shell.runParse(command, schema, options?)`

Execute a command, parse its stdout as JSON, and validate it against a [Standard Schema](https://github.com/standard-schema/standard-schema).

**Throws on error** - Command failure or validation failure will throw an exception.

#### Parameters

- `command: string | string[]` - The command to execute.
- `schema: StandardSchemaV1` - A Standard Schema to validate the JSON output.
- `options?: RunOptions` - Optional execution options.

#### Returns

- Type-safe parsed and validated output based on the schema.

#### Throws

- Error when command fails
- Error when output is not valid JSON
- Error when output doesn't match the schema

**Example with Zod:**

```typescript
import { createShell } from '@thaitype/shell';
import { z } from 'zod';

const shell = createShell();

const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

// Execute command and validate JSON output
const pkg = await shell.runParse(
  'cat package.json',
  packageSchema
);

console.log(pkg.name, pkg.version); // Type-safe!
```

### `shell.safeRunParse(command, schema, options?)`

Execute a command, parse its stdout as JSON, and validate it against a Standard Schema.

**Never throws** - Returns a result object with success/error information.

#### Parameters

- `command: string | string[]` - The command to execute.
- `schema: StandardSchemaV1` - A Standard Schema to validate the JSON output.
- `options?: RunOptions` - Optional execution options.

#### Returns

```typescript
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: Array<{ message: string }> };
```

**Example with Zod:**

```typescript
import { createShell } from '@thaitype/shell';
import { z } from 'zod';

const shell = createShell();

const userSchema = z.object({
  username: z.string(),
  id: z.number(),
});

const result = await shell.safeRunParse(
  'curl -s https://api.example.com/user',
  userSchema
);

if (result.success) {
  console.log('User:', result.data.username);
} else {
  console.error('Validation failed:', result.error);
}
```

### Output Modes

- **`capture`** (default): Captures stdout/stderr for programmatic access. Output is not printed to console.
- **`live`**: Streams stdout/stderr directly to console in real-time. Output is not captured.
- **`all`**: Both captures AND streams output simultaneously.

## Advanced Examples

### Using run() vs safeRun()

```typescript
import { createShell } from '@thaitype/shell';

const shell = createShell();

// run() - Throws on error (fail fast)
try {
  const result = await shell.run('npm test');
  console.log('Tests passed!', result.stdout);
} catch (error) {
  console.error('Tests failed:', error.message);
}

// safeRun() - Never throws, check success flag
const result = await shell.safeRun('npm test');
if (result.success) {
  console.log('Tests passed!', result.stdout);
} else {
  console.error('Tests failed with exit code:', result.exitCode);
}
```

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

await shell.run('npm install');
// Commands are logged using Winston with contextual information
```

### Combining with Execa Options

```typescript
import { createShell } from '@thaitype/shell';

// Shell-level default options
const shell = createShell({
  execaOptions: {
    env: { API_KEY: 'default-key', NODE_ENV: 'development' },
    timeout: 5000,
    cwd: '/default/directory'
  }
});

// Command-level options are deep merged with shell-level
const result = await shell.run('node script.js', {
  env: { NODE_ENV: 'production', EXTRA: 'value' },  // Deep merged
  timeout: 30000,  // Overrides shell-level timeout
  outputMode: 'capture'
});

// Resulting options:
// {
//   env: { API_KEY: 'default-key', NODE_ENV: 'production', EXTRA: 'value' },
//   timeout: 30000,
//   cwd: '/default/directory'
// }
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
