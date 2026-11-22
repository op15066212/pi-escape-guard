# 实现复核 2：pi-escape-guard 0.1.2

复核者 b711ced1 · 2026-11-20T10:04:37Z

**结论：认可（0.1.2）。** 我上轮报的七条逐条复跑，六条已修、第七条按已知差异处理且 DESIGN 里有原文，我认这个处理。
新发现三条，都不阻塞（一条报表语义、两处死代码/悬挂注释），列在下面请顺手带走。另有一条交付状态要注意：**0.1.2 还没 commit**。

现取（复跑得到的）：

```
npm test            → tests 47 / pass 47 / fail 0
node bin/mutate.mjs → caught 14, survived 0
node bin/all.mjs    → files 88, points 58, saved 1206 = expected, ratio 1, failFiles 9
```

你报 points ≈55 / saved ≈1180，我取 58 / 1206，多 3 处 26 字节——盘在写，同一时刻两次跑就这幅度。

## 一、七条逐条复跑

复跑脚本 `%TEMP%/repro-012.mjs` 与 `%TEMP%/repro-012b.mjs`（不写你的仓库）：

```
node --experimental-strip-types "C:/Users/15066212pp/AppData/Local/Temp/repro-012.mjs"
```

| 我上轮第几条 | 现取 | 应为 | 判 |
| --- | --- | --- | --- |
| ① 围栏 1a：``` 块里出现 ~~~ | points 0 | 0 | ✓ |
| ① 围栏 1b：~~~ 块里出现 ``` | points 0 | 0 | ✓ |
| ① 围栏 1c：外层 ~~~ 里示范 ``` | points 0 | 0 | ✓ |
| ① 围栏 1d：四反引号块里的三反引号行 | points 0 | 0 | ✓ |
| ① 对照 1e/1f：正常块内 / 裸正文 | 0 / 1 | 0 / 1 | ✓ 没矫枉过正 |
| ④ 反斜杠 2:1/2:2/2:3/2:4 | 1/0/1/0 | 1/0/1/0 | ✓ 奇偶对了 |
| ② strict=false ratio=0.1（段解出 a你好） | changed true | true | ✓ |
| ② strict=true 同一输入 | changed false | false | ✓ 两端可区分 |
| ③ report=false 走 S1 / S2 | points 增量 0 / 0 | 0 / 0 | ✓ |
| ③ report=true 走 S1 | points 增量 1 | 1 | ✓ |
| ⑤ 一块 3 段 | points 3 / attempted 3 / blocksRestored 1 | 3/3/1 | ✓ 量纲分开了 |
| ⑥ .gitignore + 配置文件出库 | `A .gitignore`、`D pi-escape-guard.json` | 有 | ✓ |
| ⑦ measure 与运行时不一致 | DESIGN §8 有「已知差异…不假装两边一致」原文 | 有 | ✓ 我认 |

第 ② 条我还要看实现而不是只看数字：`judges.ts` 顶部 `import { c2Pass }`，`decisive` 末尾
`if (!c2Pass(text, opts.strict ?? true, opts.ratio ?? 0.6))`，judges 里的 `CJK` 常量确实没了（只剩一行注释残留，见待办 B）。
`guard.ts` 把 `cfg.strict`/`cfg.ratio` 传进 `scan`，`scan` 再传进 `decisive`——**整条链通**，不是只在测试里通。

第 ⑦ 条我认的理由：离线验收器拿不到来源路径，这是**信息缺口**不是 bug。你写进 §8 的「不假装两边一致」，
比假装修好一档——`failFiles` 因此可能略高，读的人知道为什么高。

## 二、新发现三条（不阻塞，请带走）

### A. `stats.points` 与 `stats.attempted` 恒同值，`points / attempted` 恒等于 1

`src/features/report.ts:21-22`：

```ts
stats.points += g.points;
stats.attempted += g.points;
```

两行同源同值。而 :2 的注释承诺「points / attempted 段级比例：**还原成功** vs 尝试过的段」——
分子现在也是「尝试过的段」，所以这个比例恒 1，settle 失败时也仍是 1（`changed=false` 但 `g.points>0`）。

判据一行：`grep -n "+= g.points" src/features/report.ts` → 命中两行，值相同。
修法二选一：`if (g.changed) stats.points += g.points;`（points 变成功段数），或删掉 `points`（`attempted` 保留当分母，`blocksRestored/attempted` 仍可算）。

为什么单独立一条：这正是你两次删掉的同类——`unit-mismatch` 恒假、C5 改不了动作。一个恒等于 1 的比例不该有分母。
它不影响文本，所以我不拿它挡签核。

### B. 两处悬挂/死代码

- `src/features/report.ts:5` 注释仍写 `marked / restored`，`restored` 已改名 `blocksRestored` 且不再存在——`grep -rn "restored" src/` 只命中这一行注释。
- `src/features/toolResult.ts:16` `let touched = 0, saved = 0;`，`saved` 只在 :22 `saved += g.saved` 累加，从不读。删掉。

### C. 交付状态：0.1.2 未 commit

```
$ git log --oneline -1
2cb30d8 pi-escape-guard 0.1.1：实现复核的三条，全部是真缺陷

$ git status --porcelain | head -4
A  extensions/pi-escape-guard/.gitignore
M  extensions/pi-escape-guard/DESIGN.md
D  extensions/pi-escape-guard/pi-escape-guard.json
M  extensions/pi-escape-guard/src/scan.ts
```

15 个改动全在 index（staged），HEAD 仍是 0.1.1。任务书说「已 commit，工作区干净」，现取不成立。
代码层面我签的是**工作树的 0.1.2**；签核对象要对得上 commit，请 commit 后把 hash 回填，我按 hash 复核一次即为最终。

## 三、这轮最值钱的东西不是那七条修法

`bin/mutate.mjs` 的 `run()` 从「列出四个测试文件名」改成 `--test` 扫整个 `test/`：

```js
execFileSync(process.execPath, ["--experimental-strip-types", "--test"], { cwd: ROOT })
```

于是 `report.test.ts` 写好了没被跑、那条变异一直存活的问题当场暴露。这与「枚举出来的清单会静默漏，扫掠不会」是同一条——
而且它是你自己在修别人的缺陷时抓到的，不是被复核逼出来的。这条比七条修法更值钱。

同理 `test/edges.test.ts` 把围栏的两种嵌套形状写成了会红的样本（:10、:17），我上轮指出的那条从此有机器判据——
不是「现在绿」，是「改回去会红」：变异表里 `围栏同字符且不短于` 那条现在是抓住的。

## 四、已改 / 未改

已改：无。仓库一字节未动（`git status --porcelain` 里唯一与复核相关的只有新增的 `reviews/review-impl2-b711ced1.md`，那是本文件本身）。
另在 `%TEMP%` 放了 `repro-012.mjs`、`repro-012b.mjs`、`repro-012c.mjs` 三个可复跑脚本。

未改：无。我上轮的七条已全部结案。

结论: 认可（0.1.2 —— 我上轮七条逐条复跑：①围栏 1a/1b/1c/1d 全为 0 点且对照 1e/1f 未被矫枉过正（正常块内 0、裸正文 1），实现是 scan.ts 记 (字符,长度) 且闭合要求同字符不短于开启；②strict/ratio 整条链通，judges.ts 顶部 import c2Pass、decisive 末尾 if (!c2Pass(text, opts.strict ?? true, opts.ratio ?? 0.6))、guard 把 cfg.strict/cfg.ratio 传进 scan、scan 传进 decisive，且 CJK 常量已删，strict=false ratio=0.1 时「a你好」可还原、strict=true 时不可，两端可区分；③report 开关两个槽位都加（if (cfg.report) note(g)），走 S1/S2 实测 report=false 增 0、report=true 增 1；④反斜杠奇偶四档 1/0/1/0 全对；⑤量纲分开，一块 3 段实测 points 3/attempted 3/blocksRestored 1；⑥.gitignore 已加且 pi-escape-guard.json 已 staged 删除（D），不再跟踪；⑦measure 与运行时的 fixtures 差异按 DESIGN §8「已知差异…不假装两边一致」记为信息缺口，我认这个处理。现取 npm test 47/47/0、mutate 14 抓 0 存活、all.mjs files 88/points 58/saved 1206=expected/ratio 1/failFiles 9。新发现三条不阻塞、请带走：A `stats.points` 与 `stats.attempted` 都 += g.points（report.ts:21-22），而 :2 的注释承诺「还原成功 vs 尝试过的段」，于是 points/attempted 恒等于 1（settle 失败时也仍为 1），判据 `grep -n "+= g.points" src/features/report.ts` 命中两行同值，修法是 `if (g.changed) stats.points += g.points;` 或删掉 points 保留 attempted 当分母——这条与你自己删的 unit-mismatch、C5 同族，但不动文本，所以不挡签核；B 两处悬挂与死代码，report.ts:5 注释仍写「marked / restored」而 restored 已改名 blocksRestored（grep -rn "restored" src/ 只命中这一行注释），toolResult.ts:16 的 saved 只在 :22 累加从不读；C 交付状态：0.1.2 未 commit，git log -1 仍是 2cb30d8（0.1.1），15 个改动全在 index（含 A .gitignore 与 D pi-escape-guard.json），任务书「已 commit，工作区干净」现取不成立——我签的是工作树的 0.1.2，请 commit 后回填 hash，我按 hash 复核一次即为最终。另认这轮最值钱的一条：mutate 的 run() 从「列四个测试文件名」改成 --test 扫整个 test/，把「report.test.ts 写好了没被跑」当场暴露，与「枚举会静默漏、扫掠不会」同条，且是你在修缺陷时自己抓到的；edges.test.ts:10/:17 把围栏两种嵌套形状写成会红的样本，于是那条判据有了机器判据。仓库一字节未动，本回执是唯一新增。）

## 五、写完本回执后再取证：0.1.2 已 commit（`1fd60b4`），本节覆盖第二节 C 条的状态

```
$ git log --oneline -2
1fd60b4 pi-escape-guard 0.1.2：两位复核的十条，九条真缺陷都修了
2cb30d8 pi-escape-guard 0.1.1：实现复核的三条，全部是真缺陷

$ git status --porcelain
?? extensions/pi-escape-guard/reviews/review-impl2-b711ced1.md   ← 本文件本身，唯一未跟踪

$ git diff --stat HEAD
（空 —— 工作树与 1fd60b4 逐字节一致）
```

`1fd60b4` 的 16 个文件与我上面复跑的那一版是同一次改动（`git diff --stat HEAD` 空），
所以「0.1.2 未 commit」这条的现取状态已变，**签核对象从工作树改成 commit `1fd60b4`**。
第二节 C 条留着不回改：它记录的是我在那一刻看到的事实，也正是「任务书说干净、盘上却没 commit」这类前提要现取的原因。

`pi-escape-guard.json` 在 `1fd60b4` 里是 -11 行（出库），`.gitignore` +3 行——第 ⑥ 条是**真出库**，不是只加 ignore。

结论: 认可（0.1.2 · commit 1fd60b4 —— 与我复核的工作树逐字节一致，`git diff --stat HEAD` 为空。上轮七条逐条复跑全过：①围栏 1a/1b/1c/1d 均 0 点，对照 1e/1f 正常块内 0 与裸正文 1 说明没矫枉过正；②strict/ratio 整链通（judges 顶部 import c2Pass、decisive 用 opts.strict/opts.ratio、guard 传 cfg、scan 传递），CJK 常量已删，strict=false ratio=0.1 时「a你好」还原而 strict=true 时不还原；③report 开关两槽位都加，report=false 走 S1/S2 增量均 0、true 时 1；④反斜杠四档 1/0/1/0；⑤量纲分开，一块 3 段 points 3/attempted 3/blocksRestored 1；⑥.gitignore 加且 pi-escape-guard.json 在 commit 里是 -11 行真出库；⑦measure 与运行时的 fixtures 差异按 DESIGN §8「已知差异…不假装两边一致」记为信息缺口，我认。现取 npm test 47/47/0、mutate 14 抓 0 存活、all.mjs files 88/points 58/saved 1206=expected/ratio 1/failFiles 9（你报 55/1180，差 3 处 26 字节，盘在写）。三条不阻塞请带走：A. stats.points 与 stats.attempted 都执行 += g.points（report.ts:21-22），而 :2 的注释承诺「还原成功 vs 尝试过的段」，   于是 points/attempted 恒等于 1（settle 失败时也仍为 1）；判据是 grep 那两行同值，   修法 if (g.changed) stats.points += g.points; 或删掉 points 保留 attempted 当分母；B. report.ts:5 注释仍写「marked / restored」而 restored 已改名 blocksRestored，toolResult.ts:16 的 saved 只在 :22 累加从不读；C. 已由 1fd60b4 结案（本回执第二节 C 条给的是那一刻的现取）。另认这轮最值钱的不是七条修法，而是 mutate 的 run() 改成 --test 扫整个 test/，把「report.test.ts 写好了没被跑」当场暴露——与「枚举会静默漏、扫掠不会」同条；edges.test.ts:10/:17 把围栏两种嵌套形状写成会红的样本，那条判据从此有机器判据。仓库一字节未动。）
