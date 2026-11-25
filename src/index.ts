// 接线：两个钩子。没有业务判断——判据与还原在 scan.ts。
//
// R12：删掉了第三个钩子（before_provider_request 只标记）、删掉了 seen（首见/重复记账）、
// 删掉了 slots 的四槽位表、删掉了 stats 与 report。它们都是观测，不改变动作。
// 留下的两个位置就是「文本进入记录之前」与「助手正文落盘之前」。
import { ensureConfig, readConfig, type Cfg } from "./config.ts";
import { settle, findEscapeRuns } from "./scan.ts";
import { isTextBlock, validContent, validMessage } from "./verdict.ts";

// 观察面：拿**当前配置**现场跑三种样例。
// 不记「还原过几次」——那不是判据（R12 删过 stats，理由是它不改变动作）。
// 能自证的是：现在这条门槛，遇到这三种输入会怎么做。任何时刻可跑，不依赖历史。
const DEMOS = [
  { label: "该还原", text: "\\u4f60\\u53ef\\u4ee5\\u5e2e\\u6211" },
  { label: "不够数", text: "\\u4f60" },
  // 第三个样例：围栏里的正则字符类，不该被动。
  // 写法说明（2026-11-25）：原来用 \u0060 写反引号——那是拿 unicode 转义表示 ASCII 符号，
  // 读的人要在脑内解码 0060=反引号。双引号字符串里反引号可以直接写，一层都不需要。
  { label: "代码里", text: "```\nconst re = /[\\u4e00-\\u9fff]/;\n```" },
];

export default async function installGuard(pi: any) {
  let cfg: Cfg = ensureConfig();
  pi.on("session_start", async () => { cfg = readConfig(); });

  // 一行一条，每行 ≤44 字符（PiDeck 通知弹窗约 400px，超了会被裁掉）。
  pi.registerCommand("escape-guard", {
    description: "看阈值，并用当前配置跑三种样例",
    handler: async (args?: any) => {
      // 三种样例算一次，人读与机读共用（一处可写：两处各算一遍，迟早不一样）。
      const demos = DEMOS.map((d) => {
        const r = settle(d.text, cfg.threshold);
        return { label: d.label, hit: r.ok && r.out !== d.text, ok: r.ok, saved: d.text.length - r.out.length };
      });
      if (String(args || "").trim() === "json") {
        return JSON.stringify({ threshold: cfg.threshold, on: cfg.on, demos });
      }
      // 一行一条，每行 ≤44 字符（PiDeck 通知弹窗约 400px，超了会被裁掉）。
      const rows = ["threshold " + cfg.threshold + "   开关 " + (cfg.on ? "开" : "关")];
      for (const d of demos) {
        // 只报「改没改」，不贴原文：原文里是反斜杠，贴进弹窗更看不懂。
        rows.push(d.label + "   " + (d.hit ? "还原 " + d.saved + " 字符" : "不动"));
      }
      return rows.join(String.fromCharCode(10));
    },
  });

  // S0：调用工具前拦。这是这个插件存在的目的（2026-11-25，使用者定的方向）。
  //
  // 它此前只做事后还原：转义已经落盘，读的时候改回来。使用者指出不是这个——
  // 目的是拦住写的人，让他一开始就别写转义。
  //
  // 判据：event.input 里有成串的转义就拒。不看位置、不看上下文。
  // 要问的问题不是「这段该不该还原」，而是「你写这段参数时本来可以直接写中文吗」。
  //
  // 门槛由 cfg.block.min 控制（默认 3）：正则字符类里那种两个转义的写法是必要的，不拦。
  pi.on("tool_call", async (event: any) => {
    if (!cfg.on || !cfg.block.on) return undefined;
    // 遍历原值里每个字符串，不先 JSON.stringify。
    // 为什么：stringify 会把一个反斜杠写成两个（\\），
    // 于是 \u4f60 到了 payload 里变成 \\u4f60，匹配不到——
    // 这正是「多层转义」的又一个实例：我自己加的那一层把判据挡住了。
    // 试过再用 JSON.parse 还原，那是「用一个转义去解另一个转义」，越走越深。
    // 直接遍历原值，一层都没有。
    //
    // 可复现的证据（pi 插件2 给的）：同一段文本，直接匹配命中 1 处；
    // 先 JSON.stringify 再匹配命中 0 处。差的就是那一层。
    // 多包一层不是「更保险」，是判据整个失效，而且不报错——
    // 属于「保护形同不存在」那一类：不叫，因为分支永远不成立。
    const texts: string[] = [];
    const walk = (v: any, depth: number) => {
      if (depth > 20) return; // 防御：极深的嵌套不追
      if (typeof v === "string") texts.push(v);
      else if (Array.isArray(v)) for (const x of v) walk(x, depth + 1);
      else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, depth + 1);
    };
    walk(event?.input ?? null, 0);

    const runs: Array<{ seg: string; count: number }> = [];
    for (const t of texts) runs.push(...findEscapeRuns(t, cfg.block.min));
    if (!runs.length) return undefined;

    // 把第一段解出来给他看：模型看到「这一段应该是：你好世」就知道怎么改。
    // 只说「不许转义」他可能不知道指的是哪几个字。
    let sample = "";
    try { sample = JSON.parse('"' + runs[0].seg + '"'); } catch { sample = ""; }
    const total = runs.reduce((n, r) => n + r.count, 0);
    return {
      block: true,
      reason:
        "这段工具参数里有 " + runs.length + " 处成串的转义，共 " + total + " 个"
        + (sample ? "。其中一段应该是：" + sample : "")
        + "。直接写它代表的字，不要写转义序列。"
        + "（正则字符类这类必要写法，写成可读形式或加注释说明。）",
    };
  });
  // S1：工具结果。污染的主入口。
  pi.on("tool_result", async (event: any) => {
    if (!cfg.on || !validContent(event.content)) return undefined;
    let touched = 0;
    const content = event.content.map((b: any) => {
      if (!isTextBlock(b) || !b.text.includes("\\u")) return b;
      const r = settle(b.text, cfg.threshold);
      if (!r.ok || r.out === b.text) return b;
      touched++;
      return { ...b, text: r.out };
    });
    if (!touched) return undefined;
    // structuredContent 一旦存在就一并丢弃：改 content 不改它会两者不一致。
    return { content, structuredContent: event.structuredContent !== undefined ? undefined : undefined };
  });

  // S2：助手正文。落盘前最后一站。
  pi.on("message_end", async (event: any) => {
    const m = event?.message;
    if (!cfg.on || !m || m.role !== "assistant" || !Array.isArray(m.content)) return undefined;
    let touched = 0;
    const content = m.content.map((b: any) => {
      if (!isTextBlock(b) || !b.text.includes("\\u")) return b;
      const r = settle(b.text, cfg.threshold);
      if (!r.ok || r.out === b.text) return b;
      touched++;
      return { ...b, text: r.out };
    });
    if (!touched) return undefined;
    const next = { ...m, content };
    return validMessage(next, "assistant") ? { message: next } : undefined;
  });
}
