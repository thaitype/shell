import { createShell } from "src/shell.js";
import { z } from "zod";

const schema = z.object({
  username: z.string(),
});

async function main() {
  const shell = createShell({ verbose: true });
  const result = await shell.runParse(`echo '{ "username": "John" }'`, schema);
  console.log("Command Output:", result.username);
}

main();