#!/usr/bin/env node
// check-doc-accuracy.mjs —— 文档里写到的配置键与文件路径，盘上必须真的有。
//
// 只查两类东西，因为这两类是「文档骗人」的高发处：
//   ① 配置键：表格第一格是键名，或 JSON 块里的 "key": ——必须在 defaults.ts / config.ts 里有
//   ② 文件路径：含 / 或以已知扩展名结尾 —— 必须存在
// 不查泛泛的反引号词：那会把「你可以」「sorry」「unicode 转义」这类正常用词算成标识符，
// 于是判据天天红、人天天忽略它——比没有判据更坏。
//
// rc: 0 全对得上｜1 有对不上的｜2 文档目录缺失
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TICK = String.fromCharCode(96);
/** 由代码按需生成的运行态文件：新克隆上本来就没有，不能要求它存在。
 *  判据不是「它存在」，而是「文档说得出它是生成的」。 */
const GENERATED = new Set(["pi-escape-guard.json", "state.json"]);

/** .gitignore 里点名忽略的名字。
 *  这是 GENERATED 的外部约束：一个名字只要进了 GENERATED，就跳过了路径存在性检查。
 *  没有约束时，往名单里塞一个「既不生成、也没被忽略」的名字，没人会红——
 *  判据就退化成人自己记得住的白名单。约束把它钉到另一处可查的事实上。
 *  合并方向来自组 2（2026-11-27）：它给的坏样本是往名单里加 bogus.json。 */
function ignoredNames(root) {
  const f = path.join(root, ".gitignore");
  if (!fs.existsSync(f)) return new Set();
  return new Set(
    fs.readFileSync(f, "utf8").split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#"))
      .map((s) => (s.endsWith("/") ? s.slice(0, -1) : s))
  );
}

/** GENERATED 里没被 .gitignore 点名的名字，每条是一个问题。 */
export function generatedProblems(generated, root) {
  const ign = ignoredNames(root);
  return [...generated]
    .filter((n) => !ign.has(n))
    .map((n) => "GENERATED 名单里的 " + n + " 不在 .gitignore：它既不会被生成，也没被忽略");
}
const DOCS = ["README.md", "SETTINGS.md", "docs/for-agents/escape-guard.md"]
  .map((f) => path.join(here, f))
  .filter((f) => fs.existsSync(f));
if (DOCS.length === 0) { console.log("缺文档"); process.exit(2); }

function read(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) read(full, out);
    else out.push(full);
  }
  return out;
}
const srcFiles = read(path.join(here, "src"));
const srcText = srcFiles.filter((f) => /\.(ts|mjs|js)$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
// 只数「声明的字段」，不数注释里提到的名字：
// config.ts 的注释里写着「删掉的是 strict / ratio / ...」，用 includes 判会让这些键看着还存在。
const cfgKeys = new Set();
for (const f of ["config.ts", "defaults.ts"]) {
  const fp = path.join(here, "src", f);
  if (!fs.existsSync(fp)) continue;
  for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
    if (/^\s*(\/\/|\*)/.test(line)) continue;
    const m = line.match(/^\s{1,4}([a-z][a-zA-Z0-9_]*)\s*\??\s*:/);
    if (m) cfgKeys.add(m[1]);
    for (const j of line.matchAll(/([a-z][a-zA-Z0-9_]*)\s*:\s*(?:true|false|\d+|"|\{)/g)) cfgKeys.add(j[1]);
  }
}

/** 文档里声明的配置键。只认配置小节里的两种形状：表格首格 | 键 |，或 JSON 块里的 "键": */
export function keysIn(text) {
  const keys = new Set();
  const T = String.fromCharCode(96);
  // 2026-11-25：与 pi-think-sentry 同步。原来「任何表格首格」都算配置键，
  // 于是 README 里 /escape-guard json 的输出示例（demos / ok / label / saved）
  // 全被报成「配置键不存在」——判据恒假红，红久了就没人看。
  // 现在只在配置小节（标题含 配置/设置/键）里取，因为输出示例的形状与配置一模一样，
  // 靠键名本身分不开，只能靠小节划界。
  let inCfg = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) {
      inCfg = /配置|设置|键/.test(line);
      continue;
    }
    if (inCfg && line.startsWith("|")) {
      const cell = line.slice(1).split("|")[0].trim();
      if (cell.length > 2 && cell.startsWith(T) && cell.endsWith(T)) {
        const k = cell.slice(1, -1).trim();
        if (/^[a-z][a-zA-Z0-9_.]*$/.test(k)) keys.add(k);
      }
    }
    if (inCfg) {
      const j = line.match(/^\s*"([a-z][a-zA-Z0-9_]*)"\s*:/);
      if (j) keys.add(j[1]);
    }
  }
  return keys;
}

/** 文档里声明的文件路径 */
export function pathsIn(text) {
  const out = new Set();
  const re = new RegExp(TICK + "([A-Za-z0-9_./-]+\\.(?:ts|mjs|js|json|md|sh|py))" + TICK, "g");
  for (const m of text.matchAll(re)) out.add(m[1]);
  return out;
}

export function check(docs = DOCS, root = here) {
  // 这条约束只对仓库根成立：selftest 拿临时目录当 root 时那里没有 .gitignore，
  // 名字是否被忽略是仓库级的事实，不是每个被扫目录各自的事实。
  const gProblems = root === here ? generatedProblems(GENERATED, root) : [];
  const problems = [];
  for (const doc of docs) {
    const rel = path.isAbsolute(doc) ? path.relative(root, doc) : doc;
    const text = fs.readFileSync(doc, "utf8");
    for (const k of keysIn(text)) {
      const leaf = k.includes(".") ? k.split(".").pop() : k;
      if (!cfgKeys.has(leaf)) problems.push(rel + "：配置键 " + k + " 在 config.ts / defaults.ts 里不存在");
    }
    for (const p of pathsIn(text)) {
      if (GENERATED.has(p)) continue;
      const cands = [path.join(root, p), path.join(root, "src", p), path.join(root, "scripts", p), path.join(root, "test", p), path.join(root, "bin", p)];
      if (!cands.some((c) => fs.existsSync(c))) problems.push(rel + "：路径不存在 " + p);
    }
  }
  return problems.concat(gProblems);
}

// selftest 分支也受 isMain 保护（2026-11-25）：别的脚本带 --selftest 去 import 它时，
// 跑的是它的自检并直接 exit，外层那个脚本的自检根本没执行。
if (import.meta.main && process.argv.includes("--selftest")) {
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "docacc-"));
  const bad = path.join(tmp, "bad.md");
  const good = path.join(tmp, "good.md");
  // 非配置小节里的输出示例：demos / ok 是 /escape-guard json 的返回字段，不是配置键。
  // 这条挡的是本仓真实红过的形状（README 那段输出示例，4 处误报里的 2 处）。
  const sample = path.join(tmp, "sample.md");
  fs.writeFileSync(bad, "## 配置\n\n| " + TICK + "strict" + TICK + " | true | 已删的键 |\n有用：" + TICK + "config.ts" + TICK + "\n", "utf8");
  fs.writeFileSync(good, "## 配置\n\n| " + TICK + "on" + TICK + " | true |\n| " + TICK + "block" + TICK + " | { on: true, min: 3 } |\n", "utf8");
  fs.writeFileSync(sample, "## 不进 pi 也能查\n\n" + TICK.repeat(3) + "json\n{\n  \"demos\": [\n    { \"ok\": true }\n  ]\n}\n" + TICK.repeat(3) + "\n", "utf8");
  const badProblems = check([bad], tmp);
  const goodProblems = check([good], tmp);
  const sampleProblems = check([sample], tmp);
  const checks = [
    ["配置小节里写了已删的键 strict → 必须红", badProblems.length > 0, true],
    ["配置小节里只写真实键 → 必须绿", goodProblems.length === 0, true],
    ["非配置小节里的输出示例字段 → 必须绿", sampleProblems.length === 0, true],
    ["GENERATED 里的名字都在 .gitignore → 必须绿", generatedProblems(new Set(["pi-escape-guard.json", "state.json"]), here).length === 0, true],
    ["GENERATED 里塞一个 .gitignore 没有的名字 → 必须红", generatedProblems(new Set(["bogus.json"]), here).length > 0, true],
  ];
  let n = 0;
  for (const c of checks) { const ok = c[1] === c[2]; if (!ok) n++; console.log((ok ? "PASS" : "FAIL") + "  " + c[0] + "（得 " + c[1] + "）"); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(n === 0 ? "selftest: 坏样本红、好样本绿" : "selftest: " + n + " 条不符");
  process.exit(n === 0 ? 0 : 1);
}

// 只在被直接执行时跑主流程（2026-11-25）。此前 import 这个文件会直接跑完 check() 并 process.exit，
// 于是别的脚本想复用它里面的 keysIn/pathsIn 就做不到。
// 结果就是同一份逻辑在两个仓里各抄一遍，抄到两边行为不一致。
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const problems = check();
  for (const p of problems) console.log("红  " + p);
  console.log("check-doc-accuracy: " + DOCS.length + " 份文档，对不上 " + problems.length + " 处");
  process.exit(problems.length === 0 ? 0 : 1);
}