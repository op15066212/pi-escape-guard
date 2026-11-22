# 实现复核：pi-escape-guard 0.1.0

复核者：窗口 6e8dd769（设计阶段签过 DESIGN 5ac4530）。时间：2026-11-20T17:53:49+08:00。
对象：commit `ae4fcf3`，`package.json` version 0.1.0，工作区干净（`git status --short .` 空）。

## 0 结论

**不认可。三条，全部可复跑。还原动作本身没有缺陷**——钩子形状、判据、恒等式、fuzz、边界表都验过了、都成立。三条是「记账面」的：一条把设计承诺的按会话分键做成了常量，两条是统计字段没人写。

## 1 三条验收（我复跑的）

```
npm test            → tests 32 / pass 32 / fail 0 / skip 0 / todo 0
node bin/mutate.mjs → {"caught":8,"survived":1,"names":["S2 只动 assistant…"]}
node bin/all.mjs    → {"files":88,"points":56,"saved":1188,"expected":1188,"ratio":1,
                        "skipped":26487,"why":{"double-escaped":12741,"short":3003,"in-code":10568,"not-all-cjk":175},
                        "failFiles":[9 个]}
```
与你报的一致（points 45→56 是会话在长，不构成差异）。

## 2 钩子形状：三条都对（有源码依据）

| 钩子 | 文档要求 | 盘上 | 依据 |
| --- | --- | --- | --- |
| `tool_result` | 返回 partial patch，只给 `content` 则该字段生效；替换 content 而不返回 structuredContent 会 drop 它 | 返回 `{content, structuredContent: undefined}` | `dist/core/extensions/runner.js:908-921`：`if (handlerResult.content !== undefined) { currentEvent.content = …; if (handlerResult.structuredContent === undefined) delete currentEvent.structuredContent; }` → 显式 drop，符合 |
| `message_end` | 返回 `{message}`，role 必须相同 | `{message: next}`，`validMessage(next,"assistant")` 兜底 | `runner.js:872-895`（`emitMessageEnd`：role 不等即 `emitError` + `continue`）；`agent-session.js:999-1010` 用 `_replaceMessageInPlace` |
| `before_provider_request` | 返回 `undefined` 保持 payload | 返回 `undefined` | `runner.js` 的 emit 只在非 undefined 时替换；代码注释与 DESIGN §8 一条目的一致 |

另外核了 `session_shutdown` 存在（文档 601 行，reason 含 quit/reload/new/resume/fork）→ `seen.save()` 有落盘时机 ✓。

## 3 恒等式 saved === expected：成立，而且是单点的

**结构上不可能分叉**：`ledger.settle()` 是唯一实现，S1/S2 走 `guardText` → `settle`，`bin/measure.mjs`（S4 视角）也 `import { settle } from "../src/ledger.ts"`。三处同一个函数，不存在第二份算法。

实测（同一段文本分别过三个槽位）：

```
S1 tool_result      → {"saved":18,"changed":true,"points":2}
S2 message_end      → {"saved":18,"changed":true,"points":2}   sameS1S2: true
S3 provider_request → {"saved":0,"changed":false,"points":2}    textUnchanged: true
```

S3 的 saved 恒 0 是对的（它不改文本，恒等式对它不适用；它只贡献 points）。

fuzz：3000 条随机串（CJK 0x4e00 起每 97 取一、全角标点、五种前缀含围栏/赋值行/引号），其中 867 条被判出 points，共 867 点：

```
{"texts_with_points":867,"points":867,"settle_not_ok":0,"residue_after_apply":0}
```

`settle_not_ok 0` = 恒等式处处成立；`residue_after_apply 0` = 还原后既不含 `\uXXXX`、再扫也不再出点（幂等）。

边界表 15 条逐条与 DESIGN §2 对照，全部一致（表格见 §6）。

## 4 三条缺陷

### 4.1 `sessionOf()` 恒返回 `"default"`——设计承诺的「按会话分键」没实现

```ts
const sessionOf = (ctx) => ctx?.session?.id || ctx?.sessionId || ctx?.sessionFile || "default";
```

pi 的 `ctx` 上这三个字段一个都没有。`dist/core/extensions/runner.js:622-695` 的 `createContext()` 返回的字段是：`ui, mode, hasUI, cwd, sessionManager, modelRegistry, model, scopedModels, thinkingLevel, isIdle, isProjectTrusted, signal, abort, hasPendingMessages, shutdown, getContextUsage, compact, getSystemPrompt`。会话标识只从 `ctx.sessionManager.getSessionId()` / `getSessionFile()` 拿（`docs/extensions.md:1203-1213`、`:855`）。

复跑：

```
node -e 'const so=c=>c?.session?.id||c?.sessionId||c?.sessionFile||"default";
  console.log(so({sessionManager:{getSessionId:()=>"abc123",getSessionFile:()=>"C:/x/s.jsonl"}}))'
→ default
```

影响：`seen` 的键永远只有 `"default"` 一个 →
1. `firstSeen` / `repeat` 变成「本机所有会话合计」的首次/再现，不是「本会话」。DESIGN §7 写「按会话分键，随 state.json 落盘」、§8 风险表写「fork 后新会话从空集开始」——两条都没落地。
2. `load()` 会把 state.json 里 `default` 的旧串读进新会话：**换一个会话再看到同一个串，判成 repeat**，而它在这个会话里是首次。这恰好破坏标签的用途（首次去查源头，复制去查谁在抄）。
3. `markState.sessions` 同样只有一个键。

修法（一行）：`const sessionOf = (ctx) => ctx?.sessionManager?.getSessionId?.() ?? ctx?.sessionManager?.getSessionFile?.() ?? "default";`

### 4.2 `stats.toolResults` 与 `stats.marked` 是死字段：声明了，没人写

```ts
// src/features/report.ts:9,16
  toolResults: 0,
  marked: 0,
```

复跑：`grep -rn "stats\.toolResults\|stats\.marked" src/` → 两条都在 `report.ts` 的定义行，没有任何自增。全部自增点是 `report.ts:20-24` 与 `index.ts:31`（messages）。而 `markProvider()` 把数写进 `markState.points`，不写 `stats.marked`。

影响：`summary()` 里两个数恒 0。读的人会得出「S1 一次没跑」「S3 一处没扫到」——而这两件事都没发生。

修法：`stripToolResult` 里 `stats.toolResults++`；`markProvider` 里 `stats.marked += n`（或把 `markState` 合并进 `stats`，一处可写）。

### 4.3 变异存活那条不是纯冗余：它是记账缺口，不是无害冗余

变异：`assistant.ts` 的 `message.role !== "assistant"` → `message.role !== "assistant" && false`（永不早退）。实测（user 消息，content 为数组，含一段 `\u4f60\u597d\u4e16`）：

| 版本 | 返回值 | stats.points | stats.restored | seen |
| --- | --- | --- | --- | --- |
| 原版 | undefined | 0 | 0 | `[]` |
| 变异 | undefined | **1** | **1** | `["你好世"]` |

复跑（探针脚本内容在回执末尾附录，或按下面两步自己搭）：

```
# 1) 备份并变异
cp src/features/assistant.ts /tmp/a.bak
node -e "const fs=require('fs');const p='src/features/assistant.ts';
  fs.writeFileSync(p,fs.readFileSync(p,'utf8').split('message.role !== \"assistant\"')
    .join('message.role !== \"assistant\" && false'))"
# 2) 跑探针（脚本见附录）
node --experimental-strip-types probe-user.mjs   # → stats_points 1, restored 1, seen ["你好世"]
cp /tmp/a.bak src/features/assistant.ts          # 复原，md5 应回到 37a7d1fd
```

判断：**输出面是冗余，记账面不是**。`validMessage(next, "assistant")` 确实兜住了返回值（两版都 `undefined`），但 `note(g)` 在 `map` 循环里先跑了，`s.note()` 也把串写进了 seen。也就是说：
- 删掉 role 检查 → 返回给 pi 的东西不变（mutate 观察到的那一层正确）；
- 但同时 `stats.restored` 会虚计（记「还原了 1 处」而实际什么都没返回）、`seen` 会被污染。

所以守着 role 检查的不是 `validMessage`，是记账。而**没有一条测试会红**——这才是变异存活的含义。

最小修法（二选一，都是加法）：
1. 补一条测试：user 消息过 `stripAssistant` 后 `stats.points` 与 `stats.restored` 不变（现在 0）。
2. 或把 `note(g)` 挪到 `if (!validMessage(...)) return undefined;` 之后（但那时逐块信息已丢）。1 更便宜。

## 5 查了但没发现缺陷的四处（写在这是为了说清边界）

1. **「代码改了但没记账」**：`stripToolResult` / `stripAssistant` 每块都 `note(g)`，与 `g.changed` 同源；`settle` 失败时 `saved=0` 而 `points` 仍计——`report.ts` 注释已写明这是有意的（`restored` 与 `points` 分开），不是漏记账。
2. **`settle` 失败时点已进 `seen`**（`guard.ts` 先 `s.note` 再 `settle`）：顺序上是「记账先于动作」，但 `saved !== expected` 在 fuzz 867 条上 0 次触发，且两处都在同一函数内、回滚是「一开始就没改」。记为观察，不构成缺陷。
3. **C3b 不认双反引号**：`见 ``\u4f60\u597d\u4e16`` 是代码` 会被还原（实测 points 1）。这是 DESIGN 的 C3b 只写了「前后各一个反引号」的盲点，代码忠实实现了设计 → 不是实现与设计不一致。要改是改设计。
4. **`skipFixtures` 的参数名**：`event.input.file_path || event.input.path` 两种都试，`event.input` 在 `_afterToolCall` 里确为 `args`（`runner.js`/`agent-session.js:406-416`）→ 生效 ✓。

## 6 边界表（15 条，逐条与 DESIGN §2 对照）

| 输入形状 | points | skips | 判断 |
| --- | --- | --- | --- |
| `x = "你"`（赋值行） | 0 | in-code | ✓ C3c |
| `我看 \u4f60\u597d\u4e16 了`（正文） | 1 | — | ✓ 还原 |
| 围栏内 | 0 | in-code×3 | ✓ C3a |
| `\\u4f60…`（双重转义） | 0 | double-escaped | ✓ 前置 |
| 2 个转义 | 0 | short | ✓ C4 |
| 含重复 4 个 | 1 | — | ✓（C5 不拦） |
| 代理对 + 2 汉字 | 0 | not-all-cjk | ✓ C2 |
| 段内 `\n` | 1 | — | ✓ 输出保留 `\n` |
| é 开头 | 0 | not-all-cjk | ✓ C2 |
| 行内 code（单反引号） | 0 | in-code | ✓ C3b |
| 行内 code（双反引号） | **1** | — | 见 §5.3 |
| 紧邻引号无正文 | 0 | in-code | ✓ C3d |
| 紧邻引号有正文 | 1 | — | ✓ C3d 的洞（设计已写） |
| CRLF 赋值行 | 0 | in-code | ✓ |
| 正则 `[\u4e00-\u9fff]` | 0 | short×2 | ✓（各 1 个转义） |

## 7 已改 / 未改

已改：无。

未改：三条都是实现里的判断，不是文字——`sessionOf` 改的是行为（哪个键），`stats` 改的是输出语义，变异那条改的是测试覆盖。我不替你定这三处。

附录：`probe-user.mjs` 全文

```js
import stripAssistant from "file:///C:/Users/15066212pp/.pi/agent/extensions/pi-escape-guard/src/features/assistant.ts";
import { stats } from "…/src/features/report.ts";
import { Seen } from "…/src/seen.ts";
const s = new Seen("C:/Users/15066212pp/AppData/Local/Temp/seen-probe.json");
const msg = { role: "user", content: [{ type: "text", text: "我看 \\u4f60\\u597d\\u4e16 了" }] };
const r = stripAssistant(msg, { on: true, assistant: true }, s, "probe");
console.log(JSON.stringify({ ret: r === undefined ? "undefined" : r, stats_points: stats.points, restored: stats.restored, seen: [...s.for("probe")] }));
```

结论: 不认可（三条：① `sessionOf()` 恒返回 "default"，DESIGN §7/§8 承诺的按会话分键没落地，复跑 `node -e 'const so=c=>c?.session?.id||c?.sessionId||c?.sessionFile||"default"; console.log(so({sessionManager:{getSessionId:()=>"abc123"}}))'` → default；② `stats.toolResults` / `stats.marked` 声明后无人自增，summary 两个数恒 0，复跑 `grep -rn "stats.toolResults\|stats.marked" src/` 只有定义行；③ 变异存活那条 S2 不是纯冗余——role 检查守的是记账（note 在 validMessage 兜底前跑），删掉后 stats.points 0→1、restored 0→1、seen 被写入，当前无测试会红。还原动作本身无缺陷：钩子三条与 pi 源码一致（runner.js:625/880/911），恒等式单点实现（ledger.settle），S1/S2 saved 同为 18、S3 为 0 且文本不变，fuzz 867 段 0 失配 0 残留，边界表 15 条逐条对得上。）
