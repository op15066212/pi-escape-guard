// 输出形状校验。手写，不用 zod：要校验的形状只有三种，加一个库是把三种形状换成一张 schema。
//
// 这里判的是「我返回的东西会不会把 pi 的消息结构改坏」，不判内容对错——内容由判据判。

export type TextBlock = { type: "text"; text: string; [k: string]: unknown };

export const isTextBlock = (b: unknown): b is TextBlock =>
  !!b && typeof b === "object" && (b as any).type === "text" && typeof (b as any).text === "string";

/** tool_result 的 content 必须是数组；元素可以是任意块，但 text 块的 text 必须是字符串。 */
export function validContent(content: unknown): content is unknown[] {
  if (!Array.isArray(content)) return false;
  return content.every((b) => !(b && typeof b === "object" && (b as any).type === "text") || typeof (b as any).text === "string");
}

/** message_end 的替换必须保住 role，否则 pi 会把它当另一类消息。 */
export function validMessage(m: unknown, role: string): boolean {
  if (!m || typeof m !== "object") return false;
  const msg = m as any;
  if (msg.role !== role) return false;
  if (msg.content !== undefined && !Array.isArray(msg.content) && typeof msg.content !== "string") return false;
  return true;
}
