# 配置

配置文件位置：`<扩展目录>/pi-escape-guard.json`（首次启动自动写入默认值）。
用环境变量 `ESC_GUARD_CONFIG` 指向别处；`ESC_GUARD_STATE` 指定标签存档（默认 `state.json`）。

```json
{
  "on": true,
  "threshold": 3,
  "strict": true,
  "ratio": 0.6,
  "skipFixtures": true,
  "toolResult": true,
  "assistant": true,
  "provider": true,
  "report": true
}
```

改了配置不用重启 pi：每次 `session_start` 重读一次文件。

## 什么时候该动哪个键

- 发现**该还原的没还原** → 先看 `threshold`（是不是不到 3 个转义）。别急着降 `strict`。
- 发现**代码被改了** → `skipFixtures` 管不到源码文件，那是 C3 的洞（一行里有两个真汉字），
  只能把那条代码放进 `test/fixtures/`，或关掉整个 `on` 做一次对比。
- 只知道 `failFiles` 红 → 那是交还清单，不是配置问题。看 `node bin/all.mjs` 的 `why`。
