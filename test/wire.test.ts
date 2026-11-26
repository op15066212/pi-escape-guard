// 接线判据：这个插件**只注册一个钩子**，且配置是每次调用现读的。
//
// 2026-11-26 使用者定的范围：只保留 tool_call 与「拒绝执行」。
// 原来的 session_start（读配置缓存）、tool_result、message_end（还原）、
// /escape-guard 命令全部删除，所以这里要钉的就是「删干净了」——
// 留着一条没人要的钩子，等于给以后的人一个「这里还该有逻辑」的暗示。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BS = String.fromCharCode(92);
const SEG3 = BS + "u4f60" + BS + "u597d" + BS + "u4e16";

async function setup(cfgObj: any = {}) {
  const CFG = path.join(os.tmpdir(), "esc-wire-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(CFG, JSON.stringify(cfgObj));
  process.env.ESC_GUARD_CONFIG = CFG;
  const prevLog = console.log;
  console.log = () => {};
  try {
    const install = (await import("../src/index.ts")).default;
    const hooks: string[] = [];
    const h: Record<string, any> = {};
    const cmds: Record<string, any> = {};
    await install({
      on(e: string, f: any) { hooks.push(e); h[e] = f; },
      registerCommand(n: string, spec: any) { cmds[n] = spec; },
    });
    return { hooks, h, cmds, CFG };
  } finally {
    console.log = prevLog;
  }
}

test("只注册 tool_call 一个钩子", async () => {
  const { hooks, CFG } = await setup();
  try {
    assert.deepEqual(hooks, ["tool_call"], "注册的钩子必须只有 tool_call，实际：" + JSON.stringify(hooks));
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("不再注册任何命令（还原与观察面都已删）", async () => {
  const { cmds, CFG } = await setup();
  try {
    assert.deepEqual(Object.keys(cmds), [], "不该注册命令，实际：" + JSON.stringify(Object.keys(cmds)));
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});

test("配置每次调用现读：改完文件下一次调用就生效，不用重装也不用重开会话", async () => {
  const { h, CFG } = await setup();
  try {
    const first = await h["tool_call"]({ input: { content: SEG3 } });
    assert.equal(first?.block, true, "前提：默认配置下应当拦");

    // 只改盘上的配置，不重新 install、不碰任何缓存
    fs.writeFileSync(CFG, JSON.stringify({ block: { on: false } }));
    const second = await h["tool_call"]({ input: { content: SEG3 } });
    assert.equal(second, undefined, "关掉之后下一次调用就该放行，实际：" + JSON.stringify(second));
  } finally {
    fs.rmSync(CFG, { force: true });
  }
});
