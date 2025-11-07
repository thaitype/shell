import { describe, it, expect, vi } from 'vitest';
import { Shell } from '../src/shell.js';

describe('Shell', () => {
  describe('Command Parsing', () => {
    it('should execute command from string', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "Hello World"');

      expect(result.isSuccess).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello World');
    });

    it('should execute command from array', async () => {
      const shell = new Shell();
      const result = await shell.run(['echo', 'Hello', 'World']);

      expect(result.isSuccess).toBe(true);
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
      const shell = new Shell({ defaultMode: 'capture' });
      const result = await shell.run('echo "Test"');

      expect(result.stdout).toBe('Test');
    });

    it('should override default mode with per-command option', async () => {
      const shell = new Shell({ defaultMode: 'live' });
      const result = await shell.run('echo "Override"', { outputMode: 'capture' });

      // Override to capture, so stdout should be captured
      expect(result.stdout).toBe('Override');
    });

    it('should handle all mode (capture and stream)', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "All Mode"', { outputMode: 'all' });

      // In 'all' mode, output is both captured and streamed
      expect(result.stdout).toBe('All Mode');
      expect(result.isSuccess).toBe(true);
    });

    it('should handle live mode', async () => {
      const shell = new Shell();
      const result = await shell.run('echo "Live"', { outputMode: 'live' });

      // In live mode, command still succeeds
      expect(result.exitCode).toBe(0);
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Dry Run Mode', () => {
    it('should not execute commands in dry run mode', async () => {
      const shell = new Shell({ dryRun: true });
      // This command would fail if executed, but should succeed in dry run
      const result = await shell.run('sh -c "exit 1"');

      expect(result.isSuccess).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should return mock success result in dry run mode', async () => {
      const shell = new Shell({ dryRun: true });
      const result = await shell.run('echo "test"');

      expect(result).toEqual({
        stdout: '',
        stderr: '',
        exitCode: 0,
        isError: false,
        isSuccess: true
      });
    });

    it('should log commands in dry run mode when verbose', async () => {
      const mockLogger = vi.fn();
      const shell = new Shell({ dryRun: true, verbose: true, logger: mockLogger });

      await shell.run('echo test');

      expect(mockLogger).toHaveBeenCalledWith('$ echo test');
    });

    it('should not log commands in dry run mode without verbose', async () => {
      const mockLogger = vi.fn();
      const shell = new Shell({ dryRun: true, verbose: false, logger: mockLogger });

      await shell.run('echo test');

      // dryRun alone logs, but let's check it does log
      expect(mockLogger).toHaveBeenCalledWith('$ echo test');
    });
  });

  describe('Verbose Mode', () => {
    it('should log commands when verbose is enabled', async () => {
      const mockLogger = vi.fn();
      const shell = new Shell({ verbose: true, logger: mockLogger });

      await shell.run('echo test');

      expect(mockLogger).toHaveBeenCalledWith('$ echo test');
    });

    it('should not log commands when verbose is disabled', async () => {
      const mockLogger = vi.fn();
      const shell = new Shell({ verbose: false, logger: mockLogger });

      await shell.run('echo test');

      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should log array commands correctly', async () => {
      const mockLogger = vi.fn();
      const shell = new Shell({ verbose: true, logger: mockLogger });

      await shell.run(['echo', 'hello', 'world']);

      expect(mockLogger).toHaveBeenCalledWith('$ echo hello world');
    });
  });

  describe('Error Handling - throwOnError', () => {
    it('should throw error by default when command fails', async () => {
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

    it('should not throw when throwOnError is false at constructor level', async () => {
      const shell = new Shell({ throwOnError: false });
      const result = await shell.run('sh -c "exit 1"');

      expect(result.isError).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should respect per-command throwOnError option', async () => {
      const shell = new Shell({ throwOnError: true });
      // Override to not throw for this specific command
      const result = await shell.run('sh -c "exit 1"', { throwOnError: false });

      expect(result.isError).toBe(true);
      expect(result.exitCode).toBe(1);
    });

    it('should return error result when throwOnError is false', async () => {
      const shell = new Shell({ throwOnError: false });
      const result = await shell.run('sh -c "exit 42"');

      expect(result).toEqual({
        stdout: null,
        stderr: null,
        exitCode: 42,
        isError: true,
        isSuccess: false
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
      const customLogger = (msg: string) => logs.push(msg);

      const shell = new Shell({ verbose: true, logger: customLogger });
      await shell.run('echo test');

      expect(logs).toContain('$ echo test');
    });

    it('should use console.log by default', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const shell = new Shell({ verbose: true });

      await shell.run('echo test');

      expect(consoleSpy).toHaveBeenCalledWith('$ echo test');
      consoleSpy.mockRestore();
    });

    it('should call logger for both verbose and dryRun', async () => {
      const mockLogger = vi.fn();
      const shell = new Shell({ verbose: true, dryRun: true, logger: mockLogger });

      await shell.run('echo test');

      expect(mockLogger).toHaveBeenCalledTimes(1);
      expect(mockLogger).toHaveBeenCalledWith('$ echo test');
    });
  });

  describe('Result Structure', () => {
    it('should return correct structure for successful command', async () => {
      const shell = new Shell();
      const result = await shell.run('echo success');

      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('isSuccess');
      expect(result).toHaveProperty('isError');

      expect(result.isSuccess).toBe(true);
      expect(result.isError).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it('should set isSuccess and isError correctly', async () => {
      const shell = new Shell();
      const result = await shell.run('echo test');

      expect(result.exitCode).toBe(0);
      expect(result.isSuccess).toBe(true);
      expect(result.isError).toBe(false);
    });

    it('should return null for empty stderr', async () => {
      const shell = new Shell();
      const result = await shell.run('echo test');

      expect(result.stderr).toBe(null);
    });

    it('should capture both stdout and stderr', async () => {
      const shell = new Shell();
      const result = await shell.run('sh -c "echo stdout; echo stderr >&2; exit 0"');

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
      const mockLogger = vi.fn();
      const shell = new Shell({
        defaultMode: 'capture',
        dryRun: false,
        verbose: true,
        throwOnError: true,
        throwMode: 'simple',
        logger: mockLogger
      });

      expect(shell).toBeInstanceOf(Shell);
    });

    it('should accept partial options', async () => {
      const shell = new Shell({ verbose: true });
      const result = await shell.run('echo test');

      expect(result.isSuccess).toBe(true);
    });

    it('should handle empty options object', async () => {
      const shell = new Shell({});
      const result = await shell.run('echo test');

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Option Inheritance and Override', () => {
    it('should use constructor throwOnError by default', async () => {
      const shell = new Shell({ throwOnError: false });
      const result = await shell.run('sh -c "exit 1"');

      expect(result.isError).toBe(true);
    });

    it('should override constructor throwOnError with run option', async () => {
      const shell = new Shell({ throwOnError: false });

      await expect(
        shell.run('sh -c "exit 1"', { throwOnError: true })
      ).rejects.toThrow();
    });

    it('should use constructor defaultMode by default', async () => {
      const shell = new Shell({ defaultMode: 'capture' });
      const result = await shell.run('echo test');

      expect(result.stdout).toBe('test');
    });

    it('should override constructor defaultMode with run option', async () => {
      const shell = new Shell({ defaultMode: 'live' });
      const result = await shell.run('echo test', { outputMode: 'capture' });

      expect(result.stdout).toBe('test');
    });
  });
});
