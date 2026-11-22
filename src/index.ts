// 接线：两个钩子。没有业务判断——判据与还原在 scan.ts。
//
// R12：删掉了第三个钩子（before_provider_request 只标记）、删掉了 seen（首见/重复记账）、
// 删掉了 slots 的四槽位表、删掉了 stats 与 report。它们都是观测，不改变动作。
// 留下的两个位置就是「文本进入记录之前」与「助手正文落盘之前」。
import { ensureConfig, readConfig, type Cfg } from "./config.ts";
import { settle } from "./scan.ts";
import { isTextBlock, validContent, validMessage } from "./verdict.ts";

export default async function installGuard(pi: any) {
  let cfg: Cfg = ensureConfig();
  pi.on("session_start", async () => { cfg = readConfig(); });

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
