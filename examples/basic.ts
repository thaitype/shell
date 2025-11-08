
import { createShell } from "src/shell.js";

async function main() {
  const shell = createShell({ defaultOutputMode: 'live', verbose: true });
  const result = await shell.run("echo Hello, World!", { outputMode: 'capture', });
  console.log("Command Output:", result.stdout);
}

main();