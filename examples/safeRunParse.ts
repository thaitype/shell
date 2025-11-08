import { createShell } from "src/shell.js";
import { z } from "zod";

const schema = z.object({
  username: z.string(),
});

async function main() {
  const shell = createShell({ verbose: true });
  const result = await shell.safeRunParse(`echo '{ "username1": "John"'`, schema);
  if(result.success) {
    console.log("Command Output:", result.data.username);
  } else {
    console.error("Validation Error:", result.error);
  }
}

main();