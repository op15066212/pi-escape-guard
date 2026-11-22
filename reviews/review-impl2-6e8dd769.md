# 实现复核（第二轮）：pi-escape-guard 0.1.2

复核者：窗口 6e8dd769。采样时刻 2026-11-20T18:04:52+08:00。对象：commit `1fd60b4`，package.json version 0.1.2，`git status --short .` 空（这一刻是干净的；我第一次采样时它还列着 6 个 staged 文件，是提交进行中）。

## 0 结论

**不认可，三条。** 我上一轮的三条确实修了（逐条实测，见 §2），b711ced1 的七条抽验也基本落地（§3）。三条新的都是修复引入或漏改的：

1. `stats.points` 与 `stats.attempted` 恒等——两个名字一个值，且 `report.ts` 注释说 points 是「还原成功的段」，代码里从没记过这个量。
2. `provider.ts` 调 `scan()` 时不传 `strict`/`ratio` → 配了 `strict:false` 时 S1 还原、S3 不认。死配置的残留一处。
3. `bin/mutate.mjs` 有一条锚点已被 0.1.2 的改动删掉：它打 `SKIP(找不到锚点)`，但脚本 rc=0、JSON 仍报 `caught:14, survived:0`，HISTORY 写「14 个变异全部抓住」——数组里其实是 **15 条**，那一条从分母里消失了。

## 1 三条验收（复跑）

```
npm test            → tests 47 / pass 47 / fail 0 / skipped 0 / todo 0
node bin/mutate.mjs → caught 14, survived 0——但见 §4.3：另有一条打了 SKIP
node bin/all.mjs    → {"files":88,"points":95,"saved":2004,"expected":2004,"ratio":1,
                        "skipped":27252,"why":{"double-escaped":13255,"short":3057,"in-code":10763,"not-all-cjk":177},
                        "failFiles":[8 个]}
```
恒等式 saved === expected 成立（2004 = 2004，ratio 1）。points 从 0.1.0 的 56 涨到 95、saved 1188→2004，是「反斜杠奇偶」那条修完之后更多段被认（3 个反斜杠现在还原），加上会话在长——方向对，我按 §4.4 逐档验过。

## 2 我上一轮报的三条：都修了（逐条实测）

| # | 验法 | 结果 |
| --- | --- | --- |
| ① `sessionOf` 取真位置 | 代码改成 `ctx?.sessionManager?.getSessionId?.() || …`；mutate 有对应变异 | ✓ 修了。变异「会话 id 取 pi 的真位置」**抓住**（说明有测试守着）；旧写法留在 `||` 链末尾当兜底，不改变行为 |
| ② 两个死字段 | `index.ts` 加 `stats.toolResults++`、stats.marked += markProvider(...)` | ✓ 修了。变异「toolResults 计数」抓住 |
| ③ 变异存活不是冗余 | 上一轮我给的探针：user 消息过 `stripAssistant` 后看 stats | ✓ 修了。变异「S2 只动 assistant」现在**抓住**，0.1.0 时它是存活的 |

## 3 b711ced1 七条：抽验（不是我的责任，但改到的面我都看了）

| # | 我的验法 | 结果 |
| --- | --- | --- |
| ① 围栏 (字符, 长度) | 4 个构造：开3 内含 `~~~`、开5 关3、开5 关5、开3 关5 | ✓ 全对。开3 内含 `~~~` 不再闭合（5 行 in-code）；开5 关3 不闭合；开5 关5 与 开3 关5 都闭合 |
| ② strict/ratio 死配置 | 看 `judges.ts` 现在 import `c2Pass`；变异「C2 走 c2Pass」抓住 | ✓ judges 侧修了；**但 S3 漏了**，见 §4.2 |
| ③ report 死配置 | `toolResult.ts` / `assistant.ts` 各 `if (cfg.report) note(g)`；变异抓住 | ✓ |
| ④ 反斜杠奇偶 | 前缀 0/1/2/3/4 各一条 | ✓ 还原、不动、还原、不动、还原——与现代 JSON 语义一致（总反斜杠奇数还原、偶数不动） |
| ⑤ points/restored 改名 | 跑 `summary()` | 半对：`blocksRestored` 改对了，**attempted 是重复的像**，见 §4.1 |
| ⑥ .gitignore | `cat .gitignore` | ✓ 三行（pi-escape-guard.json / state.json / node_modules/） |
| ⑦ measure 不跳 fixtures 记为已知差异 | `DESIGN.md:208` | ✓ 写了，且写清了「不假装两边一致」 |

## 4 三条缺陷

### 4.1 `stats.points` 与 `stats.attempted` 恒等：注释说的那个量根本没被记

```ts
// src/features/report.ts:22-23
  stats.points += g.points;
  stats.attempted += g.points;   // ← 同一行数据，两个名字
```

同一文件第 2 行的注释是这么说的：

```
//   points / attempted        段级比例：还原成功 vs 尝试过的段
```

但 `points` 从没在「还原成功」这一侧加过：它加的是 `g.points`（扫出的点数，与 `g.changed` 无关）。于是分子恒等于分母，比例恒 1——**一个比值判据变成了恒等式**，这与设计阶段删掉的 unit-mismatch、C5 是同一种病。

实测：

```
{"points":1,"attempted":1,"equal":true}
```

复跑：

```
grep -n "attempted\\|stats.points" src/
→ report.ts:22  stats.points += g.points;
→ report.ts:23  stats.attempted += g.points;   （再无第三处）
```

修法（二选一，都要动语义，你定）：把 `points` 改成「还原成功的点数」（`g.changed ? g.points : 0`，但 guardText 没暴露 ok），或删掉 `points` 只留 `attempted` 与 `blocksRestored` 两个数。**别留两个相等的字段**：读 summary 的人会把它们当成两个不同的量。

### 4.2 S3 调 `scan` 不传 strict/ratio：配了 `strict:false` 时 S1 与 S3 分叉

```ts
// src/features/provider.ts:23
    return scan(s, { threshold: cfg.threshold }).points.length;   // ← 缺 strict / ratio
```

对比 `guard.ts` 的调用：

```ts
scan(text, { seen: s.for(session), threshold: cfg.threshold, strict: cfg.strict, ratio: cfg.ratio })
```

实测（同一段「你a你好」的转义，`strict:false`, `ratio:0.6`）：

```
S1 guardText    → {"S1_points":1,"S1_skips":{}}           ← 认，还原
S3 markProvider → {"S3_points":0,"markDelta":0}           ← 不认
```

这个分叉不只是数字不准：S3 存在的唯一理由就是「量出 S1/S2 漏了多少」。它和 S1 用不同判据时，它报的「漏了 N 处」里混着自己判据更严造成的误报——那正是它要发现的东西，被它自己的口径污染了。

修法：一行，把 `strict`/`ratio` 补进 `scan` 的 opts（或让 `provider.ts` 走 `guardText`，一处算）。

### 4.3 `mutate.mjs` 有一条锚点已失效：SKIP 不报、rc=0、分母被动了

全部输出（我复跑）：

```
抓住 C4 阈值边界
抓住 C1 解完还含转义
抓住 C2 零宽空格
抓住 C3c/C3d 代码上下文
抓住 从后往前删
SKIP(找不到锚点) 双重转义 @ src/scan.ts     ← 这条根本没跑
抓住 槽位表：S1 动作
抓住 记账恒等式
抓住 S2 只动 assistant
抓住 会话 id 取 pi 的真位置
抓住 toolResults 计数
抓住 围栏同字符且不短于
抓住 反斜杠数奇偶
抓住 C2 走 c2Pass
抓住 report 开关
{"caught":14,"survived":0,"names":[]}
rc=0
```
数组里是 **15 条**，跑了 14 条。SKIP 的那条锚点是 `if (at > 0 && line[at - 1] === "\\\\") { skip("double-escaped"); continue; }`（.mjs 源码里写作四个反斜杠，表示比较的是两个反斜杠） —— 0.1.2 第④条（反斜杠奇偶）把这段代码换成了 `let bs = 0; … if (bs % 2 === 1)`，旧锚点自然找不到。

同类判据确实被「反斜杠数奇偶」那条覆盖了，所以**功能上没漏**；漏的是**巡检本身的分母**：
- 脚本 rc=0，`survived 0`，看起来全绿；
- HISTORY 0.1.2 写「mutate 14 个变异全部抓住、0 存活」——把「跑了 14 条」写成「14 个变异」，而数组有 15 条。

这恰好是你自己这轮立的那条规矩的反面：**枚举出来的清单会静默漏，扫掠不会**。你修了「测试文件名清单」，没修「变异锚点清单」——锚点消失也是清单失效，而且它比测试清单更隐蔽，因为它有 `SKIP` 这个词做提示，却没人把它当失败。

修法：把 SKIP 计入失败（`if (!orig.includes(from)) { skipped++; continue; }` 且末尾 `process.exit(survived.length || skipped ? 1 : 0)`），或更彻底：锚点用「必须匹配一次且只一次」的正则/断言，找不到就红。

## 5 我看到但没算缺陷的两处（说清边界）

1. `judges.ts` 有一行悬空注释（`// C2：去掉 U+2000–U+206F …`），它对应的常量已删、代码搬到了 `strict.ts`。文字残留，不影响判据。
2. `measure.mjs` 的 `scan` 也不传 `strict`/`ratio`——但它是离线验收器、不读配置，与 §4.2 的运行时槽位不同一件事；DESIGN §8 已把它归为「已知差异」。要一致是另一个决定。

## 6 已改 / 未改

已改：无。
未改：三条都是语义判断（points 该记哪个量、S3 走不走 guardText、SKIP 算不算失败），不替你定。

## 附录：§4.1 / §4.2 / §4.4 的探针全文（复制到任意文件，`node --experimental-strip-types <文件>` 即可）

```js
import { guardText } from "file:///C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard/src/guard.ts";
import { scan } from "file:///C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard/src/scan.ts";
import markProvider, { markState } from "file:///C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard/src/features/provider.ts";
import { stats, note, summary } from "file:///C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard/src/features/report.ts";
import { Seen } from "file:///C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard/src/seen.ts";
const BS = String.fromCharCode(92);
const B = String.fromCharCode(96);
const s = new Seen("C:/Users/15066212pp/AppData/Local/Temp/seen-p3.json");
const u = (c) => BS + "u" + c.toString(16).padStart(4, "0");
const SEG3 = u(0x4f60) + u(0x597d) + u(0x4e16);

console.log("=== 1 attempted vs points ===");
const g1 = guardText("我看 " + SEG3 + " 了", "tool_result", { on: true, threshold: 3, strict: true, ratio: 0.6 }, s, "x");
note(g1);
console.log(JSON.stringify({ points: stats.points, attempted: stats.attempted, equal: stats.points === stats.attempted }));

console.log("=== 2 S1 vs S3 under strict:false ===");
const mixed = u(0x4f60) + BS + "u0061" + u(0x4f60) + u(0x597d);
const cfgLoose = { on: true, threshold: 3, strict: false, ratio: 0.6, provider: true };
const g2 = guardText(mixed, "tool_result", cfgLoose, s, "y");
const before = markState.points;
const n3 = markProvider({ m: mixed }, { ...cfgLoose, strict: undefined, ratio: undefined }, "y");
console.log(JSON.stringify({ S1_points: g2.points, S1_skips: g2.skips, S3_points: n3, markDelta: markState.points - before }));

console.log("=== 3 backslash prefix 0..4 ===");
for (const n of [0, 1, 2, 3, 4]) {
  const text = "我看 " + BS.repeat(n) + SEG3 + " 了";
  const r = scan(text);
  console.log(JSON.stringify({ bs: n, points: r.points.length, skips: r.skips }));
}

console.log("=== 4 fence ===");
const cases = [
  ["open3 with ~~~ inside", B.repeat(3) + "\n~~~\n" + SEG3 + "\n~~~\n" + B.repeat(3) + "\n" + SEG3],
  ["open5 close3", B.repeat(5) + "\n" + SEG3 + "\n" + B.repeat(3) + "\n" + SEG3],
  ["open5 close5", B.repeat(5) + "\n" + SEG3 + "\n" + B.repeat(5) + "\n" + SEG3],
  ["open3 close5", B.repeat(3) + "\n" + SEG3 + "\n" + B.repeat(5) + "\n" + SEG3],
];
for (const [name, text] of cases) {
  const r = scan(text);
  console.log(JSON.stringify({ name, points: r.points.length, skips: r.skips }));
}
console.log("=== 5 summary ===");
console.log(JSON.stringify(summary()));
```
结论: 不认可（三条：① `report.ts:22-23` 两个 `+= g.points` 让 points 与 attempted 恒等，而注释说 points 是「还原成功的段」——该量从未被记录，复跑 `grep -n "attempted\\|stats.points" src/` 只有这两行；② `provider.ts:23` 的 `scan(s,{threshold})` 缺 strict/ratio，配 strict:false 时同一段 S1 认（points 1）、S3 不认（points 0），复跑探针见 §4.2；③ `bin/mutate.mjs` 的「双重转义」锚点已被 0.1.2 第④条换掉，现在打 SKIP 但 rc=0、JSON 报 caught 14/survived 0，而数组是 15 条——HISTORY 的「14 个变异全部抓住」把没跑的那条从分母里抹掉了。我上一轮的三条（sessionOf、两个死字段、变异存活）逐条实测均已修好，b711ced1 七条抽验六条落地、第⑤条只改了名字没改语义（即本条①）。）
