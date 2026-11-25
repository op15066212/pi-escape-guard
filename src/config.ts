// 配置。读写集中在这里，别处只拿到一个对象。
//
// R12：从 11 个字段减到 3 个。删掉的是 strict / ratio / bodyCjk / maxPerSession /
// skipFixtures / toolResult / assistant / provider / report —— 一半是观测开关，
// 一半是「另一个判法」的口径。使用者要的只有一个问题：这段转义该不该还原。
import fs from "node:fs";
import path from "node:path";

export type Cfg = {
  on: boolean;
  /** 段内至少几个 \uXXXX 才算「成段」。正则里的 \u4e00-\u9fff 是两个，单个不碰。 */
  threshold: number;
  /**
   * 调用工具前的拦截（2026-11-25 加，使用者定的方向）。
   *
   * 此前这个插件只做事后还原：转义已经落盘，它在读的时候改回来。
   * 使用者指出目的不是这个——**是拦住写的人，让他一开始就别写转义**。
   *
   * on  是否启用拦截
   * min 入参里连续几个转义才拦。默认 3：正则字符类 [\u4e00-\u9fff] 是两个，
   *     那是必要的写法，不该拦；成串三个以上就是在偷懒写中文。
   */
  block: { on: boolean; min: number };
};

const pluginDir = path.join(import.meta.dirname, "..");
export const configFile = () => process.env.ESC_GUARD_CONFIG || path.join(pluginDir, "pi-escape-guard.json");

export const DEFAULTS: Cfg = { on: true, threshold: 3, block: { on: true, min: 3 } };

export function readConfig(): Cfg {
  try {
    const j = JSON.parse(fs.readFileSync(configFile(), "utf8"));
    const min = Number(j?.block?.min);
    return {
      on: j.on !== false,
      threshold: Number.isFinite(Number(j.threshold)) && Number(j.threshold) >= 1 ? Math.floor(Number(j.threshold)) : DEFAULTS.threshold,
      // 旧配置文件里没有 block 字段：不给就等于「用默认」，不是「关掉」。
      // 把它当关掉会让升级后静默失去拦截，那正是「配好了 ≠ 生效了」的另一种形状。
      block: {
        on: j?.block?.on !== false,
        min: Number.isFinite(min) && min >= 1 ? Math.floor(min) : DEFAULTS.block.min,
      },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function ensureConfig(): Cfg {
  try { if (!fs.existsSync(configFile())) fs.writeFileSync(configFile(), JSON.stringify(DEFAULTS, null, 2) + "\n"); } catch {}
  return readConfig();
}
