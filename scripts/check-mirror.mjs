#!/usr/bin/env node
// check-mirror.mjs —— 同一份判据写在两个仓里时，两份的行为必须相同。
//
// 为什么有（2026-11-25）：check-doc-accuracy.mjs 在 pi-think-sentry 与 pi-escape-guard
// 各有一份。它们是抄来的，不是共享的。真实发生过的事故：sentry 那份 11-24 修掉了
// 「任何表格首格都当配置键」的误报，escape-guard 那份没跟着改，于是同一份判据
// 在两个仓上给出两个答案——一个说 0 处对不上，一个说 4 处。两边各自都自洽，
// 所以两边都不会红。
//
// 这条判据不改架构（不抽公共包，跨仓依赖太重），只钉住一件事：
// 喂同一批样本，两个 keysIn / pathsIn 必须给出同一个答案。
//
// rc: 0 两边一致｜1 有差异｜2 找不到对端（跨仓判据，对端不在就说不出口径）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PEER = path.resolve(here, "..", "pi-think-sentry", "scripts", "check-doc-accuracy.mjs");
const T = String.fromCharCode(96);

// 抽样：覆盖两边真实红过的四种形状。
export const SAMPLES = [
  // 1 配置小节里的表格首格是真键，两边都该收
  "## 配置\n\n| " + T + "on" + T + " | true |\n| " + T + "threshold" + T + " | 3 |",
  // 2 非配置小节里的输出示例字段，两边都不该收（这就是那 4 处误报的形状）
  "## 不进 pi 也能查\n\n" + T.repeat(3) + "json\n{\n  \"demos\": 1,\n  \"ok\": true\n}\n" + T.repeat(3),
  // 3 非配置小节里的度量名表格，两边都不该收
  "## 实测\n\n| " + T + "uniqRatio" + T + " | 0.75 |",
  // 4 路径提取
  "看 " + T + "src/index.ts" + T + " 与 " + T + "bin/all.mjs" + T,
  // 5 设置小节里的 JSON 键，两边都该收
  "## 设置\n\n\"min\": 4",
];

// 比一对模块。返回差异清单（空 = 一致）。
export function compare(mine, peer, samples = SAMPLES) {
  const diff = [];
  for (const s of samples) {
    const mk = JSON.stringify([...mine.keysIn(s)].sort());
    const pk = JSON.stringify([...peer.keysIn(s)].sort());
    if (mk !== pk) diff.push("keysIn 不一致 " + JSON.stringify(s.slice(0, 40)) + " 本仓=" + mk + " 对端=" + pk);
    const mp = JSON.stringify([...mine.pathsIn(s)].sort());
    const pp = JSON.stringify([...peer.pathsIn(s)].sort());
    if (mp !== pp) diff.push("pathsIn 不一致 " + JSON.stringify(s.slice(0, 40)) + " 本仓=" + mp + " 对端=" + pp);
  }
  return diff;
}

export async function check() {
  if (!fs.existsSync(PEER)) return { rc: 2, diff: [], why: "找不到对端 " + PEER };
  const mine = await import(pathToFileURL(path.join(here, "scripts", "check-doc-accuracy.mjs")).href);
  const peer = await import(pathToFileURL(PEER).href);
  return { rc: 0, diff: compare(mine, peer), why: "" };
}

// 自检：证明这条判据会红。
// 坏样本是一个只返回固定值的假 keysIn，与真实现必然不同。
// 关键在于它**能**被比出来：如果 compare 恒返回空，这条判据就是恒绿。
if (process.argv.includes("--selftest")) {
  const real = await import(pathToFileURL(path.join(here, "scripts", "check-doc-accuracy.mjs")).href);
  const stub = { keysIn: () => new Set(["___stub___"]), pathsIn: () => new Set(["___stub___"]) };
  const bad = compare(real, stub);
  const same = compare(real, real);
  const cases = [
    ["拿真实现与桩比，必须比出差异", bad.length > 0],
    ["拿真实现与它自己比，必须一致", same.length === 0],
    ["样本至少 4 条（否则覆盖不到四种形状）", SAMPLES.length >= 4],
  ];
  let n = 0;
  for (const [name, ok] of cases) { if (!ok) n++; console.log((ok ? "PASS  " : "FAIL  ") + name); }
  console.log(n === 0 ? "selftest: 该红的红、该绿的绿" : "selftest: " + n + " 条不符");
  process.exit(n === 0 ? 0 : 1);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const r = await check();
  if (r.rc === 2) { console.error("check-mirror: " + r.why); process.exit(2); }
  for (const d of r.diff) console.log("红  " + d);
  console.log("check-mirror: " + SAMPLES.length + " 条样本，差异 " + r.diff.length + " 处");
  process.exit(r.diff.length === 0 ? 0 : 1);
}
