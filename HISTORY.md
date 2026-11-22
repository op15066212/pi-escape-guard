# 历史

## 0.1.8 · 2026-11-21 · 运行时单例接配置

签核第六轮 6e8dd769：Seen 类接参三处都对，但 export const seen = new Seen() 无参，
配置的 maxPerSession 在运行时仍然无效——测试绿、线上不生效。

补：max 改成可写；install 与 refresh 各一行 seen.max = cfg.maxPerSession。
端到端判据：配 2 → note 三条 → 只剩 2 条。npm test 51/51/0。

## 0.1.7 · 2026-11-21 · 把配置项接到使用点

签核第四轮指出的两处：maxPerSession 无人读、provider.ts 缺 bodyCjk（第四次）。
Seen 构造接 max；provider 的 scan 传 bodyCjk。

test/r6-wire.test.ts 两条：上限 2 只留 2 条、bodyCjk=0 时紧邻引号也还原。npm test 50/50/0。

## 0.1.6 · 2026-11-21 · R6：重扫判据 + bodyCjk 配置化

防止自我模仿的判据落在这里（R6 共识的第二节）：**插件写进上下文的每个字符串，每一处差异都要指得到一段原文区间。**

这个插件天然满足——它只做解码替换，输出全部来自 `settle` 或原文，不新增自造文本。
但「天然满足」不是判据，所以补了一条能红的：

   还原后的文本再扫一遍，必须 0 点。

坏样本：把 `replacement` 改成返回原段（不解码）→ 重扫仍是 1 点 → 测试红。已进 mutate（第 16 条）。

配置化：`bodyCjk`（C3d 的例外阈值，默认 2）从常量搬进配置。
**不搬**：`SEG`、`ASSIGN`、`CJK_CHAR`（结构判据，改了判据就废）。

判据：npm test 48/48/0；mutate 16 抓住 / 0 存活 / 0 锚点失效。

## 0.1.5 · 2026-11-21 · 一句注释说错了口径

report.ts 写「points 是扫到的段（restore 与 mark 都算）」，但 note() 只在 restore 槽位调用，
S3 的段根本进不来。两位复核各用一条探针指出同一件事：S3 载荷两段，stats.points 变化 0。
注释改成「只有 restore 槽位」。代码没错，错的是那句话——**注释也是判据，说错了就有人按它实现。**

## 0.1.4 · 2026-11-21 · 一行输出

0.1.3 的 mutate 打两行 JSON（旧 console.log 没删），调用方按行解析就会读到缺 skipped 的那一行。
进度改走 stderr，stdout 只剩一行：`{"caught":15,"survived":0,"skipped":0,"names":[]}`。
判断依据：`node bin/mutate.mjs 2>/dev/null | wc -l` = 1。

## 0.1.3 · 2026-11-21 · 复核三条（复核方 6e8dd769 第二轮）

| # | 缺陷 | 修法 |
| --- | --- | --- |
| ① | `stats.points` 与新增的 `attempted` 恒等（两行都 `+= g.points`），注释却说 points 是「还原成功的段」 | 删 `attempted`；注释改成「扫到的段，restore 与 mark 都算」。上一版只改名字没改语义，被指出后删掉重复的那个字段 |
| ② | `provider.ts` 的 scan 没传 strict/ratio：同一段 S1 认、S3 不认 | 补传。三个槽位必须用同一套判据参数 |
| ③ | `mutate.mjs` 的锚点在上一版被换掉后打 SKIP，但 rc=0、报「14 抓 0 存活」，而数组有 15 条——**没跑的那条被从分母里抹掉** | SKIP 计入失败并单独报数；换掉失效锚点 |

第③条是这一轮最值钱的一条：**「锚点找不到就跳过」和「判据恒真」是同一种病**——都让报告看起来比实际干净。
修完 mutate 报 `caught 15 / survived 0 / skipped 0`，分母与数组长度对得上。
## 0.1.2 · 2026-11-21 · 实现复核七条（复核方 b711ced1）

逐条复跑后判不认可，七条里六条是真缺陷：

| # | 缺陷 | 修法 |
| --- | --- | --- |
| ① | 围栏状态机只看字符的第一个字：三反引号块里出现 ~~~ 就提前闭合，块内转义被当正文还原 | 记 (字符, 长度)，闭合要求同字符且不短于开启 |
| ② | `strict` / `ratio` 是死配置：strict.ts 的 c2Pass 没有调用者，judges.ts 另写一份 CJK 正则 | C2 只留 strict.ts 一处，judges.ts 的常量删掉 |
| ③ | `report` 是死配置：`grep cfg.report` 零命中 | note() 前加开关，两个槽位都加 |
| ④ | double-escaped 只看前一个字符：三个反斜杠也判「不动」 | 数连续反斜杠的奇偶 |
| ⑤ | stats.points 是段级、restored 是块级，注释却写成「比例」 | 改名 blocksRestored，另加 attempted 当段级分母 |
| ⑥ | 仓库没有 .gitignore，配置与 state.json 一跑就变成未跟踪文件 | 加 .gitignore |
| ⑦ | measure.mjs 不带 skipFixtures，与运行时不一致 | 离线扫的是内容层，不知道来源路径；记为已知差异，不假装修好 |

修完：npm test 47 / 47 / 0；mutate 14 个变异全部抓住、0 存活
（上一版 11 个里有 3 个存活：两条是死代码，一条是测试文件根本没被跑）。

**这轮真正的方法产出**：变异巡检跑的是**列出的文件名**，所以 report.test.ts 写好了却没被跑。
把 run() 改成扫整个 test/ 目录，那条变异立刻红。**枚举出来的清单会静默漏，扫掠不会。**

## 0.1.1 · 2026-11-21 · 实现复核三条（复核方 6e8dd769）

1. **会话 id 取错了位置**。我写 `ctx?.session?.id`，pi 的真位置是 `ctx.sessionManager.getSessionId()`
   （docs/extensions.md:855/1205）。键错不报错，只会让所有会话落进一个桶，firstSeen / repeat 失去意义。
2. **两个计数声明了没自增**：`stats.toolResults` 与 `stats.marked` 恒 0。声明的计数不自增，比不声明更坏——人以为在看数据。
3. **那处「存活变异」不是冗余保护**。role 检查在 `note()` 之前，删掉它 user 消息也会记账、也会写 seen。
   我读代码判它「被 validMessage 完全覆盖」，判错了。**第三次栽在同一句话上：判等价要构造出可区分输入。**

## 0.1.0 · 2026-11-21 · 实现（设计 v2 落地）

设计在 `DESIGN.md`，md5 5ac45301 那一版由三方签字（`reviews/signoff-r4.md`）。本次只做「把它写成代码」。

**产出**：10 个 src 模块 + 6 个 features + 7 组测试 + 变异巡检。

**实现阶段新发现的三条**（设计阶段看不见，写成代码才暴露）：

1. **`unit-mismatch` 是恒假判据**。JSON.parse 自己保证每个 \uXXXX 产出一个 UTF-16 码元，
   写不出能触发它的输入。变异巡检改它，没有任何测试能红。删掉（与设计阶段的 C5 同一种病）。
2. **C3d 与正文证据冲突时以正文为准**：该行另有 ≥2 个真汉字就按正文处理。
   代价是「一行里有两个汉字的代码」会被误还原——这是 C3d 的洞，写在 DESIGN §2。
3. **role 检查有两处**（assistant.ts 与 verdict.ts）。0.1.1 证明第一处不是冗余，它守的是记账。

**删掉的东西**：`src/layers.ts`（无样本）、判据 `unit-mismatch`（恒真）、
`src/context.ts` 与 `src/unescape.ts`（合并进 `scan.ts` / `judges.ts`）。
