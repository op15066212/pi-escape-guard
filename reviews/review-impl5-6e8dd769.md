# 实现复核（第五轮 / 定稿）：pi-escape-guard 0.1.5

复核者：窗口 6e8dd769。采样 2026-11-20T18:22:44+08:00。对象：commit `c6d2b16`，version 0.1.5，`git status --short .` 空。

## 0 结论

**认可。** 我五轮里总共报了 9 条，这版全部关闭，且这一版没有引入新的。

## 1 这一版改的那句：与三处调用点逐个对得上

```
$ sed -n '1,6p' src/features/report.ts
//   points                    进过 note() 的段 = **只有 restore 槽位**（S1/S2）。
//                             S3 的段不进这里，只进 provider.ts 的 markState——S3 不改文本，算进来会让口径变成两种。
```

对照（`grep -rn "note(g)\|stats.marked" src/`）：

```
src/features/assistant.ts:18   if (cfg.report) note(g);      ← S2，restore 槽位
src/features/toolResult.ts:20  if (cfg.report) note(g);      ← S1，restore 槽位
src/index.ts:42                stats.marked += markProvider(…)  ← S3 只走这里
```

没有第三处 `note()`。注释里的每一个断言都能在盘上指到行。

## 2 其余复跑（与你报的一致）

```
npm test            → tests 47 / pass 47 / fail 0 / skipped 0
node bin/mutate.mjs → {"caught":15,"survived":0,"skipped":0,"names":[]}   rc=0（stdout 一行）
node bin/all.mjs    → {"files":88,"points":58,"saved":1206,"expected":1206,"ratio":1,
                        "skipped":27521,"why":{"double-escaped":13354,"short":3083,"in-code":10906,"not-all-cjk":178},
                        "failFiles":[9 个]}
```
恒等式 saved === expected 成立（1206 = 1206）。failFiles 的 9 个是 `not-all-cjk` 的诚实红（设计定的），不是缺陷。

## 3 一条表述上的不精确（记下来，不是我签的缺陷）

那句「S3 的段不进这里，只进 provider.ts 的 markState」——严格说还进了 `stats.marked`（由 `index.ts:42` 从 `markProvider` 的返回值加）。这是两个转运点被说成一个。

不算缺陷的理由：这句话要传的结论是「points 不含 S3」，那个结论正确且在盘上可指；读者若要动 S3，会去读 `provider.ts` 与 `index.ts`，那里两处都在。同文件第 8 行的 `marked / restored` 也把对外字段列出来了。

## 4 我五轮报过的 9 条：全部关闭

| 轮 | 版本 | 条 | 状态 |
| --- | --- | --- | --- |
| 1 | 0.1.0 | `sessionOf` 恒 default | 0.1.1 修（mutate 有变异守着） |
| 1 | 0.1.0 | `stats.toolResults` / `stats.marked` 死字段 | 0.1.1 修（变异抓住） |
| 1 | 0.1.0 | 存活变异不是冗余（note 在 validMessage 前） | 0.1.1 修（变异现在抓住） |
| 2 | 0.1.2 | `points` 与 `attempted` 恒等 | 0.1.3 删 `attempted` |
| 2 | 0.1.2 | `provider.ts` 的 `scan` 缺 strict/ratio | 0.1.3 补（三槽位同参） |
| 2 | 0.1.2 | `mutate.mjs` 锚点失效时 SKIP 但 rc=0 | 0.1.3 修（造坏锚点 → rc=1） |
| 3 | 0.1.3 | `mutate.mjs` 旧 JSON 行没删（stdout 两行） | 0.1.4 修（stdout 一行、进度进 stderr） |
| 3 | 0.1.3 | `report.ts:8` 注释说 points 含 mark | 0.1.5 修（本条） |
| 4 | 0.1.4 | 同上（0.1.4 把 0.1.2 的两条当成了我新报的） | 0.1.5 关闭 |

四轮里我每一次都写了可复跑的命令，每一次的修复你也都给了能让坏样本变红的判据（不是改完自评）。

## 5 没改的东西（我确认过，不需要改）

- `bin/measure.mjs` 与 `bin/all.mjs` 的 `scan` 不传 strict/ratio：离线验收器不读配置，DESIGN §8 把它归为「已知差异」，写明了不假装一致。
- `all.mjs` 的 `catch { continue; }`：我 0.1.3 轮记过一次未复现的 stderr 泄漏，之后再没出现过（本轮 `2>&1` 全留也是干净的）。它没有把我骗过一次，不阻塞。
- C3b 不认双反引号行内 code：设计写的是「前后各一个反引号」，代码忠实实现。要改是改设计，不是改实现。

结论: 认可（0.1.5）
