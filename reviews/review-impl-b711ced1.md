# 实现复核：pi-escape-guard 0.1.0（commit ae4fcf3）

复核者 b711ced1 · 2026-11-20T09:55:12Z

**结论：不认可。** 钩子形状三条全对，恒等式在 restore 槽成立，这些我签；但有 6 条真缺陷，
其中第 1 条会把代码改坏（误伤方向），第 2/3 条是「配置写了却恒无效」。

我先复跑了你的四条，数字对得上：

```
npm test            → tests 32 / pass 32 / fail 0
node bin/mutate.mjs → caught 8, survived 1（S2 只动 assistant）
node bin/all.mjs    → files 88, points 56, saved 1188 = expected, ratio 1, failFiles 9
md5sum DESIGN.md    → 5ac45301（与上一轮我签的一致；代码没改设计）
```

你报 points ≈55 / ≈1180，我取 56 / 1188，差 1 处 8 字节——盘在写，同一时刻两次跑就会差。

## 一、我签的部分（三条）

**1. 钩子形状 3/3 与 pi 文档一致。**

| 钩子 | 文档要求 | 代码 | 判 |
| --- | --- | --- | --- |
| `message_end` | 返回 `{ message }`，必须保住 `role` | assistant.ts:26 `{ message: next }`，:24 `validMessage(next, "assistant")` 兜底 | ✓ |
| `tool_result` | 返回 partial patch；**替换 content 而不返回 structuredContent 就丢弃它** | toolResult.ts:29 `{ content, structuredContent: undefined }` | ✓（显式置 undefined 与「省略即丢弃」等价） |
| `before_provider_request` | 返回 `undefined` 保持不变 | index.ts:38 `return undefined` | ✓ |

`AssistantMessage.content` 在文档里就是数组（message-types.md:124），所以 assistant.ts:11 要求数组不是漏判——我原本怀疑字符串 content，核了文档，撤回。

**2. 恒等式在 restore 槽成立，且 `delta-mismatch` 不是恒假判据。**

实测三槽（`guardText` 直接调，段 `\u4f60\u597d\u4e16`，每段 delta 9）：

```
tool_result        points 1  saved 9  expected 9
message_end        points 1  saved 9  expected 9
provider_request   points 1  saved 0  expected 9   ← mark 槽不改文本，不适用
```

所以我给恒等式加一句限定：**它成立在「会改文本的槽位、且每一批 settle 之内」**，不是全局跨槽位。
mark 槽不产生 saved，拿它和 expected 比会得到 0/9。你的报表只在 `--apply` 时算 ratio，避开了这一点，但 §3 的措辞要收紧。

`settle` 的 `saved !== expected` 分支**可达**，不是死代码：我把 `applyPoints` 改成从前往后（变异 5 的同款改动），
`saved/expected` 变成 `5/18`，分支真的会触发。所以它与被删掉的 `unit-mismatch` 不同类——它有守护对象（同模块的 applyPoints 顺序）。**这条我认。**

**3. 你自删 `unit-mismatch`、自删 `layers.ts` 的判断，我认。** 理由与你写的一致，且 mutate 脚本的存在本身是这条判据的机器判据。

## 二、不认可：7 条真缺陷

复跑脚本我放在 `%TEMP%/impl-repro.mjs`（不写你的仓库）：

```
cd C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard
node --experimental-strip-types "C:/Users/15066212pp/AppData/Local/Temp/impl-repro.mjs"
```

现取输出（now = 当前行为，should = 应为）：

```
1a   now=1   should=0   ``` 块里出现 ~~~ 行, 其后有段
1b   now=1   should=0   ~~~ 块里出现 ``` 行, 其后有段
1c   now=1   should=0   外层 ~~~ 里示范 ``` 围栏
2:1  now=1   should=1   1 个连续反斜杠后跟段
2:2  now=0   should=0   2 个连续反斜杠后跟段
2:3  now=0   should=1   3 个连续反斜杠后跟段
2:4  now=0   should=0   4 个连续反斜杠后跟段
3    now=false should=true  strict=false ratio=0.1, 段解出 a你好
4    now=1   should=0   report=false 后 stats.points 的增量
5    now=3/1 should=3/3 一块 3 段: points/restored
6    now=0/0 should=非恒 0  summary().toolResults / .marked
```

### 1（最硬）围栏状态机不校验字符与长度，会把代码改坏

`src/scan.ts:38-39`：

```ts
const fm = /^(`{3,}|~{3,})/.exec(t);
if (fm) { fence = fence ? null : fm[1][0]; ... }
```

任何以 ``` 或 ~~~ 开头的行都切换状态，不看**是不是同一种字符**、也不看**长度够不够**（CommonMark：闭合围栏必须同字符、长度 >= 开始）。
后果正好落在 C3a 承诺的反面——**块内内容被当正文还原**：

```
输入（1c，最现实的一种：文档里用 ~~~ 包住一段示范，示范里是 ``` 块，块里有转义）
~~~
```
\u4f60\u597d\u4e16
```
~~~
现取：points=1，即那段被还原成「你好世」；应为 0。
```

这不是理论输入：任何 README 里「两种围栏都示范」的段落都会命中，而 C3a 的存在理由就是「围栏内不动」。
修法：`fence` 存 `{ch, len}`，闭合要求 `fm[1][0] === ch && fm[1].length >= len`。

### 2（硬）`strict` / `ratio` 是死配置，`src/features/strict.ts` 整个文件没人 import

```
$ grep -rn "strict" src/ | grep -v features/strict.ts
src/config.ts:10  strict: boolean;
src/config.ts:28  strict: true,
（其余都是 test 里的 assert/strict）

$ grep -rn "c2Pass\|allCJK\|mostlyCJK" src/ test/
只有 src/features/strict.ts 自己三行，没有调用者。
```

而 `src/judges.ts:21` 另写了一份 CJK 正则。`SETTINGS.md:24` 对用户的承诺是「别急着降 `strict`」，
config 注释写「关掉回到比例判定（会误伤正则里的 一-鿿）」——**这个功能不存在**，改了配置行为不变（复跑第 3 行）：

```
段 \u0061\u4f60\u597d 解出 "a你好"
strict=true  → not-all-cjk，不还原
strict=false ratio=0.1 → 仍然 not-all-cjk，不还原（应为可还原）
```

同一判据两处各写一份（judges 的正则 + strict.ts 的 c2Pass），且只有一份被调用——这是 AGENTS 第五条说的「两处答案会分叉」。
修法二选一：把 `decisive` 接 `c2Pass(text, cfg.strict, cfg.ratio)` 并删掉 judges.ts 的 CJK 常量；或删掉 strict/ratio 与整个 strict.ts，SETTINGS 同步。

### 3（硬）`report` 是死配置

`grep -rn "cfg.report" src/` → 0 命中；`note()` 在 toolResult.ts:20 与 assistant.ts:18 无条件调用。
复跑第 4 行：`report=false` 时 `stats.points` 仍从 0 增到 1。SETTINGS.md:16 列了这个键。

### 4（中）double-escaped 只看 1 个反斜杠，奇数个连续反斜杠时漏判

`src/scan.ts:51`：`if (at > 0 && line[at - 1] === "\\") skip("double-escaped")`。
正确判法是**连续反斜杠数的奇偶**：偶数个全部成对（`\\` = 一个字面反斜杠），后面不是转义；奇数个时最后一个与 `u` 成段。

现取：1 个 → 还原（对）、2 个 → 跳过（对）、**3 个 → 跳过（错，应为污染）**、4 个 → 跳过（对）。
真实触发面窄（3 个连续反斜杠后跟转义），但它是「判据说成立、代码放过去了」的一条，且修法只有一行（数奇偶）。

### 5（中）`stats.points` 与 `stats.restored` 量纲不同，report.ts 的注释把它当比例

`src/features/report.ts:2-4` 写「points / restored 还原成功比例」。实测一块含 3 段：**points=3，restored=1**
（`restored` 每个**文本块** +1，不是每段 +1）。两个不同量纲相除不是比例，是「平均每块几段」。
这正是 DESIGN §10 第 1 条那种错（文件层与内容层混算）在代码里的同款。
修法：`restored += g.points`（段级），或把字段改名 `blocksRestored` 并把注释改成「块 / 段」。

### 6（中）两个恒 0 字段 + 仓库没有 .gitignore，运行时会往被跟踪目录里写两个文件

`stats.toolResults`、`stats.marked` 全仓库**没有一处写入**（`grep -rn "stats\.\(toolResults\|marked\)" src/` → 0），
但 `summary()` 会把它们导出——恒 0 的字段是「读的人以为它有意义」。删掉或接线。

另外：`config.ts:37` 与 `seen.ts:8` 都以 `import.meta.dirname/..`（= 扩展目录，被跟踪）为落点，
`ensureConfig()`（index.ts:15，每次加载都调）会在没有配置时写 `pi-escape-guard.json`，`session_shutdown` 写 `state.json`。
仓库既没有这两个文件、也没有 `.gitignore` → **pi 一装一跑，`git status` 就多两个 `??`**。
判据：`ls -A` 有 `.gitignore` 或这两个文件被点名忽略。修法一行：加 `.gitignore` 写 `pi-escape-guard.json`、`state.json`。

### 7（中，口径分叉）`bin/measure.mjs` 与运行时不是同一套判据

`measure.mjs:38` 直接 `scan(s, { seen })`，不传 `skipFixtures`；而运行时 S1 在 `toolResult.ts:13` 会跳过 `fixtures/`、`__fixtures__`、`testdata`。
于是同一份记录，离线验收器算 points、运行时不动——`failFiles` 会包含运行时永不改的文件。
这是「同一件事两处各算一遍」的第三处（前两处是 CJK 正则、scanText/scan 已合并）。
修法：`measure.mjs` 也传一个 `isFixture` 判定，或把「哪些路径不扫」提进 `scan` 的 opts，两边只从一处取。

## 三、你问的四条，逐条答

**Q1 钩子形状**：3/3 一致（见上表）。补一条可选项：toolResult.ts:28-29 在 `structuredContent` 不存在时仍返回 `structuredContent: undefined`，与省略等价，无害但多余。

**Q2 「判据说成立但代码放过去」**：围栏 1a/1b/1c、反斜杠 2:3、strict 第 3 行，共 5 个输入。前三条是误伤方向（代码被改），后两条是漏判方向。

**Q3 恒等式是否所有槽位成立**：不成立，但原因是**槽位不该有 expected**，不是记账错。restore 槽逐批成立（9/9），mark 槽 saved 恒 0、expected 无意义。
建议把 §3 的措辞改成「每批 restore 内 saved === expected」，并在 `guardText` 的返回里把 mark 槽的 `saved` 明标 0（现在就是 0，但没人写这句）。

**Q4 变异存活那条是冗余还是缺口**：**都不准确**，它是「文本行为不变、记账行为变了」的缺口，且第二道防线不在它后面——
`validMessage` 在 `touched > 0` 之后才判，而 `note(g)`（report.ts:19）与 `scan` 里的 `seen.add`（scan.ts:65）**在它之前就发生了**。
实测（模拟删掉 role 检查，走同一条 guardText 路径）：

```
有 role 检查：role=user 返回 undefined，stats.points 0 → 0
无 role 检查：返回仍是 undefined，但 stats.points 0 → 1、stats.firstSeen 1 → 2
```

所以：文本面确实是冗余保护（validMessage 兜住），**记账面不是**——user 消息里的转义会被算进 points 与 firstSeen/repeat。
判法：把 role 判断挪到 `note()` 之前不是问题（现在就在前面），问题是「变异存活」这条记录写的结论「行为不变」不准确。
建议要么保留这条并改成「文本行为不变，记账会变」，要么把 `note()` 挪到 `validMessage` 之后（让记账跟着实际采纳的 patch 走）。

## 四、已改 / 未改

已改：无。仓库一字节未动（`git status --porcelain` 空）；只在 `reviews/` 追加本文件，另在 `%TEMP%` 放了 `impl-repro.mjs` 与五个 probe。

未改：上面 7 条。第 1、2、3 条我认为阻塞（改代码 / 配置恒无效）；4、5、6、7 可同一批修。

结论: 不认可（理由：钩子形状 3/3 与 pi 文档一致（message_end 返回 {message} 且 validMessage 保 role；tool_result 返回 content 并显式 structuredContent: undefined，与文档「替换 content 不返回 structuredContent 即丢弃」等价；before_provider_request 返回 undefined），恒等式在 restore 槽逐批成立（saved 9 = expected 9），settle 的 saved !== expected 分支可达（把 applyPoints 改成从前往后 → 5/18 真的触发，所以它与被删的 unit-mismatch 不同类），你自删 unit-mismatch 与 layers.ts 的判断我都认；但有 7 条真缺陷，前三条阻塞：①围栏状态机不校验字符与长度（src/scan.ts:38-39），``` 块里出现 ~~~ 行或外层 ~~~ 里示范 ``` 就会提前闭合围栏，块内转义被当正文还原——复跑 `%TEMP%/impl-repro.mjs` 的 1a/1b/1c 三条 now=1 should=0，这正是 C3a 承诺「围栏内不动」的反面，且 README 示范两种围栏的段落必命中；②strict/ratio 是死配置：`grep -rn strict src/` 只剩 config.ts 两行，src/features/strict.ts 的 c2Pass/allCJK/mostlyCJK 无任何调用者，judges.ts:21 另写一份 CJK 正则，于是 SETTINGS.md:24 承诺的「降 strict」改了配置行为不变（段 a你好 解出 a你好，strict=false ratio=0.1 仍 not-all-cjk 不还原）；③report 是死配置，`grep -rn cfg.report src/` 零命中，note() 无条件调用（report=false 后 stats.points 仍 0→1）；④double-escaped 只看 1 个反斜杠（scan.ts:51），连续反斜杠应数奇偶，3 个时应还原（复跑 2:3 now=0 should=1）；⑤stats.points 是段级、stats.restored 是块级（report.ts:21），注释「points / restored 还原成功比例」是量纲混算（一块 3 段实测 3/1）；⑥stats.toolResults 与 stats.marked 全仓库无写入却由 summary() 导出，且仓库无 .gitignore 而 config.ts:37/seen.ts:8 以扩展目录为落点，pi 一跑就多出 pi-escape-guard.json 与 state.json 两个未跟踪文件；⑦bin/measure.mjs:38 直接 scan 不传 skipFixtures，与运行时 toolResult.ts:13 的 fixtures 跳过不一致，同一份记录离线算 points、运行时不改。另答 Q4：变异存活那条不是纯冗余，validMessage 在 touched>0 之后才判而 note(g) 与 seen.add 在它之前，所以删掉 role 检查后文本仍是 undefined，但 stats.points 0→1、firstSeen 1→2，「行为不变」的说法只对文本成立、对记账不成立。现取 npm test tests 32/pass 32/fail 0、mutate caught 8/survived 1、all.mjs files 88/points 56/saved 1188=expected/ratio 1/failFiles 9、DESIGN.md md5 5ac45301。）

## 五、写完后取证：`src/index.ts` 在复核期间被改，其中一条是我漏的（本节为最终结论，覆盖上面那行）

```
$ git status --porcelain
 M src/index.ts
?? reviews/review-impl-b711ced1.md
```

任务书的前提「已 commit，工作区干净」在我复核期间不成立了。改的三处我逐条核过：

```
sessionOf: ctx?.sessionManager?.getSessionId?.() || ctx?.session?.id || …
tool_result 钩子: stats.toolResults++
before_provider_request 钩子: stats.marked += markProvider(...)
```

**`sessionOf` 那一条是我漏的真缺陷，我认。** 文档核对：

```
docs/extensions.md:1203-1213  ctx.sessionManager → getCwd/getSessionDir/getSessionId/getSessionFile/…
$ grep -rn "ctx\.session\b" docs/   → 0 命中
```

所以旧写法 `ctx?.session?.id` 在 pi 里恒 `undefined`，所有会话都落进 `"default"` 一个桶——
DESIGN §2 与 seen.ts 头注释承诺的「按会话分键」等于没做。它不改文本，只让 firstSeen/repeat 失去「哪个会话」这一维，
所以我不把它列成阻塞项；但「恒不生效的键」与第 2/3 条同病，写在这里留痕。

我为什么漏：走查时我只核了**事件对象**的形状（`event.message`、`event.content`、`event.payload`），没核 `ctx`。
可复跑的判据（现取）：

```
node --experimental-strip-types "C:/Users/15066212pp/AppData/Local/Temp/impl-repro6.mjs"
6 toolResults/marked 增量      "1/1"      ← 第 6 条的两个死字段已接线
7a 真实 ctx sessionManager    "abc"      ← 新写法生效
7b 只有 ctx.session.id        "abc"      ← 旧写法兜底
7c 空 ctx                     "default"
```

于是第 6 条一分为二：两个恒 0 字段**已修**（实测 +1/+1），`.gitignore` **仍缺**（`ls -A` 无该文件，
`config.ts:37` 与 `seen.ts:8` 仍以扩展目录为落点）。

测试也随之 32 → 37 全绿（你补了 5 条）；我的 repro 1–5 与 3/4/5 各行仍红，未被这次改动触及。

## 六、最终剩余清单（按修的顺序）

| # | 阻塞 | 位置 | 一行修法 |
| --- | --- | --- | --- |
| 1 | 是 | `src/scan.ts:38-39` | 围栏存 `{ch,len}`，闭合要求同字符且 `len >= 开始` |
| 2 | 是 | `src/judges.ts:21` + `features/strict.ts` | `decisive` 接 `c2Pass(text, cfg.strict, cfg.ratio)` 并删掉 `judges.CJK`；或删 strict/ratio 与整个 strict.ts 并改 SETTINGS |
| 3 | 是 | `features/toolResult.ts:20`、`assistant.ts:18` | `note()` 前加 `if (cfg.report)` |
| 4 | 否 | `src/scan.ts:51` | 数段前连续反斜杠的奇偶 |
| 5 | 否 | `features/report.ts:21` | `restored += g.points`，或改名 `blocksRestored` |
| 6 | 否 | 仓库根 | 加 `.gitignore`：`pi-escape-guard.json`、`state.json` |
| 7 | 否 | `bin/measure.mjs:38` | 传 `isFixture` 判定，或把「哪些路径不扫」提进 `scan` 的 opts |

第 1 条修完请给一条会红的样本（我给的 1c 就是），否则这一条没有机器判据——`test/scan.test.ts:27` 只测了 ```` ``` ```` 对 ```` ``` ```` 的正常情形。

另外：`reviews/review-impl-b711ced1.md` 现在也是未跟踪（`??`），它是我这次复核的唯一证据，commit 时一并 `git add`。

结论: 不认可（理由：本轮最终状态——工作区不干净（`M src/index.ts`），你在我复核期间改的三处里，`sessionOf` 那条是我漏的真缺陷（`docs/extensions.md:1203-1213` 有 `ctx.sessionManager.getSessionId()`，`grep -rn "ctx\.session\b" docs/` 零命中，旧写法 `ctx?.session?.id` 恒 undefined，所有会话落进 "default"，「按会话分键」等于没做）——这条我认、且它只影响 firstSeen/repeat 的会话维、不改文本，不阻塞；两个死字段 stats.toolResults / stats.marked 已接线（实测各 +1），测试 32→37 全绿。仍阻塞三条：①围栏状态机不校验字符与长度（src/scan.ts:38-39），``` 块里出现 ~~~ 或外层 ~~~ 里示范 ``` 会提前闭合，块内转义被当正文还原，复跑 %TEMP%/impl-repro.mjs 的 1a/1b/1c 均 now=1 should=0，这是 C3a「围栏内不动」的反面；②strict/ratio 死配置（`grep -rn strict src/` 只剩 config.ts，features/strict.ts 的 c2Pass/allCJK/mostlyCJK 无调用者，judges.ts:21 另有一份 CJK 正则），SETTINGS.md:24 承诺的「降 strict」无效（段 a你好 解出 a你好，strict=false ratio=0.1 仍 not-all-cjk）；③report 死配置（`grep -rn cfg.report src/` 零命中，report=false 后 stats.points 仍 0→1）。非阻塞四条：④double-escaped 只看 1 个反斜杠，应数奇偶（3 个时 now=0 should=1）；⑤stats.points 段级、stats.restored 块级，report.ts 注释当比例是量纲混算（一块 3 段实测 3/1）；⑥缺 .gitignore 而 config.ts:37 与 seen.ts:8 以扩展目录为落点，pi 一跑就多出 pi-escape-guard.json 与 state.json 两个未跟踪文件；⑦bin/measure.mjs:38 直接 scan 不传 skipFixtures，与运行时 toolResult.ts:13 不一致。另答 Q4：变异存活那条不是纯冗余——validMessage 在 touched>0 之后才判，而 note(g) 与 scan 里的 seen.add 在它之前，删掉 role 检查后文本仍返回 undefined 但 stats.points 0→1、firstSeen 1→2，「行为不变」只对文本成立。现取 npm test tests 37/pass 37/fail 0、mutate caught 8/survived 1、all.mjs files 88/points 56/saved 1188=expected/ratio 1/failFiles 9、git status 为 M src/index.ts 与 ?? reviews/review-impl-b711ced1.md。）

## 七、第三次取证：`0.1.1` 已发（2cb30d8），我这条围栏缺陷两方都没抓到

```
$ git log --oneline -3
2cb30d8 pi-escape-guard 0.1.1：实现复核的三条，全部是真缺陷
8b39001 实现复核 0.1.0：不认可（三条：sessionOf 恒 default、stats 两个死字段、变异存活是记账缺口）
ae4fcf3 pi-escape-guard 0.1.0：把设计写成代码
```

**`2cb30d8` 按的是 6e8dd769 的三条，与我重合两条半**：`sessionOf` 恒 default、`stats.toolResults`/`stats.marked` 恒 0、
「存活变异是记账缺口不是纯冗余」（我的 Q4 与他的第 3 条同结论）。两方独立跑到同一条，这条按交叉验证算定案，我认。
改动只碰 `src/index.ts` + `test/hooks.test.ts` + `bin/mutate.mjs` + 文档；

```
$ md5sum src/scan.ts src/judges.ts src/features/strict.ts
27fa2885… src/scan.ts          ← 与我复核 0.1.0 时同一个 md5
cbb75748… src/judges.ts        ← 同上
80723f4b… src/features/strict.ts ← 同上
```

所以第 1、2、4、5、7 条**一行未动**，第 3 条所在的 `toolResult.ts` / `assistant.ts` 也不在 `git diff --name-only ae4fcf3 2cb30d8` 里。
0.1.1 现在 `npm test 37/37/0`、`bin/mutate 11 抓 0 存活`——两个都绿，但上面 5 条仍然红：**变异集没有围栏的样本，所以变异绿不代表围栏对**。

### 这一条我要点出来：6e8dd769 的回执写「还原动作本身无缺陷」

他的 `8b39001` 说「fuzz 867 段 0 失配 0 残留，边界表 15 条逐条对得上」。我信他的 fuzz——但 fuzz 的输入形状决定它看不见什么：
`~~~` 出现在 ```` ``` ```` 块内是**结构**样本，不是字符样本，随机段生成器天然不产这种输入。
两方复核都漏了它，而它落在**误伤方向**（代码被改），比漏判重一档。这也是我坚持它阻塞的理由。

### 0.1.1 把运行时生成的配置文件 commit 了 —— 我第 6 条第二条证据

```
$ git ls-files | grep json
package.json
pi-escape-guard.json      ← config.ts 的 ensureConfig() 在运行时写出来的那个
```

这比「会多两个未跟踪文件」严重一档：现在**改配置会脏工作区**，而 `SETTINGS.md:20` 告诉用户「改完不用重启」，
等于教人制造 dirty tree；同时同一份默认值有了两处真值（仓库里这份 + `DEFAULTS` 常量），改一处不改另一处就会分叉。
修法两条一起：`git rm --cached pi-escape-guard.json` + 仓库根加 `.gitignore`（`pi-escape-guard.json`、`state.json`）。

另：仓库根现在有一个 `?? _p.cjs` 未跟踪（不是我的，我没动仓库），commit 前清掉。

结论: 不认可（理由：0.1.1（2cb30d8）按 6e8dd769 的三条改的都是我认的——sessionOf 恒 default 是我漏的真缺陷、两个死字段已接线、变异存活是记账缺口这个结论与我的 Q4 相同，两方独立到同一条按交叉验证定案；但 0.1.1 只碰了 src/index.ts、test/hooks.test.ts、bin/mutate.mjs 与文档，`md5sum src/scan.ts src/judges.ts src/features/strict.ts` 与 0.1.0 完全相同，所以我报的 7 条里第 1、2、4、5、7 条一行未动、第 3 条所在的 toolResult.ts/assistant.ts 也不在 `git diff --name-only ae4fcf3 2cb30d8` 里，`npm test 37/37/0` 与 `bin/mutate 11 抓 0 存活` 两个绿都盖不住它们——变异集里没有围栏样本。仍阻塞三条：①围栏状态机不校验字符与长度（src/scan.ts:38-39），``` 块里出现 ~~~ 或外层 ~~~ 里示范 ``` 会提前闭合围栏、块内转义被当正文还原，复跑 %TEMP%/impl-repro.mjs 的 1a/1b/1c 均 now=1 should=0，方向是改坏代码，而 6e8dd769 的回执写「还原动作本身无缺陷」——他的 fuzz 867 段是字符样本，产不出这种结构样本，两方都漏；②strict/ratio 死配置（features/strict.ts 的 c2Pass/allCJK/mostlyCJK 无调用者，judges.ts:21 另有一份 CJK 正则），SETTINGS.md:24 承诺的「降 strict」无效（段 a你好 解出 a你好，strict=false ratio=0.1 仍 not-all-cjk）；③report 死配置（`grep -rn cfg.report src/` 零命中，report=false 后 stats.points 仍 0→1）。非阻塞四条：④double-escaped 只看 1 个反斜杠，应数奇偶（3 个时 now=0 should=1）；⑤stats.points 段级、stats.restored 块级，report.ts 注释当比例是量纲混算（一块 3 段实测 3/1）；⑥0.1.1 把运行时生成的 pi-escape-guard.json commit 了（`git ls-files | grep json` 可见），改配置会脏工作区且默认值有两处真值，修法是 `git rm --cached` 加 .gitignore，state.json 同批；⑦bin/measure.mjs:38 直接 scan 不传 skipFixtures，与运行时 toolResult.ts:13 不一致。现取 npm test tests 37/pass 37/fail 0、mutate caught 11/survived 0、all.mjs files 88/points 56/saved 1188=expected/ratio 1/failFiles 9、HEAD 2cb30d8、工作区 M reviews/review-impl-b711ced1.md 与 ?? _p.cjs。）
