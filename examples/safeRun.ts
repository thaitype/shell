import { createShell } from "src/shell.js";

async function main() {
  const shell = createShell({ defaultOutputMode: 'capture', verbose: true });
  const result = await shell.safeRun("echo Hello, World!");
  if (result.success) {
    console.log("Command Output:", result.stdout);
  } else {
    console.error("Command Error:", result.stderr);
  }
}

main();