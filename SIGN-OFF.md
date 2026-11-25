# 签字记录

本文件不进总指纹（`bin/fingerprint.mjs` 的 VOLATILE 里没有它，但它也不是 src/* bin/*，
所以 `md5sum $(git ls-files 'src/*' 'bin/*')` 这个口径同样不含它）。
它的身份印在 `git ls-files 'src/*' 'bin/*' | md5sum` 之外，靠本段记录的指纹指向被签对象。

**本文件只放当前有效的一版签字。历次原文在 `SIGN-OFF-LOG.md`。**

## 当前有效签字

| 角色 | 会话 | 已签（指纹 · 判据 · 取前取后） | 时刻 |
| --- | --- | --- | --- |
| 修改方 | `9d80afea` | **已签**：`5811122e62b9829b31ae73e76786e4d4`、npm run verify rc=0（50/50 + gate 5 个脚本 10 步，失败 0）；README 与 SETTINGS 按当前代码重写（补上 block.on / block.min）；新增 check-dtt-fingerprint；verify-dtt 的软坏样本改成按结构找格、取前取后 0 行 | 2026-11-25T16:47:02Z |
| 复核方 | `f15be404` | 待签：等复核方对 `5811122e62b9829b31ae73e76786e4d4` 复算 | — |

「已签对象」是那一刻的总指纹，不是 commit——commit 只是承载它的时刻。
查证跑 `node bin/signoff-commits.mjs`，它把本文件与 `SIGN-OFF-LOG.md` 两份一起读成一列。

## 当前未验证项

1. `signoff-commits.mjs --strict` 仍报历史行不完整，按定论不回填。
2. 拦截门槛不判「散着写的转义」，已一致记为已知缺口。
3. 注释说过时的话：.ts 端没有任何机器判据；md 端只有 check-doc-accuracy，它不查语义。

## 历次签字

18 轮重签的原文（身份、判据、复核方当时自己跑的坏样本、当时未验证项）在 `SIGN-OFF-LOG.md`。

不在这里逐轮摘录，是因为摘录会与原文分叉——同一件真值两处写，改一处等于没改。
要看某一轮签的是什么，读 LOG 里那一节，或跑上面那条命令。
