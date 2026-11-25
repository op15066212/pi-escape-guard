#!/usr/bin/env node
// gate.mjs —— 本仓所有判据的总闸。
//
// 为什么有（2026-11-25）：本仓原来的总入口是 package.json 里一条手写串
//   verify = check-doc-accuracy --selftest && check-doc-accuracy && test && all --selftest
// 靠人登记。往 scripts/ 加一个新的 check-*.mjs，它不会自动进来——
// 于是「写了判据但没人跑」这件事会再发生一次，而这正是 npm run all 假绿的成因。
// 现在靠 glob 发现，不靠登记。
//
// 每一步的顺序：带 --selftest 的，先跑 selftest 再跑正常模式。
// 不跑 selftest 的闸只能证明判据现在没报错，不能证明它还会报错。
// selftest 红了就不再跑正常模式——判据本身坏了，它给的「0 处对不上」没有意义。
//
// 判据：跑完本目录全部 check-*.mjs，每个留自己的 rc，任一步非零则 rc=1。
// 反例：往 scripts/ 塞一个返回 1 的 check-zzz-canary.mjs，本闸必须 rc=1 并点名。
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(DIR).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
if (!files.length) { console.error("gate: 没有 check-*.mjs（rc=2，环境缺失）"); process.exit(2); }

const run = (full, args, ms = 300000) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [full, ...args], { stdio: "inherit", timeout: ms });
  return { rc: r.status ?? 1, ms: Date.now() - t0 };
};

let bad = 0, steps = 0, selfs = 0;
for (const f of files) {
  const full = path.join(DIR, f);
  const hasSelf = fs.readFileSync(full, "utf8").includes("--selftest");

  if (hasSelf) {
    const s = run(full, ["--selftest"]);
    steps++; selfs++;
    console.log((s.rc === 0 ? "OK   " : "FAIL ") + f + " --selftest rc=" + s.rc + " " + s.ms + "ms");
    if (s.rc !== 0) { bad++; continue; }
  }

  const r = run(full, []);
  steps++;
  console.log((r.rc === 0 ? "OK   " : "FAIL ") + f + (hasSelf ? "" : "（无 --selftest）") + " rc=" + r.rc + " " + r.ms + "ms");
  if (r.rc !== 0) bad++;
}

if (selfs === 0) console.log("gate: 警告 —— " + files.length + " 条判据里没有一条带 --selftest，判据自身退化无人看守");
console.log("gate: " + files.length + " 个脚本，" + steps + " 步（其中 " + selfs + " 步是 selftest），失败 " + bad);
process.exit(bad ? 1 : 0);
