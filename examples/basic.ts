
import { Shell } from "src/shell.js";

async function main() {
  const shell = new Shell({ defaultOutputMode: 'live', verbose: true });
  const result = await shell.run("echo Hello, World!");
  console.log("Command Output:", result.stdout);
}

main();