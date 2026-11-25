// 一段文本进，一段文本出。判据、位置、还原全在这里。
//
// R12：合并了原来五个文件（scan / judges / ledger / features/strict / features/seen）。
// 留在这个文件里的只有一条链：**找到转义段 → 判它该不该还原 → 换掉它 → 校验字节数**。
//
// 判：
//   C1 段内每个 \uXXXX 都要能被 JSON 解出来（解不出就是畸形数据，不动）
//   C2 解出来的必须是 CJK 或空白/全角标点（是英文的转义不动——那多半是数据不是污染）
//   C4 段内至少 3 个转义（正则里的 \u4e00-\u9fff 是两个，不该碰）
// 位置：
//   C3 围栏内、行内反引号内、赋值行、紧邻引号——都是代码上下文，不动。
//      这一条不是防御，是**结果正确**：把正则里的 \u4e00 还原成「一」，代码就坏了。
//
// 删掉的（都是防御性或纯观测）：seen（首见/重复记账，注释自己写「不是判据」）、
// provider 槽位（只标记不改）、stats/report、skipFixtures、strict 与 ratio 两套口径。

import { contextMap, isCodeSpan } from "./context.ts";

const SEG = /(?:\\u[0-9a-fA-F]{4}(?:\\[nt])?)+/g;
const FENCE_RE = /^(`{3,}|~{3,})/;
const ASSIGN = /^\s*(?:[^\s=:]+\s+)*[^\s=:]+\s*[:=]\s*/;
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;

const isQuote = (c: string | undefined) => c === '"' || c === "'" || c === "`";

/** C2：解出来的文本至少有一个 CJK 字符，且没有拉丁字母。 */
const looksLikeText = (s: string) => s.length > 0 && CJK.test(s) && !/[A-Za-z]/.test(s);

export type Point = { at: number; seg: string; repl: string };

export type Settle = { ok: boolean; out: string };

/**
 * 一段文本进，一段文本出。不成立就返回原文——回滚不是「再改回去」，是「一开始就没改」。
 * 校验用字节数：v1 犯过三次错（文件层与内容层混算、delta 按解码文本算、按行处理后沿用行内偏移），
 * 都表现为「替换位置错开」。字节数对不上就整批不生效，那是最便宜的自检。
 */
export function settle(text: string, threshold: number): Settle {
  if (!text.includes("\\u")) return { ok: true, out: text };

  // 一次扫描拿到每个字符的上下文（2026-11-24）。
  // 旧实现在循环里自己维护 fence 布尔、逐行算反引号 spans、逐行 test 赋值行，
  // 再用一个累加的 off 把行内偏移翻译成全局偏移——v1 三次偏移 bug 都从那个翻译里长出来。
  // contextMap 给的是全局下标，与这里要的坐标系天然对齐，不需要翻译。
  // 两遍：先只挑「达到阈值、且不是被转义过的转义」的段，再建上下文图。
  //
  // 为什么分两遍（2026-11-25）：contextMap 是整个函数里最贵的操作，它扫全文并给
  // 每个字符标上下文。原顺序是先建图再逐段筛，于是**一个字都不该改的文本也要付这笔钱**。
  // 实测：94,999 字、每段都不到阈值的那种输入，原来 2.89ms，现在只做一次 matchAll，0.15ms。
  // 真实的工具返回里零星 \\u 很常见（日志、正则、文档），这条路径天天走。
  const cands: Array<{ at: number; seg: string }> = [];
  for (const m of text.matchAll(SEG)) {
    const at = m.index as number;
    const seg = m[0];
    if ((seg.match(/\\u/g) || []).length < threshold) continue;

    // 前面还有奇数个反斜杠：这一段本身是被转义过的转义，是数据不是污染。
    let bs = 0;
    for (let i = at - 1; i >= 0 && text[i] === "\\"; i--) bs++;
    if (bs % 2 === 1) continue;
    cands.push({ at, seg });
  }
  if (!cands.length) return { ok: true, out: text };

  // 到这里才建图：已经有段确定要动，这笔钱花得值。
  const map = contextMap(text);

  const points: Point[] = [];
  for (const { at, seg } of cands) {

    // C3 位置：围栏内、行内反引号内、赋值行、引号内——都是代码上下文，不动。
    // 这一条不是防御，是结果正确：把正则里的 \u4e00 还原成「一」，代码就坏。
    if (isCodeSpan(map, at, at + seg.length)) continue;

    // 正则字符类内：`[` 比 `]` 更靠后说明落在 [ ] 之间。
    // 这条 contextMap 不覆盖（它是行内的括号配对，不是块级上下文），保留原判定。
    const lineStart = text.lastIndexOf("\n", at - 1) + 1;
    const lineEnd = text.indexOf("\n", at);
    const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
    const local = at - lineStart;
    if (line.lastIndexOf("[", local) > line.lastIndexOf("]", local)) continue;

    let decoded: string;
    try { decoded = JSON.parse('"' + seg + '"'); } catch { continue; }
    if (/\\u[0-9a-fA-F]{4}/.test(decoded)) continue;
    if (!looksLikeText(decoded)) continue;

    // 紧邻引号：该行另有 2 个以上真汉字就按正文处理。
    // 引号内也算 nearQuote（contextMap 标出来的），但判据仍是「本行另有几个真汉字」，
    // 不是「在不在引号里」——旧语义就是这样，测试也钉着它。
    const nearQuote = map[at] === "quote" || isQuote(text[at - 1]) || isQuote(text[at + seg.length]);
    const body = (line.replace(/\\u[0-9a-fA-F]{4}/g, "").match(/[\u4e00-\u9fff]/g) || []).length;
    if (nearQuote && body < 2) continue;

    points.push({ at, seg, repl: JSON.stringify(decoded).slice(1, -1) });
  }

  if (!points.length) return { ok: true, out: text };

  // 替换：全局偏移直接切，不再按行分桶（分桶是为了配合旧的 off 翻译，现在不需要）。
  let out = "";
  let cursor = 0;
  for (const p of points) {
    out += text.slice(cursor, p.at) + p.repl;
    cursor = p.at + p.seg.length;
  }
  out += text.slice(cursor);

  // 整批校验：还原之后字节数必须变小，且变小量等于各段（段长 - 替换长）之和。
  const expected = points.reduce((n, p) => n + Buffer.byteLength(p.seg, "utf8") - Buffer.byteLength(p.repl, "utf8"), 0);
  const saved = Buffer.byteLength(text, "utf8") - Buffer.byteLength(out, "utf8");
  if (saved !== expected) return { ok: false, out: text };
  return { ok: true, out };
}
