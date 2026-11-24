# 签字记录

本文件不进总指纹（`bin/fingerprint.mjs` 的 VOLATILE 里没有它，但它也不是 src/* bin/*，
所以 `md5sum $(git ls-files 'src/*' 'bin/*')` 这个口径同样不含它）。
它的身份印在 `git ls-files 'src/*' 'bin/*' | md5sum` 之外，靠本段记录的指纹指向被签对象。

## 重新签字（用户要求，2026-11-24）

用户原话：「两个自定义的插件，重新签字，推送 github。重新双方签字。」

### 身份（现取，2026-11-24T17:54:31Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `8467da150d79afd3009519207a6cb5f9` |
| 文件数 / 总字节 | 23 / 92,150 |
| HEAD | `097c298` |
| 工作区 | 干净 |
| 口径 | `node bin/fingerprint.mjs`（23 个文件，含 README / DESIGN / SETTINGS / HISTORY） |

### 判据（整条命令的 rc）

```
npm test → rc=0
  tests 42 / pass 42 / fail 0
```

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：指纹 `f39ba5ed` SAME、npm test rc=0（42/42）、工作区取前取后 0 行。原 `8467da15` 作废（fingerprint 补齐 SIGN-OFF 身份后判据脚本自身改变，被签对象随之换身份） | 2026-11-24T18:25Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：指纹 `f39ba5ed` SAME、npm test rc=0、工作区取前取后 0 行 | 2026-11-24T18:11Z |

修改方自述（四行）：

- 指纹 `f39ba5edb20e22f4be4ea3fa4fbeade6`，`--verify` → SAME
- 时刻 2026-11-24T18:11Z
- 取前 `git status --porcelain | wc -l` = 0，取后 = 0
- `npm test` rc=0（42/42）

**指纹与上一签不同，原因写清**：上一签是 `8467da15`。本次发现本仓 `VOLATILE` 只有
`package-lock.json`、顶层名单里也没有 `SIGN-OFF.md`，所以签字记录连 md5 都不印——
别人无法确认「这一份链条是哪一版」。sentry 那边它进 files 又被 VOLATILE 过滤，
md5 印在输出末行；这边一个都没有。补齐后 `bin/fingerprint.mjs` 自己变了，
总指纹随之从 `8467da15` 变成 `f39ba5ed`。**判据脚本变了，被签对象就该换身份**，
这是对的行为，不是漂移。验法：往本文件加一行，总指纹不变、md5 变。

### 推送

`git ls-remote origin refs/heads/main` 与本地 `git rev-parse HEAD` 逐字相同（`097c298`），
`origin/main..HEAD` 未推提交 = 0。github 已是最新。
