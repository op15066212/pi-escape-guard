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


## 重签（2026-11-25T10:42Z，加了 C 判据）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T10:39:18Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `016e42ef8d920593f164ddae98d0c4c3` |
| 口径 | HEAD `eb869ee` |
| 文件数 / 总字节 | 30 / 131,716 |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `33514c5e` 作废。

### 判据（整条命令的 rc）

```text
node bin/fingerprint.mjs --selftest → rc=0，六条 PASS
npm run verify → rc=0（连跑 3 次均 rc=0）
```

### 复核方自己跑的变异

```text
EXCLUDE 里加 ["nope-does-not-exist.txt"] → rc=1，FAIL C（不生效：nope-does-not-exist.txt）
复原 → rc=0，status 0 行
```

### 复核方独立核的两处

1. 修改方说 C 判据抓到本仓一条死配置 `settings.json`。核过：
   `git show bf01d1c:bin/fingerprint.mjs` 含 `"settings.json"`，
   而盘上无此文件；本仓实际配置是 `pi-escape-guard.json`（`src/config.ts:18`），
   且被 `.gitignore:1` 忽略。这条从抄过来起就没生效，判据抓得对。
2. 修法把 `FILE` / `ALWAYS` 两个未被引用的常量删了：`grep -c` → 0。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `016e42ef` 与修改方报的逐字相同；selftest 六条 rc=0；C 变异 rc=1 且点名；取前取后 0 行 | 2026-11-25T10:42Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`016e42ef`、verify rc=0、local = remote | 2026-11-25T10:38Z |

### 未验证项（复核方发现，本仓两例，修改方尚未处理）

工作区口径比 HEAD 口径多 2 个文件（32 对 30）：`state.json`（随运行写）与 `pi-escape-guard.json`（配置，被 gitignore）。
两个都不在 `VOLATILE` 里，于是工作区口径的指纹会随「跑了一轮」或「改了一个开关」而变。

签字只认 HEAD 口径，故签字不受影响。受影响的是日常自查：靠工作区口径判断「有没有改过东西」会误报。
删掉死的 `settings.json` 是对的，但同一个位置上缺了活的 `pi-escape-guard.json`。


## 重签（2026-11-25T10:52Z，加了 D / E 两条判据）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T10:49:05Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `d41342168d8e35025aea7e3db39df5e7` |
| 口径 | HEAD `083dd85` |
| 文件数 / 总字节 | 30 / 133,577 |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `016e42ef` 作废。

### 判据（整条命令的 rc）

```text
node bin/fingerprint.mjs --selftest → rc=0，八条 PASS
npm run verify → rc=0
```

### 复核方自己跑的三个变异

| 变异 | 实测 |
| --- | --- |
| 造未跟踪顶层文件 `zzz-reviewer-untracked-probe.txt` | rc=1，FAIL D 并点名；删掉后 rc=0 |
| `VOLATILE` 加 `no-such-file.txt` | rc=1，FAIL E（死条目）；复原后 rc=0 |
| 两口径差集 | 工作区 30 / HEAD 30，两边差集均为空 |

上一版工作区比 HEAD 多 `state.json` 与 `pi-escape-guard.json` 两个文件，这一版已归零。

### 复核方独立核出的一处：E 抓不到「两边都写」

本仓 `EXCLUDE ∩ VOLATILE = SIGN-OFF.md, package-lock.json`；再人为把 `SIGN-OFF-DTT.md` 同时放进 VOLATILE，
selftest 仍 rc=0、E PASS。所以 E 判的是「盘上真有」，不是「真的被签」。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `d4134216` 与修改方报的逐字相同；八条 PASS 且 rc=0；D/E 变异各红一次；两口径差集归零；取前取后 0 行 | 2026-11-25T10:52Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`d4134216`、verify rc=0、local = remote | 2026-11-25T10:48Z |

### 未验证项（复核方发现）

E 判据不判「EXCLUDE 与 VOLATILE 重叠」。修法：E 的 knownNames 改成 `filesOf` 的输出集合。
本仓已有两条重叠（SIGN-OFF.md、package-lock.json），在改成 filesOf 口径后它们会立刻红，届时须二选一。


## 重签（2026-11-25T11:56Z，settle 提速之后）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T11:53:01Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `28d4bf31453dcccde7cd849ba4a0215a` |
| 口径 | HEAD `604a1c6` |
| 文件数 / 总字节 | 31 / 140,619（上一版 30 / 133,577） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `d4134216` 作废。新增 `bin/bench-settle.mjs`；settle 改成两遍（先挑候选，没有候选就不建 contextMap）。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0   tests 44，gate 2 脚本 4 步 0 失败
node bin/fingerprint.mjs --selftest → rc=0，八条 PASS
```

### 复核方自己跑的性能读数

```text
node --experimental-strip-types bin/bench-settle.mjs
  不够数   94999 字  0.6461 ms   没改
  不够数   18999 字  0.1359 ms   没改
  有污染  134999 字 10.5718 ms   改了
  无转义  113889 字  0.0059 ms   没改
```

修改方报「不够数 94999 字 0.45–0.55 ms」，我这里 0.6461 ms，偏高约 20%。
量级一致，降幅方向一致（改前 2.89 ms → 现在 0.65 ms）；具体毫秒数不记为已核。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `28d4bf31` 与修改方报的逐字相同；verify rc=0（44/44 + gate 4 步）；selftest 八条 PASS；bench 实跑且量级一致；取前取后 0 行 | 2026-11-25T11:56Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`28d4bf31`、verify rc=0、local = remote | 2026-11-25T11:51Z |

### 一处纠正：被作废的两个对象不是复核方签过的

修改方写「你上一封签的 `4d3f05b` / `44fe360` 作废」。
复核方实际签的是 `409d76d`（sentry）与 `e2df536`（本仓）。
`44fe360` 是修改方自己那笔「E 判据的期望改成只从 filesOf 取」。
取过的与签过的必须分开记。


## 重签（2026-11-25T12:10Z，pre-push 钩子装上之后）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T12:06:57Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `92130a3e24b5db821ed8235abeecb6c6` |
| 口径 | HEAD `3756c1e` |
| 文件数 / 总字节 | 33 / 147,801（上一版 31 / 140,619） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `28d4bf31` 作废。新增 `bin/signoff-commits.mjs` 与 `bin/install-hooks.mjs`。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0
node bin/fingerprint.mjs --selftest → rc=0，八条 PASS
```

### 复核方自己跑的：pre-push 真会拒推

```text
塞 scripts/check-zzz-canary.mjs → git push --dry-run rc=1（failed to push some refs）
删掉 → rc=0
status 0 行
```

### 关于不完整指纹的处理（复核方定）

不动历史行，从现在起写完整 32 位。理由见 sentry 那侧同一节：
历史行是既成事实；不完整的行已由 `--strict` 逐行标出，不会静默；只补一半会让表读不出哪些是补的。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | **重签**：`--head` 复算 `92130a3e24b5db821ed8235abeecb6c6` 与修改方报的逐字相同；verify rc=0；selftest 八条 PASS；pre-push 拒推实测；取前取后 0 行 | 2026-11-25T12:10Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`92130a3e`、verify rc=0、local = remote | 2026-11-25T12:06Z |


## 重签（2026-11-25T12:20Z，sign.mjs 生成签字行之后）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T12:17:06Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `21332431be2644d093f32ceb5a11ba4c` |
| 口径 | HEAD `efa961f` |
| 文件数 / 总字节 | 34 / 151,225（上一版 33 / 147,801） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `92130a3e` 作废。新增 `bin/sign.mjs`。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0   tests 44，gate 2 脚本 4 步 0 失败
node bin/fingerprint.mjs --selftest → rc=0，八条 PASS
node bin/sign.mjs 复核方 "…" → rc=0，本节的签字行由它印出
```

### 复核方自己跑的两个方向

```text
干净 → rc=0，印出「口径 HEAD efa961f，指纹 21332431be2644d093f32ceb5a11ba4c（32 位）」
脏（造 zzz-sign-probe.txt）→ rc=1，「工作区有 1 行未提交改动，先提交再签」并点名那一行
删掉 → rc=0
```

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | `| 复核方 | f15be404 | **已签**：`21332431be2644d093f32ceb5a11ba4c`、npm run verify rc=0（44/44 + gate 4 步）；fingerprint selftest 八条 PASS、取前取后 0 行 | 2026-11-25T12:19:11Z |` | 2026-11-25T12:20Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`21332431`、verify rc=0、local = remote | 2026-11-25T12:15Z |


## 重签（2026-11-25T12:32Z，sign.mjs 加了本地与远端同步检查）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T12:28:03Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `c0a125285bdd7d416ad704a2f78bed37` |
| 口径 | HEAD `b4c3741` |
| 文件数 / 总字节 | 34 / 152,631（上一版 34 / 151,225） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `21332431` 作废。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0   tests 44，gate 2 脚本 4 步 0 失败
node bin/fingerprint.mjs --selftest → rc=0，八条 PASS
node bin/sign.mjs 复核方 "…" → rc=0
```

### 复核方自己跑的同步检查

```text
同步时            rc=0
造领先 1 后       rc=1「本地与 origin/main 不同步（领先 1 / 落后 0）」
reset --soft 回退  rc=0，HEAD 回到 b4c3741，status 0 行
回退后            rc=0
```

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | `| 复核方 | f15be404 | **已签**：`c0a125285bdd7d416ad704a2f78bed37`、npm run verify rc=0；selftest 八条 PASS；本地与远端同步实测（领先 1 → rc=1）、取前取后 0 行 | 2026-11-25T12:30:35Z |` | 2026-11-25T12:32Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`c0a12528`、verify rc=0、local = remote | 2026-11-25T12:27Z |


## 重签（2026-11-25T12:46Z，check-rc-pipe 与 rc=2 分支都验过之后）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T12:41:42Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `5cb46e060d0d99268abf13997e5449f8` |
| 口径 | HEAD `ca1ac49` |
| 文件数 / 总字节 | 35 / 157,172（上一版 34 / 152,631） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `c0a12528` 作废。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0   tests 44，gate 3 个脚本 6 步（3 步 selftest）0 失败
node scripts/check-rc-pipe.mjs → rc=0，16 个文件命中 0 处
```

### 复核方自己跑的两件

```text
一、插一行管道取 rc → rc=1（红 README.md:62）；复原 → rc=0
二、临时 clone 后把 remote 指向不存在路径 → sign.mjs rc=2
    「git fetch 失败，判断不了本地是否领先远端（rc=2，环境缺失）」
    clone 里同步时 rc=0
```

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | `| 复核方 | f15be404 | **已签**：`5cb46e060d0d99268abf13997e5449f8`、npm run verify rc=0；check-rc-pipe 插入管道行实测 rc=1；rc=2 分支用临时 clone 实测、取前取后 0 行 | 2026-11-25T12:44:12Z |` | 2026-11-25T12:46Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`5cb46e06`、verify rc=0、local = remote | 2026-11-25T12:34Z |


## 重签（2026-11-25T13:01Z，check-rc-pipe 六种形状进自检之后）

### 身份（`node bin/fingerprint.mjs --head` 现取，采样 2026-11-25T12:57:15Z）

| 项 | 值 |
| --- | --- |
| 总指纹 | `13760238792b096e38abe66651e9ebc0` |
| 口径 | HEAD `29adab3` |
| 文件数 / 总字节 | 35 / 158,533（上一版 35 / 157,172） |
| 取前取后 git status | 0 行 / 0 行 |

上一版 `5cb46e06` 作废。

### 判据（整条命令的 rc）

```text
npm run verify → rc=0   tests 44，gate 3 个脚本 6 步（3 步 selftest）0 失败
node scripts/check-rc-pipe.mjs --selftest → rc=0，十条 PASS
```

### 复核方自己跑的两条变异

```text
任何竖线都算管道      → rc=1，FAIL「形状：逻辑或不是管道」
去掉引号剥离          → rc=1，FAIL「形状：引号里的竖线不算」
复原                  → rc=0，status 0 行
```

另两条防线未抽验。

### 签字

| 角色 | 会话 | 状态 | 时刻 |
| --- | --- | --- | --- |
| 复核方 | pi 插件2 `f15be404` | `| 复核方 | f15be404 | **已签**：`13760238792b096e38abe66651e9ebc0`、npm run verify rc=0；check-rc-pipe 六形状十条自检 PASS；变异 A/B 各红对应形状、取前取后 0 行 | 2026-11-25T12:59:32Z |` | 2026-11-25T13:01Z |
| 修改方 | pi 插件 `9d80afea` | **已签**：`13760238`、verify rc=0、local = remote | 2026-11-25T12:56Z |
