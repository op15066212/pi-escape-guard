# 轮次 R4 · 三方签核

轮次: R4
提出者: 会话 9d80afea-e93e-4328-8106-7f2aebe20d8d
发现者: b711ced1-8bb9-465f-83a3-1ab8fb57f197 / 6e8dd769-9d5c-4a3b-b0cd-f982a3f40c27
修改者: 会话 9d80afea-e93e-4328-8106-7f2aebe20d8d（设计 v1 → v2）
复核者: b711ced1-8bb9-465f-83a3-1ab8fb57f197 / 6e8dd769-9d5c-4a3b-b0cd-f982a3f40c27
交付: 2026-11-20T10:20Z

## 审查

三方在同一份 DESIGN.md 上签字：**md5 5ac45301**（233 行）。

- reviews/review-r4-b711ced1.md → 认可（DESIGN.md 版本 5ac45301）
- reviews/review-r4-6e8dd769.md → 认可（DESIGN.md 版本 5ac45301）

我复核了它们在 39998c4b 之上补的几行（§2 的 C3d 定义、C5 措辞）：与 bin/measure.mjs 的实现一致，
且把 C3d 的洞写进了文档本身（两个汉字就能洗白一行代码）。接受这个洞，理由与 §5 相同：那是取舍，不是判据缺失。

我方现跑：

  node bin/all.mjs → files 88, points 约 45, saved 约 1090 = expected, ratio 1, failFiles 9
                     skipped 约 24900 = double-escaped 约 11950 + short 约 2830 + in-code 约 9970 + not-all-cjk 175

points 每次跑浮动约 3（盘在写、半行 JSON 被跳过）。不变量是 ratio 与 saved === expected，不是 points。

## 已改（v1 → v2，十条全部由复核推翻）

| 次 | 原写法 | 被什么推翻 | 改成 |
| --- | --- | --- | --- |
| 1 | C2 往返一致 | JSON.stringify 对可打印字符不转义，序列化不是单射 | C1：字符数相等 + 解出不含字面转义 |
| 2 | 直扫 jsonl 原文 | 106/106 段判 double-escaped | 先 JSON.parse 再扫内容层 |
| 3 | 两端记账层不同 | ratio 1.333 | 都放内容层 |
| 4 | pass 要求 skipped 为零 | 双重转义本就不该动 | 三条：恒等式 + points 大于零 + why 白名单 |
| 5 | delta 按解码文本算 | 替换写的是 stringify 结果 | delta 按替换文本算 |
| 6 | 按行处理后沿用行内偏移 | ratio 1.45 | 行首偏移 + 行内偏移 |
| 7 | 赋值行正则只认 ASCII 词 | const 声明两个词漏网 | 放宽到非空白非赋值符 |
| 8 | C5 会话内再现判复制 | 改不了动作，首次与再现都还原 | 删除该判据，降级为记账标签 |
| 9 | not-all-cjk 进白名单 | failFiles 零是拆判据换的 | 移出，failFiles 9 诚实红 |
| 10 | C3d 紧邻引号即代码 | 阻挡 65% 真污染 | 加例外：该行两个以上真汉字按正文处理 |

## 未改（三条交还，写进 §5）

1. 首次出现、不在代码上下文、不在会话内见过：与污染逐字符相同、位置也相同，没有可执行判据。
2. C3d 的洞：一行里有两个真汉字，代码区的转义会被还原。取舍问题。
3. 多行续行形式的 properties：进记账标签，不进交还名单。

结论: 认可（DESIGN.md 版本 5ac45301；三方签字；残余三条写进 §5 与本节）
