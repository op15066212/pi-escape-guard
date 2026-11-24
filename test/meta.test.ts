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

// 证明项必须精确到这一条（P20 的 2026-11-24 补）：跑全量测试，红了只知道「有一处红」。
// 所以「引入」格必须是单文件命令，不许是 npm test。
test("每条规则的引入是单文件精确命令，不是批次命令", async () => {
  const { RULES } = await import("../src/meta.ts");
  for (const r of RULES) {
    const s = String(r.引入 || "");
    assert.ok(
      /--test test\/[\w-]+\.test\.ts/.test(s),
      (r.id || "(无 id)") + " 的引入不是单文件命令：" + s,
    );
    assert.ok(!/npm test/.test(s), (r.id || "(无 id)") + " 用了批次命令 npm test：" + s);
  }
});
