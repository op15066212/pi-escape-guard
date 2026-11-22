# 实现复核（第三轮 / 定稿）：pi-escape-guard 0.1.3

复核者：窗口 6e8dd769。采样 2026-11-20T18:13:49+08:00。对象：commit `a1ff468`，version 0.1.3，`git status --short .` 空。

## 0 结论

**不认可，两条，都是一行改动。** 三条修复本身都真修好了（第③条我做了证伪实验，见 §1.3）。两条剩的是「报告层」：一条让你这轮最值钱的修复（SKIP 计入失败）在默认输出里看不见，一条让 `points` 的注释第三次与代码不符。

## 1 三条修复：逐条验（两条实测 + 一条证伪）

### 1.1 ① `attempted` 删了、注释改了 —— 删干净了，注释没 google 到

```
grep -rn "attempted" src/ test/ bin/ → 0 命中
grep -rn "attempted" HISTORY.md → 2 命中（历史记录，保留正确）
src/features/report.ts:8  comments → 「points 扫到的段（restore 与 mark 都算），不是「还原成功的段」」
src/features/report.ts    stats 对象里只剩 points / blocksRestored / … ，attempted 字段已删
```
删字段这一半 ✓。`test/report.test.ts` 已改成断言 `stats.points` ✓。**注释那一半错了**，见 §3.2。

### 1.2 ② `provider.ts` 补传 strict/ratio —— ✓

```
return scan(s, { threshold: cfg.threshold, strict: cfg.strict, ratio: cfg.ratio }).points.length;
```
与 `guard.ts` 的调用现在是同一组参数（threshold + strict + ratio）。三个槽位同一套判据 ✓。

### 1.3 ③ SKIP 计入失败 —— ✓，我造了坏样本，它会红

这是我唯一不满足于「读代码说改了」的一条，所以做了证伪：把 `MUTANTS` 第一条的锚点改成不存在的串，跑，看 rc。

```
# 造坏锚点：把 'if (esc' 前面插 ___NOPE___
node -e "… s.split('\"src/judges.ts\", \"if (esc').join('\"src/judges.ts\", \"___NOPE___if (esc') …"
node bin/mutate.mjs
→ 锚点失效 C4 阈值边界 @ src/judges.ts
→ 锚点失效（等同未覆盖）: C4 阈值边界
→ {"caught":14,"survived":0,"skipped":1,"names":["C4 阈值边界"]}
→ rc=1          ← 会红 ✓
# 恢复后
→ rc=0, git status 空 ✓
```
你写的「锚点找不到就跳过与判据恒真是同一种病」我同意——而且现在它有坏样本了，不是一句口号。

## 2 三条验收（复跑）

```
npm test            → tests 47 / pass 47 / fail 0 / skipped 0
node bin/mutate.mjs → caught 15 / survived 0 / skipped 0   （rc=0）
node bin/all.mjs    → 连跑 3 次同一时刻：{"points":58,"saved":1206,"expected":1206,"ratio":1} ×3（确定性 ✓）
                       failFiles 8~10 随会话内容变——它不是判据，恒等式才是（我上轮说过，这轮仍然这样）
```
与你报的 ≈55/≈1180/9 同量级；差值来自 jsonl 在长，不是行为差异。

## 3 两条缺陷

### 3.1 `mutate.mjs` 现在打两行 JSON：第一行缺 `skipped`，正好把第③条的成果挡住

```js
// bin/mutate.mjs:47（旧行，没删）
console.log(JSON.stringify({ caught, survived: survived.length, names: survived }));
// bin/mutate.mjs:50（新行）
console.log(JSON.stringify({ caught, survived: survived.length, skipped: skipped.length, names: survived.concat(skipped) }));
```

我复跑的实际输出：

```
{"caught":15,"survived":0,"names":[]}                    ← 第 47 行，没有 skipped
{"caught":15,"survived":0,"skipped":0,"names":[]}       ← 第 50 行，完整
```

读的人（或任何 `JSON.parse(stdout.split("\n")[0])` 的脚本）拿到第一行 → **又是一个没有 skipped 字段的对象**，与 0.1.2 时一模一样。你这轮把 skipped 做进 rc，但默认输出的第一行仍把结论说成「15 抓 0 存活」。

复跑：

```
node bin/mutate.mjs | wc -l      → 2（应为 1）
node bin/mutate.mjs | head -1    → 缺 skipped
```
修法：删第 47 行。

### 3.2 `report.ts` 的注释说 points「restore 与 mark 都算」，实测 mark 不进 points

```ts
// src/features/report.ts:8
//   points                    扫到的段（restore 与 mark 都算），不是「还原成功的段」
```

但 `note()` 只被 `toolResult.ts` 与 `assistant.ts`（S1/S2）调用；S3 走 `markProvider`，它的段记在 `stats.marked`（`index.ts` 里 `stats.marked += markProvider(...)`）。

实测（S3 载荷里放两段成段转义）：

```
{"S3 扫到的段":2,"stats.points 变化":0,"stats.marked 变化":0}
```

markProvider 自己只写 `markState`；`stats.marked` 由 `index.ts` 加。所以 `points` 是**只含 S1/S2**，`marked` 才是 S3——注释把两个槽位说成一个。

这是同一形状的第三次：0.1.0 的 `points/restored` 注释写「比例」而值是块数；0.1.2 的 `points/attempted` 注释写「还原成功 vs 尝试过」而两值相等；0.1.3 注释写「restore 与 mark 都算」而 mark 不在里面。**每次都是注释描述了一个代码里不存在的量。**

修法：注释改成「扫到的段，只含 S1/S2；S3 的段在 marked」。或者把 S3 的段也灌进 points（但那样 marked 又要说明它只含 S3——不如让注释配代码）。

## 4 一条观察（一次观察、未复现，所以不算缺陷）

我第一次跑 `node bin/all.mjs 2>&1 | tail -2` 时，输出里出现过一行 `Node.js v26.13.0`（子进程崩溃的尾行），同一次 points 49 / saved 699；随后连跑 3 次都是 58 / 1206 / 1206，没有那行。未复现。

可疑的是 `bin/all.mjs` 的这行：

```js
try { o = JSON.parse(execFileSync(…)); } catch { continue; }   // 静默跳过，files 仍报总数
```

若某个 measure 子进程崩了，它不计入 P/S/E/skip，但 `files` 仍是 walk 出来的总数 → 分母与 files 不等，而且没有任何提示。这与你这轮刚立的那句是同一句话。若你愿意，加一个 `crashed++` 并让它进 rc，一行。

## 5 已改 / 未改

已改：无（证伪实验改的是 `bin/mutate.mjs`，跑完已从备份恢复，`git status --short .` 空）。
未改：两条都是一行，但都是「这层不存在会漏哪种事故」的判断题——A 漏的是「读输出的人以为全跑完」，B 漏的是「看 points 以为 S3 也算了」。我不替你选。

结论: 不认可（两条，都是一行：① `bin/mutate.mjs:47` 的旧 `console.log` 没删，脚本现在打两行 JSON，第一行 `{"caught":15,"survived":0,"names":[]}` 缺 skipped——复跑 `node bin/mutate.mjs | wc -l` = 2，与 0.1.2 时「读第一行看不到 skipped」是同一个形状；② `src/features/report.ts:8` 注释写「points 扫到的段（restore 与 mark 都算）」，实测 S3 载荷两段 `{"S3 扫到的段":2,"stats.points 变化":0}`——mark 的段在 `stats.marked`，不在 `points`。三条修复本身：① `attempted` 已从 src/test/bin 清零 ✓，② `provider.ts` 已与 `guard.ts` 同一组参数 ✓，③ SKIP 计入失败 ✓（我造坏锚点→rc=1、skipped 1，恢复→rc=0）。p.s. all.mjs 的 catch-continue 有一次未复现的 stderr 泄漏，记为观察，不阻塞。）
