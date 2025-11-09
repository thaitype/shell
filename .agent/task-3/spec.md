

🧩 FluentShell Design Spec (v2)

1. วัตถุประสงค์
	•	ทำให้ FluentShell (asFluent() / $) สอดคล้องกับ ShellOptions
	•	จำกัดการใช้งานให้รองรับเฉพาะ capture และ all mode
(เนื่องจาก FluentShell ต้องมี stdout สำหรับการ parse และ memoize)
	•	อนุญาตให้ $ override outputMode ต่อคำสั่งได้ แต่ห้ามใช้ 'live'
	•	คงรูปแบบการเรียกทั้ง “tagged template” และ “function call” ไว้เหมือนเดิม

⸻

2. OutputMode Policy

Mode	FluentShell	เหตุผล
'capture'	✅ อนุญาต	มี stdout สำหรับ parse และ memoize
'all'	✅ อนุญาต	แสดงผลสด + ยัง capture stdout ได้
'live'	❌ ห้ามใช้	ไม่มี stdout → chain ต่อไม่ได้


⸻

3. Type Definitions

/** Mode ที่ FluentShell อนุญาตให้ใช้ */
type FluentOutputMode = Exclude<OutputMode, 'live'>;

/** RunOptions ที่จำกัดไม่ให้ใช้ live mode */
type FluentRunOptions<M extends FluentOutputMode = FluentOutputMode> =
  Omit<RunOptions<M>, 'outputMode'> & {
    outputMode?: M;
  };

/**
 * FluentShell function type
 * รองรับทั้ง template call และ function call
 */
export interface DollarFunction {
  /** Tagged template call — `` $`echo ${name}` `` */
  (parts: TemplateStringsArray, ...values: any[]): LazyCommandHandle;

  /** Function call — $('echo hi') หรือ $(['echo', 'hi'], { ...options }) */
  (command: string | string[], options?: FluentRunOptions): LazyCommandHandle;
}


⸻

4. พฤติกรรมการเลือก outputMode

ลำดับการตัดสินใจ (effective mode)
	1.	ถ้าเรียก $([...], options) → ใช้ options.outputMode
	2.	ถ้าไม่มีใน options → ใช้ this.outputMode จาก ShellOptions
	3.	ถ้า mode ที่ได้คือ 'live' → throw Error

⸻

5. พฤติกรรม asFluent()

กติกา
	•	ถ้า Shell ถูกสร้างด้วย outputMode: 'live' → throw ทันทีเมื่อเรียก asFluent()
	•	ภายใน $ ต้องตรวจอีกชั้น เผื่อผู้ใช้ส่ง { outputMode: 'live' } ใน options

ตัวอย่างโค้ด (pseudo-implementation)

public asFluent(): DollarFunction {
  if (this.outputMode === 'live') {
    throw new Error(
      "FluentShell does not support `outputMode: 'live'`. " +
      "Use `shell.run(..., { outputMode: 'live' })` instead."
    );
  }

  const $impl = (first: any, ...rest: any[]): LazyCommandHandle => {
    // ✅ Tagged template
    if (Array.isArray(first) && 'raw' in first) {
      const command = this.processTaggedTemplate(first as TemplateStringsArray, rest);
      const mode = this.outputMode;
      this.assertFluentMode(mode);
      return this.createLazyHandle(command, { outputMode: mode });
    }

    // ✅ Function call
    const command = first as string | string[];
    const maybeOptions = rest[0] as FluentRunOptions | undefined;
    const mode = (maybeOptions?.outputMode ?? this.outputMode) as OutputMode;
    this.assertFluentMode(mode);
    return this.createLazyHandle(command, { ...(maybeOptions ?? {}), outputMode: mode });
  };

  return $impl as DollarFunction;
}

private assertFluentMode(mode: OutputMode) {
  if (mode === 'live') {
    throw new Error(
      "FluentShell does not support `outputMode: 'live'`. " +
      "Use 'capture' or 'all', or call `shell.run(..., { outputMode: 'live' })`."
    );
  }
}


⸻

6. createLazyHandle() Behavior
	•	รับ RunOptions<OutputMode> (ที่ผ่าน assert แล้วว่าไม่ใช่ live)
	•	ใช้โหมดที่ได้จริง (effectiveOptions.outputMode)
	•	ไม่บังคับ capture ภายในอีกต่อไป
(ใช้ค่าที่ resolve แล้วจาก ShellOptions หรือ override)

private createLazyHandle(
  command: string | string[],
  effectiveOptions: RunOptions<FluentOutputMode>
): LazyCommandHandle {
  let executionPromise: Promise<RunResult<false, FluentOutputMode>> | null = null;

  const start = (): Promise<RunResult<false, FluentOutputMode>> => {
    if (!executionPromise) {
      executionPromise = this.safeRun(command, effectiveOptions);
    }
    return executionPromise;
  };

  // ... other fluent methods: await handle / result / toLines / parse / safeParse
  return handle as LazyCommandHandle;
}


⸻

7. ตัวอย่างการใช้งาน

✅ ใช้ค่าจาก ShellOptions (capture mode)

const shell = createShell({ outputMode: 'capture' });
const $ = shell.asFluent();

const text = await $`echo hello`;
console.log(text); // 'hello'

✅ ใช้ all mode (แสดงผล + capture)

const shell = createShell({ outputMode: 'all' });
const $ = shell.asFluent();

const r = await $(['echo', 'world'], { outputMode: 'all' }).result();
console.log(r.stdout); // 'world'

❌ พยายามใช้ live mode

const shell = createShell({ outputMode: 'live' });
shell.asFluent(); // ❌ throw Error: "FluentShell does not support live mode"

const $ = createShell({ outputMode: 'capture' }).asFluent();
await $(["echo", "x"], { outputMode: "live" }); // ❌ throw Error


⸻

8. ข้อความ error มาตรฐาน

FluentShell does not support outputMode: 'live'.
Use 'capture' or 'all', or call shell.run(..., { outputMode: 'live' }) instead.

⸻

9. Test Cases ที่ควรมี

Case	Input	Expected
Shell capture mode + $ template	$ ใช้งานได้ คืน stdout	✅
Shell all mode + $ string call	$(['echo','x']) → แสดงผล + capture stdout	✅
Shell live mode + .asFluent()	throw	✅
$([...], { outputMode: 'live' })	throw	✅
$([...], { outputMode: 'all' })	ทำงานได้, แสดงผล + capture	✅
$([...]) → inherit จาก ShellOptions	ถูกต้องตาม mode	✅
.toLines(), .parse() ใน all mode	ทำงานได้	✅
.result() memoize ได้	✅	


⸻

🔧 สรุปการเปลี่ยนแปลงหลักจากสเปคเดิม

เดิม	ใหม่
บังคับ capture ในทุก $	ยึดค่าจาก ShellOptions
ไม่มี override ต่อคำสั่ง	เพิ่ม override ผ่าน $([...], options)
ไม่ตรวจ live mode	ตรวจสองชั้น (ใน asFluent() และในแต่ละ $)
Signature ของ $ มี overload แยก no-opt	รวมเป็น `(command: string


⸻

ผลลัพธ์สุดท้าย:
FluentShell จะทำงาน ปลอดภัย, predictable, type-safe,
รองรับทั้งโหมด capture และ all,
และมี DX ที่ดีด้วย error message ชัดเจนสำหรับ live mode.