นี่คือ Design Spec สำหรับ $ ที่รองรับทั้ง tagged template และการเรียกแบบฟังก์ชัน $(…) โดยคง lazy execution และมี .result() เป็น non-throwable finalizer

เป้าหมาย
	•	เรียกใช้สั้นแบบ DSL:
	•	await $echo hi`` → คืน stdout (throwable)
	•	await $exit 2.result() → คืน { success, stdout, stderr, exitCode } (non-throwable)
	•	รองรับสองรูปแบบอินพุต: tagged template และ function call (string หรือ string[])
	•	เป็น lazy จริง: ค่อยเริ่มรันเมื่อถูก “consume” ครั้งแรก (เช่น await, .result(), .toLines(), .parse())

พฤติกรรมหลัก
	•	$ คืนค่าเป็น Thenable Command Handle (อ็อบเจ็กต์ที่ await ได้ + มีเมธอด helper)
	•	เส้นทาง throwable: await $(…) หรือ await $…`` → ถ้า exit code ≠ 0 ให้โยนข้อผิดพลาด
	•	เส้นทาง non-throwable: await $(…).result() → คืนอ็อบเจ็กต์ผลแบบปลอดภัย
	•	ทุกเมธอด/การ await ภายใต้ handle เดียวกัน แชร์ execution เดียว (memoize)

รูปแบบอินพุตที่รองรับ
	•	Tagged template:

$`echo ${name} and ${age}`

ส่วน literal ใช้เป็นโครงคำสั่ง, ส่วน interpolation ทุกตัวถือเป็น “อาร์กิวเมนต์เดี่ยว” (ภายหลังค่อยเติม escaping/argv-safe)

	•	Function call:
	•	$(string) → ตัวช่วยง่าย, เหมาะข้อความคำสั่งดิบ
	•	$(string[]) → คุม argv ตรง ๆ เช่น $(["bash","-lc","ls -la"])

สัญญา (Contract) ของผลลัพธ์
	•	Thenable Command Handle: PromiseLike<string> & Helpers
	•	await handle → stdout: string (throwable)
	•	handle.result(): Promise<Result> → non-throwable
	•	handle.toLines(): Promise<string[]> → แปลง stdout เป็นอาเรย์บรรทัด
	•	handle.parse(schema): Promise<T> → แปลง stdout ด้วยสคีมา (throw เมื่อ invalid)
	•	Result (non-throwable):

type Result = {
  success: boolean;        // exitCode === 0
  stdout: string;
  stderr: string;
  exitCode?: number;       // undefined เมื่อ process ไม่ได้เริ่ม/ล้มก่อน start
}



การออกแบบภายใน (สำคัญต่อความ “lazy”)
	•	ตัว $ ไม่รันทันที; จะสร้าง executor แบบ deferred:
	•	start(): Promise<Result> สร้างขึ้นครั้งแรกที่ถูกเรียก แล้ว memoize
	•	ทุกเมธอด (then, result, toLines, parse) จะเรียก start() ก่อนใช้งาน
	•	การทำงานของ then:
	•	เรียก start() → ได้ Promise<Result>
	•	ถ้า result.success === false ให้สร้างและ throw ข้อผิดพลาด (รูปแบบข้อความตาม throwMode)
	•	ถ้า success === true ส่ง result.stdout เข้าสู่ onFulfilled
	•	การทำงานของ .result()/.toLines()/.parse():
	•	เรียก start() แล้ว map ผล โดย ไม่ เริ่ม process ซ้ำ

การแตกโอเวอร์โหลด (Type Signature โดยย่อ)

// 1) tagged template
function $(
  parts: TemplateStringsArray, ...vals: any[]
): CommandHandle;

// 2) string
function $(cmd: string): CommandHandle;

// 3) argv
function $(argv: string[]): CommandHandle;

// Thenable handle
type CommandHandle = PromiseLike<string> & {
  result(): Promise<Result>;
  toLines(): Promise<string[]>;
  parse<T>(schema: { parse(x: unknown): T }): Promise<T>;
};

Error Model
	•	เส้นทาง await $… → throwable by default
	•	ถ้าอยากไม่โยน ให้ใช้ .result() เสมอ
	•	รูปแบบข้อความข้อผิดพลาดควบคุมได้ด้วย throwMode: "simple" | "raw" ที่ระดับอินสแตนซ์ Shell/$
	•	ในอนาคตเพิ่ม .result({ includeTiming: true }) ได้โดยไม่กระทบสัญญาหลัก

ตัวอย่างการใช้งาน

// Throwable (สั้นสุด)
const who = await $`whoami`;               // 'mildr'

// Non-throwable
const r = await $`exit 2`.result();        // { success:false, exitCode:2, stdout:'', stderr:'...' }
if (!r.success) console.warn(r.exitCode, r.stderr);

// Helper
const files = await $`ls -la`.toLines();
const user  = await $`gh api /user`.parse(UserSchema);

// Function call forms
const text  = await $('echo hello');
const list  = await $(['bash','-lc','printf "a\nb"']).toLines();

กติกาพิเศษ (ภายหลังค่อยเติม)
	•	Escaping & argv-safe: interpolation ใน template จะถูกแปลงเป็นอาร์กิวเมนต์เดี่ยวเสมอ (กันแตกคำ)
	•	Pipeline/Redirection: แยกเป็นโหมด shell ชัดเจน เช่น $sh\ls | grep x`หรือ.withShell()`
	•	Interactive stdin: auto-inherit เมื่อ .live() หรือส่ง { stdin: 'inherit' } รายคำสั่งได้
	•	Memoization: handle เดียวกัน ถูก consume หลายแบบต้องอาศัยผลจาก execution เดียว

เหตุผลที่ดีไซน์นี้ตอบโจทย์
	•	API เรียบ สั้น ใช้ได้ทั้งสองสไตล์ โดยยังคง lazy จริง
	•	ไม่บังคับผู้ใช้เลือกระหว่าง template vs function; ทั้งสองทางวิ่งเข้า กลไกเดียวกัน
	•	แยก throwable vs non-throwable แบบชัดเจนผ่าน await กับ .result()
	•	ขยายต่อได้ง่าย: .json(), .safeParse(), .csv(), .stream(), .timing() โดยไม่ทำลายสัญญาหลัก

สรุป: ใช้ $ เป็น thenable handle ที่รองรับ tagged template และ $(…) พร้อม .result() เป็น non-throwable finalizer จะได้ API ที่สวย, lazy, และขยายได้ในอนาคต.