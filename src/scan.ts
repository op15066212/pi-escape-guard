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
  const points: Point[] = [];
  let fence: { ch: string; len: number } | null = null;
  let off = 0;   // 行首偏移。at 必须存**全局**偏移：后面按全局切，行内偏移会错开（v1 的 ratio 1.45）。

  for (const line of text.split("\n")) {
    const t = line.trim();
    const fm = FENCE_RE.exec(t);
    if (fm) {
      const ch = fm[1][0], len = fm[1].length;
      if (!fence) fence = { ch, len };
      else if (ch === fence.ch && len >= fence.len) fence = null;
      continue;
    }
    if (fence) continue;

    const assign = ASSIGN.test(line);
    const spans = [...line.matchAll(/`[^`]*`/g)].map((m) => [(m.index as number) + off, (m.index as number) + off + m[0].length]);

    for (const m of line.matchAll(SEG)) {
      const at = (m.index as number) + off;
      const seg = m[0];
      if ((seg.match(/\\u/g) || []).length < threshold) continue;
      // 前面还有奇数个反斜杠：这一段本身是被转义过的转义，是数据不是污染。
      let bs = 0;
      for (let i = at - 1; i >= 0 && line[i] === "\\"; i--) bs++;
      if (bs % 2 === 1) continue;
      if (spans.some(([x, y]) => at >= x && at < y)) continue;
      // 正则字符类内：line.lastIndexOf("[", at) 比 line.lastIndexOf("]", at) 更靠后说明 at 落在 [ ] 之间。
      // 回放实测抓到的：.replace(/[\u201c\u201d\u300c\u300d.../ 被还原成中文引号，代码直接坏了。
      const local = at - off;
      if (line.lastIndexOf("[", local) > line.lastIndexOf("]", local)) continue;

      let decoded: string;
      try { decoded = JSON.parse('"' + seg + '"'); } catch { continue; }
      if (/\\u[0-9a-fA-F]{4}/.test(decoded)) continue;
      if (!looksLikeText(decoded)) continue;

      // C3d：段紧邻引号即判代码。例外：该行另有 2 个以上真汉字就按正文处理。
      const nearQuote = isQuote(line[at - 1]) || isQuote(line[at + seg.length]);
      const body = (line.replace(/\\u[0-9a-fA-F]{4}/g, "").match(/[\u4e00-\u9fff]/g) || []).length;
      if (assign || (nearQuote && body < 2)) continue;

      points.push({ at, seg, repl: JSON.stringify(decoded).slice(1, -1) });
    }
    off += line.length + 1;
  }

  if (!points.length) return { ok: true, out: text };

  // 按行分别替换：行内偏移与全局偏移不同，v1 在这里错过一次（ratio 1.45）。
  const lines = text.split("\n");
  let base = 0;
  const out: string[] = [];
  for (const line of lines) {
    const local = points.filter((p) => p.at >= base && p.at < base + line.length);
    if (!local.length) { out.push(line); base += line.length + 1; continue; }
    let buf = line;
    for (const p of [...local].sort((a, b) => b.at - a.at)) {
      const i = p.at - base;
      buf = buf.slice(0, i) + p.repl + buf.slice(i + p.seg.length);
    }
    out.push(buf);
    base += line.length + 1;
  }
  const joined = out.join("\n");

  // 整批校验：还原之后字节数必须变小，且变小量等于各段（段长 - 替换长）之和。
  const expected = points.reduce((n, p) => n + Buffer.byteLength(p.seg, "utf8") - Buffer.byteLength(p.repl, "utf8"), 0);
  const saved = Buffer.byteLength(text, "utf8") - Buffer.byteLength(joined, "utf8");
  if (saved !== expected) return { ok: false, out: text };
  return { ok: true, out: joined };
}
