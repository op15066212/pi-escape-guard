# escape-guard

覆盖：本仓根

- 目的：调用工具前拦住写转义的人（`tool_call`）；已经落盘的转义在 `tool_result` 与 `message_end` 还原。
- 机器判据：`npm run verify`（= `npm test` + `bin/all.mjs --selftest` + 总闸 `scripts/gate.mjs`）
- 能改哪里：这个仓内的文件；跨仓改动要先说明那是另一个 ownership。

## 改之前

- 先跑上面那条，拿到当前 rc；改完同一条必须还是 0。
- 只跑好样本会绿的不算判据：带 `--selftest` 的必须一起跑（总闸已经这么做）。
- 改 `README.md` 会让它的 sha256 变，`scripts/check-dtt-fingerprint.mjs` 会红。按 `node verify-dtt.mjs --fingerprint` 的新值更新 `SIGN-OFF-DTT.md` 后重签。
- 配置默认值只有一处：`src/config.ts` 的 `DEFAULTS`。`SETTINGS.md` 与它不一致时以代码为准。
- `scripts/check-doc-accuracy.mjs` 与 sentry 那份必须行为一致，`check-mirror.mjs` 盯着这条。
