
import { Shell } from "src/shell.js";

async function main() {
  const shell = new Shell();
  const result = await shell.run("echo Hello, World!");
  console.log("Command Output:", result.stdout);
}

main();