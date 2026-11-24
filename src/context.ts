// 上下文状态机：一次扫过全文，给每个字符标出它处在什么上下文里。
//
// 为什么需要它（2026-11-24，用户要求「两个插件都用整体思维+高级算法」）：
//   现在判「这个转义段在不在代码里」用的是逐行正则：
//   行首三反引号切围栏、行内反引号、`^\s*ident[:=]` 认赋值行、紧邻引号。
//   逐行判不出三件事：
//     一 围栏跨了多少行（只有「刚才见过三反引号」这一个布尔量，嵌套与未闭合都乱）
//     二 转义段跨行时，前半在正文、后半在围栏里
//     三 行内反引号开了没关，下一个反引号在哪
//   这三件都能用一次字符级扫描加一个显式栈答完，不需要按行猜。
//
// 输出是「每个字符属于哪类上下文」的数组。判据拿到它之后只需要问「这个位置是什么」。

export type Ctx = "prose" | "fence" | "inline-code" | "assign" | "quote";

/**
 * 一次扫描，返回长度等于 text.length 的上下文数组。
 *
 * 状态显式维护，不靠正则回溯：
 *   fence       当前围栏的符号与长度，null 表示不在围栏里
 *   inlineTick  行内反引号开了没，0 表示没开
 *   assignUntil 赋值行的结束位置
 *   quoteUntil  当前字符串的结束位置
 */
export function contextMap(text: string): Ctx[] {
  const n = text.length;
  const out: Ctx[] = new Array(n).fill("prose");

  let fence: { ch: string; len: number } | null = null;
  let inlineTick = 0;
  let assignUntil = -1;
  let quoteUntil = -1;
  let quoteCh = "";
  let lineStart = 0;

  for (let i = 0; i < n; i++) {
    const ch = text[i];
    const prefix = text.slice(lineStart, i);
    const atLineStart = prefix === "" || /^[ \t]*$/.test(prefix);

    if (atLineStart && ch !== "\n") {
      const rest = text.slice(i, Math.min(n, i + 8));
      const fm = /^(`{3,}|~{3,})/.exec(rest);
      if (fm) {
        const sym = fm[1][0];
        const len = fm[1].length;
        if (!fence) fence = { ch: sym, len };
        else if (fence.ch === sym && len >= fence.len) fence = null;
        const eol = text.indexOf("\n", i);
        const stop = eol < 0 ? n : eol;
        for (let k = i; k < stop; k++) out[k] = "fence";
        i = stop - 1;
        continue;
      }
      const am = /^[ \t]*[^\s=:]+[ \t]*[:=][ \t]*/.exec(text.slice(i, Math.min(n, i + 200)));
      if (am && !fence) {
        const eol = text.indexOf("\n", i);
        assignUntil = eol < 0 ? n : eol;
      }
    }

    if (ch === "\n") {
      lineStart = i + 1;
      inlineTick = 0;
      if (i < assignUntil) out[i] = "assign";
      continue;
    }

    if (fence) {
      out[i] = "fence";
      continue;
    }
    if (ch === "`") {
      inlineTick = inlineTick === 0 ? 1 : 0;
      out[i] = "inline-code";
      continue;
    }
    if (inlineTick) {
      out[i] = "inline-code";
      continue;
    }
    if (quoteUntil >= i) {
      out[i] = "quote";
      if (ch === quoteCh && text[i - 1] !== "\\") quoteUntil = -1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quoteCh = ch;
      const eol = text.indexOf("\n", i);
      quoteUntil = (eol < 0 ? n : eol) - 1;
      out[i] = "quote";
      continue;
    }
    if (i < assignUntil) {
      out[i] = "assign";
      continue;
    }
    out[i] = "prose";
  }

  return out;
}

/**
 * 某一段 [from, to) 是不是全在**代码**上下文里。
 *
 * 注意 quote 不算代码：引号里装的通常是正文（'意思是 "\u4f60" 这三个字'），
 * 只有它在赋值行里才连着 assign 一起被算进来。把 quote 当代码会让带引号的正文
 * 永远还原不了——2026-11-24 改 contextMap 时踩到，测试钉着的那条当场红了。
 */
const CODE_CTX: ReadonlySet<Ctx> = new Set<Ctx>(["fence", "inline-code", "assign"]);

export function isCodeSpan(map: readonly Ctx[], from: number, to: number): boolean {
  if (from >= to) return false;
  for (let i = from; i < to; i++) if (!CODE_CTX.has(map[i])) return false;
  return true;
}
