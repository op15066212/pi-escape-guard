// verdict.ts 的两条形状校验：这两条是唯一防线。
// 2026-11-22 变异测试实测：删掉其中任一条，全套测试仍绿——说明它们原来一条测试都没有。
// 形状校验的价值全在「会不会红」：一个永远返回 true 的校验等于没有校验。
import { test } from "node:test";
import assert from "node:assert/strict";
import { validContent, validMessage, isTextBlock } from "../src/verdict.ts";

test("message_end：role 不符必须判否（否则 pi 会把替换结果当成另一类消息）", () => {
  assert.equal(validMessage({ role: "assistant", content: [] }, "assistant"), true);
  assert.equal(validMessage({ role: "user", content: [] }, "assistant"), false, "role 是 user 却当 assistant 放过去");
  assert.equal(validMessage(null, "assistant"), false);
  assert.equal(validMessage("str", "assistant"), false);
});

test("message_end：content 既不是数组也不是字符串时判否", () => {
  assert.equal(validMessage({ role: "assistant", content: { a: 1 } }, "assistant"), false);
  assert.equal(validMessage({ role: "assistant", content: "text" }, "assistant"), true);
  assert.equal(validMessage({ role: "assistant" }, "assistant"), true, "content 可以缺省");
});

test("tool_result：content 必须是数组", () => {
  assert.equal(validContent([{ type: "text", text: "x" }]), true);
  assert.equal(validContent([]), true);
  assert.equal(validContent("not-array"), false, "字符串不是数组，必须判否");
  assert.equal(validContent({ type: "text" }), false);
  assert.equal(validContent(null), false);
});

test("tool_result：text 块的 text 必须是字符串", () => {
  assert.equal(validContent([{ type: "text", text: 42 }]), false, "text 是数字，pi 会把消息结构改坏");
  assert.equal(validContent([{ type: "image", data: "..." }]), true, "非 text 块不校验 text");
});

test("isTextBlock：只认 type=text 且 text 是字符串", () => {
  assert.equal(isTextBlock({ type: "text", text: "a" }), true);
  assert.equal(isTextBlock({ type: "text" }), false);
  assert.equal(isTextBlock({ type: "image", text: "a" }), false);
  assert.equal(isTextBlock(null), false);
});
