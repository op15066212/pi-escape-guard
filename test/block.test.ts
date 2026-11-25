// S0 拦截：调用工具前，入参里有成串转义就拒。
//
// 这是这个插件存在的目的（使用者 2026-11-25 定的方向）：不是事后还原，是当场不让写。
// 所以每条判据都要说得出「喂什么进去它该拒、喂什么进去它该放」。
//
// 输入一律用 String.fromCharCode(92) 拼——本文件的主题就是「别写多层转义」，
// 用例自己先写一堆转义字面量就本末倒置了。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BS = String.fromCharCode(92);
// 三个连着的转义：一段本该是中文的东西
const SEG3 = BS + "u4f60" + BS + "u597d" + BS + "u4e16";
// 两个：正则字符类那种必要写法，不该被拦
const SEG2 = BS + "u4e00-" + BS + "u9fff";

async function setup(cfgObj: any = {}) {
  const CFG = path.join(os.tmpdir(), "esc-block-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(CFG, JSON.stringify(cfgObj));
  process.env.ESC_GUARD_CONFIG = CFG;
  const prevLog = console.log;
  console.log = () => {};
  try {
    const install = (await import("../src/index.ts")).default;
    const h: Record<string, any> = {};
    const cmds: Record<string, any> = {};
    await install({ on(e: string, f: any) { h[e] = f; }, registerCommand(n: string, spec: any) { cmds[n] = spec; } });
    return { h, cmds, CFG };
  } finally {
    console.log = prevLog;
  }
}

test("tool_call：入参里有成串转义就拦，并解出它本该是什么", async () => {
  const { h, CFG } = await setup();
  try {
    assert.ok(h["tool_call"], "tool_call 钩子应当注册——这是这个插件的主要目的");
    const r = await h["tool_call"]({ input: { content: SEG3 } });
    assert.equal(r?.block, true, "应当拦：" + JSON.stringify(r));
    // 只说「不许转义」模型可能不知道指哪几个字；reason 里要出现解码后的样子。
    assert.ok(r.reason.includes("你好世"), "reason 应当解出「你好世」，实际：" + r.reason);
    assert.ok(/不要写转义/.test(r.reason), "reason 应当说清怎么改，实际：" + r.reason);
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("tool_call：两个转义（正则字符类）不拦——那是必要写法", async () => {
  const { h, CFG } = await setup();
  try {
    const r = await h["tool_call"]({ input: { pattern: "[" + SEG2 + "]" } });
    assert.equal(r, undefined, "两个转义不该拦，实际：" + JSON.stringify(r));
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("tool_call：普通参数不拦", async () => {
  const { h, CFG } = await setup();
  try {
    const r = await h["tool_call"]({ input: { content: "普通一段中文，没有任何转义" } });
    assert.equal(r, undefined);
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("tool_call：block.on=false 时放行（开关必须真的接到判据上）", async () => {
  const { h, CFG } = await setup({ block: { on: false } });
  try {
    const r = await h["tool_call"]({ input: { content: SEG3 } });
    assert.equal(r, undefined, "关掉后不该拦，实际：" + JSON.stringify(r));
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("tool_call：门槛可配——min=2 时两个连续转义也拦", async () => {
  const { h, CFG } = await setup({ block: { min: 2 } });
  try {
    // 用两个「连续」的转义。正则字符类里那种（中间隔着 -）是两个独立段，
    // 不算「成串」，min=2 也不该拦它——这条边界在下面那个用例里钉着。
    const two = BS + "u4f60" + BS + "u597d";
    const r = await h["tool_call"]({ input: { content: two } });
    assert.equal(r?.block, true, "min=2 时两个连续该拦，实际：" + JSON.stringify(r));
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("tool_call：序列化不了时宁漏不错杀", async () => {
  const { h, CFG } = await setup();
  try {
    const circular: any = { a: 1 };
    circular.self = circular;
    const r = await h["tool_call"]({ input: circular });
    assert.equal(r, undefined, "看不成就别拦");
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});
