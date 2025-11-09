# Pre-Development Plan: Enhance asFluent() with Tagged Templates and Lazy Execution

## Overview
Enhance the existing `asFluent()` method to support tagged template literals, lazy execution, and memoization. The returned function (commonly named `$`) will support:
- Tagged template literals: `` $`echo hello` ``
- Function calls: `$('echo hello')` and `$(['echo', 'hello'])`
- Lazy execution: doesn't run until consumed
- Memoization: one handle, one execution
- `.result()` method for non-throwable execution

## Before and After

### Before (Task-1):
```typescript
const shell = createShell({ verbose: true });
const $ = shell.asFluent();

// Only function calls supported
const result = await $('echo hello');      // ✅ Works
const lines = await $('ls').toLines();     // ✅ Works

// Tagged templates NOT supported
await $`echo hello`;                       // ❌ Doesn't work
```

### After (Task-2):
```typescript
const shell = createShell({ verbose: true });
const $ = shell.asFluent();

// Function calls still work (backward compatible)
const result = await $('echo hello');      // ✅ Still works
const lines = await $('ls').toLines();     // ✅ Still works

// Tagged templates NOW supported
const output = await $`echo hello`;        // ✅ Now works!
const files = await $`ls -la`.toLines();   // ✅ Now works!

// Interpolation in tagged templates
const name = 'world';
const msg = await $`echo hello ${name}`;   // ✅ New feature!

// Non-throwable execution with .result()
const r = await $`exit 1`.result();        // ✅ New feature!
if (!r.success) {
  console.error(r.exitCode, r.stderr);
}

// Lazy execution + memoization
const handle = $`echo test`;
const a = await handle;                    // Executes once
const b = await handle.result();           // Reuses same execution
```

## Goals
- **Enhance `asFluent()`** to return a function that supports:
  - Tagged template: `` await $`echo ${name}` ``
  - Function calls: `await $('echo hello')` and `await $(['echo', 'hello'])`
- **Add lazy execution**: only starts when first "consumed" (await, .result(), .toLines(), .parse())
- **Add memoization**: one handle, one execution, shared by all consumers
- **Add `.result()` method**: non-throwable execution path
- **Maintain backward compatibility**: existing function call syntax still works

## Key Enhancements from Current asFluent()

### Current `asFluent()` behavior (from task-1):
- Returns a function: `(command: string | string[]) => CommandHandle`
- Executes immediately when called
- Each method call creates new execution
- No memoization
- Only supports function calls, not tagged templates

### Enhanced behavior (task-2):
- Returns a function: `DollarFunction` (supports tagged templates + function calls)
- Deferred execution (lazy)
- Execution starts only when consumed (await, .result(), .toLines(), .parse())
- One execution shared by all methods (memoized)
- Supports tagged templates in addition to function calls
- Has `.result()` for non-throwable execution

## Architecture Design

### 1. New Types

```typescript
/**
 * Result type for non-throwable execution
 */
export type CommandResult = {
  success: boolean;        // exitCode === 0
  stdout: string;
  stderr: string;
  exitCode: number | undefined;  // undefined when process failed to start
};

/**
 * Command handle with lazy execution and memoization
 * Supports both throwable (await) and non-throwable (.result()) patterns
 */
export type LazyCommandHandle = PromiseLike<string> & {
  /**
   * Non-throwable execution - returns result object with success flag
   */
  result(): Promise<CommandResult>;

  /**
   * Split stdout into array of lines
   */
  toLines(): Promise<string[]>;

  /**
   * Parse stdout as JSON and validate with schema
   */
  parse<T>(schema: { parse(x: unknown): T }): Promise<T>;
};

/**
 * Overloaded $ function signatures
 */
export interface DollarFunction {
  // Tagged template
  (parts: TemplateStringsArray, ...values: any[]): LazyCommandHandle;

  // String command
  (command: string): LazyCommandHandle;

  // Argv array
  (command: string[]): LazyCommandHandle;
}
```

### 2. Shell Class Modification

Modify existing `asFluent()` method in Shell class:
```typescript
class Shell {
  // ... existing methods ...

  /**
   * Create a fluent shell function with tagged template support and lazy execution.
   * The returned function can be used with tagged templates or regular function calls.
   *
   * @example Tagged template
   * ```typescript
   * const $ = shell.asFluent();
   * const files = await $`ls -la`.toLines();
   * ```
   *
   * @example Function call
   * ```typescript
   * const $ = shell.asFluent();
   * const result = await $('echo hello');
   * ```
   */
  asFluent(): DollarFunction {
    // NEW implementation with lazy execution and tagged template support
  }
}
```

**Note**: This replaces the current `createFluentShell()` implementation from task-1.

### 3. Lazy Execution Implementation Pattern

```typescript
function createLazyHandle(shell: Shell, command: string | string[]): LazyCommandHandle {
  // Memoized execution promise
  let executionPromise: Promise<CommandResult> | null = null;

  // Lazy executor - only runs once, then memoizes
  const start = (): Promise<CommandResult> => {
    if (executionPromise === null) {
      executionPromise = shell.safeRun(command, { outputMode: 'capture' })
        .then(result => ({
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
  handle.then = (onFulfilled, onRejected) => {
    return start().then(result => {
      if (!result.success) {
        // Throw error based on throwMode
        throw new Error(`Command failed with exit code ${result.exitCode}`);
      }
      return result.stdout;
    }).then(onFulfilled, onRejected);
  };

  // Non-throwable path: handle.result()
  handle.result = () => start();

  // Helper methods
  handle.toLines = () => start().then(result => {
    if (!result.success) {
      throw new Error(`Command failed with exit code ${result.exitCode}`);
    }
    if (!result.stdout) return [];
    return result.stdout.split(/\r?\n/);
  });

  handle.parse = <T>(schema: { parse(x: unknown): T }): Promise<T> => {
    return start().then(result => {
      if (!result.success) {
        throw new Error(`Command failed with exit code ${result.exitCode}`);
      }
      const parsed = JSON.parse(result.stdout);
      return schema.parse(parsed);
    });
  };

  return handle as LazyCommandHandle;
}
```

### 4. Tagged Template Processing

```typescript
function processTaggedTemplate(
  parts: TemplateStringsArray,
  values: any[]
): string {
  // Interleave parts and values
  // For now: simple string interpolation
  // Later: proper argv-safe escaping for interpolated values
  let result = parts[0];
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + parts[i + 1];
  }
  return result;
}
```

## Implementation Steps

### Step 1: Add New Types to src/shell.ts
- Define `CommandResult` type (for `.result()` method)
- Define `LazyCommandHandle` type (extends `CommandHandle` with `.result()`)
- Define `DollarFunction` interface with overloads for tagged templates
- Keep existing `CommandHandle` and `FluentShellFn` types for backward compatibility
- Export all new types

### Step 2: Implement Lazy Execution Core
- Create `createLazyHandle()` helper function
- Implement memoized `start()` function that runs command only once
- Implement `then` method for throwable path (replaces immediate execution)
- Implement `result()` method for non-throwable path (new feature)
- Update `toLines()` and `parse()` to use lazy execution

### Step 3: Implement Tagged Template Processing
- Create `processTaggedTemplate()` helper function
- Simple string interpolation for now (concatenate parts and values)
- Note: argv-safe escaping to be added later (future enhancement)

### Step 4: Replace asFluent() Implementation in Shell Class
- Remove current `createFluentShell()` implementation
- Implement new `asFluent()` method that:
  - Returns `DollarFunction` (supports tagged templates + function calls)
  - Detects tagged template vs function call
  - Processes input and delegates to `createLazyHandle()`
  - Maintains backward compatibility with function call syntax

### Step 5: Export from src/index.ts
- Export new types: `CommandResult`, `LazyCommandHandle`, `DollarFunction`
- Keep existing exports for backward compatibility

### Step 6: Update Existing Tests
- Modify `test/shell.test.ts`:
  - Keep existing "Fluent Shell API - asFluent" tests
  - Update tests to verify lazy execution behavior
  - Add tests for new `.result()` method

### Step 7: Add New Tests for Tagged Templates and Lazy Execution
Create additional test cases in `test/shell.test.ts`:
- **Basic Functionality**:
  - Tagged template: `` await $`echo test` ``
  - String call: `await $('echo test')`
  - Array call: `await $(['echo', 'test'])`

- **Lazy Execution**:
  - Verify execution doesn't start immediately
  - Verify execution starts on first consume

- **Memoization**:
  - Multiple awaits share same execution
  - `.result()` and `await` share same execution
  - `.toLines()` and `.parse()` share same execution

- **Throwable Path**:
  - `await $`exit 1`` throws error
  - Error includes exit code and stderr
  - Respects throwMode setting

- **Non-throwable Path**:
  - `.result()` doesn't throw
  - Returns CommandResult with success: false
  - Includes stdout, stderr, exitCode

- **Helper Methods**:
  - `.toLines()` splits output correctly
  - `.parse()` parses JSON with schema
  - Both helpers throw on command failure

- **Template Interpolation**:
  - `` $`echo ${value}` `` includes interpolated values
  - Multiple interpolations work
  - Edge cases: empty strings, numbers, etc.

### Step 8: Add Usage Examples
Update `examples/fluentShell.ts` or create `examples/lazyFluent.ts`:
- Tagged template basic usage
- Function call usage (existing examples still work)
- `.result()` for non-throwable execution (new)
- `.toLines()` and `.parse()` with templates
- Demonstrating lazy + memoization behavior
- Show that `asFluent()` now supports both styles

## Technical Considerations

### Lazy Execution Details
- Execution promise is `null` initially
- First consumer (await, .result(), etc.) triggers start()
- start() creates promise and memoizes it
- Subsequent consumers reuse memoized promise
- No race conditions: all consumers wait on same promise

### Memoization Guarantee
```typescript
const handle = $`echo test`;
const a = await handle;           // Executes once
const b = await handle;           // Reuses same execution
const c = await handle.result();  // Still same execution
```

### Tagged Template vs Function Call Detection
```typescript
public asFluent(): DollarFunction {
  return ((firstArg: any, ...rest: any[]) => {
    // Check if it's a tagged template call
    if (
      Array.isArray(firstArg) &&
      'raw' in firstArg &&
      Array.isArray(firstArg.raw)
    ) {
      // Tagged template: firstArg is TemplateStringsArray
      const command = processTaggedTemplate(firstArg, rest);
      return createLazyHandle(this, command);
    }

    // Function call with string or array
    return createLazyHandle(this, firstArg);
  }) as DollarFunction;
}
```

### Error Handling Strategy
- **Throwable path** (`await $...`):
  - Checks result.success in `then` callback
  - Throws error if success === false
  - Error format based on throwMode (simple vs raw)

- **Non-throwable path** (`.result()`):
  - Always returns CommandResult
  - Never throws (unless Shell itself throws)
  - User checks result.success manually

- **Helper methods** (`.toLines()`, `.parse()`):
  - Throw if command failed (exit code ≠ 0)
  - Also throw on parsing errors
  - Consistent with throwable semantics

### Type Safety
- Overloaded signatures provide proper type inference
- `await $...` returns `string`
- `.result()` returns `Promise<CommandResult>`
- `.toLines()` returns `Promise<string[]>`
- `.parse(schema)` returns `Promise<T>` where T inferred from schema

## Files to Modify

1. **src/shell.ts**
   - Add `CommandResult` type
   - Add `LazyCommandHandle` type (extends existing `CommandHandle`)
   - Add `DollarFunction` interface
   - **Replace** `createFluentShell()` method with enhanced `asFluent()` method
   - Add helper functions: `createLazyHandle()`, `processTaggedTemplate()`

2. **src/index.ts**
   - Export new types: `CommandResult`, `LazyCommandHandle`, `DollarFunction`

3. **test/shell.test.ts**
   - **Update** existing "Fluent Shell API - asFluent" test suite
   - Add new test cases for tagged templates
   - Add new test cases for lazy execution and memoization
   - Add new test cases for `.result()` method

4. **examples/fluentShell.ts** or **examples/lazyFluent.ts**
   - Update existing examples or create new file
   - Demonstrate tagged template usage
   - Demonstrate lazy execution behavior
   - Demonstrate memoization guarantee
   - Show `.result()` for non-throwable execution

## Success Criteria

- ✅ `const $ = shell.asFluent()` works
- ✅ `` const result = await $`echo test` `` works and returns 'test'
- ✅ `await $('echo test')` works (backward compatibility)
- ✅ `await $(['echo', 'test'])` works (backward compatibility)
- ✅ `` const r = await $`exit 1`.result() `` doesn't throw, r.success === false
- ✅ `` await $`exit 1` `` throws error
- ✅ `` await $`echo test`.toLines() `` returns array
- ✅ Tagged template with interpolation: `` $`echo ${value}` `` works
- ✅ Lazy execution verified (doesn't run until consumed)
- ✅ Memoization verified (multiple consumers share one execution)
- ✅ All existing tests still pass (backward compatibility)
- ✅ New tests for tagged templates and lazy execution pass
- ✅ TypeScript compilation succeeds
- ✅ Type inference works correctly for all overloads
- ✅ Respects Shell options (verbose, dryRun, throwMode)

## Non-Goals (Out of Scope for Initial Implementation)

- Argv-safe escaping for template interpolations (mark as TODO)
- Pipeline/redirection support (future: `` $sh`ls | grep x` ``)
- Interactive stdin auto-inherit (future: `.live()` or `.withShell()`)
- Additional methods like `.json()`, `.safeParse()`, `.csv()`, `.stream()`, `.timing()`
- Performance optimizations for template parsing
- Support for nested templates

## Future Enhancements (Document as TODOs)

1. **Argv-safe interpolation**:
   ```typescript
   // Each ${value} should be treated as single argv element
   $`git commit -m ${message}` // message shouldn't word-split
   ```

2. **Shell mode for pipelines**:
   ```typescript
   $sh`ls | grep .ts`
   // or
   $`ls -la`.withShell().pipe($`grep .ts`)
   ```

3. **Interactive stdin**:
   ```typescript
   await $`vim myfile.txt`.live()
   ```

4. **Additional helper methods**:
   - `.json()` - auto-parse JSON without schema
   - `.text()` - alias for direct await
   - `.lines()` - alias for toLines()
   - `.stream()` - return Node.js stream
   - `.timing()` - include execution timing in result

5. **Enhanced result options**:
   ```typescript
   await $`...`.result({
     includeTiming: true,
     includeCommand: true
   })
   ```

## Notes

- The `asFluent()` method returns a function (`DollarFunction`), not a handle directly
- This function can be used with both tagged template and function call syntax
- Usage pattern: `const $ = shell.asFluent(); await $`echo test``
- Or with createShell: `const $ = createShell().asFluent(); await $`ls``
- The returned function can be named anything (commonly `$`, but could be `sh`, `cmd`, etc.)
- Consider adding a top-level export for convenience:
  ```typescript
  export const $ = createShell().asFluent();
  ```
- The lazy execution is truly lazy - handle can be created without execution
- Multiple consumption of same handle is safe and efficient (memoized)
- The `.result()` method is the primary way to avoid exceptions
- **Implementation note**: This enhances the existing `asFluent()` method from task-1
- **Backward compatibility**: All existing function call syntax continues to work
- **New behavior**: Adds tagged template support, lazy execution, and `.result()` method
