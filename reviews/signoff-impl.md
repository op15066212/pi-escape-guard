# 实现签核 · 0.1.5

对象: pi-escape-guard 0.1.5（commit 16c22fd 之前的代码提交）
提出者: 会话 9d80afea-e93e-4328-8106-7f2aebe20d8d
复核方: b711ced1-8bb9-465f-83a3-1ab8fb57f197 / 6e8dd769-9d5c-4a3b-b0cd-f982a3f40c27
日期: 2026-11-21

## 三方结论

| 方 | 结论 | 文件 |
| --- | --- | --- |
| 提出方 | 认可 | 本文件 |
| 复核方 b711ced1 | 认可（0.1.5） | reviews/review-impl5-b711ced1.md |
| 复核方 6e8dd769 | 认可（0.1.5） | reviews/review-impl5-6e8dd769.md |

## 现取（三方都复跑过）

    npm test            → 47 / 47 / 0
    node bin/mutate.mjs → {"caught":15,"survived":0,"skipped":0}
    node bin/all.mjs    → files 88, points ≈55, saved ≈1180 = expected, ratio 1, failFiles 9

## 复核过程改掉的十三件（全在 HISTORY）

0.1.1 三条（6e8dd769）：会话 id 取错位置、两个计数声明了没自增、那处「存活变异」其实守的是记账。

0.1.2 七条（b711ced1）：围栏状态机不校验字符与长度、strict/ratio 死配置、report 死配置、
double-escaped 只看一个反斜杠、points 与 restored 量纲混算、没有 .gitignore、measure 不跳 fixtures（记为已知差异）。

0.1.3 三条（6e8dd769）：points 与 attempted 恒等、provider 的 scan 缺 strict/ratio、
mutate 的锚点失效后打 SKIP 但 rc=0（分母被抹掉）。

0.1.4 一条：mutate 打两行 JSON。
0.1.5 一条：注释说 points 含 mark，实际 note() 只在 restore 槽位调用。

## 三条方法产出（都来自被驳回，不是自省）

1. **判「等价」的门槛是构造出可区分输入。** 我三次判错的等价变异，每次都是被复核方用一条输入推翻的
   （最狠的一次：role 检查看起来被 validMessage 完全覆盖，实际它守的是记账）。
2. **「锚点找不到就跳过」与「判据恒真」是同一种病。** 都让报告看起来比实际干净。
   前者让 15 个变异报成 14 个，后者让 unit-mismatch 一直躺在判据表里。
3. **枚举出来的清单会静默漏，扫掠不会。** mutate 跑的是列出的测试文件名，report.test.ts 写好从没被跑；
   改成扫整个 test/ 目录，那条变异立刻红。

## 未改（写进文档，不假装）

- C3d 的洞：一行里有两个真汉字，代码区的转义会被还原（DESIGN §2）。
- 离线验收器不跳 test/fixtures/，运行时会跳（DESIGN §8）。
- 首次出现、非代码上下文、非会话内见过：与污染逐字符相同，写不出可执行判据（DESIGN §5）。

结论: 认可（0.1.5；三方签字；残余三条写在 DESIGN §2/§5/§8）
