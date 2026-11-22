# escape-guard

覆盖：本仓根

- 目的：把落进会话记录的字面 unicode 转义还原；只对 thinking 槽位动手。
- 机器判据：npm test、node bin/mutate.mjs --unique
- 能改哪里：这个仓内的文件；跨仓改动要先说明那是另一个 ownership。

## 改之前

- 先跑上面所有判据拿到当前 rc；改完同一条命令必须还是 0。
- 只跑好样本会绿的不算判据：有 selftest 的必须一起跑。
