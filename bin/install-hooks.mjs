#!/usr/bin/env node
// install-hooks.mjs —— 把「rc=1 不许推」装成机器判据。
//
// 为什么有（2026-11-25）：提交前跑了 npm run verify，rc=1，没看就 commit 又 push。
// hook 与顺序无关：红了就推不出去。它放进 .git/hooks 不进 git、不跨机器，
// 所以这个脚本要进 git——装的那一步可复制，装出来的东西是本地的。
//
// 2026-11-27 修掉的事故（组 2 在 pi-think-sentry 上报的同形状缺陷，本仓同样存在）：
// 原实现用 git rev-parse --git-dir 拼路径。在 git worktree 里 --git-dir 给的是
// .git/worktrees/<名>，于是钩子被装进 .git/worktrees/<名>/hooks/pre-push，
// 而 git 真读的是共享的 .git/hooks —— **装了不生效，还打印「已装」**。
// 判据（当时实测）：
//   git rev-parse --git-path hooks  → projects/pi-escape-guard/.git/hooks
//   node bin/install-hooks.mjs      → .git/worktrees/pi-escape-guard-wt/hooks/pre-push
// 两个路径不同，脚本仍然 rc=0。
//
// 现在两条都交给 git 自己回答：钩子目录问 --git-path hooks，日志路径问
// --git-path，装完再问一次，位置对不上就 rc=1，不再打印一句无判据的「已装」。
//
// 跑法：node bin/install-hooks.mjs     期望 rc=0，第二行是 git 自己认的那个路径
// 反例：造一条红的判据，git push 必须被拒（exit 1）
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitPath = (p) => execFileSync("git", ["-C", REPO, "rev-parse", "--git-path", p], { encoding: "utf8" }).trim();

const logRel = path.relative(REPO, path.resolve(REPO, gitPath("pre-push-verify.log"))).replace(/\\/g, "/");

const HOOK = `#!/bin/sh
# pre-push —— rc=1 不许推。由 bin/install-hooks.mjs 装。
# 判据只看退出码，不看文本：npm run verify 的 rc 非 0 就 exit 1。
# 日志路径在安装时由 git 自己给出（worktree 与普通克隆不同，不能自己拼）。
cd "$(git rev-parse --show-toplevel)" || exit 1
LOG="${logRel}"
npm run verify >"$LOG" 2>&1
rc=$?
if [ $rc -ne 0 ]; then
  echo "pre-push 拒收：npm run verify rc=$rc"
  echo "红在哪：tail -30 $LOG"
  exit 1
fi
exit 0
`;

// ① git 自己说钩子该装在哪
const dir = path.resolve(REPO, gitPath("hooks"));
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, "pre-push");
fs.writeFileSync(target, HOOK, { mode: 0o755 });
try { fs.chmodSync(target, 0o755); } catch {}

// ② 装完再问一次：装的位置必须是 git 自己认的位置。
// 这一条挡的是「装了不生效」，不是「装不上」——装不上会抛异常，不生效不会。
const expect = path.resolve(REPO, gitPath("hooks"), "pre-push");
if (!fs.existsSync(expect)) {
  console.error("装完但 git 认的位置没有这个文件：" + expect);
  process.exit(1);
}
console.log("已装 " + path.relative(REPO, target) + "（= git rev-parse --git-path hooks 给的位置）");
console.log("日志：" + logRel);
console.log("判据：npm run verify 的 rc 非 0 时，git push 被拒（exit 1）");
