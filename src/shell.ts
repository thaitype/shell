import type { StandardSchemaV1 } from '@standard-schema/spec';
import { execa, type Options as ExecaOptions, ExecaError } from 'execa';
import parseArgsStringToArgv from 'string-argv';
import deepmerge from 'deepmerge';
import { standardSafeValidate, standardValidate, type ValidationResult } from './standard-schema.js';

/**
 * Output mode behavior for handling stdout/stderr.
 *
 * - `'capture'` - Captures output for programmatic access (default)
 * - `'live'` - Streams output to console in real-time
 * - `'all'` - Both captures AND streams output simultaneously
 */
export type OutputMode = 'capture' | 'live' | 'all';

/**
 * Type utility to determine if an output mode captures output.
 * Returns false for 'live' mode, true for 'capture' and 'all'.
 */
type CaptureForMode<M extends OutputMode> = M extends 'live' ? false : true;

/**
 * Default options that can be overridden per command execution.
 *
 * These options can be set at the Shell instance level and overridden per command.
 * When both shell-level and command-level options are provided, they are deep merged,
 * with command-level options taking precedence.
 */
export interface OverridableCommandOptions<Mode extends OutputMode> {
  /**
   * Default execa options applied to all command executions.
   *
   * When command-level execaOptions are provided, they are deep merged with
   * shell-level options using the `deepmerge` library. Command-level options
   * override shell-level options.
   *
   * @example
   * ```typescript
   * // Shell-level defaults
   * const shell = createShell({
   *   execaOptions: {
   *     env: { API_KEY: 'default' },
   *     timeout: 5000
   *   }
   * });
   *
   * // Command-level override (deep merged)
   * await shell.run('command', {
   *   env: { EXTRA: 'value' },  // Both API_KEY and EXTRA available
   *   timeout: 10000             // Overrides shell-level timeout
   * });
   * ```
   */
  execaOptions?: ShellExecaOptions;
  /**
   * Default output mode applied to all runs unless overridden.
   *
   * @default 'capture'
   */
  outputMode?: Mode;
  /**
   * If true, print commands but skip actual execution.
   * Useful for testing scripts without making real changes.
   *
   * @default false
   */
  dryRun?: boolean;
  /**
   * If true, log every executed command to the logger.
   * Helpful for debugging and CI/CD pipelines.
   *
   * @default false
   */
  verbose?: boolean;
}

export interface ShellLogger {
  /**
   * Called when Shell wants to emit a debug-level log.
   * Defaults to console.debug.
   */
  debug?(message: string, context: ShellLogContext): void;

  /**
   * Called when Shell wants to emit a warning or non-fatal issue.
   * Defaults to console.warn.
   */
  warn?(message: string, context: ShellLogContext): void;
}

/** Provides contextual info about where the log originated. */
export interface ShellLogContext {
  /**
   * The command that was being executed when the log was generated.
   */
  command: string | string[];
  /**
   * Execa options used for the command execution.
   */
  execaOptions: ExecaOptions;
}

/**
 * Configuration options for Shell instance.
 *
 * @template Mode - The default output mode type (defaults to 'capture')
 */
export interface ShellOptions<Mode extends OutputMode = 'capture'> extends OverridableCommandOptions<Mode> {
  /**
   * Controls how errors are thrown when a command fails.
   * - `"simple"` → Throws a short, human-readable error message with command, exit code, and stderr.
   * - `"raw"` → Throws the full ExecaError object with complete details.
   *
   * Only applies when using `run()` or `execute()` with `throwOnError: true`.
   *
   * @default "simple"
   */
  throwMode?: 'simple' | 'raw';

  /**
   * Optional custom logger for command output and diagnostics.
   *
   * Provides two logging methods:
   * - `debug(message, context)` - Called for verbose command logging (defaults to console.debug)
   * - `warn(message, context)` - Called for warnings (defaults to console.warn)
   *
   * The context parameter includes the command and final execa options.
   *
   * @example
   * ```typescript
   * const shell = createShell({
   *   verbose: true,
   *   logger: {
   *     debug: (message, context) => {
   *       console.log(`[DEBUG] ${message}`);
   *       console.log('Command:', context.command);
   *     },
   *     warn: (message, context) => {
   *       console.warn(`[WARN] ${message}`, context);
   *     }
   *   }
   * });
   * ```
   *
   * @default { debug: console.debug, warn: console.warn }
   */
  logger?: ShellLogger;
}

/**
 * Execa options that can be passed to Shell methods.
 * We handle some properties internally, so we omit them to avoid conflicts:
 * - `reject` - handled by throwOnError
 * - `verbose` - we use our own boolean verbose flag
 * - `stdout`/`stderr` - handled by outputMode
 *
 * All other execa options (like `cwd`, `env`, `timeout`) can be passed through.
 */
export type ShellExecaOptions = Omit<ExecaOptions, 'reject' | 'verbose' | 'stdout' | 'stderr'>;

/**
 * Options for an individual command execution.
 *
 * Extends overridable command options (outputMode, verbose, dryRun) and execa options.
 * All execa options provided here will be deep merged with shell-level execaOptions,
 * with command-level options taking precedence.
 *
 * @template Mode - The output mode type for this specific command
 *
 * @example
 * ```typescript
 * const shell = createShell({
 *   execaOptions: { env: { API_KEY: 'default' } }
 * });
 *
 * // Command-level options are deep merged with shell-level
 * await shell.run('command', {
 *   outputMode: 'live',      // Override output mode
 *   verbose: true,           // Override verbose
 *   env: { EXTRA: 'value' }, // Merged with shell-level env
 *   timeout: 5000            // Added to shell-level options
 * });
 * ```
 */
export interface RunOptions<Mode extends OutputMode = OutputMode>
  extends Omit<OverridableCommandOptions<Mode>, 'execaOptions'>,
    ShellExecaOptions {}

/**
 * Strict result returned by `run()` method (throws on error).
 * Only includes stdout/stderr, as the command either succeeds or throws.
 *
 * @template Capture - Whether output is captured (false for 'live' mode)
 */
export interface StrictResult<Capture extends boolean> {
  /** Captured stdout output (string if captured, null if live mode) */
  stdout: Capture extends true ? string : null;
  /** Captured stderr output (string if captured, null if live mode) */
  stderr: Capture extends true ? string : null;
}

/**
 * Safe result returned by `safeRun()` method (never throws).
 * Includes all execution details including exit code and error flags.
 *
 * @template Capture - Whether output is captured (false for 'live' mode)
 */
export interface SafeResult<Capture extends boolean> extends StrictResult<Capture> {
  /** Exit code returned by the executed process (undefined if command failed to start) */
  exitCode: number | undefined;
  /** True if the command exited with code 0 */
  success: boolean;
}

/**
 * Result type that varies based on whether the command throws on error.
 *
 * @template Throw - Whether the method throws on error (true for run(), false for safeRun())
 * @template Mode - The output mode used for the command
 */
export type ExecutionResult<Throw extends boolean, Mode extends OutputMode> = Throw extends true
  ? StrictResult<CaptureForMode<Mode>>
  : SafeResult<CaptureForMode<Mode>>;

/**
 * A handle for a command execution that can be awaited directly or have helper methods called on it.
 *
 * This type implements the PromiseLike interface, allowing it to be awaited directly to get stdout,
 * while also providing helper methods for common transformations.
 *
 * @example Direct await
 * ```typescript
 * const result = await $('echo hello'); // Returns 'hello'
 * ```
 *
 * @example Using toLines()
 * ```typescript
 * const lines = await $('ls -la').toLines(); // Returns array of lines
 * ```
 *
 * @example Using parse()
 * ```typescript
 * const data = await $('echo \'{"key":"value"}\'').parse(schema);
 * ```
 */
export type CommandHandle = PromiseLike<string> & {
  /**
   * Split stdout by newlines and return as array of strings.
   * Handles both Unix (\n) and Windows (\r\n) line endings.
   *
   * @returns Promise resolving to array of lines from stdout
   */
  toLines(): Promise<string[]>;

  /**
   * Parse stdout as JSON and validate with the provided Standard Schema V1.
   * The schema must implement the Standard Schema V1 interface (e.g., Zod schemas).
   *
   * @template T - A Standard Schema V1 schema type
   * @param schema - A Standard Schema V1 compatible schema
   * @returns Promise resolving to the parsed and validated data
   *
   * @see https://github.com/standard-schema/standard-schema
   */
  parse<T extends StandardSchemaV1>(schema: T): Promise<StandardSchemaV1.InferOutput<T>>;
};

/**
 * A function that creates CommandHandle instances for fluent command execution.
 *
 * @param command - Command to execute, as string or array of arguments
 * @returns A CommandHandle that can be awaited or have helper methods called
 */
export type FluentShellFn = (command: string | string[]) => CommandHandle;


/**
 * Command handle with lazy execution and memoization.
 * Extends CommandHandle with `.result()` method for non-throwable execution.
 *
 * Key features:
 * - **Lazy execution**: Command doesn't run until first consumption (await, .result(), .toLines(), .parse())
 * - **Memoization**: Multiple consumptions share the same execution
 * - **Throwable path**: `await handle` throws on non-zero exit code
 * - **Non-throwable path**: `await handle.result()` returns result with success flag
 *
 * @example Throwable execution
 * ```typescript
 * const $ = createShell().asFluent();
 * try {
 *   const output = await $`exit 1`; // Throws error
 * } catch (error) {
 *   console.error(error);
 * }
 * ```
 *
 * @example Non-throwable execution
 * ```typescript
 * const $ = createShell().asFluent();
 * const r = await $`exit 1`.result(); // Doesn't throw
 * if (!r.success) {
 *   console.error(r.exitCode, r.stderr);
 * }
 * ```
 *
 * @example Memoization
 * ```typescript
 * const $ = createShell().asFluent();
 * const handle = $`echo test`;
 * const a = await handle;           // Executes once
 * const b = await handle;           // Reuses same execution
 * const c = await handle.result();  // Still same execution
 * ```
 */
export type LazyCommandHandle = PromiseLike<string> & {
  /**
   * Non-throwable execution - returns result object with success flag.
   * This method never throws, even if the command fails.
   *
   * @returns Promise resolving to ExecutionResult with success, stdout, stderr, and exitCode
   */
  result(): Promise<ExecutionResult<false, 'capture'>>;

  /**
   * Split stdout by newlines and return as array of strings.
   * Handles both Unix (\n) and Windows (\r\n) line endings.
   * Throws if command fails.
   *
   * @returns Promise resolving to array of lines from stdout
   */
  toLines(): Promise<string[]>;

  /**
   * Parse stdout as JSON and validate with the provided schema.
   * The schema must have a `parse(data: any): T` method (compatible with Zod and other validators).
   * Throws if command fails or if JSON parsing/validation fails.
   *
   * @template T - The inferred output type from the schema
   * @param schema - A schema object with a parse method (e.g., Zod schema)
   * @returns Promise resolving to the parsed and validated data
   */
  parse<T extends StandardSchemaV1>(schema: T): Promise<StandardSchemaV1.InferOutput<T>>;

  /**
   * Parse stdout as JSON and validate with schema (non-throwable).
   * Returns ValidationResult instead of throwing on failure.
   *
   * This method never throws, even if:
   * - The command fails
   * - There's no stdout
   * - JSON parsing fails
   * - Schema validation fails
   *
   * @template T - A Standard Schema V1 schema type
   * @param schema - A Standard Schema V1 compatible schema
   * @returns Promise resolving to ValidationResult with either data or error
   *
   * @example
   * ```typescript
   * const $ = createShell().asFluent();
   * const result = await $`cat config.json`.safeParse(ConfigSchema);
   * if (result.success) {
   *   console.log('Config:', result.data);
   * } else {
   *   console.error('Validation failed:', result.error);
   * }
   * ```
   */
  safeParse<T extends StandardSchemaV1>(schema: T): Promise<ValidationResult<StandardSchemaV1.InferOutput<T>>>;
};

/**
 * Function that supports both tagged templates and function calls for command execution.
 * Returned by `shell.asFluent()`.
 *
 * Supports three call signatures:
 * 1. Tagged template: `` $`echo hello` ``
 * 2. String command: `$('echo hello')`
 * 3. Argv array: `$(['echo', 'hello'])`
 *
 * @example Tagged template with interpolation
 * ```typescript
 * const $ = createShell().asFluent();
 * const name = 'world';
 * const result = await $`echo hello ${name}`;
 * ```
 *
 * @example Function call with string
 * ```typescript
 * const $ = createShell().asFluent();
 * const result = await $('echo hello');
 * ```
 *
 * @example Function call with array
 * ```typescript
 * const $ = createShell().asFluent();
 * const result = await $(['echo', 'hello']);
 * ```
 */
export interface DollarFunction {
  /**
   * Tagged template call - interpolates values into command string
   */
  (parts: TemplateStringsArray, ...values: any[]): LazyCommandHandle;

  /**
   * String command call
   */
  (command: string): LazyCommandHandle;

  /**
   * Argv array call
   */
  (command: string[]): LazyCommandHandle;
}

/**
 * Factory function to create a new Shell instance with type inference.
 * Provides better type safety and convenience compared to using `new Shell()`.
 *
 * @template DefaultMode - The default output mode type (inferred from options)
 * @param options - Configuration options for the Shell instance
 * @returns A new Shell instance with the specified configuration
 *
 * @example Basic usage
 * ```typescript
 * const shell = createShell({
 *   outputMode: 'live',
 *   verbose: true
 * });
 * await shell.run('npm install'); // Output streams to console
 * ```
 *
 * @example With default execaOptions and custom logger
 * ```typescript
 * const shell = createShell({
 *   execaOptions: {
 *     env: { NODE_ENV: 'production', API_URL: 'https://api.example.com' },
 *     timeout: 30000
 *   },
 *   verbose: true,
 *   logger: {
 *     debug: (message, context) => {
 *       console.log(`[${new Date().toISOString()}] ${message}`);
 *       console.log('Execa options:', context.execaOptions);
 *     }
 *   }
 * });
 *
 * // All commands inherit shell-level execaOptions
 * await shell.run('npm install');
 *
 * // Command-level options are deep merged with shell-level
 * await shell.run('npm test', {
 *   env: { TEST_ENV: 'true' }, // Merged with shell-level env
 *   timeout: 120000             // Overrides shell-level timeout
 * });
 * ```
 */
export function createShell<DefaultMode extends OutputMode = OutputMode>(options: ShellOptions<DefaultMode> = {}) {
  return new Shell<DefaultMode>(options);
}

/**
 * Type-safe Shell class for executing commands with configurable behavior.
 * Use `createShell()` factory function for better type inference.
 *
 * @template DefaultMode - The default output mode for this instance (defaults to 'capture')
 *
 * @example Creating a shell instance
 * ```typescript
 * const shell = new Shell({
 *   outputMode: 'capture',
 *   verbose: true
 * });
 * ```
 *
 * @example Using the static factory
 * ```typescript
 * const shell = Shell.create({
 *   dryRun: true
 * });
 * ```
 */
export class Shell<DefaultMode extends OutputMode = 'capture'> {
  private outputMode: OutputMode;
  private dryRun: boolean;
  private verbose: boolean;
  private throwMode: 'simple' | 'raw';
  private logger: ShellLogger;
  private execaOptions: ShellExecaOptions;

  /**
   * Static factory method (alias for createShell).
   *
   * Factory function to create a new Shell instance with type inference.
   * Provides better type safety and convenience compared to using `new Shell()`.
   *
   * @template DefaultMode - The default output mode type (inferred from options)
   * @param options - Configuration options for the Shell instance
   * @returns A new Shell instance with the specified configuration
   *
   * @example
   * ```typescript
   * const shell = Shell.create({
   *   outputMode: 'live',
   *   verbose: true
   * });
   * await shell.run('npm install'); // Output streams to console
   * ```
   */
  public static create = createShell;

  /**
   * Create a new Shell instance.
   *
   * @param options - Configuration options for default behavior
   *
   * @example Basic usage
   * ```typescript
   * const shell = new Shell({
   *   outputMode: 'capture',
   *   verbose: true,
   *   throwMode: 'simple'
   * });
   * ```
   *
   * @example With default execaOptions
   * ```typescript
   * const shell = new Shell({
   *   execaOptions: {
   *     env: { NODE_ENV: 'production' },
   *     timeout: 30000,
   *     cwd: '/app'
   *   },
   *   logger: {
   *     debug: (msg, ctx) => console.log(`[DEBUG] ${msg}`, ctx),
   *     warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx)
   *   }
   * });
   * ```
   */
  constructor(options: ShellOptions<DefaultMode> = {}) {
    this.outputMode = options.outputMode ?? 'capture';
    this.dryRun = options.dryRun ?? false;
    this.verbose = options.verbose ?? false;
    this.throwMode = options.throwMode ?? 'simple';
    this.execaOptions = options.execaOptions ?? {};
    this.logger = {
      debug: options.logger?.debug ?? ((message: string, context: ShellLogContext) => console.debug(message, context)),
      warn: options.logger?.warn ?? ((message: string, context: ShellLogContext) => console.warn(message, context)),
    };
  }

  /**
   * Low-level method to execute a command with full control over error handling.
   *
   * Use `run()` for commands that should throw on error, or `safeRun()` for commands
   * that should return an error result instead.
   *
   * This method deep merges command-level options with shell-level `execaOptions`,
   * allowing fine-grained control over command execution while maintaining defaults.
   *
   * @template Throw - Whether to throw on error (true) or return error result (false)
   * @template Mode - The output mode for this command
   *
   * @param cmd - Command to execute, as string or array of arguments
   * @param options - Optional overrides including throwOnError flag and any execa options.
   *                  Execa options are deep merged with shell-level execaOptions.
   *
   * @returns A result object with type-safe stdout/stderr based on output mode and throw mode
   *
   * @example Throws on error
   * ```typescript
   * const result = await shell.execute('echo test', { throwOnError: true });
   * console.log(result.stdout); // No need to check success
   * ```
   *
   * @example Returns error result
   * ```typescript
   * const result = await shell.execute('might-fail', { throwOnError: false });
   * if (result.success) {
   *   console.log(result.stdout);
   * }
   * ```
   *
   * @example With deep merged options
   * ```typescript
   * const shell = createShell({
   *   execaOptions: { env: { API_KEY: 'default' }, timeout: 5000 }
   * });
   *
   * // Command-level env is merged, timeout is overridden
   * await shell.execute('command', {
   *   throwOnError: true,
   *   env: { EXTRA: 'value' }, // Merged: both API_KEY and EXTRA available
   *   timeout: 10000            // Overrides: 10000 instead of 5000
   * });
   * ```
   */
  public async execute<Throw extends boolean = true, Mode extends OutputMode = DefaultMode>(
    cmd: string | string[],
    options?: RunOptions<Mode> & { throwOnError?: Throw }
  ): Promise<ExecutionResult<Throw, Mode>> {
    const args = Array.isArray(cmd) ? cmd : parseArgsStringToArgv(cmd);

    const [program, ...cmdArgs] = args;
    if (!program) {
      throw new Error('No command provided.');
    }

    // Merge command-level overrides with instance defaults
    const outputMode = options?.outputMode ?? this.outputMode;
    const verbose = options?.verbose ?? this.verbose;
    const dryRun = options?.dryRun ?? this.dryRun;

    const stdioMap: Record<OutputMode, { stdout: string | string[]; stderr: string | string[] }> = {
      capture: { stdout: 'pipe', stderr: 'pipe' },
      live: { stdout: 'inherit', stderr: 'inherit' },
      all: { stdout: ['pipe', 'inherit'], stderr: ['pipe', 'inherit'] },
    };

    // Extract our custom properties to avoid passing them to execa
    const { outputMode: _, verbose: __, dryRun: ___, ...commandExecaOptions } = options ?? {};

    // Deep merge shell-level and command-level execa options
    // Command-level options override shell-level options
    const mergedExecaOptions = deepmerge(this.execaOptions, commandExecaOptions);

    const finalExecaOptions: ExecaOptions = {
      ...stdioMap[outputMode],
      reject: options?.throwOnError ?? true,
      ...mergedExecaOptions,
    };

    const logContext: ShellLogContext = {
      command: cmd,
      execaOptions: finalExecaOptions,
    };

    if (verbose || dryRun) {
      this.logger.debug?.(`$ ${args.join(' ')}`, logContext);
    }

    if (dryRun) {
      return { stdout: '', stderr: '', exitCode: 0, success: true } as ExecutionResult<Throw, Mode>;
    }

    try {
      const result = await execa(program, cmdArgs, finalExecaOptions);

      return {
        stdout: result.stdout ? String(result.stdout) : null,
        stderr: result.stderr ? String(result.stderr) : null,
        exitCode: result.exitCode,
        success: result.exitCode === 0,
      } as ExecutionResult<Throw, Mode>;
    } catch (error: unknown) {
      if (error instanceof ExecaError) {
        if (options?.throwOnError) {
          if (this.throwMode === 'raw') {
            throw error;
          } else {
            throw new Error(`Command failed: ${args.join(' ')}\nExit code: ${error.exitCode}\n${error.stderr || ''}`);
          }
        }
      } else {
        throw error;
      }
      return {
        stdout: null,
        stderr: null,
        exitCode: undefined,
        success: false,
      } as ExecutionResult<Throw, Mode>;
    }
  }

  /**
   * Execute a command that throws an error on failure.
   *
   * This is the recommended method for most use cases where you want to fail fast.
   * Returns only stdout/stderr since the command either succeeds or throws.
   *
   * @template Mode - The output mode for this command (defaults to instance default)
   *
   * @param cmd - Command to execute, as string or array of arguments
   * @param options - Optional overrides for this execution
   *
   * @returns Result with stdout and stderr (type-safe based on output mode)
   *
   * @throws {Error} When command exits with non-zero code (format depends on throwMode)
   *
   * @example
   * ```typescript
   * const shell = new Shell({ throwMode: 'simple' });
   * try {
   *   const result = await shell.run('npm test');
   *   console.log('Tests passed:', result.stdout);
   * } catch (error) {
   *   console.error('Tests failed:', error.message);
   * }
   * ```
   */
  public async run<Mode extends OutputMode = DefaultMode>(
    cmd: string | string[],
    options?: RunOptions<Mode>
  ): Promise<ExecutionResult<true, Mode>> {
    return this.execute<true, Mode>(cmd, { ...options, throwOnError: true });
  }

  /**
   * Execute a command that never throws, returning an error result instead.
   *
   * Use this when you want to handle errors programmatically without try/catch.
   * Returns a result with exitCode, and success flags.
   *
   * @template Mode - The output mode for this command (defaults to instance default)
   *
   * @param cmd - Command to execute, as string or array of arguments
   * @param options - Optional overrides for this execution
   *
   * @returns Result with stdout, stderr, exitCode, and success
   *
   * @example
   * ```typescript
   * const shell = new Shell();
   * const result = await shell.safeRun('lint-code');
   *
   * if (!result.success) {
   *   console.warn('Linting failed with exit code:', result.exitCode);
   *   console.warn('Errors:', result.stderr);
   * } else {
   *   console.log('Linting passed!');
   * }
   * ```
   */
  public async safeRun<Mode extends OutputMode = DefaultMode>(
    cmd: string | string[],
    options?: RunOptions<Mode>
  ): Promise<ExecutionResult<false, Mode>> {
    return this.execute<false, Mode>(cmd, { ...options, throwOnError: false });
  }

  public async runParse<T extends StandardSchemaV1, Mode extends OutputMode = DefaultMode>(
    cmd: string | string[],
    schema: T,
    options?: RunOptions<Mode>
  ): Promise<StandardSchemaV1.InferOutput<T>> {
    const result = await this.run<Mode>(cmd, options);
    const verbose = options?.verbose ?? this.verbose;
    const verboseOutput = verbose ? `\nStdout: ${result.stdout}\nStderr: ${result.stderr}` : '';
    if (verbose) {
      // Extract our custom properties to get clean execa options
      const { outputMode: _, verbose: __, dryRun: ___, ...execaOptions } = options ?? {};
      const logContext: ShellLogContext = {
        command: cmd,
        execaOptions: execaOptions,
      };
      this.logger.debug?.('Validation Output:' + verboseOutput, logContext);
    }
    return standardValidate(schema, JSON.parse(result.stdout ?? '{}'));
  }

  public async safeRunParse<T extends StandardSchemaV1, Mode extends OutputMode = DefaultMode>(
    cmd: string | string[],
    schema: T,
    options?: RunOptions<Mode>
  ): Promise<ValidationResult<StandardSchemaV1.InferOutput<T>>> {
    const result = await this.safeRun<Mode>(cmd, options);
    const verbose = options?.verbose ?? this.verbose;
    const fullCommand = Array.isArray(cmd) ? cmd.join(' ') : cmd;
    const verboseOutput = verbose ? `\nStdout: ${result.stdout}\nStderr: ${result.stderr}` : '';
    const verboseCommand = verbose ? `\nCommand: ${fullCommand}` : '';
    const verboseInfo = verboseCommand + verboseOutput;
    if (!result.stdout) {
      return {
        success: false,
        error: [{ message: `The command produced no output to validate. ${verboseInfo}` }],
      };
    }
    if (!result.success) {
      return {
        success: false,
        error: [{ message: `The command failed with exit code ${result.exitCode}. ${verboseInfo}` }],
      };
    }
    try {
      return standardSafeValidate(schema, JSON.parse(result.stdout));
    } catch (e: unknown) {
      return {
        success: false,
        error: [{ message: 'Unable to Parse JSON: ' + (e instanceof Error ? e.message : String(e)) + verboseInfo }],
      };
    }
  }

  /**
   * Process tagged template literal into a command string.
   * Interpolates values between template string parts.
   *
   * @param parts - Template string parts (TemplateStringsArray)
   * @param values - Interpolated values
   * @returns Concatenated command string
   *
   * @internal
   */
  private processTaggedTemplate(parts: TemplateStringsArray, values: any[]): string {
    // Interleave parts and values
    // TODO: Implement argv-safe escaping for interpolated values
    let result = parts[0];
    for (let i = 0; i < values.length; i++) {
      result += String(values[i]) + parts[i + 1];
    }
    return result;
  }

  /**
   * Create a lazy command handle with memoized execution.
   * The command doesn't execute until first consumption (await, .result(), .toLines(), .parse()).
   * Multiple consumptions share the same execution result.
   *
   * @param command - Command to execute (string or array)
   * @returns LazyCommandHandle with deferred execution
   *
   * @internal
   */
  private createLazyHandle(command: string | string[]): LazyCommandHandle {
    // Memoized execution promise - null until first consumption
    let executionPromise: Promise<ExecutionResult<false, 'capture'>> | null = null;

    // Lazy executor - runs command once and memoizes result
    const start = (): Promise<ExecutionResult<false, 'capture'>> => {
      if (executionPromise === null) {
        executionPromise = this.safeRun(command, { outputMode: 'capture' }).then(result => ({
          success: result.success,
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode,
        }));
      }
      return executionPromise;
    };

    const handle: Partial<LazyCommandHandle> = {};

    // Throwable path: await handle
    // Checks success and throws error if command failed
    handle.then = (onFulfilled, onRejected) => {
      return start()
        .then(result => {
          if (!result.success) {
            // Throw error based on throwMode setting
            if (this.throwMode === 'simple') {
              const args = Array.isArray(command) ? command : parseArgsStringToArgv(command);
              throw new Error(`Command failed: ${args.join(' ')}\nExit code: ${result.exitCode}\n${result.stderr}`);
            } else {
              // For 'raw' mode, we'd need the original ExecaError
              // Since we're using safeRun, we'll throw a simplified error
              throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
            }
          }
          return result.stdout;
        })
        .then(onFulfilled, onRejected);
    };

    // Non-throwable path: handle.result()
    // Returns CommandResult with success flag, never throws
    handle.result = () => start();

    // Helper method: split stdout into lines
    // Throws if command failed
    handle.toLines = () =>
      start().then(result => {
        if (!result.success) {
          const args = Array.isArray(command) ? command : parseArgsStringToArgv(command);
          throw new Error(`Command failed: ${args.join(' ')}\nExit code: ${result.exitCode}\n${result.stderr}`);
        }
        if (!result.stdout) return [];
        return result.stdout.split(/\r?\n/);
      });

    // Helper method: parse JSON and validate with schema
    // Throws if command failed or if JSON parsing/validation fails
    handle.parse = <T extends StandardSchemaV1>(schema: T): Promise<StandardSchemaV1.InferOutput<T>> => {
      return start().then(result => {
        if (!result.success) {
          const args = Array.isArray(command) ? command : parseArgsStringToArgv(command);
          throw new Error(`Command failed: ${args.join(' ')}\nExit code: ${result.exitCode}\n${result.stderr}`);
        }
        return standardValidate(schema, JSON.parse(result.stdout ?? '{}'));
      });
    };

    // Helper method: parse JSON and validate with schema (non-throwable)
    // Returns ValidationResult instead of throwing
    handle.safeParse = <T extends StandardSchemaV1>(
      schema: T
    ): Promise<ValidationResult<StandardSchemaV1.InferOutput<T>>> => {
      return start().then(result => {
        const args = Array.isArray(command) ? command : parseArgsStringToArgv(command);
        const commandStr = args.join(' ');

        // Check if command failed
        if (!result.success) {
          return {
            success: false,
            error: [
              {
                message: `Command failed: ${commandStr}\nExit code: ${result.exitCode}\n${result.stderr}`,
              },
            ],
          };
        }

        // Check if there's no output
        if (!result.stdout) {
          return {
            success: false,
            error: [
              {
                message: `The command produced no output to validate: ${commandStr}`,
              },
            ],
          };
        }

        // Try to parse JSON
        try {
          const parsed = JSON.parse(result.stdout);
          // Use standardSafeValidate for schema validation (non-throwing)
          return standardSafeValidate(schema, parsed);
        } catch (e: unknown) {
          return {
            success: false,
            error: [
              {
                message: `Unable to parse JSON: ${e instanceof Error ? e.message : String(e)}\nCommand: ${commandStr}`,
              },
            ],
          };
        }
      });
    };

    return handle as LazyCommandHandle;
  }

  /**
   * Create a fluent shell function with tagged template and lazy execution support.
   *
   * Returns a function that supports:
   * - Tagged templates: `` $`echo hello` ``
   * - Function calls: `$('echo hello')` or `$(['echo', 'hello'])`
   * - Lazy execution: command doesn't run until consumed
   * - Memoization: multiple consumptions share one execution
   * - Non-throwable path: `.result()` returns result with success flag
   *
   * @returns DollarFunction that supports tagged templates and function calls
   *
   * @example Tagged template
   * ```typescript
   * const $ = createShell().asFluent();
   * const name = 'world';
   * const result = await $`echo hello ${name}`; // 'hello world'
   * ```
   *
   * @example Function call
   * ```typescript
   * const $ = createShell().asFluent();
   * const result = await $('echo hello'); // 'hello'
   * ```
   *
   * @example Non-throwable execution
   * ```typescript
   * const $ = createShell().asFluent();
   * const r = await $`exit 1`.result();
   * if (!r.success) {
   *   console.error(`Failed with exit code ${r.exitCode}`);
   * }
   * ```
   *
   * @example Lazy + memoization
   * ```typescript
   * const $ = createShell().asFluent();
   * const handle = $`echo test`;
   * const a = await handle;           // Executes once
   * const b = await handle;           // Reuses execution
   * const c = await handle.result();  // Still same execution
   * ```
   *
   * @example Helper methods
   * ```typescript
   * const $ = createShell().asFluent();
   * const lines = await $`ls -la`.toLines();
   * const data = await $`cat package.json`.parse(schema);
   * ```
   */
  public asFluent(): DollarFunction {
    return ((firstArg: any, ...rest: any[]): LazyCommandHandle => {
      // Detect if it's a tagged template call
      // Tagged templates pass TemplateStringsArray as first argument
      if (Array.isArray(firstArg) && 'raw' in firstArg && Array.isArray((firstArg as any).raw)) {
        // Tagged template: process interpolation
        const command = this.processTaggedTemplate(firstArg as TemplateStringsArray, rest);
        return this.createLazyHandle(command);
      }

      // Function call: string or array
      return this.createLazyHandle(firstArg);
    }) as DollarFunction;
  }
}
