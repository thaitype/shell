/**
 * Example demonstrating the Fluent Shell API
 *
 * The fluent shell API provides a cleaner, more ergonomic way to run shell commands
 * with helper methods for common output transformations.
 */

import { createShell } from '../src/index.js';
import { z } from 'zod';

async function main() {
  // Create a fluent shell function
  const $ = createShell({ verbose: false }).asFluent();

  console.log('=== Example 1: Direct await ===');
  // Direct await - returns stdout as string
  const result = await $('echo hello');
  console.log(`Result: ${result}`);

  console.log('\n=== Example 2: Using toLines() ===');
  // Split output into array of lines
  const files = await $('ls -la').toLines();
  console.log('Files:');
  for (const file of files.slice(0, 5)) {
    console.log(`  - ${file}`);
  }

  console.log('\n=== Example 3: Using parse() with Zod ===');
  // Parse JSON output with schema validation
  const PackageSchema = z.object({
    name: z.string(),
    version: z.string(),
    type: z.string().optional(),
  });

  const pkg = await $('cat package.json').parse(PackageSchema);
  console.log(`Package: ${pkg.name} v${pkg.version}`);

  console.log('\n=== Example 4: Chaining commands ===');
  // Use result of one command in another
  const data = await $('echo test-dir');
  console.log(`Creating directory: ${data}`);
  // Note: Using dry run to avoid actually creating the directory
  const $dryRun = createShell({ dryRun: true }).asFluent();
  await $dryRun(`mkdir ${data}`);

  console.log('\n=== Example 5: Working with multiple lines ===');
  // Process lines individually
  const lines = await $('printf "apple\\nbanana\\ncherry"').toLines();
  console.log('Fruits:');
  lines.forEach((fruit, index) => {
    console.log(`  ${index + 1}. ${fruit}`);
  });

  console.log('\n=== Example 6: Custom schema ===');
  // Use a custom schema object with parse method
  const customSchema = {
    parse: (data: any) => {
      return {
        ...data,
        uppercase: data.name ? data.name.toUpperCase() : 'UNKNOWN',
      };
    },
  };

  const customResult = await $('echo \'{"name":"fluent-shell"}\'').parse(customSchema);
  console.log(`Custom result: ${customResult.uppercase}`);

  console.log('\n✅ All examples completed successfully!');
}

main().catch(console.error);
