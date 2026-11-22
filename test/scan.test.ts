// 判据与还原。每一条都说得出「改回去会红」。
import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "../src/scan.ts";

const S = (t: string, th = 3) => settle(t, th);

test("成段的 CJK 转义被还原", () => {
  const r = S("\\u4f60\\u597d\\u4e16");
  assert.equal(r.ok, true);
  assert.equal(r.out, "你好世");
});

test("单个或两个转义不动（正则里的 \\u4e00-\\u9fff 是两个）", () => {
  assert.equal(S("\\u4e00").out, "\\u4e00");
  assert.equal(S("\\u4e00-\\u9fff").out, "\\u4e00-\\u9fff");
});

test("解出来是英文的转义不动：那多半是数据不是污染", () => {
  // \u0048\u0065\u006c = "Hel"
  assert.equal(S("\\u0048\\u0065\\u006c").out, "\\u0048\\u0065\\u006c");
});

test("围栏内的不动（代码上下文，还原会破坏它）", () => {
  const t = ["```", "\\u4f60\\u597d\\u4e16", "```"].join("\n");
  assert.equal(S(t).out, t);
});

test("行内反引号内的不动", () => {
  const t = "见 `\\u4f60\\u597d\\u4e16` 这一行";
  assert.equal(S(t).out, t);
});

test("赋值行不动", () => {
  const t = 'const s = "\\u4f60\\u597d\\u4e16";';
  assert.equal(S(t).out, t);
});

test("紧邻引号且本行没有正文的，不动", () => {
  assert.equal(S('"\\u4f60\\u597d\\u4e16"').out, '"\\u4f60\\u597d\\u4e16"');
});

test("紧邻引号但本行另有汉字，按正文还原", () => {
  const t = '意思是 "\\u4f60\\u597d\\u4e16" 这三个字';
  assert.equal(S(t).out.includes("你好世"), true);
});

test("双重转义的不动：它本身是被转义过的转义，是数据不是污染", () => {
  // 源码里是 \\u4f60（两个反斜杠 + u4f60），表示「这个转义本身还被转义着」。
  const t = String.raw`\\u4f60\\u597d\\u4e16`;
  assert.equal(S(t).out, t, "实际输出：" + JSON.stringify(S(t).out));
});

test("同一行多个段，位置不许错开（v1 的 ratio 1.45 就是这个错）", () => {
  const t = "前面 \\u4f60\\u597d\\u4e16 后面 \\u518d\\u89c1\\u4e86";
  assert.equal(S(t).out, "前面 你好世 后面 再见了");
});

test("多行：每行各自错开也算对", () => {
  const t = ["第一行 \\u4f60\\u597d\\u4e16", "第二行 \\u518d\\u89c1\\u4e86"].join("\n");
  assert.equal(S(t).out, ["第一行 你好世", "第二行 再见了"].join("\n"));
});

test("畸形数据不动，且不抛", () => {
  assert.doesNotThrow(() => S("\\uZZZZ\\u4f60\\u597d"));
  assert.equal(S("\\uZZZZ\\u4f60\\u597d").out, "\\uZZZZ\\u4f60\\u597d");
});

test("不含 \\u 的文本原样返回", () => {
  assert.equal(S("普通一行中文").out, "普通一行中文");
});
