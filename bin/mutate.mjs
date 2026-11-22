#!/usr/bin/env node
// mutate.mjs —— 消去：换第二个入口算一遍。
// 判据的引入是「npm test 期望 rc=0」；这里是另一半——把代码改坏，测试必须红。
// 只跑正样本会绿的东西不算判据；这一份就是那根会红的针。
//
// 一个关键区分（2026-11-22 实测得出）：变异分两种，
//   唯一防线（unique）——删了它，某条测试必须红。不红 = 判据有缺口，报错。
//   冗余防线（redundant）——同一判断在别处还有一层，删了行为不变、测试仍绿。
//     那不是缺口，是多层防御（AGENTS.md P1：每层要指名它挡的已发生事故）。
// 把两者混在一起报，「漏 N 条」这个数字就没有意义了。
//
// 用法：
//   node bin/mutate.mjs              跑全部变异
//   node bin/mutate.mjs --unique     只跑唯一防线（CI 用这个，要求全抓住）
//   node bin/mutate.mjs --limit 3    只跑前 3 条
//
// rc: 0 唯一防线全被抓住｜1 有唯一防线没被抓住（真缺口）｜2 环境缺失
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const LIMIT = arg("--limit") ? Number(arg("--limit")) : Infinity;
const ONLY_UNIQUE = process.argv.includes("--unique");

// [文件, 原文, 替换成, 它守哪条规则, 是否唯一防线]
const MUTANTS = [
	["src/scan.ts", 'if (!text.includes("\\\\u")) return { ok: true, out: text };', 'if (false) return { ok: true, out: text };', "C1 无转义短路", false],
	["src/scan.ts", ".length < threshold) continue;", ".length <= threshold) continue;", "C4 阈值边界（< 改 <=）", true],
	["src/scan.ts", "if (bs % 2 === 1) continue;", "", "C1 双重转义：反斜杠奇偶", false],
	["src/scan.ts", "if (/\\\\u[0-9a-fA-F]{4}/.test(decoded)) continue;", "", "C1 解完还含字面转义", false],
	["src/scan.ts", "if (fence) continue;", "", "C3 围栏内是代码上下文", false],
	["src/config.ts", "threshold: 3 };", "threshold: 1 };", "C4 默认阈值 3", false],
	["src/verdict.ts", "if (msg.role !== role) return false;", "", "输出形状：message_end 必须保住 role", true],
	["src/verdict.ts", 'if (!Array.isArray(content)) return false;', "", "输出形状：tool_result 的 content 必须是数组", true],
];

const list = MUTANTS.filter((m) => !ONLY_UNIQUE || m[4]).slice(0, LIMIT);
if (list.length === 0) { console.log("没有可跑的变异"); process.exit(2); }

let missed = 0, redundant = 0, dead = 0, caughtN = 0;
for (const [file, from, to, why, unique] of list) {
	const abs = path.join(here, file);
	if (!fs.existsSync(abs)) { console.log("缺文件 " + file); process.exit(2); }
	const orig = fs.readFileSync(abs, "utf8");
	if (!orig.includes(from)) {
		console.log("DEAD  " + why + "（原文不在 " + file + " 里——这条变异是死的）");
		dead++;
		continue;
	}
	fs.writeFileSync(abs, orig.replace(from, to));
	let caught = false;
	try { execSync("npm test", { cwd: here, stdio: ["ignore", "pipe", "pipe"], timeout: 180000 }); }
	catch { caught = true; }
	finally { fs.writeFileSync(abs, orig); }
	if (caught) { caughtN++; console.log((unique ? "抓住  " : "抓住(冗余)  ") + why); }
	else if (unique) { missed++; console.log("漏    " + why + " —— 唯一防线被删而测试没红（判据缺口）"); }
	else { redundant++; console.log("冗余  " + why + " —— 删了行为不变，别处还有同一判断"); }
}
console.log("mutate: " + list.length + " 条｜抓住 " + caughtN + "｜唯一防线漏 " + missed + "｜冗余 " + redundant + "｜死 " + dead);
process.exit(missed === 0 && dead === 0 ? 0 : 1);
