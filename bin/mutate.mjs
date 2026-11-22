#!/usr/bin/env node
// mutate.mjs —— 消去：换第二个入口算一遍。
// 判据的引入是「npm test 期望 rc=0」；这里是另一半——把代码改坏，测试必须红。
// 只跑正样本会绿的东西不算判据；这一份就是那根会红的针。
//
// 用法：
//   node bin/mutate.mjs              跑全部变异，逐条报告是否被抓住
//   node bin/mutate.mjs --limit 3    只跑前 3 条
//   node bin/mutate.mjs --file src/scan.ts
//
// rc: 0 每条变异都被测试抓住｜1 有变异没被抓住（判据漏了）｜2 环境缺失
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const LIMIT = arg("--limit") ? Number(arg("--limit")) : Infinity;
const ONLY = arg("--file");

// 每条：文件 · 原文 · 替换成 · 它守的是哪条规则
// 原文必须逐字节出现在文件里，否则这条变异是死的（脚本会报出来）。
const MUTANTS = [
	["src/scan.ts", 'if (!text.includes("\\\\u")) return { ok: true, out: text };', 'if (false) return { ok: true, out: text };', "C1 no-op 短路：没有转义也走还原路径"],
	["src/scan.ts", ".length < threshold) continue;", ".length <= threshold) continue;", "C4 阈值边界（< 改成 <=）"],
	["src/scan.ts", "if (bs % 2 === 1) continue;", "", "C1 双重转义：反斜杠奇偶检查"],
	["src/scan.ts", "if (/\\\\u[0-9a-fA-F]{4}/.test(decoded)) continue;", "", "C1 解完还含字面转义"],
	["src/scan.ts", "if (fence) continue;", "", "C3 围栏内是代码上下文，一律不碰"],
	["src/config.ts", "threshold: 3 };", "threshold: 1 };", "C4 默认阈值 3 个起算"],
	["src/verdict.ts", "if (msg.role !== role) return false;", "", "输出形状：message_end 必须保住 role"],
];

const list = MUTANTS.filter((m) => !ONLY || m[0] === ONLY).slice(0, LIMIT);
if (list.length === 0) { console.log("没有可跑的变异（--file 写错了？）"); process.exit(2); }

let missed = 0;
let dead = 0;
for (const [file, from, to, why] of list) {
	const abs = path.join(here, file);
	if (!fs.existsSync(abs)) { console.log("缺文件 " + file); process.exit(2); }
	const orig = fs.readFileSync(abs, "utf8");
	if (!orig.includes(from)) {
		// 原文找不到 = 这条变异是死的。它比「没抓住」更坏：看着在防，其实什么都没改。
		console.log("DEAD  " + why + "（原文不在 " + file + " 里）");
		dead++;
		continue;
	}
	fs.writeFileSync(abs, orig.replace(from, to));
	let caught = false;
	try {
		execSync("npm test", { cwd: here, stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });
	} catch {
		caught = true; // 测试红了 = 变异被抓住
	} finally {
		fs.writeFileSync(abs, orig);
	}
	if (caught) console.log("抓住  " + file + "  " + why);
	else { console.log("漏    " + file + "  " + why + " —— 测试没红"); missed++; }
}
console.log("mutate: " + list.length + " 条变异，抓住 " + (list.length - missed - dead) + "，漏 " + missed + "，死 " + dead);
process.exit(missed === 0 && dead === 0 ? 0 : 1);
