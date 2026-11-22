# 实现复核 5：pi-escape-guard 0.1.5（commit c6d2b16）

复核者 b711ced1 · 2026-11-20T10:23:26Z

**结论：认可（0.1.5）。** 我上一轮唯一阻塞的那句注释改了，改对了，判据对上三处调用点。
我连着三轮报的两处（`report.ts` 头注释里的 `restored`、`toolResult.ts` 的 `saved`）仍在，这轮是第三次——但我三次都写「不阻塞」，不在这里升格。

## 一、验的哪一版

```
$ git log --oneline -2
16c22fd 实现复核第五轮 / 定稿 0.1.5：认可        ← 只加了 reviews/review-impl5-6e8dd769.md，代码未动
c6d2b16 pi-escape-guard 0.1.5：一句注释说错了口径

$ git diff --stat faaf09f HEAD
HISTORY.md | 6 ++, package.json | 2 +-, report.ts | 3 +-, 两个回执
（除 report.ts 那 3 行，源码一行没动——「其余与 0.1.4 完全相同」成立）

$ git status --porcelain → 空
```

## 二、上一轮那条，改对了

```
//   points                    进过 note() 的段 = **只有 restore 槽位**（S1/S2）。
//                             S3 的段不进这里，只进 provider.ts 的 markState——S3 不改文本，算进来会让口径变成两种。
```

与我上轮给的两条 grep 逐个对得上：`note(g)` 只在 `assistant.ts:18` 与 `toolResult.ts:20`；`stats.points` 只在 `report.ts:21` 写入；
`provider.ts` 只写 `markState`。三处对三句，一个不多一个不少。

你那句「注释也是判据，说错了就有人按它实现」我认——这轮的阻塞条就是它自己：一句注释让人以为 S3 的标记也进了 points，
照着它去调 `points` 的人会得到一个永远偏高的分母。

## 三、我仍开着两条（第三次报，不阻塞）

```
$ grep -rn "restored" src/ | grep -v blocksRestored
src/features/report.ts:6://   marked / restored   S3 还能扫到的段数：非零说明 S1/S2 有漏洞

$ grep -n "saved" src/features/toolResult.ts
16:  let touched = 0, saved = 0;
22:    touched += g.points; saved += g.saved;
```

- `restored` 这个字段在 0.1.2 已改名 `blocksRestored`，现在全仓库只在这行注释里出现。修法：`marked / points`（S3 还能扫到的段 vs S1/S2 计入的段），或直接删掉这一行——`marked` 自己的语义在上面已经写清了。
- `saved` 只累加不读（`savedBytes` 走的是 `note(g)` 里的 `g.saved`）。删掉 `:16` 的声明与 `:22` 的 `saved += g.saved`。

为什么仍不升格为阻塞：它不改动作、不改任何数字，只让读的人去找一个不存在的字段名、多读一个死变量。
我 0.1.2、0.1.4 两次都写「不阻塞」，现在改口就是移动门柱。**但我把它记成第三次**：三轮没改，说明它被当噪声了，而它恰好落在你这两轮一直在改的那个头注释里。

## 四、一条观察：改一处留一处

`report.ts` 的头注释这两轮你改了两次：0.1.3 改了 `points` 那一行，0.1.5 又改了同一行的后半句；
同一个注释块里 `restored` 那行（:6）三次都没动。这不是新缺陷，是**同一个动作没收尾**：

```
改完一处注释后跑一条：grep -rn "<你刚改的那个术语或字段名>" src/
残留的那几行就是要不要一起改的判断依据。
```

这条与你自己在 0.1.3 抓到的那条同族：「锚点找不到就跳过」让报告比实际干净；
「改了我指的那句」也让文档比实际一致。两件事的判据都是**扫全量**，不是**改点名的那处**。

## 五、现取

```
npm test            → tests 47 / pass 47 / fail 0
node bin/mutate.mjs → {"caught":15,"survived":0,"skipped":0,"names":[]}   rc=0
node bin/all.mjs    → files 88, points 58, saved 1206 = expected, ratio 1, failFiles 9
```

比你报的 ≈55 / ≈1180 多 3 处 26 字节，盘在写。另：这轮我又看到一次 ` M src/slots.ts` 出现又消失，两次之间 HEAD 未变——
与上轮同一现象（并发写），不影响本次判定，记在这里。

## 六、已改 / 未改

已改：无。仓库一字节未动（`git status --porcelain` 只多出 `?? reviews/review-impl5-b711ced1.md`，即本文件）。
未改：第三节两条（不阻塞，第三次）。

结论: 认可（0.1.5 · commit c6d2b16；HEAD 16c22fd 只加了 6e8dd769 的回执，代码未动，`git diff --stat faaf09f HEAD` 除 report.ts 3 行外源码一行没改，`git status` 空）。上一轮唯一阻塞条已改对：report.ts 头注释现写「points 进过 note() 的段 = 只有 restore 槽位（S1/S2）；S3 的段不进这里，只进 provider.ts 的 markState」，与我给的两条 grep 逐个对得上（note(g) 只在 assistant.ts:18 与 toolResult.ts:20，stats.points 只在 report.ts:21 写入，provider.ts 只写 markState）。「注释也是判据，说错了就有人按它实现」这句我认——这轮阻塞条就是它自己：照那句去调 points 的人会拿到永远偏高的分母。现取 npm test 47/47/0、mutate {"caught":15,"survived":0,"skipped":0} rc=0、all.mjs files 88/points 58/saved 1206=expected/ratio 1/failFiles 9（你报 55/1180，差 3 处 26 字节，盘在写）。我仍开着两条、第三次报、不升格为阻塞：report.ts:6 的「marked / restored」里 restored 在 0.1.2 已改名 blocksRestored、全仓库只剩这行注释（修法：改成 marked / points 或删掉该行），toolResult.ts:16/22 的 saved 只累加不读、savedBytes 走 note(g) 里的 g.saved（删两行）；不升格的理由是我 0.1.2 与 0.1.4 两次都写「不阻塞」，现在改口就是移动门柱，但它落在你这两轮一直在改的那个头注释里，三轮没改说明它被当噪声了。另有一条观察：report.ts 头注释你两轮改了两次（0.1.3 改 points 那行、0.1.5 改同一行后半句），同块的 restored 那行三次没动——这是「同一个动作没收尾」，判据是改完一处后 grep 一遍刚改的术语看全文件残留，与你 0.1.3 自己抓到的「锚点找不到就跳过」同族：都让文件比实际干净，判法都是扫全量而不是改点名那处。另记一条：这轮又出现一次 ` M src/slots.ts` 出现又消失、两次之间 HEAD 未变（与上轮同一并发现象），不影响判定。仓库一字节未动，本回执是唯一新增。）
