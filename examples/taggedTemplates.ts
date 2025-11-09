/**
 * Example demonstrating Tagged Template Literals with Lazy Execution
 *
 * Task-2 features:
 * - Tagged template support: $`echo hello`
 * - Function call support (backward compatible): $('echo hello')
 * - Lazy execution: command doesn't run until consumed
 * - Memoization: multiple consumptions share one execution
 * - .result() method for non-throwable execution
 */

import { createShell } from '../src/index.js';
import { z } from 'zod';

async function main() {
  console.log('=== Tagged Template Literals + Lazy Execution ===\n');

  // Create fluent shell function
  const $ = createShell({ verbose: false }).asFluent();

  console.log('--- Example 1: Tagged Template Basic ---');
  // Tagged template - new in task-2!
  const greeting = await $`echo hello`;
  console.log(`Result: ${greeting}\n`);

  console.log('--- Example 2: Tagged Template with Interpolation ---');
  // Interpolate values into template
  const name = 'world';
  const msg = await $`echo hello ${name}`;
  console.log(`Result: ${msg}\n`);

  console.log('--- Example 3: Multiple Interpolations ---');
  // Multiple interpolated values
  const a = 'foo';
  const b = 'bar';
  const c = 'baz';
  const result = await $`echo ${a} ${b} ${c}`;
  console.log(`Result: ${result}\n`);

  console.log('--- Example 4: Function Call (Backward Compatible) ---');
  // Function call syntax still works
  const funcResult = await $('echo "function call works"');
  console.log(`Result: ${funcResult}\n`);

  console.log('--- Example 5: Array Command ---');
  // Array syntax for precise argv control
  const arrayResult = await $(['echo', 'array', 'syntax']);
  console.log(`Result: ${arrayResult}\n`);

  console.log('--- Example 6: Non-throwable Execution with .result() ---');
  // Use .result() for non-throwable execution
  const successResult = await $`echo success`.result();
  console.log(`Success: ${successResult.success}`);
  console.log(`Stdout: ${successResult.stdout}`);
  console.log(`Exit code: ${successResult.exitCode}\n`);

  // Failed command with .result() - doesn't throw!
  const failResult = await $`sh -c "exit 42"`.result();
  console.log(`Success: ${failResult.success}`);
  console.log(`Exit code: ${failResult.exitCode}`);
  console.log(`Note: .result() never throws, even on failure!\n`);

  console.log('--- Example 7: Lazy Execution ---');
  // Command doesn't execute until consumed
  console.log('Creating handle (no execution yet)...');
  const lazyHandle = $`echo "I am lazy"`;
  console.log('Handle created, but command has not run yet!');
  console.log('Now consuming handle (execution starts)...');
  const lazyResult = await lazyHandle;
  console.log(`Result: ${lazyResult}\n`);

  console.log('--- Example 8: Memoization ---');
  // Multiple consumptions share one execution
  const memoHandle = $`echo "executed once"`;
  console.log('First consumption (executes):');
  const memo1 = await memoHandle;
  console.log('Second consumption (reuses):');
  const memo2 = await memoHandle;
  console.log('Third consumption with .result() (still reuses):');
  const memo3 = await memoHandle.result();
  console.log(`All three got same result: ${memo1 === memo2 && memo2 === memo3.stdout}\n`);

  console.log('--- Example 9: Tagged Template with .toLines() ---');
  // Combine tagged template with helper methods
  const lines = await $`printf "apple\nbanana\ncherry"`.toLines();
  console.log('Fruits:');
  lines.forEach((fruit, i) => {
    console.log(`  ${i + 1}. ${fruit}`);
  });
  console.log();

  console.log('--- Example 10: Tagged Template with .parse() ---');
  // Parse JSON output with Zod schema
  const PackageSchema = z.object({
    name: z.string(),
    version: z.string(),
  });

  const pkg = await $`cat package.json`.parse(PackageSchema);
  console.log(`Package: ${pkg.name} v${pkg.version}\n`);

  console.log('--- Example 11: Error Handling Comparison ---');
  // Throwable vs non-throwable
  try {
    console.log('Attempting throwable execution...');
    await $`sh -c "exit 1"`;
  } catch (error) {
    console.log(`Caught error (throwable): ${(error as Error).message.split('\n')[0]}`);
  }

  const safeResult = await $`sh -c "exit 1"`.result();
  console.log(`Non-throwable result: success=${safeResult.success}, exitCode=${safeResult.exitCode}\n`);

  console.log('--- Example 12: Chaining with Variables ---');
  // Use result of one command in another
  const dir = await $`echo test-dir`;
  console.log(`Got directory name: ${dir}`);

  const $dryRun = createShell({ dryRun: true }).asFluent();
  await $dryRun`mkdir ${dir}`;
  console.log(`Would create directory: ${dir} (dry run)\n`);

  console.log('--- Example 13: Complex Template ---');
  // More complex template with multiple parts
  const user = 'alice';
  const age = 30;
  const city = 'wonderland';
  const complexMsg = await $`echo "User: ${user}, Age: ${age}, City: ${city}"`;
  console.log(`Complex: ${complexMsg}\n`);

  console.log('✅ All examples completed successfully!');
}

main().catch(console.error);
