# pi-escape-guard

在 `tool_call` 执行前检查工具入参中的连续 Unicode 转义；达到门槛就拒绝调用，并返回可读原因。

## 当前行为

| 位置 | 条件 | 动作 | 反例 |
| --- | --- | --- | --- |
| `tool_call` | 连续转义段数量 ≥ `block.min` 且 `block.on` 为真 | 拒绝工具调用 | 两个连续转义且门槛为三时放行 |

扫描器只检查连续转义段，不按围栏、反引号或赋值位置区别处理；它只遍历正则命中的区间，未命中部分不逐字符扫描，每个命中保留原始偏移、文本和转义数。默认门槛是 3。
正则字符类 `[\u4e00-\u9fff]` 含两个不连续转义；门槛为 3 时放行。门槛改为 2 时，它会被拦截，这是配置的直接结果。

## 配置

配置文件是插件目录下的 `pi-escape-guard.json`，也可以用 `ESC_GUARD_CONFIG` 指定路径。每次 `tool_call` 都重新读取配置。

完整配置见 `SETTINGS.md`。

## 代码结构

- `src/scan.ts`：扫描连续转义段；
- `src/config.ts`：读取和校验配置；
- `src/index.ts`：注册 `tool_call` 钩子；
- `src/meta.ts`：规则表和四构件检查。

## 元理论

### 规则模型

依赖类型理论：规则是类型，命题、证明项、反例、消去缺一不可。直觉主义：成立必须给出居民，不能把未发现反例当成证明。莫比乌斯反演：累积覆盖恢复逐项贡献时，先指名偏序与 μ。布尔格上的莫比乌斯反演使用 `μ(S)=(-1)^|S|`，也就是容斥。

| 构件 | 当前居民 | 反例 |
| --- | --- | --- |
| 形成 | `src/meta.ts` 中的 S0 | 规则名与实现不一致 |
| 引入 | `npm run verify` 返回 0 | 只写“检查过” |
| 反例 | 连续转义输入 | 没有坏样本 |
| 消去 | `node verify-dtt.mjs` 返回 0 | 文档与代码给出不同结果 |

`src/meta.ts` 的 `RULES` 只有 S0。检查数量不等于独立覆盖数量。

## 检查

```bash
npm ci
npm test
npm run verify
node scripts/gate.mjs
node verify-dtt.mjs
node --experimental-strip-types --test test/scan.test.ts
```

总闸通过 glob 发现 `scripts/check-*.mjs`；每条检查先运行坏样本自测，再检查当前代码。

## 排错

| 现象 | 检查 |
| --- | --- |
| 应拦未拦 | 检查 `block.on`、`block.min` 和转义是否连续 |
| 正则字符类被拦 | 检查门槛；门槛为 2 时两个连续转义会被拦 |
| 配置没有生效 | 检查 `ESC_GUARD_CONFIG` 指向的 JSON |

## 文档入口

配置见 `SETTINGS.md`；规则签字见 `SIGN-OFF-DTT.md` 和 `SIGN-OFF.md`。
