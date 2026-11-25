#!/usr/bin/env node
// 全量：对每个会话 jsonl 跑一遍 settle，汇总「还原了多少、有没有判失败」。
//
// 2026-11-25 发现它曾是个恒假绿：它 execFileSync 调 bin/measure.mjs，
// 那个文件在 8009c4f 已删（同一笔提交里 package.json 的 measure 脚本删了，
// 这里的引用漏了）。于是每个文件都在 catch 里 continue，最后输出
// {"files":19,"points":0} 且 rc=0——19 个文件、0 个点、0 个失败，
// 读起来像"全绿"，其实是**一个文件都没测**。
//
// 现在直接 import settle，不经过外部脚本。三种收场分开：
//   读到但全是 0 点       rc=0（可能真没污染）
//   一个文件都没读到       rc=2（环境坏了，不是代码对）
//   出现 settle 判失败     rc=1（真 bug：字节数对不上）
// 为什么必须分：混成一个码分不清"机器没装好"还是"代码坏"。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { settle } from "../src/scan.ts";

const MAX = 20 * 1024 * 1024; // 单文件上限：377MB 那个会话不该进日常档

function listJsonl(dir) {
  const out = [];
  const walk = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** 扫一批 jsonl。纯函数：给目录进，给统计出，不 exit。 */
export function survey(dir, th = 3, maxBytes = MAX) {
  const files = listJsonl(dir);
  let points = 0, chars = 0, failures = 0, unreadable = 0, tooBig = 0, scanned = 0;
  const failFiles = [];
  for (const f of files) {
    let text;
    try {
      if (fs.statSync(f).size > maxBytes) { tooBig++; continue; }
      text = fs.readFileSync(f, "utf8");
    } catch { unreadable++; continue; }
    scanned++;
    const r = settle(text, th);
    if (!r.ok) { failures++; failFiles.push(path.basename(f)); continue; }
    if (r.out !== text) { points++; chars += text.length - r.out.length; }
  }
  return { files: files.length, scanned, points, chars, failures, unreadable, tooBig, threshold: th, failFiles };
}

/** 三种收场各一个退出码。 */
export function rcOf(s) {
  if (s.scanned === 0) return 2;
  if (s.failures > 0) return 1;
  return 0;
}

// 自检：证明这个脚本会红，而不只是会绿。
// 恒绿的风险在这里特别高——路径错了、walk 崩了、settle 空转，都会静静地输出 0。
if (process.argv.includes("--selftest")) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "all-selftest-"));
  const sub = path.join(tmp, "s");
  fs.mkdirSync(sub, { recursive: true });
  // 有污染：三个连续中文转义，settle 该还原
  // 有污染：段前后是本行正文（body>=2），符合 settle 的 C3d；纯 JSON 里那种被引号夹着的不算。
  fs.writeFileSync(path.join(sub, "dirty.jsonl"), String.raw`{"t":"说明：\u4f60\u597d\u4e16 这三个字"}` + "\n", "utf8");
  // 干净：不含转义
  fs.writeFileSync(path.join(sub, "clean.jsonl"), '{"t":"你好世"}\n', "utf8");
  // 超大：必须被 tooBig 挡掉，不许读进来
  fs.writeFileSync(path.join(sub, "huge.jsonl"), "x".repeat(200), "utf8");

  const got = survey(sub, 3, 100); // maxBytes=100 → huge.jsonl(200B) 被挡
  const cases = [
    ["读到 2 个、挡掉 1 个超大", got.scanned === 2 && got.tooBig === 1],
    ["有污染的那个被数成 1 个点", got.points === 1],
    ["没有判失败", got.failures === 0],
    ["rc 是 0（读了、没失败、有点）", rcOf(got) === 0],
    ["空目录 → rc=2，不是 0", rcOf(survey(path.join(tmp, "nope"))) === 2],
    ["全干净 → rc=0 但 points=0", (() => {
      const d = path.join(tmp, "cleanonly");
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "a.jsonl"), '{"t":"你好世"}\n', "utf8");
      const s = survey(d);
      return s.points === 0 && s.scanned === 1 && rcOf(s) === 0;
    })()],
  ];
  let bad = 0;
  for (const [name, ok] of cases) { if (!ok) bad++; console.log((ok ? "PASS  " : "FAIL  ") + name); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad === 0 ? "selftest: 该红的红、该绿的绿" : "selftest: " + bad + " 条不符");
  process.exit(bad === 0 ? 0 : 1);
}

const R = path.join(process.env.USERPROFILE || "C:/Users/15066212pp", ".pi/agent/sessions");
const th = Number(process.argv[2] || 3);
const s = survey(R, Number.isFinite(th) ? th : 3);
console.log(JSON.stringify(s));
const rc = rcOf(s);
if (rc === 2) console.error("一个文件都没读到：" + R);
if (rc === 1) console.error("settle 判失败 " + s.failures + " 个文件（字节数对不上，真 bug）");
process.exit(rc);
