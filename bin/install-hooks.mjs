#!/usr/bin/env node
// install-hooks.mjs —— 把「rc=1 不许推」装成机器判据。
//
// 为什么有（2026-11-25）：提交前跑了 npm run verify，rc=1，没看就 commit 又 push。
// hook 与顺序无关：红了就推不出去。它放进 .git/hooks 不进 git、不跨机器，
// 所以这个脚本要进 git——装的那一步可复制，装出来的东西是本地的。
//
// 这个文件经历过三次「装了不生效，还打印已装」，每次都是同一个根因：自己拼路径，
// 不问 git。三次的形状记在这里，因为它就是这个脚本的全部理由：
//
//   ① 2026-11 上旬：用 git rev-parse --git-dir 拼 hooks。在 worktree 里 --git-dir 给
//      .git/worktrees/<名>，钩子装进 .git/worktrees/<名>/hooks/，git 不读那里。
//      修法：目录问 --git-path hooks。
//   ② 2026-11-27：日志路径在**安装时**算成绝对路径（指向当时那个 worktree）。
//      那个 worktree 删掉后，在主克隆里 push 也被拒——重定向失败让 rc=1，
//      而 npm run verify 本身是绿的。比 ① 更坏：① 只影响一处，② 会拒掉正确的推送。
//      修法：钩子里每一处路径都在运行时问 git。
//   ③ 2026-11-27（组 2 报的）：core.hooksPath 被设过（husky 装的），切回旧分支后
//      仍生效，于是装进一个已删目录、还 rc=0。
//      实测本脚本**已经正确**：git rev-parse --git-path hooks 会跟着 core.hooksPath 走
//      （设 .husky/_ 时返回 .husky/_）。这一条靠 --selftest 钉住，不靠我记得。
//
// 跑法：node bin/install-hooks.mjs            期望 rc=0，第二行是 git 自己认的那个路径
//       node bin/install-hooks.mjs --selftest 在三个临时仓里验「装到哪」，不动本仓
// 反例：造一条红的判据，git push 必须被拒（exit 1）
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const git = (repo, ...args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const HOOK = `#!/bin/sh
# pre-push —— rc=1 不许推。由 bin/install-hooks.mjs 装。
# 判据只看退出码，不看文本：npm run verify 的 rc 非 0 就 exit 1。
#
# 钩子里每一处路径都在**运行时**问 git，不在安装时算死：
# 安装时算死的路径会在 worktree 被删之后拒掉正确的推送（见脚本头部第 ② 条）。
cd "$(git rev-parse --show-toplevel)" || exit 1
LOG="$(git rev-parse --git-path pre-push-verify.log)"
mkdir -p "$(dirname "$LOG")" 2>/dev/null
npm run verify >"$LOG" 2>&1
rc=$?
if [ $rc -ne 0 ]; then
  echo "pre-push 拒收：npm run verify rc=$rc"
  echo "红在哪：tail -30 $LOG"
  exit 1
fi
exit 0
`;

/** 装到 repo 的 git 认可位置，返回装到的绝对路径。位置只问 git，不自己拼。 */
export function install(repo) {
  const dir = path.resolve(repo, git(repo, "rev-parse", "--git-path", "hooks"));
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "pre-push");
  fs.writeFileSync(target, HOOK, { mode: 0o755 });
  try { fs.chmodSync(target, 0o755); } catch {}
  return target;
}

if (process.argv.includes("--selftest")) {
  // 三个临时仓，各验一种「装到哪」。不改本仓的 config，也不借本仓。
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-selftest-"));
  const cases = [];
  try {
    // A 普通克隆：hooks 在 .git/hooks
    const a = path.join(tmp, "plain");
    fs.mkdirSync(a);
    git(a, "init", "-q");
    const ta = install(a);
    cases.push(["普通仓 → .git/hooks/pre-push", ta.split(path.sep).join("/").endsWith("/.git/hooks/pre-push")]);

    // B core.hooksPath：git 读那里，所以必须装到那里（第 ③ 条）
    const b = path.join(tmp, "hookspath");
    fs.mkdirSync(b);
    git(b, "init", "-q");
    git(b, "config", "core.hooksPath", "hk");
    const tb = install(b);
    cases.push(["core.hooksPath=hk → hk/pre-push（不是 .git/hooks）", tb.split(path.sep).join("/").endsWith("/hk/pre-push")]);

    // C worktree：hooks 在共享的 .git/hooks，不在 .git/worktrees/<名>/hooks（第 ① 条）
    const c = path.join(tmp, "main");
    fs.mkdirSync(c);
    git(c, "init", "-q");
    git(c, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
    const wt = path.join(tmp, "wt");
    git(c, "worktree", "add", "-q", wt);
    const tc = install(wt).split(path.sep).join("/");
    cases.push(["worktree → 共享 .git/hooks（不含 /worktrees/）", tc.endsWith("/.git/hooks/pre-push") && !tc.includes("/worktrees/")]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  let bad = 0;
  for (const [name, ok] of cases) { console.log((ok ? "PASS  " : "FAIL  ") + name); if (!ok) bad++; }
  console.log(bad ? "selftest: " + bad + " 条不符" : "selftest: 三种情形都装到 git 认的位置");
  process.exit(bad ? 1 : 0);
}

const target = install(REPO);
const expect = path.resolve(REPO, git(REPO, "rev-parse", "--git-path", "hooks"), "pre-push");
if (!fs.existsSync(expect)) {
  console.error("装完但 git 认的位置没有这个文件：" + expect);
  process.exit(1);
}
const hp = (() => { try { return git(REPO, "config", "--get", "core.hooksPath"); } catch { return ""; } })();
console.log("已装 " + path.relative(REPO, target) + "（= git rev-parse --git-path hooks 给的位置）");
if (hp) console.log("注意：本仓设了 core.hooksPath=" + hp + "，git 只读那里，所以装在那里");
console.log("判据：npm run verify 的 rc 非 0 时，git push 被拒（exit 1）");