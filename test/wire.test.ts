// 接线：两个钩子各自只在「真的改了」的时候返回补丁。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function setup(cfgObj: any = {}) {
  const CFG = path.join(os.tmpdir(), "esc-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(CFG, JSON.stringify(cfgObj));
  process.env.ESC_GUARD_CONFIG = CFG;
  const prevLog = console.log; console.log = () => {};
  try {
    const install = (await import("../src/index.ts")).default;
    const h: Record<string, any> = {};
    await install({ on(e: string, f: any) { h[e] = f; }, registerCommand() {} });
    return { h, CFG };
  } finally { console.log = prevLog; }
}

test("tool_result：文本块里的成段转义被还原", async () => {
  const { h, CFG } = await setup();
  try {
    const r = await h.tool_result({ content: [{ type: "text", text: "\\u4f60\\u597d\\u4e16" }] });
    assert.equal(r.content[0].text, "你好世");
  } finally { fs.rmSync(CFG, { force: true }); }
});

test("tool_result：没有可还原的就返回 undefined，不制造空补丁", async () => {
  const { h, CFG } = await setup();
  try {
    assert.equal(await h.tool_result({ content: [{ type: "text", text: "普通文本" }] }), undefined);
  } finally { fs.rmSync(CFG, { force: true }); }
});

test("message_end：助手正文被还原，role 不变", async () => {
  const { h, CFG } = await setup();
  try {
    const r = await h.message_end({ message: { role: "assistant", content: [{ type: "text", text: "\\u4f60\\u597d\\u4e16" }] } });
    assert.equal(r.message.role, "assistant");
    assert.equal(r.message.content[0].text, "你好世");
  } finally { fs.rmSync(CFG, { force: true }); }
});

test("message_end：非助手消息不碰", async () => {
  const { h, CFG } = await setup();
  try {
    assert.equal(await h.message_end({ message: { role: "user", content: [{ type: "text", text: "\\u4f60\\u597d\\u4e16" }] } }), undefined);
  } finally { fs.rmSync(CFG, { force: true }); }
});

test("改配置看行为：on=false 时不改任何东西", async () => {
  const { h, CFG } = await setup({ on: false });
  try {
    assert.equal(await h.tool_result({ content: [{ type: "text", text: "\\u4f60\\u597d\\u4e16" }] }), undefined);
  } finally { fs.rmSync(CFG, { force: true }); }
});

test("改配置看行为：threshold=1 时单个转义也还原", async () => {
  const { h, CFG } = await setup({ threshold: 1 });
  try {
    const r = await h.tool_result({ content: [{ type: "text", text: "\\u4f60" }] });
    assert.equal(r.content[0].text, "你");
  } finally { fs.rmSync(CFG, { force: true }); }
});
