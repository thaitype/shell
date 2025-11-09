import { createShell } from "src/shell.js";
import { z } from "zod";

const azAccountShowResponse = z.object({
  name: z.string(),
  user: z.object({
    name: z.string(),
    type: z.string(),
  }),
});

async function main() {
  const shell = createShell();
  const result = await shell.runParse(`az account show`, azAccountShowResponse);
  console.log("Current Active username", result.user.name);
  console.log("Current Active Subscription Name", result.name);
}

main();