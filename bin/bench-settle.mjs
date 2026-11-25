#!/usr/bin/env node
// bench-settle.mjs —— settle() 的耗时（Ax4 有界：每个文本块都跑）。
//
// 为什么需要它：tool_result 与 message_end 对**每一个文本块**调一次 settle。
// 一次工具返回可能带十几块，每块几 KB 到几百 KB。单块 10ms 就是一次工具调用多 100ms。
//
// 跑法：node --experimental-strip-types bin/bench-settle.mjs
// 不设阈值：耗时随机器变，卡绝对值会把"换台慢机"判成回归。
import { settle } from "../src/scan.ts";

const R = 200;

// 三种输入，对应 settle 的三条路：
//   有污染（真的还原） / 干净（含 \u 但不成段） / 完全无 \u（最快路径）
const dirty = (n) => Array.from({ length: n }, () => "说明：\\u4f60\\u597d\\u4e16 这三个字").join("\n");
const clean = (n) => Array.from({ length: n }, (_, i) => "第" + i + " 行是普通中文内容，没有任何转义。").join("\n");
const tiny = (n) => Array.from({ length: n }, () => "一个 \\u4f60 单独出现，不够数").join("\n");

const per = (text, th = 3) => {
  settle(text, th); settle(text, th);
  const t0 = performance.now();
  for (let i = 0; i < R; i++) settle(text, th);
  return (performance.now() - t0) / R;
};

console.log("单次 settle（重复 " + R + " 次取均）");
for (const [name, make] of [["有污染", dirty], ["无转义", clean], ["不够数", tiny]]) {
  for (const n of [100, 1000, 5000]) {
    const t = make(n);
    const r = settle(t, 3);
    const changed = r.out !== t;
    console.log(
      "  " + name.padEnd(4) + " " + String(t.length).padStart(7) + " 字   " +
      per(t).toFixed(4).padStart(8) + " ms   " + (changed ? "改了" : "没改")
    );
  }
}
