import test from "node:test";
import assert from "node:assert/strict";
import { META, RULES, audit } from "../src/meta.ts";

test("元理论是依赖类型理论", () => {
  assert.equal(META, "依赖类型理论");
});

test("每条规则四件齐", () => {
  assert.deepEqual(audit(), []);
});

test("缺一件就红", () => {
  const broken = [{ ...RULES[0], 反例: "" }];
  assert.ok(audit(broken).length > 0);
});

test("引入没给命令就红", () => {
  const broken = [{ ...RULES[0], 引入: "已经测过了" }];
  assert.ok(audit(broken).some((m) => m.includes("命令")));
});

// id 唯一：重复的 id 会让「覆盖」这类按 id 对拍的判据静默算错——
// 两条规则共用一个 id，缺一条也看不出来。
test("规则 id 唯一且非空", async () => {
  const { RULES } = await import("../src/meta.ts");
  const ids = RULES.map((r: any) => r.id).filter(Boolean);
  assert.ok(ids.length === RULES.length, "每条规则都该有 id，实际有 " + ids.length + " / " + RULES.length);
  assert.equal(new Set(ids).size, ids.length, "id 有重复：" + ids.join("、"));
});
