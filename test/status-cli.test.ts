// CLI 判据：不需要 pi 进程就能验「门楣 + 三种样例」。
//
// 宽度按**显示宽度**算：一个中文字占两格。按字符数算会低估一半，
// 中文行才会在保证「不过 44」之后仍然撑破弹窗。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const bin = path.join(import.meta.dirname, "..", "bin", "status.mjs");

const width = (s: string) =>
  [...s].reduce((n, c) => n + (/[\u1100-\uffff]/.test(c) ? 2 : 1), 0);

test("bin/status.mjs：rc=0，四行，三种样例动作对", () => {
  const CFG = path.join(os.tmpdir(), "esc-cli-" + process.pid + ".json");
  fs.writeFileSync(CFG, JSON.stringify({ threshold: 3 }));
  const prev = process.env.ESC_GUARD_CONFIG;
  process.env.ESC_GUARD_CONFIG = CFG;
  try {
    let out = "";
    try {
      out = execFileSync(process.execPath, [bin], { encoding: "utf8", env: process.env });
    } catch (e: any) {
      assert.fail("退出码非 0：" + e.status + " " + e.stderr);
    }
    const rows = out.trim().split("\n");
    assert.equal(rows.length, 4, "应当 4 行，实际 " + rows.length + "：" + out);
    assert.match(rows[0], /^threshold 3\b/, "第一行报门槛，实际：" + rows[0]);
    assert.match(rows[1], /该还原\s+还原/, "成段转义要还原，实际：" + rows[1]);
    assert.match(rows[2], /不够数\s+不动/, "单个转义不动，实际：" + rows[2]);
    assert.match(rows[3], /代码里\s+不动/, "围栏内不动，实际：" + rows[3]);
    for (const r of rows) {
      assert.ok(width(r) <= 44, "显示宽度 ≤ 44，实际 " + width(r) + "：" + r);
    }
  } finally {
    if (prev === undefined) delete process.env.ESC_GUARD_CONFIG;
    else process.env.ESC_GUARD_CONFIG = prev;
    fs.rmSync(CFG, { force: true });
  }
});

test("门槛调到 6 之后，5 个转义不再还原（判据跟着配置走）", () => {
  const CFG = path.join(os.tmpdir(), "esc-cli5-" + process.pid + ".json");
  // 样例是 5 个转义（你/可/以/帮/我），门槛要比 5 大才该挡住。
  fs.writeFileSync(CFG, JSON.stringify({ threshold: 6 }));
  const prev = process.env.ESC_GUARD_CONFIG;
  process.env.ESC_GUARD_CONFIG = CFG;
  try {
    const out = execFileSync(process.execPath, [bin], { encoding: "utf8", env: process.env });
    const rows = out.trim().split("\n");
    assert.match(rows[0], /^threshold 6\b/, "门槛应当读到 6，实际：" + rows[0]);
    assert.match(rows[1], /该还原\s+不动/, "5 个转义不到门槛 6，应当不动，实际：" + rows[1]);
  } finally {
    if (prev === undefined) delete process.env.ESC_GUARD_CONFIG;
    else process.env.ESC_GUARD_CONFIG = prev;
    fs.rmSync(CFG, { force: true });
  }
});
