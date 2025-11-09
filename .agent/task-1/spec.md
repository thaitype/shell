
## Short form

- export const shell = createShell({ verbose: true });

## cleaner shell api

- export const $ = shell.createFluentShell(); // in the library code of @thaitype/shell
or user need some custom config, user can do like this:

```ts
import { createShell } from '@thaitype/shell';
export const $ = createShell({ verbose: true }).createFluentShell();

```

for clean shell api usage:

the user can use the `$` to run shell command directly and get the result in promise. no need to use `.stdout` or `.stderr` to get the result.

```ts
import { $ } from '@thaitype/shell';

const files = await $('ls -la').toLines();
for(const file of files) {
  console.log(`File: ${file}`);
}
```

note: `toLines()` is a helper method to split the stdout by new line and return as array of strings.
also, user can use other helper methods like `parse(zodObjectSchema)` to parse the stdout into object using zod schema.


const data = await $('echo test');
await $(`mkdir ${data}`);


🔧 ตัวอย่างโค้ด $ แบบ Thenable Handle

import { execa } from "execa";

// แค่ helper ตัวเล็ก จำลอง execa
async function runCommand(cmd: string): Promise<string> {
  const { stdout } = await execa("bash", ["-lc", cmd]);
  return stdout.trim();
}

// พื้นฐานของ CommandHandle
type CommandHandle = PromiseLike<string> & {
  toLines(): Promise<string[]>;
  parse<T>(schema: { parse(x: any): T }): Promise<T>;
};

// ตัวสร้าง $
function $(cmd: string): CommandHandle {
  // ตัว Promise จริง ๆ ที่จะรันคำสั่ง
  const execPromise = runCommand(cmd);

  // สร้าง handle ว่าง ๆ ขึ้นมา
  const handle: Partial<CommandHandle> = {};

  // ทำให้ await handle ทำงานได้ (thenable)
  handle.then = execPromise.then.bind(execPromise);

  // เพิ่ม helper method ต่าง ๆ
  handle.toLines = () => execPromise.then((s) => s.split(/\r?\n/));
  handle.parse = (schema) =>
    execPromise.then((s) => schema.parse(JSON.parse(s)));

  // คืน handle (พร้อม type casting)
  return handle as CommandHandle;
}


⸻

💻 ตัวอย่างการใช้งานจริง

// ✅ ใช้แบบรับ stdout ตรง ๆ
const name = await $('echo hello');
console.log('Name:', name); // -> hello

// ✅ ใช้ helper แปลงเป็น array ของบรรทัด
const files = await $('ls -la').toLines();
for (const file of files) {
  console.log('File:', file);
}

// ✅ ใช้ parse() กับ Zod schema
import { z } from "zod";

const UserSchema = z.object({
  login: z.string(),
  id: z.number(),
});

const user = await $('gh api /user').parse(UserSchema);
console.log('User login:', user.login);


⸻

🧠 สรุปแนวคิด

ฟีเจอร์	ทำงานอย่างไร
await $('cmd')	ใช้ .then() ของ handle → คืน stdout (string)
await $('cmd').toLines()	เรียก helper ก่อน await → คืน string[]
await $('cmd').parse(schema)	เรียก helper ก่อน await → คืน object
await h; await h.toLines()	❌ ไม่ได้ เพราะ handle ถูก resolve แล้ว


⸻

✅ ข้อดีของดีไซน์นี้
	•	ใช้ได้ทั้งสองสไตล์
→ await $('echo hi') และ await $('ls').toLines()
	•	TypeScript จับได้หมด (เพราะ PromiseLike)
	•	ไม่ต้องมี class / instance แยกออกมา

