export type { Intent, Rule, RulespecFile, Source, Example } from "./schema.js";
export type { CompileOptions } from "./compiler.js";
export type { EmitOptions } from "./emitter.js";
export { compileRule, compileRules } from "./compiler.js";
export { emitRulesMd, emitDirName } from "./emitter.js";
export { generatePrompt } from "./generate.js";
export { parseRulespecFile } from "./parser.js";
export { validate } from "./schema.js";
export {
  addRule,
  editRule,
  removeRule,
  addSource,
  removeSource,
  addExample,
  removeExample,
  setDomain,
  replaceInFile,
  addRuleExample,
  removeRuleExample,
} from "./writer.js";

import { parseRulespecFile } from "./parser.js";
import type { CompileOptions } from "./compiler.js";

export async function loadRules(
  path: string = "rulespec.yaml",
  options?: CompileOptions,
): Promise<string> {
  const file = await parseRulespecFile(path);
  const { includeHeader = true } = options ?? {};
  const parts: string[] = [];

  if (includeHeader) {
    parts.push("## Rules\n");
  }

  parts.push(file.rules.map((r) => r.prompt).join("\n\n"));

  return parts.join("\n");
}
