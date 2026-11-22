#!/usr/bin/env node
// 全量：对每个 jsonl 跑一次 measure.mjs --apply，汇总恒等式是否处处成立。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const R = path.join(process.env.USERPROFILE || "C:/Users/15066212pp", ".pi/agent/sessions");
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : e.name.endsWith(".jsonl") && files.push(p); } };
walk(R);
let P = 0, S = 0, E = 0, skip = 0;
const failFiles = [], why = {};
for (const f of files) {
  let o;
  try { o = JSON.parse(execFileSync(process.execPath, ["bin/measure.mjs", f, "--apply"], { encoding: "utf8" })); } catch { continue; }
  P += o.points; S += o.saved_bytes || 0; E += o.expected || 0; skip += o.skipped;
  for (const [k, v] of Object.entries(o.why || {})) why[k] = (why[k] || 0) + v;
  if (o.verdict !== "PASS" && o.points > 0) failFiles.push(o.file);
}
console.log(JSON.stringify({ files: files.length, points: P, saved: S, expected: E, ratio: E ? Number((S / E).toFixed(6)) : null, skipped: skip, why, failFiles }, null, 0));
