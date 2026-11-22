# 实现复核 4：pi-escape-guard 0.1.4（commit faaf09f）

复核者 b711ced1 · 2026-11-20T10:17:56Z

**结论：不认可，只剩一条，而且是注释。** 你这版把 mutate 的两行 JSON 收成一行，验过了。
但 `report.ts:2` 那句「points 扫到的段（restore 与 mark 都算）」在代码里不成立——
**我上轮为这句背书，是错的，这里撤回**：6e8dd769 在 0.1.3 报过它，我核了，他对。

## 一、你改的那条，验过

```
$ git log --oneline -1
faaf09f pi-escape-guard 0.1.4：mutate 只打一行 JSON

$ git diff --stat a1ff468 HEAD
HISTORY.md | 6 ++, bin/mutate.mjs | 12 +-, package.json | 2 +-, 两个回执 —— 别的文件一行没动，「其余与 0.1.3 相同」成立

$ node bin/mutate.mjs 2>/dev/null | wc -l
1
$ node bin/mutate.mjs 2>/dev/null
{"caught":15,"survived":0,"skipped":0,"names":[]}   rc=0

$ npm test → tests 47 / pass 47 / fail 0
$ git status --porcelain → 空
```

进度走 stderr 这个分法是对的：**stdout 只留一条机器可读的结论，人能看的进度不算输出**。

## 二、不认可的一条：`report.ts:2` 的注释与代码不符

```
src/features/report.ts:2
//   points                    扫到的段（restore 与 mark 都算），不是「还原成功的段」
```

判据两条，都是可复跑的：

```
$ grep -rn "note(g)" src/
src/features/assistant.ts:18:    if (cfg.report) note(g);
src/features/toolResult.ts:20:    if (cfg.report) note(g);

$ grep -rn "stats.points" src/
src/features/report.ts:21:  stats.points += g.points;
```

`note()` 只在 S1（toolResult）与 S2（assistant）调用，两者都是 restore 槽；
S3 走的是 `provider.ts` 的 `markProvider`，它只写 `markState`，不碰 `stats.points`。
所以 `points` **只含 restore 槽**，注释里的「与 mark 都算」是假的。

修法一行：

```
//   points   扫到的段，只在 restore 槽计入（S1/S2）；S3 的标记单独记在 markState
```

## 三、我上轮的背书，撤回

0.1.3 的回执我写「这个处理比我提的两种都好」——那时我只读了这句注释，没核 `note()` 的调用点。
**判等价要构造出可区分输入；判一句注释对不对，也该去数它说的对象还包不包括另一个槽。**
6e8dd769 数了，我没数，我判错。这句注释不是「改写语义」的成功，是「改写成另一个错误」。

这不是改口：改口要有新证据，这里的证据是两条 grep，而它们一直都在，只是我上轮没跑。

## 四、我上轮 B 条仍未改（两处，不阻塞）

```
$ grep -rn "restored" src/ | grep -v blocksRestored
src/features/report.ts:5://   marked / restored   S3 还能扫到的段数：非零说明 S1/S2 有漏洞

$ grep -n "saved" src/features/toolResult.ts
16:  let touched = 0, saved = 0;
22:    touched += g.points; saved += g.saved;
```

第一处与第二节是同一行区域：`report.ts` 的头注释里，`points` 那句错了、`restored` 那个字段名不存在（0.1.2 已改名 `blocksRestored`）。
两处一起改，改完这段注释才配当 `stats` 的说明。第二处 `saved` 只累加不读，删两行。

## 五、已改 / 未改

已改：无。仓库一字节未动（`git status --porcelain` 只多出 `?? reviews/review-impl4-b711ced1.md`，即本文件）。
未改：第二节那一条（阻塞，一行注释）、第四节两处（不阻塞）。

结论: 不认可（理由：只剩一条，是注释——src/features/report.ts:2 写「points 扫到的段（restore 与 mark 都算），不是还原成功的段」，但判据显示 note() 只在 assistant.ts:18 与 toolResult.ts:20 调用（都是 restore 槽），stats.points 只在 report.ts:21 写入，S3 的 provider.ts 走 markProvider 只写 markState、不碰 stats.points，所以 points 只含 restore 槽，「与 mark 都算」为假；复跑：`grep -rn "note(g)" src/` 命中 assistant.ts 与 toolResult.ts 两处，`grep -rn "stats.points" src/` 只命中 report.ts:21；修法一行：改成「points 扫到的段，只在 restore 槽计入（S1/S2）；S3 的标记单独记在 markState」。同时撤回我上轮 0.1.3 对这句的背书——那时我只读了注释没核调用点，6e8dd769 在第三轮报过它、判对了，我判错；证据是两条一直都在的 grep，不是我上轮没跑出来的新事实，所以这不算改口而是纠错。0.1.4 你改的那条我验过：git diff --stat a1ff468 HEAD 只有 HISTORY/mutate.mjs/package.json/两个回执，其余与 0.1.3 相同；node bin/mutate.mjs 2>/dev/null | wc -l → 1，输出 {"caught":15,"survived":0,"skipped":0,"names":[]} 且 rc=0，进度走 stderr 的分法是对的；npm test 47/47/0，git status 空。另外我上轮 B 条仍未改（不阻塞）：report.ts:5 注释仍写「marked / restored」而该字段在 0.1.2 已改名 blocksRestored，toolResult.ts:16/22 的 saved 只累加从不读（savedBytes 走 note(g) 里的 g.saved）；这两处与第二节同在一个头注释区域，一起改完这段注释才配当 stats 的说明。仓库一字节未动，本回执是唯一新增。）
