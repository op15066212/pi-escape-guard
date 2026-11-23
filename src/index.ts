// 接线：两个钩子。没有业务判断——判据与还原在 scan.ts。
//
// R12：删掉了第三个钩子（before_provider_request 只标记）、删掉了 seen（首见/重复记账）、
// 删掉了 slots 的四槽位表、删掉了 stats 与 report。它们都是观测，不改变动作。
// 留下的两个位置就是「文本进入记录之前」与「助手正文落盘之前」。
import { ensureConfig, readConfig, type Cfg } from "./config.ts";
import { settle } from "./scan.ts";
import { isTextBlock, validContent, validMessage } from "./verdict.ts";

// 观察面：拿**当前配置**现场跑三种样例。
// 不记「还原过几次」——那不是判据（R12 删过 stats，理由是它不改变动作）。
// 能自证的是：现在这条门槛，遇到这三种输入会怎么做。任何时刻可跑，不依赖历史。
const DEMOS = [
  { label: "该还原", text: "\\u4f60\\u53ef\\u4ee5\\u5e2e\\u6211" },
  { label: "不够数", text: "\\u4f60" },
  { label: "代码里", text: "\u0060\u0060\u0060\nconst re = /[\\u4e00-\\u9fff]/;\n\u0060\u0060\u0060" },
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
