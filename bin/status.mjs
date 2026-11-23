// 从命令行看转义还原的门槛，不需要 pi 进程，也不需要人替我把输出贴过来。
//
// 与 /escape-guard 命令同一个口径（同一份 DEMOS、同一个 settle），
// 区别只在入口：命令给使用者，这个给脚本和 agent。
//
// 退出码：0 正常，1 三种样例里有一条不符合预期（判据失败），2 配置文件读不出
import fs from "node:fs";
import path from "node:path";
import { readConfig } from "../src/config.ts";
import { settle } from "../src/scan.ts";

const dir = path.join(import.meta.dirname, "..");

const cfg = readConfig();
// want 不能写死：门槛是可配的，写死就会出现「threshold=6 时这条判据自己红」。
// 从规则推导：段内转义数 ≥ 门槛才还原；围栏内永远不动（那不是门槛，是位置）。
const count = (s) => (s.match(/\\u[0-9a-fA-F]{4}(?:\\[nt])?/g) || []).length;
const DEMOS = [
  { label: "该还原", text: "\\u4f60\\u53ef\\u4ee5\\u5e2e\\u6211", want: count("\\u4f60\\u53ef\\u4ee5\\u5e2e\\u6211") >= cfg.threshold },
  { label: "不够数", text: "\\u4f60", want: count("\\u4f60") >= cfg.threshold },
  // 围栏内的正则：动了代码就坏。这条是「不该动」里最要紧的一条，与门槛无关。
  { label: "代码里", text: "\u0060\u0060\u0060\nconst re = /[\\u4e00-\\u9fff]/;\n\u0060\u0060\u0060", want: false },
];

// 三种样例算一次，人读与机读共用（一处可写：两处各算一遍，迟早不一样）。
const results = DEMOS.map((d) => {
  const r = settle(d.text, cfg.threshold);
  const hit = r.ok && r.out !== d.text;
  return { label: d.label, want: d.want, hit, ok: hit === d.want, saved: d.text.length - r.out.length };
});
const bad = results.filter((x) => !x.ok).length;

// 机读：与短表同一次计算，只是换个形状。
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ threshold: cfg.threshold, on: cfg.on, demos: results, ok: bad === 0 }, null, 2));
} else {
  const out = ["threshold " + cfg.threshold + "   开关 " + (cfg.on ? "开" : "关")];
  for (const r of results) {
    out.push(r.label + "   " + (r.hit ? "还原 " + r.saved + " 字符" : "不动") + (r.ok ? "" : "  ← 不对"));
  }
  console.log(out.join(String.fromCharCode(10)));
}
if (bad) process.exitCode = 1;
