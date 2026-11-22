# 配置

配置文件：`<扩展目录>/pi-escape-guard.json`（首次启动写入默认值）。用 `ESC_GUARD_CONFIG` 指向别处；
`ESC_GUARD_STATE` 指定标签存档（默认 `state.json`）。改了不用重启 pi：每次 `session_start` 重读一次。

## 真的只有两个键

```json
{ "on": true, "threshold": 3 }
```

`src/config.ts` 的 `Cfg` 类型就是这两个字段。别照旧文档填九个键——**它们中间有七个已经不读**。

> 2026-11-22 核对：旧版本这份文件列了 9 个键（on / threshold / strict / ratio / skipFixtures /
> toolResult / assistant / provider / report）。`src/config.ts` 的注释写着「R12：从 11 个字段减到 3 个，
> 删掉的是 strict / ratio / bodyCjk / maxPerSession / skipFixtures / toolResult / assistant / provider / report」。
> 也就是说旧文档里 **7 个键写了但读不到**：填进去不报错，也不生效——这是最难发现的一类配置错误。
 > 判据：`grep -cE '^\\s+(strict|ratio|skipFixtures|toolResult|assistant|provider|report)\\??:' src/config.ts` 得 `0`（只数字段声明，不数注释）。

## 两个键各自怎么判

| 键 | 命题 | 引入（命令 → 期望） | 消去（第二入口） | 反例 |
| --- | --- | --- | --- | --- |
| `on` | 关掉后一律不动手 | 设 `on=false` → 跑 `npm test` 的「改配置看行为」用例 → rc=0 | 同一份输入在 `on=true` 下被还原，`on=false` 下原样返回 | 关掉了还去还原：用户以为关了 |
| `threshold` | 段内至少这么多个 `\uXXXX` 才算「成段」 | `threshold=1` 时单个转义也还原；默认 3 时不动 | 与 `npm test` 的阈值用例同结论 | 写成 0 或负数：`src/config.ts` 会拒并回落到默认 3 |

## 发现不对时先看哪里

- **该还原的没还原** → 先看 `threshold`（是不是不到 3 个转义）。没有「降 strict」这条路了，那个键已删。
- **代码被改了** → 那是 C3（代码上下文）的洞：一行里有两个真汉字时判据会误判。把那段放进 `test/fixtures/`，或关掉 `on` 做对比。
- **只知道 `failFiles` 红** → 那是交还清单，不是配置问题。看 `node bin/all.mjs` 输出的 `why`。

## 判据

```bash
npm test                              # rc=0
node bin/mutate.mjs --unique          # 3 条唯一防线全部被抓住
node verify-dtt.mjs                   # 元理论节齐、四件齐、反例逐行有
```
