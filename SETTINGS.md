# 设置

配置文件：插件目录下的 `pi-escape-guard.json`（首次启动写入默认值）。用 `ESC_GUARD_CONFIG` 指向别处；`ESC_GUARD_STATE` 指定标签存档（默认 `state.json`）。改完不用重启 pi：每次 `session_start` 重读一次。

## 全文

```json
{ "on": true, "threshold": 3 }
```

`src/config.ts` 的 `Cfg` 就是这两个字段。别的键写了不读，也不报错。

## 逐个解释

### `on`

| 项 | 内容 |
| --- | --- |
| 默认 | `true` |
| 什么时候改 | 想整体停掉还原、只看原样时设 `false` |
| 不改会怎样 | 一直在还原 |

关掉后一律不动手：`settle()` 直接返回原文本，`content`、`texts` 都不变。

### `threshold`

| 项 | 内容 |
| --- | --- |
| 默认 | `3` |
| 什么时候改 | 出现「该还原的没还原」时先看它——是不是这一段不到 3 个转义 |
| 取值范围 | ≥ 1 的整数；写 0、负数、非数字会被 `src/config.ts` 拒并回落到 3 |

一段里至少这么多个 `\uXXXX` 才算「成段」。单个转义不碰，因为孤立的 `\u4f60` 更可能是数据而不是污染。

## 判据

| # | 命题 | 引入（命令 → 期望） | 消去（第二入口） | 反例 |
| --- | --- | --- | --- | --- |
| S1 | 已删的键不再被读 | `grep -cE '^\s+(strict\|ratio\|skipFixtures\|toolResult\|assistant\|provider\|report)\??:' src/config.ts` → `0` | 填 `strict` 后行为不变、也不报错 | 照旧文档填 9 个键：7 个不读，最难发现 |
| S2 | `on=false` 后一律不动手 | 设 `false` → `npm test` 的「改配置看行为」用例 → rc=0 | 同一份输入在 `on=true` 下被还原、`false` 下原样 | 关掉了还还原，用户以为关了 |
| S3 | `threshold` 写 0 会回落 | 设 `threshold=0` → 读回是 `3` | 与 `npm test` 的阈值用例同结论 | 以为设 0 等于「全还原」 |

```bash
npm test                        # rc=0
node bin/mutate.mjs --unique    # 3 条唯一防线全部被抓住
node verify-dtt.mjs             # 元理论节齐、四件齐、反例逐行有
```

## 发现不对时先看哪里

- **该还原的没还原** → 先看 `threshold`。
- **代码被改了** → 那是 C3（代码上下文）的洞：一行里有两个真汉字时判据会误判。把那段放进 `test/fixtures/`，或关掉 `on` 做对比。
- **`failFiles` 红** → 那是交还清单，不是配置问题。看 `node bin/all.mjs` 输出的 `why`。
