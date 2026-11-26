// 配置。读写集中在这里，别处只拿到一个对象。
//
// 2026-11-26：只剩两个字段。threshold 随还原一起删掉了 ——
// 它判的是「一段里几个转义才值得还原」，而还原这条路径已经不存在。
// 现在唯一要问的是：调用工具前拦不拦、连续几个起拦。
import fs from "node:fs";
import path from "node:path";

export type Cfg = {
  /** 总开关。关掉 = 不拦。 */
  on: boolean;
  /**
   * 调用工具前的拦截。这是插件存在的全部理由。
   *
   * on  是否启用拦截
   * min 入参里连续几个转义才拦。默认 3：正则字符类 [\u4e00-\u9fff] 是两个，
   *     那是必要的写法，不该拦；成串三个以上就是在偷懒写中文。
   */
  block: { on: boolean; min: number };
};

const pluginDir = path.join(import.meta.dirname, "..");
export const configFile = () => process.env.ESC_GUARD_CONFIG || path.join(pluginDir, "pi-escape-guard.json");

export const DEFAULTS: Cfg = { on: true, block: { on: true, min: 3 } };

export function readConfig(): Cfg {
  try {
    const j = JSON.parse(fs.readFileSync(configFile(), "utf8"));
    const min = Number(j?.block?.min);
    return {
      on: j.on !== false,
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
