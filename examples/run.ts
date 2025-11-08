
import { createShell } from "src/shell.js";

async function main() {
  const shell = createShell({
    outputMode: 'capture',
    verbose: true
  });
  const result = await shell.run("echo Hello, World!");
  console.log("Command Output:", result.stdout);
}

main();