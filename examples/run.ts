
import { createShell } from "src/shell.js";

async function main() {
  const shell = createShell({ defaultOutputMode: 'capture', verbose: true });
  const result = await shell.run("echo Hello, World!");
  console.log("Command Output:", result.stdout);
}

main();