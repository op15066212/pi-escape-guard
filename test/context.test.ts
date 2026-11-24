// 上下文状态机判据：一次扫描，每个字符的上下文都要对。
//
// 逐行正则判不出的三件事，这里各有一条：
//   围栏跨多少行、未闭合怎么办；转义段跨行时前后半各属哪里；行内反引号关了没。
import test from "node:test";
import assert from "node:assert/strict";
import { contextMap, isCodeSpan } from "../src/context.ts";

test("普通正文：全 prose", () => {
  const m = contextMap("这是一段普通的话。");
  assert.ok(m.every((c) => c === "prose"));
});

test("围栏跨多行：里面全是 fence，闭合之后回到 prose", () => {
  const m = contextMap("正文\n```\nconst x = 1;\n```\n又回到正文");
  const s = m.join(",");
  assert.ok(s.includes("fence"), "围栏内应当是 fence");
  // 最后一行必须是 prose
  const last = m.length - 1;
  assert.equal(m[last], "prose", "闭合之后应当回到 prose");
});

test("未闭合的围栏：一直延伸到最后一行（不是每行都重新开）", () => {
  const m = contextMap("正文\n```\nconst a = 1;\nconst b = 2;");
  assert.equal(m[m.length - 1], "fence", "未闭合时最后一行仍在围栏里");
});

test("行内反引号：开与关之间的算 inline-code", () => {
  const m = contextMap("看 `const x` 这一段");
  const s = m.join(",");
  assert.ok(s.includes("inline-code"));
  assert.equal(m[m.length - 1], "prose", "关闭之后回到 prose");
});

test("赋值行：`ident: 值` 的本行算 assign", () => {
  const m = contextMap('key: "value"\n下一行是正文');
  const colon = "key".length;
  assert.equal(m[colon], "assign", "冒号之后算 assign");
});

test("引号内的内容算 quote，行尾自动闭合", () => {
  const m = contextMap('说 "引用一段" 然后\n下一行');
  const s = m.join(",");
  assert.ok(s.includes("quote"));
});

test("isCodeSpan：整段在代码里才算", () => {
  const text = "```\nabc\n```";
  const m = contextMap(text);
  const inside = text.indexOf("abc");
  assert.equal(isCodeSpan(m, inside, inside + 3), true, "围栏内应当是代码");
  const out = text.indexOf("```");
  assert.equal(isCodeSpan(m, out, out + 3), true, "围栏标记本身也是代码");
  assert.equal(isCodeSpan(contextMap("正文"), 0, 2), false, "正文不是代码");
});

test("一次扫描：同一输入两次结果一致（纯函数）", () => {
  const t = "正文\n```\nx\n```\n中 `y` 尾";
  assert.deepEqual(contextMap(t), contextMap(t));
});
