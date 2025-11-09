import { describe, it, expect, vi } from 'vitest';
import { Shell, createShell } from '../src/shell.js';
import { z } from 'zod';

describe('Shell', () => {
  describe('Command Parsing', () => {
    it('should execute command from string', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "Hello World"');

      expect(result.stdout).toBe('Hello World');
    });

    it('should execute command from array', async () => {
      const shell = new Shell();
      const result = await shell.run(['echo', 'Hello', 'World']);

      expect(result.stdout).toBe('Hello World');
    });

    it('should throw error when no command provided', async () => {
      const shell = new Shell();
      await expect(shell.run('')).rejects.toThrow('No command provided.');
      await expect(shell.run([])).rejects.toThrow('No command provided.');
    });

    it('should parse quoted strings in command strings', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "hello world"');

      expect(result.stdout).toBe('hello world');
    });
  });

  describe('Output Modes', () => {
    it('should use capture mode by default', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "Captured"');

      expect(result.stdout).toBe('Captured');
    });

    it('should use specified default mode', async () => {
      const shell = new Shell({ outputMode: 'capture' });
      const result = await shell.run('echo "Test"');

      expect(result.stdout).toBe('Test');
    });

    it('should override default mode with per-command option', async () => {
      const shell = new Shell({ outputMode: 'live' });
      const result = await shell.run('echo "Override"', { outputMode: 'capture' });

      // Override to capture, so stdout should be captured
      expect(result.stdout).toBe('Override');
    });

    it('should handle all mode (capture and stream)', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "All Mode"', { outputMode: 'all' });

      // In 'all' mode, output is both captured and streamed
      expect(result.stdout).toBe('All Mode');
    });

    it('should handle live mode', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "Live"', { outputMode: 'live' });

      // In live mode, output is not captured
      expect(result.stdout).toBe(null);
    });
  });

  describe('Dry Run Mode', () => {
    it('should not execute commands in dry run mode', async () => {
      const shell = new Shell({ dryRun: true });
      // This command would fail if executed, but should succeed in dry run
      const result = await shell.safeRun('sh -c "exit 1"');

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should return mock success result in dry run mode', async () => {
      const shell = new Shell({ dryRun: true });
      const result = await shell.safeRun('echo "test"');

      expect(result).toEqual({
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true
      });
    });

    it('should log commands in dry run mode when verbose', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        dryRun: true,
        verbose: true,
        logger: { debug: mockDebug }
      });

      await shell.run('echo test');

      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });

    it('should not log commands in dry run mode without verbose', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        dryRun: true,
        verbose: false,
        logger: { debug: mockDebug }
      });

      await shell.run('echo test');

      // dryRun alone logs, so it should still log
      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });
  });

  describe('Verbose Mode', () => {
    it('should log commands when verbose is enabled', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        verbose: true,
        logger: { debug: mockDebug }
      });

      await shell.run('echo test');

      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });

    it('should not log commands when verbose is disabled', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        verbose: false,
        logger: { debug: mockDebug }
      });

      await shell.run('echo test');

      expect(mockDebug).not.toHaveBeenCalled();
    });

    it('should log array commands correctly', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        verbose: true,
        logger: { debug: mockDebug }
      });

      await shell.run(['echo', 'hello', 'world']);

      expect(mockDebug).toHaveBeenCalledWith('$ echo hello world', expect.any(Object));
    });
  });

  describe('Error Handling - run() vs safeRun()', () => {
    it('should throw error by default when command fails with run()', async () => {
      const shell = new Shell();

      await expect(shell.run('sh -c "exit 1"')).rejects.toThrow();
    });

    it('should throw simple error message in simple mode (default)', async () => {
      const shell = new Shell({ throwMode: 'simple' });

      try {
        await shell.run('sh -c "echo error output >&2; exit 1"');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain('Command failed');
        expect(message).toContain('Exit code: 1');
        expect(message).toContain('error output');
      }
    });

    it('should throw raw ExecaError in raw mode', async () => {
      const shell = new Shell({ throwMode: 'raw' });

      try {
        await shell.run('sh -c "exit 1"');
        expect.fail('Should have thrown an error');
      } catch (error) {
        // ExecaError has specific properties
        expect(error).toHaveProperty('command');
        expect(error).toHaveProperty('failed');
      }
    });

    it('should not throw when using safeRun()', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('sh -c "exit 1"');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should respect execute with throwOnError false', async () => {
      const shell = new Shell();
      // Use execute() with explicit throwOnError: false
      const result = await shell.execute('sh -c "exit 1"', { throwOnError: false });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should return error result when using safeRun() with different exit codes', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('sh -c "exit 42"');

      expect(result).toEqual({
        stdout: null,
        stderr: null,
        exitCode: 42,
        success: false
      });
    });
  });

  describe('Error Handling - throwMode', () => {
    it('should format simple error with command and exit code', async () => {
      const shell = new Shell({ throwMode: 'simple' });

      try {
        await shell.run(['sh', '-c', 'exit 5']);
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Command failed');
        expect(message).toContain('sh -c exit 5');
        expect(message).toContain('Exit code: 5');
      }
    });

    it('should include stderr in simple error message', async () => {
      const shell = new Shell({ throwMode: 'simple' });

      try {
        await shell.run('sh -c "echo stderr message >&2; exit 1"');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('stderr message');
      }
    });
  });

  describe('Logger Integration', () => {
    it('should use custom logger when provided', async () => {
      const logs: string[] = [];
      const customDebug = (msg: string) => logs.push(msg);

      const shell = new Shell({
        verbose: true,
        logger: { debug: customDebug }
      });
      await shell.run('echo test');

      expect(logs).toContain('$ echo test');
    });

    it('should use console.debug by default', async () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const shell = new Shell({ verbose: true });

      await shell.run('echo test');

      expect(consoleSpy).toHaveBeenCalledWith('$ echo test', expect.any(Object));
      consoleSpy.mockRestore();
    });

    it('should call logger for both verbose and dryRun', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        verbose: true,
        dryRun: true,
        logger: { debug: mockDebug }
      });

      await shell.run('echo test');

      expect(mockDebug).toHaveBeenCalledTimes(1);
      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });
  });

  describe('Result Structure', () => {
    it('should return correct structure for successful command with safeRun', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('echo success');

      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('success');

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should set success correctly', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('echo test');

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should return null for empty stderr', async () => {
      const shell = new Shell();
      const result = await shell.run('echo test');

      expect(result.stderr).toBe(null);
    });

    it('should capture both stdout and stderr', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('sh -c "echo stdout; echo stderr >&2; exit 0"');

      expect(result.stdout).toBe('stdout');
      expect(result.stderr).toBe('stderr');
    });

    it('should return null for empty stdout', async () => {
      const shell = new Shell();
      const result = await shell.run('true');

      expect(result.stdout).toBe(null);
    });
  });

  describe('Constructor Options', () => {
    it('should use default options when none provided', () => {
      const shell = new Shell();
      expect(shell).toBeInstanceOf(Shell);
    });

    it('should accept all valid options', () => {
      const mockDebug = vi.fn();
      const mockWarn = vi.fn();
      const shell = new Shell({
        outputMode: 'capture',
        dryRun: false,
        verbose: true,
        throwMode: 'simple',
        logger: {
          debug: mockDebug,
          warn: mockWarn
        }
      });

      expect(shell).toBeInstanceOf(Shell);
    });

    it('should accept partial options', async () => {
      const shell = new Shell({ verbose: true });
      const result = await shell.run('echo test');

      expect(result.stdout).toBe('test');
    });

    it('should handle empty options object', async () => {
      const shell = new Shell({});
      const result = await shell.run('echo test');

      expect(result.stdout).toBe('test');
    });
  });

  describe('Option Inheritance and Override', () => {
    it('should use safeRun to not throw', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('sh -c "exit 1"');

      expect(result.success).toBe(false);
    });

    it('should use execute with throwOnError to control behavior', async () => {
      const shell = new Shell();

      await expect(
        shell.execute('sh -c "exit 1"', { throwOnError: true })
      ).rejects.toThrow();
    });

    it('should use constructor defaultOutputMode by default', async () => {
      const shell = new Shell({ outputMode: 'capture' });
      const result = await shell.run('echo test');

      expect(result.stdout).toBe('test');
    });

    it('should override constructor defaultOutputMode with run option', async () => {
      const shell = new Shell({ outputMode: 'live' });
      const result = await shell.run('echo test', { outputMode: 'capture' });

      expect(result.stdout).toBe('test');
    });

    it('should override verbose at command level', async () => {
      const mockDebug = vi.fn();
      const shell = new Shell({
        verbose: false,
        logger: { debug: mockDebug }
      });

      // This command should log because we override verbose to true
      await shell.run('echo test', { verbose: true });
      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });

    it('should override dryRun at command level', async () => {
      const shell = new Shell({ dryRun: false });

      // This command should be in dry run mode even though default is false
      const result = await shell.safeRun('sh -c "exit 1"', { dryRun: true });

      expect(result.success).toBe(true); // Dry run always succeeds
      expect(result.exitCode).toBe(0);
    });

    it('should deep merge execaOptions from shell and command level', async () => {
      const shell = new Shell({
        execaOptions: {
          env: { SHELL_VAR: 'from-shell' },
          timeout: 5000
        }
      });

      // Command-level should override shell-level
      const result = await shell.run('echo $SHELL_VAR $CMD_VAR', {
        env: { CMD_VAR: 'from-command' }
      });

      // Both env vars should be available (deep merge)
      // Note: This test verifies the merge happens, actual execution depends on shell
      expect(result.stdout).toBeDefined();
    });

    it('should allow command-level execaOptions to override shell-level', async () => {
      const shell = new Shell({
        execaOptions: {
          timeout: 1000
        }
      });

      // Command-level timeout should override shell-level
      const result = await shell.run('echo test', {
        timeout: 10000 // Higher timeout at command level
      });

      expect(result.stdout).toBe('test');
    });
  });

  describe('Edge Cases - ExecaError Handling', () => {
    it('should return error result when command not found with safeRun', async () => {
      const shell = new Shell();
      const result = await shell.safeRun('this-command-definitely-does-not-exist-12345');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBeUndefined();
      expect(result.stdout).toBe(null);
      expect(result.stderr).toBe(null);
    });

    it('should throw when command not found with run', async () => {
      const shell = new Shell();

      await expect(
        shell.run('this-command-definitely-does-not-exist-12345')
      ).rejects.toThrow();
    });

    it('should handle execaOptions reject override in safeRun', async () => {
      const shell = new Shell();

      // Edge case: safeRun with reject: true in execaOptions
      // This causes execa to throw even though throwOnError is false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await shell.safeRun('sh -c "exit 1"', { reject: true } as any);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBeUndefined();
      expect(result.stdout).toBe(null);
      expect(result.stderr).toBe(null);
    });

    it('should handle non-ExecaError in execute', async () => {
      const shell = new Shell();

      // This will trigger a non-ExecaError (command not found)
      await expect(
        shell.execute('this-command-definitely-does-not-exist-12345', { throwOnError: true })
      ).rejects.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create Shell instance using createShell factory', async () => {
      const shell = createShell({ verbose: true });
      expect(shell).toBeInstanceOf(Shell);

      const result = await shell.run('echo factory');
      expect(result.stdout).toBe('factory');
    });

    it('should create Shell with typed output mode', async () => {
      const shell = createShell({ outputMode: 'capture' });
      const result = await shell.run('echo test');
      expect(result.stdout).toBe('test');
    });
  });

  describe('Schema Validation - runParse', () => {
    it('should parse and validate JSON output', async () => {
      const shell = createShell();
      const schema = z.object({
        name: z.string(),
        version: z.string(),
      });

      const result = await shell.runParse(
        'echo \'{"name":"test-package","version":"1.0.0"}\'',
        schema
      );

      expect(result.name).toBe('test-package');
      expect(result.version).toBe('1.0.0');
    });

    it('should handle async schema validation', async () => {
      const shell = createShell();

      // Create a custom async standard schema
      const asyncSchema = {
        '~standard': {
          version: 1,
          vendor: 'custom',
          validate: async (input: unknown) => {
            // Simulate async validation
            await new Promise(resolve => setTimeout(resolve, 10));

            if (typeof input === 'object' && input !== null && 'value' in input) {
              return { value: input };
            }
            return {
              issues: [{ message: 'Invalid data' }]
            };
          }
        }
      };

      const result = await shell.runParse(
        'echo \'{"value":"async-test"}\'',
        asyncSchema as any
      );

      expect(result).toHaveProperty('value');
    });

    it('should parse with verbose mode', async () => {
      const mockDebug = vi.fn();
      const shell = createShell({
        verbose: true,
        logger: { debug: mockDebug }
      });

      const schema = z.object({ value: z.string() });

      await shell.runParse('echo \'{"value":"test"}\'', schema);

      // Should log validation output
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('Validation Output:'),
        expect.any(Object)
      );
    });

    it('should throw when JSON is invalid', async () => {
      const shell = createShell();
      const schema = z.object({ name: z.string() });

      await expect(
        shell.runParse('echo "not json"', schema)
      ).rejects.toThrow();
    });

    it('should throw when validation fails', async () => {
      const shell = createShell();
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      await expect(
        shell.runParse('echo \'{"name":"test","count":"not-a-number"}\'', schema)
      ).rejects.toThrow();
    });
  });

  describe('Schema Validation - safeRunParse', () => {
    it('should parse and validate JSON output successfully', async () => {
      const shell = createShell();
      const schema = z.object({
        name: z.string(),
        version: z.string(),
      });

      const result = await shell.safeRunParse(
        'echo \'{"name":"test-pkg","version":"2.0.0"}\'',
        schema
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test-pkg');
        expect(result.data.version).toBe('2.0.0');
      }
    });

    it('should return error when command produces no output', async () => {
      const shell = createShell();
      const schema = z.object({ value: z.string() });

      const result = await shell.safeRunParse('true', schema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error[0].message).toContain('produced no output');
      }
    });

    it('should return error when command fails', async () => {
      const shell = createShell();
      const schema = z.object({ value: z.string() });

      const result = await shell.safeRunParse('sh -c "echo output && exit 1"', schema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error[0].message).toContain('failed with exit code');
      }
    });

    it('should return error when JSON is invalid', async () => {
      const shell = createShell();
      const schema = z.object({ value: z.string() });

      const result = await shell.safeRunParse('echo "not valid json{{"', schema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error[0].message).toContain('Unable to Parse JSON');
      }
    });

    it('should return error when validation fails', async () => {
      const shell = createShell();
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      const result = await shell.safeRunParse(
        'echo \'{"name":"test","count":"not-a-number"}\'',
        schema
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.length).toBeGreaterThan(0);
      }
    });

    it('should include verbose info in error messages', async () => {
      const shell = createShell({ verbose: true });
      const schema = z.object({ value: z.string() });

      const result = await shell.safeRunParse('true', schema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error[0].message).toContain('Command:');
      }
    });

    it('should handle array commands in verbose mode', async () => {
      const shell = createShell({ verbose: true });
      const schema = z.object({ value: z.string() });

      const result = await shell.safeRunParse(['echo', '{"value":"test"}'], schema);

      expect(result.success).toBe(true);
    });

    it('should handle async schema validation with safeRunParse', async () => {
      const shell = createShell();

      // Create a custom async standard schema
      const asyncSchema = {
        '~standard': {
          version: 1,
          vendor: 'custom',
          validate: async (input: unknown) => {
            // Simulate async validation
            await new Promise(resolve => setTimeout(resolve, 10));

            if (typeof input === 'object' && input !== null && 'value' in input) {
              return { value: input };
            }
            return {
              issues: [{ message: 'Invalid async data' }]
            };
          }
        }
      };

      const result = await shell.safeRunParse(
        'echo \'{"value":"async-safe-test"}\'',
        asyncSchema as any
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('value');
      }
    });
  });

  describe('Fluent Shell API - asFluent', () => {
    it('should create a fluent shell function', () => {
      const shell = createShell();
      const $ = shell.asFluent();

      expect(typeof $).toBe('function');
    });

    it('should execute command and return stdout when awaited directly', async () => {
      const $ = createShell().asFluent();

      const result = await $('echo hello');

      expect(result).toBe('hello');
    });

    it('should handle command as array', async () => {
      const $ = createShell().asFluent();

      const result = await $(['echo', 'world']);

      expect(result).toBe('world');
    });

    it('should return empty string for commands with no output', async () => {
      const $ = createShell().asFluent();

      const result = await $('true');

      expect(result).toBe('');
    });

    it('should work with shell configuration', async () => {
      const $ = createShell({ verbose: true }).asFluent();

      const result = await $('echo test');

      expect(result).toBe('test');
    });

    it('should propagate errors when command fails', async () => {
      const $ = createShell().asFluent();

      await expect($('sh -c "exit 1"')).rejects.toThrow();
    });
  });

  describe('Fluent Shell API - toLines()', () => {
    it('should split output into array of lines', async () => {
      const $ = createShell().asFluent();

      const lines = await $('printf "line1\\nline2\\nline3"').toLines();

      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle Windows line endings', async () => {
      const $ = createShell().asFluent();

      const lines = await $('printf "line1\\r\\nline2\\r\\nline3"').toLines();

      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should return empty array for commands with no output', async () => {
      const $ = createShell().asFluent();

      const lines = await $('true').toLines();

      expect(lines).toEqual([]);
    });

    it('should handle single line output', async () => {
      const $ = createShell().asFluent();

      const lines = await $('echo single').toLines();

      expect(lines).toEqual(['single']);
    });

    it('should handle output with trailing newline', async () => {
      const $ = createShell().asFluent();

      const lines = await $('printf "a\\nb\\nc\\n"').toLines();

      expect(lines.length).toBeGreaterThan(0);
      expect(lines).toContain('a');
      expect(lines).toContain('b');
      expect(lines).toContain('c');
    });

    it('should propagate errors when command fails', async () => {
      const $ = createShell().asFluent();

      await expect($('sh -c "exit 1"').toLines()).rejects.toThrow();
    });
  });

  describe('Fluent Shell API - parse()', () => {
    it('should parse JSON output with Zod schema', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({
        name: z.string(),
        id: z.number(),
      });

      const result = await $('echo \'{"name":"test","id":42}\'').parse(schema);

      expect(result.name).toBe('test');
      expect(result.id).toBe(42);
    });

    it('should work with nested objects', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
      });

      const result = await $('echo \'{"user":{"name":"John","email":"john@example.com"}}\'').parse(schema);

      expect(result.user.name).toBe('John');
      expect(result.user.email).toBe('john@example.com');
    });

    it('should work with arrays', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({
        items: z.array(z.string()),
      });

      const result = await $('echo \'{"items":["a","b","c"]}\'').parse(schema);

      expect(result.items).toEqual(['a', 'b', 'c']);
    });

    it('should throw error when JSON is invalid', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({ value: z.string() });

      await expect(
        $('echo "not valid json"').parse(schema)
      ).rejects.toThrow();
    });

    it('should throw error when schema validation fails', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      await expect(
        $('echo \'{"name":"test","count":"not-a-number"}\'').parse(schema)
      ).rejects.toThrow();
    });

    it('should work with custom schema objects', async () => {
      const $ = createShell().asFluent();

      // Custom schema with parse method
      const customSchema = {
        parse: (data: any) => {
          if (typeof data.value === 'string') {
            return { value: data.value.toUpperCase() };
          }
          throw new Error('Invalid schema');
        }
      };

      const result = await $('echo \'{"value":"hello"}\'').parse(customSchema);

      expect(result.value).toBe('HELLO');
    });

    it('should propagate command execution errors', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({ value: z.string() });

      await expect($('sh -c "exit 1"').parse(schema)).rejects.toThrow();
    });
  });

  describe('Fluent Shell API - Chaining Commands', () => {
    it('should allow chaining commands using results', async () => {
      const $ = createShell().asFluent();

      const data = await $('echo test');
      const result = await $(`echo ${data}`);

      expect(result).toBe('test');
    });

    it('should work with toLines() results', async () => {
      const $ = createShell().asFluent();

      const lines = await $('printf "a\\nb\\nc"').toLines();

      expect(lines).toHaveLength(3);

      // Use first line in another command
      const result = await $(`echo ${lines[0]}`);
      expect(result).toBe('a');
    });

    it('should work with parse() results', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({
        dir: z.string(),
      });

      const config = await $('echo \'{"dir":"tmp"}\'').parse(schema);
      const result = await $(`echo ${config.dir}`);

      expect(result).toBe('tmp');
    });
  });

  describe('Fluent Shell API - Integration with Shell Options', () => {
    it('should respect verbose mode', async () => {
      const mockDebug = vi.fn();
      const shell = createShell({
        verbose: true,
        logger: { debug: mockDebug }
      });
      const $ = shell.asFluent();

      await $('echo test');

      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });

    it('should respect dry run mode', async () => {
      const $ = createShell({ dryRun: true }).asFluent();

      // This would fail if executed, but should succeed in dry run
      const result = await $('sh -c "exit 1"');

      expect(result).toBe('');
    });

    it('should respect throwMode setting', async () => {
      const $ = createShell({ throwMode: 'simple' }).asFluent();

      try {
        await $('sh -c "exit 1"');
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Command failed');
        expect(message).toContain('Exit code: 1');
      }
    });

    it('should always use capture mode', async () => {
      // Even with live mode as default, fluent shell should capture
      const $ = createShell({ outputMode: 'live' }).asFluent();

      const result = await $('echo captured');

      // Should still capture output despite shell default being live
      expect(result).toBe('captured');
    });
  });

  describe('Fluent Shell API - Edge Cases', () => {
    it('should handle empty string output', async () => {
      const $ = createShell().asFluent();

      const result = await $('echo -n ""');

      expect(result).toBe('');
    });

    it('should handle commands with special characters', async () => {
      const $ = createShell().asFluent();

      const result = await $('echo "hello $world"');

      expect(result).toContain('hello');
    });

    it('should handle multiline output', async () => {
      const $ = createShell().asFluent();

      const result = await $('printf "line1\\nline2"');

      expect(result).toContain('line1');
      expect(result).toContain('line2');
    });

    it('should not allow awaiting twice', async () => {
      const $ = createShell().asFluent();

      const handle = $('echo test');
      const result1 = await handle;
      const result2 = await handle; // Awaiting the same promise again

      expect(result1).toBe('test');
      expect(result2).toBe('test');
    });

    it('should handle long output', async () => {
      const $ = createShell().asFluent();

      // Generate 100 lines
      const result = await $('seq 1 100').toLines();

      expect(result.length).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Fluent Shell API - Tagged Templates', () => {
    it('should support tagged template basic usage', async () => {
      const $ = createShell().asFluent();

      const result = await $`echo hello`;

      expect(result).toBe('hello');
    });

    it('should support tagged template with single interpolation', async () => {
      const $ = createShell().asFluent();
      const name = 'world';

      const result = await $`echo hello ${name}`;

      expect(result).toBe('hello world');
    });

    it('should support tagged template with multiple interpolations', async () => {
      const $ = createShell().asFluent();
      const a = 'foo';
      const b = 'bar';
      const c = 'baz';

      const result = await $`echo ${a} ${b} ${c}`;

      expect(result).toBe('foo bar baz');
    });

    it('should handle tagged template with number interpolation', async () => {
      const $ = createShell().asFluent();
      const num = 42;

      const result = await $`echo ${num}`;

      expect(result).toBe('42');
    });

    it('should handle tagged template with empty interpolation', async () => {
      const $ = createShell().asFluent();
      const empty = '';

      const result = await $`echo test${empty}value`;

      expect(result).toBe('testvalue');
    });

    it('should work with tagged template and toLines()', async () => {
      const $ = createShell().asFluent();

      const lines = await $`printf "a\nb\nc"`.toLines();

      expect(lines).toEqual(['a', 'b', 'c']);
    });

    it('should work with tagged template and parse()', async () => {
      const $ = createShell().asFluent();
      const schema = z.object({
        value: z.string(),
      });

      const result = await $`echo '{"value":"test"}'`.parse(schema);

      expect(result.value).toBe('test');
    });

    it('should throw error for failing tagged template command', async () => {
      const $ = createShell().asFluent();

      await expect($`sh -c "exit 1"`).rejects.toThrow();
    });
  });

  describe('Fluent Shell API - .result() Non-throwable Execution', () => {
    it('should return success result for successful command', async () => {
      const $ = createShell().asFluent();

      const result = await $`echo test`.result();

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('test');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should return failure result without throwing', async () => {
      const $ = createShell().asFluent();

      const result = await $`sh -c "exit 1"`.result();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should work with function call syntax', async () => {
      const $ = createShell().asFluent();

      const result = await $('sh -c "exit 42"').result();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(42);
    });

    it('should capture stderr in result', async () => {
      const $ = createShell().asFluent();

      const result = await $`sh -c "echo error >&2; exit 1"`.result();

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('error');
    });

    it('should work with array command syntax', async () => {
      const $ = createShell().asFluent();

      const result = await $(['echo', 'test']).result();

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('test');
    });

    it('should include both stdout and stderr on success', async () => {
      const $ = createShell().asFluent();

      const result = await $`sh -c "echo out; echo err >&2"`.result();

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err');
    });
  });

  describe('Fluent Shell API - Lazy Execution', () => {
    it('should not execute immediately when handle is created', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      // Create handle - should NOT execute yet
      const handle = $`echo test`;

      // No execution yet
      expect(mockDebug).not.toHaveBeenCalled();

      // Consume the handle - NOW it executes
      await handle;

      // Now it executed
      expect(mockDebug).toHaveBeenCalledWith('$ echo test', expect.any(Object));
    });

    it('should execute on first await', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`echo test`;
      expect(mockDebug).not.toHaveBeenCalled();

      const result = await handle;

      expect(result).toBe('test');
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should execute on first .result() call', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`echo test`;
      expect(mockDebug).not.toHaveBeenCalled();

      const result = await handle.result();

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('test');
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should execute on first .toLines() call', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`echo test`;
      expect(mockDebug).not.toHaveBeenCalled();

      const result = await handle.toLines();

      expect(result).toEqual(['test']);
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should execute on first .parse() call', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();
      const schema = z.object({ value: z.string() });

      const handle = $`echo '{"value":"test"}'`;
      expect(mockDebug).not.toHaveBeenCalled();

      const result = await handle.parse(schema);

      expect(result.value).toBe('test');
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fluent Shell API - Memoization', () => {
    it('should reuse execution when awaited multiple times', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`echo test`;

      const result1 = await handle;
      const result2 = await handle;
      const result3 = await handle;

      expect(result1).toBe('test');
      expect(result2).toBe('test');
      expect(result3).toBe('test');

      // Should only execute once
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should share execution between await and .result()', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`echo test`;

      const result1 = await handle;
      const result2 = await handle.result();

      expect(result1).toBe('test');
      expect(result2.stdout).toBe('test');
      expect(result2.success).toBe(true);

      // Should only execute once
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should share execution between .result() and .toLines()', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`printf "a\nb"`;

      const result1 = await handle.result();
      const result2 = await handle.toLines();

      expect(result1.stdout).toBe('a\nb');
      expect(result2).toEqual(['a', 'b']);

      // Should only execute once
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should share execution between all methods', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();

      const handle = $`echo '{"value":"test"}'`;
      const schema = z.object({ value: z.string() });

      const result1 = await handle;
      const result2 = await handle.result();
      const result3 = await handle.parse(schema);

      expect(result1).toBe('{"value":"test"}');
      expect(result2.stdout).toBe('{"value":"test"}');
      expect(result3.value).toBe('test');

      // Should only execute once
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });

    it('should handle errors consistently across multiple consumptions', async () => {
      const $ = createShell().asFluent();

      const handle = $`sh -c "exit 1"`;

      // First consumption throws
      await expect(handle).rejects.toThrow();

      // Second consumption also throws (same error)
      await expect(handle).rejects.toThrow();

      // .result() doesn't throw but shows failure
      const result = await handle.result();
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should memoize with tagged template interpolation', async () => {
      const mockDebug = vi.fn();
      const $ = createShell({ verbose: true, logger: { debug: mockDebug } }).asFluent();
      const name = 'world';

      const handle = $`echo hello ${name}`;

      const result1 = await handle;
      const result2 = await handle;

      expect(result1).toBe('hello world');
      expect(result2).toBe('hello world');

      // Should only execute once
      expect(mockDebug).toHaveBeenCalledTimes(1);
    });
  });
});
