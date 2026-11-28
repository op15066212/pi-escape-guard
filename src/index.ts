// 接线。这个插件只有一个动作：**调用工具前，参数里有成串转义就拒绝执行**。
//
// 2026-11-26 使用者定的范围：只保留 tool_call 与「拒绝执行」。
// 删掉的是 tool_result / message_end 两条还原钩子：转义已经落盘之后再改回来是补漏，
// 不是目的——目的只有一个，让它一开始就写不出来。
//
// 因此这里只注册**一个钩子**。配置不进 session_start 缓存，而是在 tool_call 里现读：
// tool_call 每轮只来几次，读一个 200 字节的 JSON 约 0.1ms；换来的是改完配置下一次调用
// 就生效，不用等下一个会话。少一个钩子，也少一处「配好了 ≠ 生效了」。
import { ensureConfig, readConfig } from "./config.ts";
import { forEachEscapeRun } from "./scan.ts";

export default async function installGuard(pi: any) {
  // 首次启动把配置文件写出来，之后不再覆盖（使用者要能自己改）。
  ensureConfig();

  // S0：调用工具前拦。这是这个插件存在的全部理由。
  //
  // 判据：event.input 里有成串的转义就拒。不看位置、不看上下文。
  // 要问的问题不是「这段该不该还原」，而是「你写这段参数时本来可以直接写中文吗」。
  // 门槛由 block.min 控制（默认 3）：正则字符类里那种两个转义的写法是必要的，不拦。
  pi.on("tool_call", async (event: any) => {
    const cfg = readConfig();
    if (!cfg.on || !cfg.block.on) return undefined;
    // 遍历原值里每个字符串，不先 JSON.stringify。
    // stringify 会把一个反斜杠写成两个（\\），于是 \u4f60 到了 payload 里变成 \\u4f60，匹配不到 ——
    // 我加的那一层把判据挡住了。多包一层不是「更保险」，是判据整个失效，而且不报错。
    // （可复现：同一段文本直接匹配命中 1 处；先 stringify 再匹配命中 0 处。）

    let runCount = 0;
    let total = 0;
    let firstSeg: string | null = null;
    const scanText = (text: string) => {
      forEachEscapeRun(text, cfg.block.min, (_at, seg, count) => {
        runCount++;
        total += count;
        if (firstSeg === null) firstSeg = seg;
      });
    };
    const walk = (v: any, depth: number): void => {
      if (depth > 20) return; // 防御：极深的嵌套不追
      if (typeof v === "string") scanText(v);
      else if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
      else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, depth + 1);
    };
    walk(event?.input ?? null, 0);
    if (runCount === 0) return undefined;

    // 把第一段解出来给他看：模型看到「这一段应该是：你好世」就知道怎么改。
    // 只说「不许转义」他可能不知道指的是哪几个字。
    let sample = "";
    try { sample = JSON.parse('"' + firstSeg + '"'); } catch { sample = ""; }
    return {
      block: true,
      reason:
        "这段工具参数里有 " + runCount + " 处成串的转义，共 " + total + " 个"
        + (sample ? "。其中一段应该是：" + sample : "")
        + "。直接写它代表的字，不要写转义序列。"
        + "（正则字符类这类必要写法，写成可读形式或加注释说明。）",
    };
  });
}
