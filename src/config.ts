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
};

export const DEFAULTS: Cfg = { on: true, threshold: 3 };

const pluginDir = path.join(import.meta.dirname, "..");
export const configFile = () => process.env.ESC_GUARD_CONFIG || path.join(pluginDir, "pi-escape-guard.json");

export function readConfig(): Cfg {
  try {
    const j = JSON.parse(fs.readFileSync(configFile(), "utf8"));
    return {
      on: j.on !== false,
      threshold: Number.isFinite(Number(j.threshold)) && Number(j.threshold) >= 1 ? Math.floor(Number(j.threshold)) : DEFAULTS.threshold,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function ensureConfig(): Cfg {
  try { if (!fs.existsSync(configFile())) fs.writeFileSync(configFile(), JSON.stringify(DEFAULTS, null, 2) + "\n"); } catch {}
  return readConfig();
}
