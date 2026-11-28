// 只做一件事：在文本里找出**成串的转义段**，供「调用工具前拦截」用。
//
// 2026-11-26 使用者定的范围：插件只保留 tool_call 与「拒绝执行」。
// 原来还有一条 settle()（判这段该不该还原、换掉它、校验字节数）与它依赖的位置表
// （context.ts：围栏、行内反引号、赋值行、引号）—— 全部删除。
// 理由：那是事后补漏，目的只有一个，让它一开始就写不出来。
//
// 这一条为什么**不看位置**：拦截要问的不是「这段该不该还原」，而是
// 「你写这段参数时，本来可以直接写中文吗？」在工具入参里出现成串 \uXXXX 就是偷懒。
// 单看这一条会误伤正则字符类 [\u4e00-\u9fff]（必要写法，但只有两个），
// 所以门槛由 min 控制（默认 3），两个不拦。

const SEG = /(?:\\u[0-9a-fA-F]{4}(?:\\[nt])?)+/g;

/** Visit matching runs without retaining an array of every run. Returns the number visited. */
export function forEachEscapeRun(text: string, min: number, visit: (at: number, seg: string, count: number) => void): number {
  let found = 0;
  for (const m of text.matchAll(SEG)) {
    const seg = m[0];
    let count = 0;
    for (let i = 0; i < seg.length;) {
      count++;
      i += 6;
      if (seg[i] === "\\" && (seg[i + 1] === "n" || seg[i + 1] === "t")) i += 2;
    }
    if (count >= min) {
      found++;
      visit(m.index as number, seg, count);
    }
  }
  return found;
}

export function findEscapeRuns(text: string, min: number): Array<{ at: number; seg: string; count: number }> {
  const out: Array<{ at: number; seg: string; count: number }> = [];
  forEachEscapeRun(text, min, (at, seg, count) => out.push({ at, seg, count }));
  return out;
}
