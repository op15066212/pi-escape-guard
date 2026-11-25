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


## 重签（2026-11-25，all.mjs 假绿修好之后）

### 身份（现取，2026-11-25T09:30:57Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `b687bb60d6f08b40dac0ba0e6665bb34` |
| 文件数 / 总字节 | 23 / 101,502 |
| HEAD | `748acf6` |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `f39ba5ed` 作废。这一轮四笔（`b44fb86` / `8bdca11` / `ea0485f` / `748acf6`）。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0
  check-doc-accuracy: 3 份文档，对不上 0 处
  tests 44 / fail 0
  selftest: 该红的红、该绿的绿（6 条）

npm run all → rc=0
  {"files":19,"scanned":16,"points":0,"chars":0,"failures":0,"unreadable":0,"tooBig":3,"threshold":3,"failFiles":[]}
```

`scanned` 这个字段是假绿的解药：旧版输出只有 `{"files":19,"points":0}`，
19 个文件、0 个点、0 个失败，读起来像全绿，其实是 measure.mjs 早被删掉、每个文件都在 catch 里 continue。
现在 16 个扫过、3 个因超 20MB 被挡，三种收场各一个码（0 正常 / 1 真 bug / 2 一个都没读到）。

### 复核方自己跑的坏样本（不看自述）

| 变异 | 应然 | 实测 |
| --- | --- | --- |
| 把 `bin/all.mjs` 的 survey 第一行改成 `const files = [];`（空转，一个文件都不读） | 自检红 | 退出码 1；六条自检里四条红（读到 2 个 / 有污染的数成 1 个点 / rc 是 0 / 全干净） |
| 恢复 | 自检绿 | 退出码 0，六条全 PASS，status 0 行 |

### 另一条独立核对

两仓的 `scripts/check-doc-accuracy.mjs` 不是逐字节相同，但 `keysIn` 的写法两仓一致
（都靠标题含「配置/设置/键」划界）。差的是 DOCS 清单：本仓多一份 `DESIGN.md`，那是本仓自己的文档。
注释各记各自的误报样本，不是同一句写两遍。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：指纹 `b687bb60` SAME、verify rc=0、all rc=0、取前取后 0 行、survey 空转那条红过 | 2026-11-25T09:31Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：指纹 `b687bb60`、verify rc=0、local = remote | 2026-11-25T09:26Z |


## 重签（2026-11-25T10:05Z，口径改为 HEAD）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T10:00:17Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `faaa127f621da19fc30d7bb6947eae35` |
| 口径 | HEAD `0920e6c`（展开到临时目录再算） |
| 文件数 / 总字节 | 25 / 118,142 |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `b687bb60` 作废。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0（gate 2 脚本 4 步 + 44/44 + all selftest + fingerprint selftest）
node bin/fingerprint.mjs --selftest → rc=0，三条 PASS
```

### 复核方自己跑的两件事

一、两口径分得开：探针在盘上时工作区口径变、HEAD 口径不变，恢复后两者相同。

二、修改方点名的变异不红（与 sentry 同源，同一个洞）

```text
把 --head 分支里的 ROOT = tmp; 改成 ROOT = REPO;
node bin/fingerprint.mjs --selftest
  → rc=0，FAIL 0 条；期望「HEAD 口径不受工作区影响」红
```

两仓的 fingerprint.mjs 同构，所以这条洞也是两处各一份。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `faaa127f` 与修改方报的逐字相同；verify rc=0；selftest rc=0；取前取后 0 行 | 2026-11-25T10:05Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`faaa127f`、verify rc=0、local = remote | 2026-11-25T09:52Z |


## 重签（2026-11-25T10:19Z，判据修好之后）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T10:17:24Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `5cfac4353c7cf3d2690cea8118607a66` |
| 口径 | HEAD `3384a09` |
| 文件数 / 总字节 | 25 / 121,275 |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `faaa127f` 作废。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0（gate 2 脚本 4 步 + 44/44 + all selftest + fingerprint selftest）
node bin/fingerprint.mjs --selftest → rc=0，三条 PASS
```

### 复核方自己跑的三件

一、变异现在会红

```text
把 --head 分支里的 ROOT = tmp; 改成 ROOT = REPO;
node bin/fingerprint.mjs --selftest → rc=1
  FAIL  探针在盘上时，HEAD 口径与探针之前相同（它不读工作区）
复原 → rc=0，status 0 行
```

二、被签面里七份顶层文档都在（这一条专门验修改方自查出的那处错：照抄 sentry 的清单会少三份）

```text
node bin/fingerprint.mjs --head | grep -E "DESIGN|SETTINGS|HISTORY|README"
  14816B   230L  DESIGN.md
  16496B   263L  HISTORY.md
  9152B   184L  README.md
   2442B    54L  SETTINGS.md
文件数 25
```

三、TOP_FILES 七个，与 sentry 的五个不同（注释已写明这一行不能照抄）

```text
const TOP_FILES = ["package.json", "tsconfig.json", "README.md", "DESIGN.md", "SETTINGS.md", "HISTORY.md", "SIGN-OFF.md"];
```

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `5cfac435` 与修改方报的逐字相同；verify rc=0；selftest rc=0；变异 rc=1；三份文档确在被签面、文件数 25；取前取后 0 行 | 2026-11-25T10:19Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`5cfac435`、verify rc=0、local = remote | 2026-11-25T10:16Z |


## 重签（2026-11-25T10:33Z，被签面从 25 涨到 30）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T10:26:56Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `33514c5e1adc7eae8e561530d04fd591` |
| 口径 | HEAD `f44a256` |
| 文件数 / 总字节 | 30 / 130,954（上一版 25 / 121,275） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `5cfac435` 作废。被签面变大的原因同 sentry：默认全收、排除需点名。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0（gate 2 脚本 4 步 + 44/44 + all selftest + fingerprint selftest）
node bin/fingerprint.mjs --selftest → rc=0，五条 PASS
```

### 复核方自己跑的两个变异

| 变异 | 应然 | 实测 |
| --- | --- | --- |
| `DIRS` 去掉 `docs` | A 判据红并点名 | rc=1，A 红：`未签：docs/for-agents/escape-guard.md` |
| `EXTS` 去掉 `.md` | B 判据红 | rc=1，B 红：`未处理：.md` |

修改方报的 A 变异未签清单在本仓写作 `docs/guard-rules.md`，实测多一个 `docs/for-agents/escape-guard.md`。
不影响结论（A 红且点名），但两处清单不一致，记在这里。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `33514c5e` 与修改方报的逐字相同；verify rc=0；selftest 五条 rc=0；两个变异各红一次；取前取后 0 行 | 2026-11-25T10:33Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`33514c5e`、verify rc=0、local = remote | 2026-11-25T10:26Z |
