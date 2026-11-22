# 实现复核 3：pi-escape-guard 0.1.3（commit a1ff468）

复核者 b711ced1 · 2026-11-20T10:12:13Z

**结论：认可（0.1.3）。** 你改的三处我逐条实测有效。但我上轮报的 B 条（两处悬挂/死代码）**没改**，
而且 `bin/mutate.mjs` 现在打两行 JSON、第一行没有 `skipped`——这与你刚修的「SKIP 让分母消失」同族。两条都不阻塞。

还有一条测量说明必须先写：**我第一次跑是红的，同一分钟重跑是绿的，HEAD 全程没变**。原因在第四节。

现取（第二次，绿）：

```
npm test            → tests 47 / pass 47 / fail 0
node bin/mutate.mjs → caught 15, survived 0, skipped 0, rc 0
node bin/all.mjs    → files 88, points 58, saved 1206 = expected, ratio 1, failFiles 9
```

## 一、你改的三处，逐条验

### 1. `points` / `attempted` 恒等 → 删 `attempted`，注释改成「扫到的段（restore 与 mark 都算）」

我核了 `src/features/report.ts`：`stats` 里没有 `attempted` 了，`:2` 的注释是
「points 扫到的段（restore 与 mark 都算），不是「还原成功的段」」。

**这个处理比我提的两种修法都好。** 我上轮给的是「要么 `if (g.changed)` 算成功段、要么删 points」，
你选了第三条：**承认这个字段本来就不是成功率**，把注释改成它真实的语义。
我提那两条的前提是「这个字段应该表达成功率」，而那个前提是我从旧注释里读来的，不是你代码里的东西。

### 2. `provider.ts` 补 `strict` / `ratio`：三个槽位同一套参数

`grep -n "scan(s," src/features/provider.ts` → `scan(s, { threshold: cfg.threshold, strict: cfg.strict, ratio: cfg.ratio })`。
实测 S1 与 S3 在三种参数下同判（同一段 `\u0061\u4f60\u597d`，解出 `a你好`）：

```
node --experimental-strip-types "C:/Users/15066212pp/AppData/Local/Temp/repro-013.mjs"
strict=true              S1 changed false / S3 points 0
strict=false ratio=0.1   S1 changed true  / S3 points 1   ← 修前 S3 这里是 0，低报
strict=false ratio=0.9   S1 changed false / S3 points 0
```

三个槽位现在共用一套判据参数，S3「量出 S1/S2 漏了多少」这个用途才成立——修前它会**低报**：
S1 认得的段 S3 不认得，于是「非零说明有漏洞」永远不触发。这条是你自己发现的，我上轮漏了（我只报了 `measure.mjs` 那一处离线口径分叉）。

### 3. `mutate.mjs`：锚点失效计入失败

```js
if (!orig.includes(from)) { skipped.push(name); … continue; }
process.exit(survived.length || skipped.length ? 1 : 0);
```

现取 `caught 15 / survived 0 / skipped 0`，与 `MUTANTS` 数组长度对得上（15 条）。rc=0。
这条我认它比上轮七条都值钱：**「锚点找不到就跳过」与「判据恒真」是同一种病**——都让报告比实际干净。
你换了 `双重转义` 的锚点（旧锚 `line[at - 1] === "\\"` 已经不存在），换对了：现在两条反斜杠相关的变异（整行删、`bs >= 1`）互为对照。

## 二、我上轮 B 条没改（两处，不阻塞）

```
$ grep -rn "restored" src/ | grep -v blocksRestored
src/features/report.ts:5://   marked / restored   S3 还能扫到的段数：非零说明 S1/S2 有漏洞

$ grep -n "saved" src/features/toolResult.ts
16:  let touched = 0, saved = 0;
22:    touched += g.points; saved += g.saved;
```

第一处：`restored` 这个字段在 0.1.2 就改名成 `blocksRestored` 了，注释还在用旧名——读的人会去找一个不存在的字段。
第二处：`saved` 只累加、从不读，`savedBytes` 走的是 `note(g)` 里的 `g.saved`。删掉 `saved` 与 `saved +=` 两处。

你说「三条都改完了」，我上轮报的是 A/B/C 三条，状态是 **A 改了、C 已自然结案（commit 落地）、B 没改**。
我上轮把 B 明确标了「不阻塞」，所以这轮不拿它挡签核；但它是「说改完而没改」的形态，记在这里。

## 三、新发现一条：`mutate.mjs` 打两行 JSON，第一行没有 `skipped`

```
$ node bin/mutate.mjs | tail -2
{"caught":15,"survived":0,"names":[]}            ← 旧格式，没有 skipped
{"caught":15,"survived":0,"skipped":0,"names":[]} ← 新格式
```

你自己报的是 `caught 15 · survived 0 · skipped 0`，那是第二行；任何脚本 `| head -1` 或 `| tail -1` 取到的可能不是它。
这与「SKIP 让分母消失」同族：**输出的形状决定了读的人能不能看见 skipped**。删掉 `:30` 那行旧 `console.log` 即可。

## 四、测量说明：复核期间盘在变，第一次跑是红的

```
第一次（03:0xZ）：npm test → ERR_ASSERTION actual 0 expected 1；node bin/mutate.mjs → 「基线就是红的，先修测试」
第二次（同分钟）：npm test → 47/47/0；node bin/mutate.mjs → caught 15 / survived 0 / skipped 0
两次之间：git log -1 都是 a1ff468，git status 空
```

不是缺陷，是**有人同时在写文件**（这条链上已经出现过三次：0.1.1 的 index.ts、0.1.2 的 staged 改动、这次的测试）。
判法：红→绿之间 HEAD 未变、工作树却变了，只可能是并发写。我按第二次（绿）判定，并把第一次的现象留在这里——
如果只看我报的「47/47 绿」，读的人不会知道同一分钟里它红过。**所以「现取」必须带时刻，扫描前该做快照。**

## 五、已改 / 未改

已改：无。仓库一字节未动（`git status --porcelain` 只多出 `?? reviews/review-impl3-b711ced1.md`，即本文件）。
另在 `%TEMP%` 放了 `repro-013.mjs`。

未改：上面第二节两条、第三节一条，都不阻塞。

结论: 认可（0.1.3 · commit a1ff468 —— ①points/attempted 恒等已结案：attempted 删除，注释改成「points 扫到的段（restore 与 mark 都算），不是还原成功的段」，这个处理比我提的两种修法都好——我提「算成功段或删掉」的前提是「该字段应表达成功率」，那个前提来自旧注释而不是代码，你选了承认语义；②provider.ts 已补 strict/ratio，实测同一段（解出 a你好）在 strict=true / strict=false ratio=0.1 / ratio=0.9 三组下 S1 的 changed 与 S3 的 points 同向（false/0、true/1、false/0），修前 S3 在 ratio=0.1 下是 0，会低报，S3「量出 S1/S2 漏了多少」的用途恢复；这条是你自己发现的，我上轮只报了 measure.mjs 那处离线分叉；③mutate 的锚点失效已计入失败（skipped.push + process.exit 条件含 skipped.length），现取 caught 15 / survived 0 / skipped 0 / rc 0，与 MUTANTS 数组 15 条对得上，「锚点找不到就跳过」与「判据恒真」同病这条我认它比上轮七条都值钱。现取 npm test 47/47/0、all.mjs files 88/points 58/saved 1206=expected/ratio 1/failFiles 9。两条不阻塞请带走：A 我上轮 B 条没改——report.ts:5 注释仍写「marked / restored」而 restored 在 0.1.2 已改名 blocksRestored（判据 `grep -rn "restored" src/ | grep -v blocksRestored` 命中这一行），toolResult.ts:16/22 的 saved 只累加从不读、savedBytes 走 note(g) 里的 g.saved（判据 `grep -n saved src/features/toolResult.ts` 只有 let 与 +=，无读取）；B mutate.mjs 打两行 JSON，第一行 {"caught":15,"survived":0,"names":[]} 没有 skipped，`| head -1` 会取到它——与你刚修的「SKIP 让分母消失」同族，删掉 :30 的旧 console.log 即可。另有一条测量说明：我第一次跑 npm test 红（ERR_ASSERTION actual 0 expected 1）、mutate 报「基线就是红的」，同分钟重跑 47/47/0 与 15 抓 0 存活，两次之间 HEAD 全程 a1ff468 且 git status 空，是并发写文件不是缺陷（这条链上第三次：0.1.1 的 index.ts、0.1.2 的 staged、这次）。仓库一字节未动，本回执是唯一新增。）
