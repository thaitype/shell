# FluentShell API Enhancement - Pre-Development Plan

## Overview

Enhance FluentShell (`asFluent()` / `$`) to align with `ShellOptions` while maintaining safety and type correctness. The fluent API will support `capture` and `all` modes but explicitly reject `live` mode since fluent operations require stdout for chaining, parsing, and memoization.

## Design Goals

1. **Consistency**: FluentShell should respect `ShellOptions` configuration
2. **Safety**: Prevent `live` mode usage which breaks fluent operations
3. **Flexibility**: Allow per-command `outputMode` overrides (except `live`)
4. **Type Safety**: Enforce constraints at compile-time where possible
5. **Backward Compatibility**: Maintain existing tagged template and function call patterns

---

## Current State Analysis

### Existing Implementation (`src/shell.ts`)

**Current `DollarFunction` signature** (lines ~424-439):
```typescript
export interface DollarFunction {
  (parts: TemplateStringsArray, ...values: any[]): LazyCommandHandle;
  (command: string): LazyCommandHandle;
  (command: string[]): LazyCommandHandle;
}
```

**Current `createLazyHandle()` implementation** (lines ~828-972):
- Hardcodes `outputMode: 'capture'` at line 859
- No options parameter - always uses capture mode
- Returns `Promise<RunResult<false, 'capture'>>`

**Current `asFluent()` implementation** (lines ~1024-1037):
- No validation of shell's `outputMode`
- Always creates lazy handles with capture mode
- No per-command options support

---

## Required Changes

### 1. Type Definitions

#### 1.1 Add `FluentOutputMode` type
**Location**: After `OutputMode` type definition (after line 14)

```typescript
/**
 * Output modes supported by FluentShell.
 * Excludes 'live' mode since fluent operations require stdout for chaining and parsing.
 */
export type FluentOutputMode = Exclude<OutputMode, 'live'>;
```

#### 1.2 Add `FluentRunOptions` type
**Location**: After `RunOptions` definition (after line 187)

```typescript
/**
 * Options for fluent shell command execution.
 * Restricts outputMode to exclude 'live' mode.
 *
 * @template Mode - The output mode for this command (capture or all only)
 */
export type FluentRunOptions<Mode extends FluentOutputMode = FluentOutputMode> =
  Omit<RunOptions<Mode>, 'outputMode'> & {
    outputMode?: Mode;
  };
```

#### 1.3 Update `DollarFunction` interface
**Location**: Replace existing definition (lines ~424-439)

```typescript
/**
 * Function that supports both tagged templates and function calls for command execution.
 * Returned by `shell.asFluent()`.
 *
 * Supports three call signatures:
 * 1. Tagged template: `` $`echo hello` ``
 * 2. String command: `$('echo hello')` or `$('echo hello', { outputMode: 'all' })`
 * 3. Argv array: `$(['echo', 'hello'])` or `$(['echo', 'hello'], { outputMode: 'all' })`
 *
 * Note: FluentShell does not support 'live' mode. Use 'capture' or 'all' only.
 *
 * @example Tagged template
 * ```typescript
 * const $ = createShell().asFluent();
 * const name = 'world';
 * const result = await $`echo hello ${name}`;
 * ```
 *
 * @example Function call with options
 * ```typescript
 * const $ = createShell().asFluent();
 * const result = await $('echo hello', { outputMode: 'all' });
 * ```
 *
 * @example Array call with options
 * ```typescript
 * const $ = createShell().asFluent();
 * const result = await $(['echo', 'hello'], { outputMode: 'all' });
 * ```
 */
export interface DollarFunction {
  /**
   * Tagged template call - interpolates values into command string
   */
  (parts: TemplateStringsArray, ...values: any[]): LazyCommandHandle;

  /**
   * String or array command call with optional fluent options
   */
  (command: string | string[], options?: FluentRunOptions): LazyCommandHandle;
}
```

---

### 2. Helper Method - `assertFluentMode()`

**Location**: Add as private method in `Shell` class (after `processTaggedTemplate`, around line 840)

```typescript
/**
 * Validates that the output mode is compatible with FluentShell.
 * Throws an error if 'live' mode is used.
 *
 * @param mode - The output mode to validate
 * @throws {Error} If mode is 'live'
 *
 * @internal
 */
private assertFluentMode(mode: OutputMode): asserts mode is FluentOutputMode {
  if (mode === 'live') {
    throw new Error(
      "FluentShell does not support outputMode: 'live'. " +
      "Use 'capture' or 'all', or call shell.run(..., { outputMode: 'live' }) instead."
    );
  }
}
```

---

### 3. Update `createLazyHandle()` Method

**Location**: Modify existing method (lines ~828-972)

**Changes**:
1. Add `options` parameter with type `FluentRunOptions<FluentOutputMode>`
2. Remove hardcoded `outputMode: 'capture'` at line 859
3. Pass options through to `safeRun()`
4. Update return type to use `FluentOutputMode`
5. Update promise type to `Promise<RunResult<false, FluentOutputMode>>`

**New signature**:
```typescript
/**
 * Create a lazy command handle with memoized execution.
 * The command doesn't execute until first consumption (await, .result(), .toLines(), .parse()).
 * Multiple consumptions share the same execution result.
 *
 * @param command - Command to execute (string or array)
 * @param options - Fluent execution options (validated to not use 'live' mode)
 * @returns LazyCommandHandle with deferred execution
 *
 * @internal
 */
private createLazyHandle(
  command: string | string[],
  options: FluentRunOptions<FluentOutputMode>
): LazyCommandHandle {
  let executionPromise: Promise<RunResult<false, FluentOutputMode>> | null = null;

  const start = (): Promise<RunResult<false, FluentOutputMode>> => {
    if (executionPromise === null) {
      // Pass options directly to safeRun (outputMode already validated)
      executionPromise = this.safeRun(command, options as RunOptions<FluentOutputMode>);
    }
    return executionPromise;
  };

  // ... rest of implementation (handle.then, handle.result, etc.)
}
```

**Key change at line 859**:
- **Before**: `executionPromise = this.safeRun(command, { outputMode: 'capture' }).then(result => ({...}))`
- **After**: `executionPromise = this.safeRun(command, options as RunOptions<FluentOutputMode>)`
- **Remove** the `.then()` transformation (lines 859-864) since we're no longer forcing capture mode

---

### 4. Update `asFluent()` Method

**Location**: Modify existing method (lines ~1024-1037)

**Changes**:
1. Add validation to reject `live` mode at shell level
2. Handle options parameter in function call path
3. Determine effective output mode (options → shell default)
4. Validate effective mode before creating lazy handle
5. Pass options to `createLazyHandle()`

**New implementation**:
```typescript
/**
 * Create a fluent shell function with tagged template and lazy execution support.
 *
 * Returns a function that supports:
 * - Tagged templates: `` $`echo hello` ``
 * - Function calls: `$('echo hello')` or `$(['echo', 'hello'], { outputMode: 'all' })`
 * - Lazy execution: command doesn't run until consumed
 * - Memoization: multiple consumptions share one execution
 * - Non-throwable path: `.result()` returns result with success flag
 *
 * Note: FluentShell requires stdout for chaining, so 'live' mode is not supported.
 * If the shell instance has `outputMode: 'live'`, this method will throw an error.
 *
 * @returns DollarFunction that supports tagged templates and function calls
 *
 * @throws {Error} If shell instance has `outputMode: 'live'`
 *
 * @example Tagged template with shell default mode
 * ```typescript
 * const shell = createShell({ outputMode: 'capture' });
 * const $ = shell.asFluent();
 * const result = await $`echo hello`; // Uses 'capture' mode
 * ```
 *
 * @example Function call with mode override
 * ```typescript
 * const shell = createShell({ outputMode: 'capture' });
 * const $ = shell.asFluent();
 * const result = await $('echo hello', { outputMode: 'all' }); // Uses 'all' mode
 * ```
 *
 * @example Error case - live mode not supported
 * ```typescript
 * const shell = createShell({ outputMode: 'live' });
 * shell.asFluent(); // ❌ Throws error
 * ```
 */
public asFluent(): DollarFunction {
  // Validate shell-level outputMode
  this.assertFluentMode(this.outputMode);

  return ((firstArg: any, ...rest: any[]): LazyCommandHandle => {
    // Detect if it's a tagged template call
    if (Array.isArray(firstArg) && 'raw' in firstArg && Array.isArray((firstArg as any).raw)) {
      // Tagged template: process interpolation, use shell default mode
      const command = this.processTaggedTemplate(firstArg as TemplateStringsArray, rest);
      const mode = this.outputMode;

      // Mode already validated at asFluent() level, but assert for type narrowing
      this.assertFluentMode(mode);

      return this.createLazyHandle(command, { outputMode: mode } as FluentRunOptions<FluentOutputMode>);
    }

    // Function call: string or array with optional options
    const command = firstArg as string | string[];
    const options = rest[0] as FluentRunOptions | undefined;

    // Determine effective output mode (options override shell default)
    const effectiveMode = (options?.outputMode ?? this.outputMode) as OutputMode;

    // Validate effective mode
    this.assertFluentMode(effectiveMode);

    // Create lazy handle with effective options
    const effectiveOptions: FluentRunOptions<FluentOutputMode> = {
      ...(options ?? {}),
      outputMode: effectiveMode,
    };

    return this.createLazyHandle(command, effectiveOptions);
  }) as DollarFunction;
}
```

---

### 5. Update `LazyCommandHandle` Return Types

**Location**: `LazyCommandHandle` type definition (lines ~315-394)

**Changes**:
- Update `result()` return type to support both `capture` and `all` modes
- Currently uses `RunResult<false, 'capture'>`, should use `RunResult<false, FluentOutputMode>`

**Note**: This may require making `LazyCommandHandle` generic or keeping it flexible enough to handle both modes. Consider type implications carefully.

**Option A - Keep simple (recommended)**:
```typescript
result(): Promise<RunResult<false, FluentOutputMode>>;
```

**Option B - Make generic**:
```typescript
export type LazyCommandHandle<Mode extends FluentOutputMode = FluentOutputMode> = PromiseLike<string> & {
  result(): Promise<RunResult<false, Mode>>;
  // ... other methods
}
```

Recommendation: Use **Option A** for simplicity. The nullability difference between modes is handled at runtime.

---

## Implementation Order

### Phase 1: Type Definitions
1. Add `FluentOutputMode` type
2. Add `FluentRunOptions` type
3. Update `DollarFunction` interface

### Phase 2: Validation Logic
4. Add `assertFluentMode()` helper method

### Phase 3: Core Implementation
5. Update `createLazyHandle()` signature and implementation
6. Update `asFluent()` implementation

### Phase 4: Type Alignment
7. Update `LazyCommandHandle.result()` return type (if needed)
8. Fix any type issues in the lazy handle implementation

### Phase 5: Testing & Documentation
9. Add comprehensive tests (see test cases below)
10. Update JSDoc comments for all modified code
11. Verify type safety with `pnpm check-types`
12. Run full test suite with `pnpm test:ci`

---

## Test Cases

### Test File Location: `test/shell.test.ts`

Add new test suite: "Fluent Shell API - OutputMode Support"

#### Test 1: Shell with capture mode + tagged template
```typescript
test('should work with capture mode (default)', async () => {
  const shell = createShell({ outputMode: 'capture' });
  const $ = shell.asFluent();
  const result = await $`echo hello`;
  expect(result).toBe('hello');
});
```

#### Test 2: Shell with all mode + function call
```typescript
test('should work with all mode', async () => {
  const shell = createShell({ outputMode: 'all' });
  const $ = shell.asFluent();
  const result = await $(['echo', 'world']).result();
  expect(result.success).toBe(true);
  expect(result.stdout).toBe('world');
});
```

#### Test 3: Shell with live mode should reject asFluent()
```typescript
test('should throw when shell has live mode', () => {
  const shell = createShell({ outputMode: 'live' });
  expect(() => shell.asFluent()).toThrow(
    "FluentShell does not support outputMode: 'live'"
  );
});
```

#### Test 4: Override to live mode should throw
```typescript
test('should throw when overriding to live mode', async () => {
  const shell = createShell({ outputMode: 'capture' });
  const $ = shell.asFluent();
  await expect(async () => {
    await $(['echo', 'x'], { outputMode: 'live' as any });
  }).rejects.toThrow("FluentShell does not support outputMode: 'live'");
});
```

#### Test 5: Override to all mode should work
```typescript
test('should allow overriding to all mode', async () => {
  const shell = createShell({ outputMode: 'capture' });
  const $ = shell.asFluent();
  const result = await $(['echo', 'test'], { outputMode: 'all' }).result();
  expect(result.success).toBe(true);
  expect(result.stdout).toBe('test');
});
```

#### Test 6: Inherit mode from ShellOptions
```typescript
test('should inherit outputMode from ShellOptions', async () => {
  const shell = createShell({ outputMode: 'all' });
  const $ = shell.asFluent();
  const result = await $('echo inherited').result();
  expect(result.success).toBe(true);
  expect(result.stdout).toBe('inherited');
});
```

#### Test 7: Helper methods work in all mode
```typescript
test('should support toLines() in all mode', async () => {
  const shell = createShell({ outputMode: 'all' });
  const $ = shell.asFluent();
  const lines = await $`echo -e "line1\nline2"`.toLines();
  expect(lines).toEqual(['line1', 'line2']);
});

test('should support parse() in all mode', async () => {
  const shell = createShell({ outputMode: 'all' });
  const $ = shell.asFluent();
  const schema = z.object({ value: z.string() });
  const data = await $`echo '{"value":"test"}'`.parse(schema);
  expect(data.value).toBe('test');
});
```

#### Test 8: Memoization works with options
```typescript
test('should memoize execution with options', async () => {
  const shell = createShell({ outputMode: 'capture' });
  const $ = shell.asFluent();
  const handle = $(['echo', 'memo'], { outputMode: 'all' });

  const result1 = await handle.result();
  const result2 = await handle.result();

  expect(result1).toBe(result2); // Same object reference
});
```

#### Test 9: Error message validation
```typescript
test('should provide clear error message for live mode', () => {
  const shell = createShell({ outputMode: 'live' });
  expect(() => shell.asFluent()).toThrow(
    "FluentShell does not support outputMode: 'live'. " +
    "Use 'capture' or 'all', or call shell.run(..., { outputMode: 'live' }) instead."
  );
});
```

---

## Breaking Changes

### User-Facing Changes

1. **None for existing usage**: All current code using `$` without options continues to work
2. **New capability**: Users can now pass options to `$` function calls
3. **New restriction**: Shells with `outputMode: 'live'` cannot call `.asFluent()`

### Internal Changes

1. `DollarFunction` signature expanded (backward compatible)
2. `createLazyHandle()` signature changed (private method)
3. `asFluent()` implementation changed (behavior preserved for valid cases)

---

## Type Safety Considerations

### Compile-Time Safety

1. `FluentOutputMode` excludes `'live'` at type level
2. `FluentRunOptions<Mode>` enforces valid modes in type signature
3. `assertFluentMode()` provides type assertion for narrowing

### Runtime Safety

1. Validation at `asFluent()` level (shell configuration)
2. Validation at per-command level (options override)
3. Clear error messages guide users to alternatives

### Edge Cases

1. **Type casting workaround**: User forces `{ outputMode: 'live' as any }`
   - Caught by runtime validation in `assertFluentMode()`
   - Throws with helpful error message

2. **Null/undefined stdout in 'all' mode**:
   - `RunResult<false, 'all'>` = `SafeResult<true>` with `stdout: string | null`
   - Existing code handles this correctly
   - Helper methods like `.parse()` check for null stdout

---

## Documentation Updates

### Files to Update

1. **README.md**: Add examples of fluent API with `all` mode and options
2. **CLAUDE.md**: Document the new FluentShell behavior and restrictions
3. **JSDoc comments**: Already included in code examples above

### Key Points to Document

1. FluentShell supports `capture` and `all` modes only
2. `live` mode incompatible with fluent operations (why: no stdout for chaining)
3. Per-command mode override via options parameter
4. Error handling and error messages
5. Type safety guarantees

---

## Checklist

### Before Implementation
- [ ] Review spec.md and ensure understanding
- [ ] Review current implementation in `src/shell.ts`
- [ ] Plan test cases
- [ ] Consider edge cases and error scenarios

### During Implementation
- [ ] Add `FluentOutputMode` type
- [ ] Add `FluentRunOptions` type
- [ ] Update `DollarFunction` interface
- [ ] Add `assertFluentMode()` method
- [ ] Update `createLazyHandle()` signature and implementation
- [ ] Update `asFluent()` implementation
- [ ] Update `LazyCommandHandle` return types if needed
- [ ] Add JSDoc comments
- [ ] Fix any TypeScript errors

### After Implementation
- [ ] Run `pnpm check-types` (must pass)
- [ ] Run `pnpm test:ci` (must pass)
- [ ] Add new test suite for FluentShell outputMode support
- [ ] Verify all test cases pass
- [ ] Check code coverage (maintain >97%)
- [ ] Manual testing with various scenarios
- [ ] Update documentation (README, CLAUDE.md)
- [ ] Review error messages for clarity

---

## Success Criteria

1. ✅ All existing tests pass without modification
2. ✅ New test suite covers all specified test cases
3. ✅ TypeScript compilation succeeds with no errors
4. ✅ Code coverage remains above 97%
5. ✅ Error messages are clear and actionable
6. ✅ API is backward compatible for existing usage
7. ✅ Type safety prevents invalid mode usage at compile time
8. ✅ Runtime validation catches edge cases (type casting workarounds)
9. ✅ Documentation clearly explains new capabilities and restrictions

---

## Estimated Complexity

- **Type Definitions**: Low complexity, straightforward exclusion and extension
- **Validation Logic**: Low complexity, simple assertion function
- **Core Implementation**: Medium complexity, requires careful handling of options merging
- **Testing**: Medium complexity, comprehensive coverage of modes and edge cases
- **Documentation**: Low complexity, mostly examples and explanations

**Total Estimated Effort**: 2-3 hours for implementation and testing

---

## References

- **Spec Document**: `.agent/task-3/spec.md`
- **Current Implementation**: `src/shell.ts` lines 509-1039 (Shell class)
- **Type Definitions**: `src/shell.ts` lines 1-223
- **Test File**: `test/shell.test.ts`
- **CLAUDE.md**: Project documentation for AI assistants
