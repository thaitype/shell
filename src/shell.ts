/**
 * A utility class for running shell commands with flexible output modes and configuration options.
 * Supports dry-run, verbose logging, output streaming, and error handling control.
 *
 * @example
 * const shell = new Shell({ verbose: true });
 * const result = await shell.run("bash delay.sh");
 * if (result.isSuccess) console.log(result.stdout);
 */
import { execa, type Options as ExecaOptions, ExecaError } from 'execa';
import parseArgsStringToArgv from 'string-argv';

/** Output mode behavior for handling stdout/stderr */
export type OutputMode = 'capture' | 'live' | 'all';

type CaptureForMode<M extends OutputMode> =
  M extends 'live' ? false : true;

/** Configuration options for Shell instance */
export interface ShellOptions<ThrowOnError extends boolean = true, Mode extends OutputMode = 'capture'> {
  /** Default output mode applied to all runs unless overridden */
  defaultOutputMode?: Mode;
  /** If true, print commands but skip actual execution */
  dryRun?: boolean;
  /** If true, log every executed command */
  verbose?: boolean;
  /** If true, throw an error when a command exits with non-zero code, @default true */
  throwOnError?: ThrowOnError;
  /**
   * Controls how errors are thrown when a command fails.
   * - `"simple"` → Throws a short, human-readable error message.
   * - `"raw"` → Throws the full ExecaError object with complete details.
   *
   * @default "simple"
   */
  throwMode?: 'simple' | 'raw';
  /** Optional custom logger function for command output */
  logger?: (message: string) => void;
}

/** Options for an individual command execution */
export interface RunOptions<ThrowOnError extends boolean = true, Mode extends OutputMode = OutputMode> extends ExecaOptions {
  /** Override the output behavior for this specific command */
  outputMode?: Mode;
  /** Whether to throw error on non-zero exit */
  throwOnError?: ThrowOnError;
}

/** The structured result returned by Shell.run() */
export interface StrictResult<Capture extends boolean> {
  /** Captured stdout output, or null if not captured */
  stdout: Capture extends true ? string : null;
  /** Captured stderr output, or null if not captured */
  stderr: Capture extends true ? string : null;
}

export interface SafeResult<Capture extends boolean> extends StrictResult<Capture> {
  /** Exit code returned by the executed process */
  exitCode: number | undefined;
  /** Indicates whether the command exited with an error */
  isError: boolean;
  /** Indicates whether the command executed successfully */
  isSuccess: boolean;
}

export type RunResult<Throw extends boolean, Mode extends OutputMode> =
  Throw extends true
  ? StrictResult<CaptureForMode<Mode>>
  : SafeResult<CaptureForMode<Mode>>;

/**
 * Factory function to create a new Shell instance for type safety and convenience.
 */
export function createShell<
  DefaultThrow extends boolean = true,
  DefaultMode extends OutputMode = OutputMode
>(options: ShellOptions<DefaultThrow, DefaultMode> = {}) {
  return new Shell<DefaultThrow, DefaultMode>(options);
}

export class Shell<DefaultThrow extends boolean = true, DefaultMode extends OutputMode = 'capture'> {
  private defaultOutputMode: OutputMode;
  private dryRun: boolean;
  private verbose: boolean;
  private throwOnError: boolean;
  private throwMode: 'simple' | 'raw';
  private logger?: (message: string) => void;

  public static create = createShell;

  /**
   * Create a new Shell instance.
   * @param options - Configuration options for default behavior.
   */
  constructor(options: ShellOptions<DefaultThrow, DefaultMode> = {}) {
    this.defaultOutputMode = options.defaultOutputMode ?? 'capture';
    this.dryRun = options.dryRun ?? false;
    this.verbose = options.verbose ?? false;
    this.throwOnError = options.throwOnError ?? true; // default true
    this.throwMode = options.throwMode ?? 'simple'; // default "simple"
    this.logger = options.logger ?? console.log;
  }

  /**
   * Run a command using shell arguments or a string command line.
   * Supports quoting and escaping via `string-argv`.
   *
   * @param cmd - Command to execute, as string or array of arguments.
   * @param options - Optional overrides for this execution.
   * @returns A structured {@link RunResult} containing outputs and exit info.
   */
  async run<
    Throw extends boolean = DefaultThrow,
    Mode extends OutputMode = DefaultMode
  >(cmd: string | string[], options?: RunOptions<Throw, Mode>): Promise<RunResult<Throw, Mode>> {
    const args = Array.isArray(cmd) ? cmd : parseArgsStringToArgv(cmd);

    const [program, ...cmdArgs] = args;
    if (!program) {
      throw new Error('No command provided.');
    }

    const outputMode = options?.outputMode ?? this.defaultOutputMode;

    const stdioMap: Record<OutputMode, { stdout: string | string[]; stderr: string | string[] }> = {
      capture: { stdout: 'pipe', stderr: 'pipe' },
      live: { stdout: 'inherit', stderr: 'inherit' },
      all: { stdout: ['pipe', 'inherit'], stderr: ['pipe', 'inherit'] },
    };

    if (this.verbose || this.dryRun) {
      this.logger?.(`$ ${args.join(' ')}`);
    }

    if (this.dryRun) {
      return { stdout: '', stderr: '', exitCode: 0, isError: false, isSuccess: true } as RunResult<Throw, Mode>;
    }

    try {
      const result = await execa(program, cmdArgs, {
        ...stdioMap[outputMode],
        reject: options?.throwOnError ?? this.throwOnError,
        ...options,
      });

      return {
        stdout: result.stdout ? String(result.stdout) : null,
        stderr: result.stderr ? String(result.stderr) : null,
        exitCode: result.exitCode,
        isError: result.exitCode !== 0,
        isSuccess: result.exitCode === 0,
      } as RunResult<Throw, Mode>;
    } catch (error: unknown) {
      if (error instanceof ExecaError) {
        if (this.throwOnError || options?.throwOnError) {
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
        isError: true,
        isSuccess: false,
      } as RunResult<Throw, Mode>;
    }
  }
}
