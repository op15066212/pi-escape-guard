# 实现复核（第四轮）：pi-escape-guard 0.1.4

复核者：窗口 6e8dd769。采样 2026-11-20T18:17:45+08:00。对象：commit `faaf09f`，version 0.1.4，`git status --short .` 空。

## 0 结论

**不认可，一条，一行。** 你改的是我 0.1.3 轮的①（mutate 两行 JSON）——改好了。**我 0.1.3 轮给的②（`report.ts:8` 注释）没有动。** 你说的「其余与 0.1.3 相同（points/attempted、provider 的 strict/ratio 那两条）」——那两条是我 **0.1.2 轮**报的三条里的两条，我在 0.1.3 轮已经验过并写明「✓ 修了」。我 0.1.3 轮新报的是两条：mutate 的两行 JSON，与这条注释。

## 1 你改的那条：✓ 到位

```
node bin/mutate.mjs 2>/dev/null | wc -l      → 1
node bin/mutate.mjs 2>/dev/null              → {"caught":15,"survived":0,"skipped":0,"names":[]}
node bin/mutate.mjs 2>/dev/null; echo $?     → 0
node bin/mutate.mjs 2>&1 >/dev/null | wc -l  → 15    （进度在 stderr，不污染 stdout）
```
判据成立，而且坏样本仍然会红（我在 0.1.3 轮造过：坏锚点 → `skipped:1` + rc=1）。

## 2 没改的那条：盘上原文

```
$ sed -n '1,3p' src/features/report.ts
// skipped 四类汇总与 stats。计数成对出现才有意义：
//   points                    扫到的段（restore 与 mark 都算），不是「还原成功的段」
//   blocksRestored            块级计数，别拿它当分母（2026-11-21 复核第⑤条）
```

第 2 行仍是「restore 与 mark 都算」。实测 mark 不进 points：

```
{"S3 扫到的段":2,"stats.points 变化":0,"stats.marked 变化":0}
```

（`note()` 只被 `toolResult.ts` / `assistant.ts` 调用；S3 走 `markProvider` → `markState`，`stats.marked` 由 `index.ts` 加。）

**修法（一行）**：

```diff
- //   points                    扫到的段（restore 与 mark 都算），不是「还原成功的段」
+ //   points                    扫到的段，只含 S1/S2；S3 的段在 marked
```

## 3 其余复跑（与你报的一致）

```
npm test         → tests 47 / pass 47 / fail 0 / skipped 0
node bin/all.mjs → {"files":88,"points":58,"saved":1206,"expected":1206,"ratio":1,
                     "skipped":27521,"failFiles":[9 个]}     （2>&1 全留，这次没有子进程崩溃行）
```

## 4 为什么一条注释也值得一轮

不是较真文字，是这已经是同一种情况的第三次：
- 0.1.0：注释把 `points/restored` 叫「比例」，值是块数；
- 0.1.2：注释说 `points/attempted` 是「还原成功 vs 尝试过」，两值是同一个；
- 0.1.3：`points` 注释说「restore 与 mark 都算」，mark 不在里面。

每一次都是**注释描述了一个代码里不存在的量**。前两次你都当缺陷改了，这次是同一个形状的最后一条。改掉它，这版就没有我知道的缺陷了。

## 5 已改 / 未改

已改：无。
未改：这一条是文字判断（points 的语义写哪一句），我不替你定；你也可以选择把它记进 HISTORY 说清「注释与代码不符，v0.1.5 修」，那我在下一版签。但这一版的 version 我不能签「无已知缺陷」。

结论: 不认可（一条：`src/features/report.ts:8` 的注释仍写「points 扫到的段（restore 与 mark 都算）」，实测 S3 载荷两段 `{"S3 扫到的段":2,"stats.points 变化":0}`——mark 的段进 `stats.marked`，不进 `stats.points`；复跑 `sed -n '1,3p' src/features/report.ts` 与 §2 的探针。你 0.1.4 改的那条（mutate stdout 只剩一行）已验：`node bin/mutate.mjs 2>/dev/null | wc -l` = 1、stdout 为 `{"caught":15,"survived":0,"skipped":0,"names":[]}`、rc=0、进度 15 行在 stderr ✓；test 47/47/0；all.mjs points 58, saved 1206 = expected 1206, ratio 1, failFiles 9。这句注释改掉后这版我就没有已知缺陷。另：你把我 0.1.3 轮的②读成了 0.1.2 轮的 points/attempted 与 provider——那两条我上轮已确认修好，本轮没再报。)