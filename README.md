# pi-escape-guard

在 `tool_call` 前检查参数中的连续 `\uXXXX` 转义段；段内 Unicode 转义数达到配置门槛时拒绝调用，并返回原因。

## 行为

| 条件 | 结果 | 反例 |
| --- | --- | --- |
| 总开关与 `block.on` 均开启，连续转义数 ≥ `block.min` | 拒绝工具调用 | 两个连续转义、门槛为三时放行 |

默认门槛为 `3`。例如正则字符类 `[\u4e00-\u9fff]` 含两个连续转义；默认门槛为 3 时放行，门槛设为 2 时会拦截。扫描按连续语法匹配，不区分代码围栏、反引号或赋值位置。

## 扫描实现

`src/scan.ts` 只遍历正则命中的片段；未命中区间不逐字符扫描。匹配片段按 Unicode 转义 token 步进计数，保留原始偏移、片段文本和转义数。可选的 `\n`、`\t` 后缀不另计为 Unicode 转义。

此判据不理解语义，也不推断转义出现的位置是否必要；它只执行连续转义数与门槛的比较。

## 配置与入口

配置文件为插件目录下的 `pi-escape-guard.json`，也可用 `ESC_GUARD_CONFIG` 指定路径。每次 `tool_call` 重新读取配置，下一次调用即生效。完整字段与默认值见 [SETTINGS.md](SETTINGS.md)。

- `src/scan.ts`：转义段扫描与计数。
- `src/config.ts`：配置读取和校验。
- `src/index.ts`：注册 `tool_call` 钩子。
- `src/meta.ts`：规则元数据与覆盖入口。

## 元理论
形成由 `src/meta.ts` 的 S0 声明，反例由连续转义输入给出；引入判据是 `npm run verify` 返回 0，坏样本由总闸测试。依赖类型理论要求规则有命题、证明项、反例和消去；直觉主义要求每个结论有可运行证据。累积覆盖需先指名偏序与 Möbius 函数；子集格的 μ 为 `(-1)^|S|`，即容斥。当前规则表在 `src/meta.ts`，坏样本覆盖由仓内总闸验证。

规则与文档签核见 `SIGN-OFF-DTT.md` 和 `SIGN-OFF.md`；指纹不匹配时签核失效。

## 验证

```bash
npm ci
npm test
npm run verify
node scripts/check-doc-accuracy.mjs
node --experimental-strip-types --test test/scan.test.ts
```

`npm run verify` 返回 `0` 表示总闸、测试、指纹与安装钩子自测均通过。
