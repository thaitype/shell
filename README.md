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
- **Verbose logging**: Automatically log all executed commands
- **Flexible error handling**: Choose to throw on errors or handle them gracefully
- **Custom logger support**: Integrate with your preferred logging solution
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
import { Shell } from '@thaitype/shell';

// Create a shell instance
const shell = new Shell();

// Run a command
const result = await shell.run('echo "Hello World"');

console.log(result.stdout); // "Hello World"
```

## Example Usage

### 1. Verbose Mode for Debugging

Perfect for build scripts and CI/CD pipelines where you want to see what's being executed:

```typescript
import { Shell } from '@thaitype/shell';

const shell = new Shell({
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
import { Shell } from '@thaitype/shell';

const shell = new Shell({
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
import { Shell } from '@thaitype/shell';

const shell = new Shell();

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

Handle command failures without throwing exceptions:

```typescript
import { Shell } from '@thaitype/shell';

const shell = new Shell({
  throwOnError: false  // Don't throw on non-zero exit codes
});

const result = await shell.run('some-command-that-might-fail');

if (result.isError) {
  console.error('Command failed with exit code:', result.exitCode);
  console.error('Error output:', result.stderr);
  // Handle the error gracefully
} else {
  console.log('Success:', result.stdout);
}
```

## API

### `new Shell(options?)`

Creates a new Shell instance with the specified configuration.

#### Options

```typescript
interface ShellOptions {
  /** Default output mode applied to all runs unless overridden */
  defaultOutputMode?: OutputMode; // 'capture' | 'live' | 'all'

  /** If true, print commands but skip actual execution */
  dryRun?: boolean;

  /** If true, log every executed command */
  verbose?: boolean;

  /** If true, throw an error when a command exits with non-zero code */
  throwOnError?: boolean; // default: true

  /**
   * Controls how errors are thrown when a command fails.
   * - "simple" → Throws a short, human-readable error message
   * - "raw" → Throws the full ExecaError object with complete details
   */
  throwMode?: 'simple' | 'raw'; // default: 'simple'

  /** Optional custom logger function for command output */
  logger?: (message: string) => void;
}
```

### `shell.run(command, options?)`

Executes a shell command and returns a structured result.

#### Parameters

- `command: string | string[]` - The command to execute. Can be a string (with automatic parsing) or an array of arguments.
- `options?: RunOptions` - Optional execution options.

#### RunOptions

```typescript
interface RunOptions extends ExecaOptions {
  /** Override the output behavior for this specific command */
  outputMode?: OutputMode; // 'capture' | 'live' | 'all'

  /** Whether to throw error on non-zero exit */
  throwOnError?: boolean;
}
```

Inherits all options from [execa's Options](https://github.com/sindresorhus/execa#options).

#### Returns

```typescript
interface RunResult {
  /** Captured stdout output, or null if not captured */
  stdout: string | null;

  /** Captured stderr output, or null if not captured */
  stderr: string | null;

  /** Exit code returned by the executed process */
  exitCode: number | undefined;

  /** Indicates whether the command exited with an error */
  isError: boolean;

  /** Indicates whether the command executed successfully */
  isSuccess: boolean;
}
```

### Output Modes

- **`capture`** (default): Captures stdout/stderr for programmatic access. Output is not printed to console.
- **`live`**: Streams stdout/stderr directly to console in real-time. Output is not captured.
- **`all`**: Both captures AND streams output simultaneously.

## Advanced Examples

### Custom Logger Integration

```typescript
import { Shell } from '@thaitype/shell';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const shell = new Shell({
  verbose: true,
  logger: (message) => logger.info(message)
});

await shell.run('npm install');
// Commands are logged using Winston
```

### Combining with Execa Options

```typescript
import { Shell } from '@thaitype/shell';

const shell = new Shell();

// Pass any execa options
const result = await shell.run('node script.js', {
  cwd: '/custom/directory',
  env: { NODE_ENV: 'production' },
  timeout: 30000,
  outputMode: 'capture'
});
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
