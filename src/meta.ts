/**
 * 元理论：依赖类型理论（唯一）。
 *
 * 一条规则 = 一个类型；说它成立 = 指得出住在这个类型里的居民。没有居民就不成立。
 * 四件缺一不算规则：形成（词落到盘上可查的东西）· 引入（命令 + 期望 rc）·
 * 消去（换第二个入口算一遍，得同一个答案）· 反例（一个具体输入，喂进去就为假）。
 *
 * 这个文件是转义还原的元理论声明本身：下面的 RULES 就是它的居民。
 */

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
    id: "c1-unescape", kind: "verdict",
    prop: "C1 解出来不含字面转义",
    形成: "scan.ts 的 unescape 与 detect 判据",
    引入: "npm test 的 scan 用例；期望 rc=0",
    消去: "bin/mutate.mjs 的变异必须被 C1 抓住",
    反例: "\\u005c\\u0075\\u0034\\u0066\\u0036\\u0030 解出 \\u4f60",
  },
  {
    id: "c2-cjk", kind: "verdict",
    prop: "C2 解出来全是 CJK（含空白、全角标点）",
    形成: "strict 与 ratio 开关在 pi-escape-guard.json",
    引入: "npm test 的 strict/ratio 两组；期望 rc=0",
    消去: "同一段在 strict=true 与 ratio=0.6 下的判决要对得上",
    反例: "\\u0024\\u0024\\u0024 解出 $$$",
  },
  {
    id: "c3-position", kind: "verdict",
    prop: "C3 不在代码上下文",
    形成: "围栏、行内 code、赋值行、紧邻引号的位置表",
    引入: "npm test 的位置用例（12 条）；期望 rc=0",
    消去: "test/fixtures 里同一段放进围栏与放进正文，判决应相反",
    反例: "const s = \"…\" 里的一串转义",
  },
  {
    id: "c4-threshold", kind: "verdict",
    prop: "C4 至少 3 个转义起算成段",
    形成: "threshold 在 pi-escape-guard.json（默认 3）",
    引入: "npm test 的阈值用例；期望 rc=0",
    消去: "threshold=3 与 threshold=1 在同一份记录上比较",
    反例: "孤立 \\u4f60，只一个转义，不动",
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
