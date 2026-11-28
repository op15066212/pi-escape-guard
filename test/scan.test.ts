import test from "node:test";
import assert from "node:assert/strict";
import { findEscapeRuns, forEachEscapeRun } from "../src/scan.ts";

// 2026-11-26：这一套随还原一起重写。原来 15 条测的是 settle（该不该还原、位置、
// 偏移、幂等），那条路径已按使用者要求删除。现在只钉一件事：
// **调用工具前，什么样的入参算「成串转义」**。
//
// 转义一律用 String.fromCharCode(92) 拼，不写进字符串字面量：
// 这个插件治的就是「多层转义把判据挡住」，测试自己先别踩；而且写出来会被它自己拦。

const BS = String.fromCharCode(92);
const esc = (hex: string) => BS + "u" + hex;
const THREE = esc("4f60") + esc("597d") + esc("4e16");
const TWO = esc("4e00") + esc("9fff");
const FOUR = esc("4f60") + esc("597d") + esc("4e16") + esc("754c");
const BSLASH_ESC = esc("005c");

test("三个连续转义算成段", () => {
  const runs = findEscapeRuns("x " + THREE + " y", 3);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].count, 3);
  assert.equal(runs[0].at, 2);
});

test("两个连续转义不到门槛（正则字符类必须放行）", () => {
  assert.deepEqual(findEscapeRuns("[" + TWO + "]", 3), []);
});

test("同一段门槛降到 2 就拦——门槛真的接在判据上", () => {
  const runs = findEscapeRuns(TWO, 2);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].count, 2);
});

test("四个连续算一段，不是两段", () => {
  const runs = findEscapeRuns(FOUR, 3);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].count, 4);
});

test("中间夹一个转义反斜杠也算同一段：整串超过门槛就该拦", () => {
  // 三 + 一个转义反斜杠 + 三 → 匹配是贪婪的，整串算一段，count 累加到 7。
  // 这不是缺陷：这种写法正是「多层转义」的形状——用转义去表示反斜杠，
  // 再在它后面继续写转义，本可以直接写中文。插件存在的理由之一就是拦它。
  const text = THREE + BSLASH_ESC + THREE;
  const runs = findEscapeRuns(text, 3);
  assert.equal(runs.length, 1, "整串是一段");
  assert.equal(runs[0].count, 7, "3 + 1 + 3");
});

test("换行与制表转义后缀不增加 Unicode 转义计数", () => {
  const text = esc("4e00") + BS + "n" + esc("9fff") + BS + "t" + esc("4f60");
  const runs = findEscapeRuns(text, 3);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].count, 3);
});

test("普通中文不命中", () => {
  assert.deepEqual(findEscapeRuns("普通中文，一个转义也没有", 3), []);
});

test("空串不命中，也不抛", () => {
  assert.deepEqual(findEscapeRuns("", 3), []);
});

test("回调扫描与数组接口逐项一致", () => {
  const input = "a \\u4f60\\u597d\n + \\u4e16\\u754c";
  const expected = findEscapeRuns(input, 2);
  const seen: Array<{ at: number; seg: string; count: number }> = [];
  const count = forEachEscapeRun(input, 2, (at, seg, tokenCount) => seen.push({ at, seg, count: tokenCount }));
  assert.equal(count, expected.length);
  assert.deepEqual(seen, expected);
});
