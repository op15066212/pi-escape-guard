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

// 幂等（2026-11-25，与 pi-think-sentry 的 idempotence.test.ts 同一件事）：
// 两个插件里每个改内容的地方，第二遍必须不再改。
// 不靠「显然」——settle 的输出里不该再有转义段是推理，判据是拿输出再喂一遍逐字节比。
test("幂等：还原过的文本再还原一次，一个字都不再改", () => {
  const once = S("\\u4f60\\u597d\\u4e16");
  assert.equal(once.ok, true);
  const twice = S(once.out);
  assert.equal(twice.ok, true);
  assert.equal(twice.out, once.out);
});

test("幂等：混合文本（该还原的与不该还原的都有）第二遍不再改", () => {
  const t = "说明：\\u4f60\\u597d\\u4e16 后面是代码 \u0060\\u4e00-\\u9fff\u0060";
  const a = S(t);
  assert.equal(a.ok, true);
  // 第一遍必须真的改了东西，否则这条测的是空转。
  assert.ok(a.out !== t, "第一遍没有改动，这条判据就白测了");
  const b = S(a.out);
  assert.equal(b.ok, true);
  assert.equal(b.out, a.out);
});
