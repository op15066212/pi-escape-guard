#!/usr/bin/env node
// gate.mjs —— 本仓所有判据的总闸。
//
// 为什么有（2026-11-25）：本仓原来的总入口是 package.json 里一条手写串，靠人登记。
// 往 scripts/ 加一个新的 check-*.mjs，它不会自动进来——于是「写了判据但没人跑」
// 这件事会再发生一次，而那正是假绿的成因。现在靠 glob 发现，不靠登记。
//
// 每一步的顺序：带 --selftest 的，先跑 selftest 再跑正常模式。
// 不跑 selftest 的闸只能证明判据现在没报错，不能证明它还会报错。
// selftest 红了就不再跑正常模式——判据本身坏了，它给的「0 处对不上」没有意义。
//
// 三态口径（2026-11-27）：判据的退出码本来就分三种 —— 0 绿、1 判据失败、2 环境缺失。
// 早先本闸把 2 也写成「失败」，于是克隆到没有邻居仓的目录时 check-mirror 报 2，
// 整个 verify 变红：那不是在说代码坏，是在说这台机器没有对端仓。
// 一份报告混两种意思，人学会忽略它——比没有判据更坏。
// 现在分开报：绿 N / 红 N / 跳过 N（环境缺失），退出码 有红 1、有绿无红 0、全跳过 2。
//
// 跑法：node scripts/gate.mjs            期望 rc=0
//       node scripts/gate.mjs --selftest 造三个假判据，验分类口径
// 反例：往 scripts/ 塞一个返回 1 的 check-zzz-canary.mjs，本闸必须 rc=1 并点名。
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** 只看退出码：0 绿、1 红、2 及未知跳过。null（信号杀掉）算红——它没说完话。 */
export function classify(steps) {
  const green = steps.filter((s) => s.rc === 0);
  const red = steps.filter((s) => s.rc === 1 || s.rc === null || s.rc === undefined);
  const skip = steps.filter((s) => s.rc !== 0 && s.rc !== 1 && s.rc !== null && s.rc !== undefined);
  return { green, red, skip, rc: red.length ? 1 : green.length ? 0 : 2 };
}

if (process.argv.includes("--selftest")) {
  const cases = [
    ["三态各一条 → 绿 1 红 1 跳过 1", (() => { const c = classify([{ rc: 0 }, { rc: 1 }, { rc: 2 }]); return c.green.length === 1 && c.red.length === 1 && c.skip.length === 1; })()],
    ["有红时整体 rc=1", classify([{ rc: 0 }, { rc: 1 }]).rc === 1],
    ["只有绿 → rc=0", classify([{ rc: 0 }, { rc: 0 }]).rc === 0],
    ["全跳过 → rc=2（不能报绿）", classify([{ rc: 2 }, { rc: 2 }]).rc === 2],
    ["进程被信号杀掉（rc=null）算红，不算跳过", classify([{ rc: null }]).red.length === 1],
    ["rc=2 不算失败：它不进红", classify([{ rc: 0 }, { rc: 2 }]).red.length === 0]
  ];
  let bad = 0;
  for (const [name, ok] of cases) { console.log((ok ? "PASS  " : "FAIL  ") + name); if (!ok) bad++; }
  console.log(bad ? "selftest: " + bad + " 条不符" : "selftest: 分类口径对得上");
  process.exit(bad ? 1 : 0);
}

const files = fs.readdirSync(DIR).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
if (!files.length) { console.error("gate: 没有 check-*.mjs（rc=2，环境缺失）"); process.exit(2); }

const run = (full, args, ms = 300000) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [full, ...args], { stdio: "inherit", timeout: ms });
  return { rc: r.status, ms: Date.now() - t0 };
};

const steps = [];
let selfs = 0;
for (const f of files) {
  const full = path.join(DIR, f);
  const hasSelf = fs.readFileSync(full, "utf8").includes("--selftest");
  if (hasSelf) {
    const s = run(full, ["--selftest"]);
    selfs++;
    steps.push({ name: f + " --selftest", rc: s.rc });
    console.log((s.rc === 0 ? "OK   " : s.rc === 2 ? "env? " : "FAIL ") + f + " --selftest rc=" + s.rc + " " + s.ms + "ms");
    if (s.rc !== 0) continue;
  }
  const r = run(full, []);
  steps.push({ name: f, rc: r.rc });
  console.log((r.rc === 0 ? "OK   " : r.rc === 2 ? "env? " : "FAIL ") + f + (hasSelf ? "" : "（无 --selftest）") + " rc=" + r.rc + " " + r.ms + "ms");
}

if (selfs === 0) console.log("gate: 警告 —— " + files.length + " 条判据里没有一条带 --selftest，判据自身退化无人看守");
const c = classify(steps);
console.log("");
console.log("gate: " + files.length + " 个脚本，" + steps.length + " 步（其中 " + selfs + " 步是 selftest）：绿 " + c.green.length + " / 红 " + c.red.length + " / 跳过 " + c.skip.length + "（环境缺失）");
if (c.red.length) console.log("红：" + c.red.map((s) => s.name).join(", "));
if (c.skip.length) console.log("跳过：" + c.skip.map((s) => s.name).join(", ") + " —— 这台机器缺它们要的环境，不代表代码坏");
process.exit(c.rc);