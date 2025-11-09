# Pre-Development Plan: Fluent Shell API

## Overview
Implement a fluent shell API that provides a cleaner, more ergonomic interface for running shell commands with helper methods for common output transformations.

## Goals
- Create `asFluent()` method on Shell class that returns a `$` function
- Implement `CommandHandle` as a `PromiseLike<string>` with helper methods
- Support direct awaiting: `await $('echo test')` returns stdout as string
- Support helper methods before await: `await $('ls').toLines()` returns array of lines
- Support schema parsing: `await $('gh api /user').parse(UserSchema)` with Zod-like schemas

## Architecture Design

### 1. CommandHandle Type
```typescript
type CommandHandle = PromiseLike<string> & {
  toLines(): Promise<string[]>;
  parse<T>(schema: { parse(x: any): T }): Promise<T>;
};
```

### 2. Fluent Shell Function Signature
```typescript
export type FluentShellFn = (command: string | string[]) => CommandHandle;
```

### 3. Shell Class Extension
Add method to Shell class:
```typescript
class Shell {
  // ... existing methods ...

  asFluent(): FluentShellFn {
    // Implementation
  }
}
```

## Implementation Steps

### Step 1: Define Types
- Create `CommandHandle` interface in `src/shell.ts`
- Create `FluentShellFn` type alias
- Ensure types are exported from `src/index.ts`

### Step 2: Implement asFluent() Method
Add to Shell class:
- Return a function that accepts command (string | string[])
- Function returns CommandHandle instance
- Leverage existing `run()` method for execution
- Handle output mode appropriately (should default to 'capture')

### Step 3: Implement CommandHandle
Create CommandHandle by:
- Execute command via `this.run()` to get a promise
- Create an object that implements `PromiseLike<string>`
- Bind the promise's `.then()` method to make it thenable
- Add helper methods:
  - `toLines()`: Split stdout by newlines (`/\r?\n/`)
  - `parse(schema)`: Parse stdout as JSON, then validate with schema

### Step 4: Handle Edge Cases
- Empty stdout handling in `toLines()`
- JSON parse errors in `parse()`
- Propagate errors from underlying command execution
- Consider output modes (only 'capture' makes sense for fluent API)

### Step 5: Add Tests
Create tests in `test/shell.test.ts`:
- Direct await: `await $('echo test')` returns 'test'
- toLines(): `await $('printf "a\nb\nc"').toLines()` returns ['a', 'b', 'c']
- parse(): `await $('echo \'{"key":"value"}\'').parse(schema)` returns object
- Error propagation when command fails
- Test with both string and array command formats

### Step 6: Add Usage Examples
Update or create example files showing:
- Basic usage: `const result = await $('ls -la')`
- Using toLines(): `const files = await $('ls').toLines()`
- Using parse() with Zod schema
- Custom shell config: `createShell({ verbose: true }).asFluent()`

## Technical Considerations

### PromiseLike Implementation
The key pattern from the spec:
```typescript
const execPromise = this.run(command);
const handle: Partial<CommandHandle> = {};

// Make it thenable
handle.then = execPromise.then.bind(execPromise);

// Add helpers
handle.toLines = () => execPromise.then(s => s.split(/\r?\n/));
handle.parse = (schema) => execPromise.then(s => schema.parse(JSON.parse(s)));

return handle as CommandHandle;
```

### Output Mode Behavior
- Fluent API should use 'capture' mode by default
- 'live' mode doesn't make sense (returns null for stdout)
- Could potentially allow override via options

### Error Handling
- Command execution errors should propagate through the promise chain
- JSON parse errors in `parse()` should also propagate
- Schema validation errors should propagate from schema.parse()

### Type Safety
- `parse()` should infer return type `T` from schema
- Ensure TypeScript properly recognizes `CommandHandle` as both awaitable and having helper methods
- Return type of direct await should be `string`
- Return type of `toLines()` should be `Promise<string[]>`
- Return type of `parse(schema)` should be `Promise<T>`

## Files to Modify

1. `src/shell.ts`
   - Add `CommandHandle` type
   - Add `FluentShellFn` type
   - Add `asFluent()` method to Shell class

2. `src/index.ts`
   - Export new types: `CommandHandle`, `FluentShellFn`

3. `test/shell.test.ts`
   - Add test suite for fluent API

4. Examples (optional)
   - Create or update examples showing fluent API usage

## Success Criteria

- ✅ `const $ = createShell().asFluent()` works
- ✅ `await $('echo test')` returns 'test'
- ✅ `await $('ls').toLines()` returns array of lines
- ✅ `await $('echo \'{"a":1}\'').parse(schema)` parses JSON
- ✅ All tests pass
- ✅ TypeScript compilation succeeds with no errors
- ✅ Proper error propagation from failed commands
- ✅ Clean API that matches the spec examples

## Non-Goals (Out of Scope)

- Modifying existing `run()`, `safeRun()`, or `execute()` methods
- Changing how the Shell class handles stdio/output modes
- Adding new command execution logic (reuse existing methods)
- Supporting chaining of helper methods (not required by spec)
- Supporting options override in fluent API (can be added later if needed)

## Notes

- The fluent API is a convenience layer on top of existing Shell functionality
- It should delegate to `run()` for actual execution
- Focus on developer ergonomics and type safety
- Keep implementation simple - it's essentially a wrapper with helper methods
