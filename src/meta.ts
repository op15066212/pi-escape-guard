/**
 * 元理论：依赖类型理论（唯一）。
 *
 * 一条规则 = 一个类型；说它成立 = 指得出住在这个类型里的居民。没有居民就不成立。
 * 四件缺一不算规则：形成（词落到盘上可查的东西）· 引入（命令 + 期望 rc）·
 * 消去（换第二个入口算一遍，得同一个答案）· 反例（一个具体输入，喂进去就为假）。
 *
 * 2026-11-26：RULES 从 5 条减到 1 条。C1–C4 判的是「这段该不该还原」，
 * 而还原这条路径（settle / context.ts / verdict.ts）已按使用者要求删除。
 * 留下来的只有 S0：调用工具前，入参里有成串转义就拒 —— 这个插件唯一的动作。
 */

// 默认值从 config.ts 引入，不在这里手写一遍（2026-11-25，pi 插件2 指出）。
// 原来「形成」格里手写「默认 3」——那是第二处，改 DEFAULTS 时文本不会跟着变，
// 于是四件表描述的和代码做的是两件事，而这种不一致不影响任何运行结果。
// 这里插值，改 DEFAULTS 就自动同步。
import { DEFAULTS } from "./config.ts";
export const META = "依赖类型理论" as const;

export type Piece = "形成" | "引入" | "消去" | "反例";

export interface Rule {
  /** 与 scan.ts 的判据名对齐，供覆盖判据校验。没有 id 的规则进不了那张表。 */
  readonly id?: string;
  /** verdict = 参与判决的判据；mechanism = 接线约束（不产生判决）。 */
  readonly kind?: "verdict" | "mechanism";
  /** 这条规则约束的文件（相对 src/），判据会验它存在。 */
  readonly module?: string;
  readonly prop: string;
  readonly 形成: string;
  readonly 引入: string;
  readonly 消去: string;
  readonly 反例: string;
}

export const RULES: readonly Rule[] = [
  {
    id: "s0-block", kind: "verdict", module: "scan.ts",
    prop: "S0 调用工具前，入参里有成串转义就拒",
    形成: "block 在 pi-escape-guard.json（默认 on:" + DEFAULTS.block.on + ", min:" + DEFAULTS.block.min + "）；findEscapeRuns 在 scan.ts",
    引入: "node --experimental-strip-types --test test/block.test.ts；期望全过、rc=0",
    消去: "同一段入参在 block.on=true 与 false 下结论相反（block.test.ts 的两条用例）",
    反例: "一段参数里连续三个转义：该拒；而正则字符类里那种两个不连续的，该放",
  },
];

/** 四件齐不齐。空数组 = 每条规则都有居民。 */
export function audit(rules: readonly Rule[] = RULES): string[] {
  const miss: string[] = [];
  for (const r of rules) {
    for (const k of ["形成", "引入", "消去", "反例"] as Piece[]) {
      if (!r[k] || !r[k].trim()) miss.push(r.prop + " 缺「" + k + "」");
    }
    if (!/(rc|test|node\b)/.test(r.引入)) miss.push(r.prop + " 的引入没给命令或退出码");
    if (r.反例.trim().length < 4) miss.push(r.prop + " 的反例太短，不是具体输入");
  }
  return miss;
}
