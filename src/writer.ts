import { readFile, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { validate, type Rule, type Source, type Example } from "./schema.js";
import { compileRule } from "./compiler.js";

async function readAndValidate(path: string) {
  const content = await readFile(path, "utf-8");
  const data = parse(content);
  const result = validate(data);
  if (!result.ok) {
    const messages = result.errors
      .map((e) => `  ${e.path}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid rulespec file:\n${messages}`);
  }
  return result.value;
}

async function readRaw(path: string) {
  const content = await readFile(path, "utf-8");
  return parse(content) as Record<string, unknown>;
}

// --- Replace (find & replace with re-validation + recompile) ---

export async function replaceInFile(
  path: string,
  oldStr: string,
  newStr: string,
): Promise<void> {
  const content = await readFile(path, "utf-8");

  if (!content.includes(oldStr)) {
    throw new Error(`String not found in ${path}:\n  "${oldStr}"`);
  }

  const updated = content.replace(oldStr, newStr);
  const data = parse(updated);
  const result = validate(data);
  if (!result.ok) {
    const messages = result.errors
      .map((e) => `  ${e.path}: ${e.message}`)
      .join("\n");
    throw new Error(`Replacement would produce an invalid file:\n${messages}`);
  }

  // Re-compile all rule prompts to keep them in sync
  const file = result.value;
  for (const rule of file.rules) {
    rule.prompt = compileRule(rule);
  }

  await writeFile(path, stringify(file), "utf-8");
}

// --- Domain ---

export async function setDomain(path: string, domain: string): Promise<void> {
  const raw = await readRaw(path);
  raw.domain = domain;
  const result = validate(raw);
  if (!result.ok) {
    const messages = result.errors
      .map((e) => `  ${e.path}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid rulespec file:\n${messages}`);
  }
  await writeFile(path, stringify(raw), "utf-8");
}

// --- Rules ---

export async function addRule(path: string, rule: Rule): Promise<void> {
  const file = await readAndValidate(path);

  if (file.rules.some((r) => r.id === rule.id)) {
    throw new Error(`Rule with id "${rule.id}" already exists`);
  }

  const ruleWithPrompt = { ...rule, prompt: compileRule(rule) };
  file.rules.push(ruleWithPrompt);
  await writeFile(path, stringify(file), "utf-8");
}

export async function editRule(
  path: string,
  id: string,
  updates: Partial<Pick<Rule, "rule" | "context" | "intent">>,
): Promise<void> {
  const file = await readAndValidate(path);

  const rule = file.rules.find((r) => r.id === id);
  if (!rule) {
    throw new Error(`Rule with id "${id}" not found`);
  }

  if (updates.rule !== undefined) rule.rule = updates.rule;
  if (updates.context !== undefined) rule.context = updates.context;
  if (updates.intent !== undefined) rule.intent = updates.intent;
  rule.prompt = compileRule(rule);

  await writeFile(path, stringify(file), "utf-8");
}

export async function removeRule(path: string, id: string): Promise<void> {
  const file = await readAndValidate(path);

  const index = file.rules.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new Error(`Rule with id "${id}" not found`);
  }

  file.rules.splice(index, 1);

  if (file.rules.length === 0) {
    throw new Error("Cannot remove the last rule");
  }

  await writeFile(path, stringify(file), "utf-8");
}

// --- Rule examples ---

export async function addRuleExample(
  path: string,
  ruleId: string,
  example: Example,
): Promise<void> {
  const file = await readAndValidate(path);

  const rule = file.rules.find((r) => r.id === ruleId);
  if (!rule) {
    throw new Error(`Rule with id "${ruleId}" not found`);
  }

  if (!rule.examples) rule.examples = [];
  rule.examples.push(example);
  await writeFile(path, stringify(file), "utf-8");
}

export async function removeRuleExample(
  path: string,
  ruleId: string,
  index: number,
): Promise<void> {
  const file = await readAndValidate(path);

  const rule = file.rules.find((r) => r.id === ruleId);
  if (!rule) {
    throw new Error(`Rule with id "${ruleId}" not found`);
  }

  if (!rule.examples || index < 0 || index >= rule.examples.length) {
    throw new Error(
      `Example at index ${index} not found on rule "${ruleId}"`,
    );
  }

  rule.examples.splice(index, 1);
  if (rule.examples.length === 0) {
    delete rule.examples;
  }

  await writeFile(path, stringify(file), "utf-8");
}

// --- Sources ---

export async function addSource(path: string, source: Source): Promise<void> {
  const file = await readAndValidate(path);

  if (!file.sources) file.sources = [];

  if (file.sources.some((s) => s.id === source.id)) {
    throw new Error(`Source with id "${source.id}" already exists`);
  }

  file.sources.push(source);
  await writeFile(path, stringify(file), "utf-8");
}

export async function removeSource(path: string, id: string): Promise<void> {
  const file = await readAndValidate(path);

  if (!file.sources) {
    throw new Error(`Source with id "${id}" not found`);
  }

  const index = file.sources.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`Source with id "${id}" not found`);
  }

  file.sources.splice(index, 1);
  if (file.sources.length === 0) {
    delete (file as unknown as Record<string, unknown>).sources;
  }

  await writeFile(path, stringify(file), "utf-8");
}

// --- Examples ---

export async function addExample(
  path: string,
  example: Example,
): Promise<void> {
  const file = await readAndValidate(path);

  if (!file.examples) file.examples = [];
  file.examples.push(example);
  await writeFile(path, stringify(file), "utf-8");
}

export async function removeExample(
  path: string,
  index: number,
): Promise<void> {
  const file = await readAndValidate(path);

  if (!file.examples || index < 0 || index >= file.examples.length) {
    throw new Error(`Example at index ${index} not found`);
  }

  file.examples.splice(index, 1);
  if (file.examples.length === 0) {
    delete (file as unknown as Record<string, unknown>).examples;
  }

  await writeFile(path, stringify(file), "utf-8");
}
