/**
 * rulespec — OpenClaw plugin entry.
 *
 * Registers 16 native tools so agents can manage rulespec files without
 * shelling out to the `rulespec` CLI:
 *
 *   Setup:      rulespec_init, rulespec_set_domain
 *   Rules:      rulespec_list, rulespec_add_rule, rulespec_edit_rule, rulespec_remove_rule
 *   Sources:    rulespec_add_source, rulespec_remove_source
 *   Examples:   rulespec_add_example, rulespec_remove_example,
 *               rulespec_add_rule_example, rulespec_remove_rule_example
 *   Build:      rulespec_compile, rulespec_validate, rulespec_emit
 *   Bulk:       rulespec_replace
 *
 * The CLI remains the standalone interface — these tools just expose the
 * same operations as in-process function calls (no subprocess spawn).
 *
 * Only `rulespec_emit` is gated by `before_tool_call` approval, since
 * that's the operation that publishes compiled SKILL.md files agents will
 * subsequently follow. All other writes run silently — they edit
 * `rulespec.yaml` (a developer asset), not the agent-facing SKILL.md.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { knownAgentDirs, resolveAgentDir } from "../agents.js";
import { compileRule, compileRules } from "../compiler.js";
import { emitDirName, emitRulesMd } from "../emitter.js";
import { parseRulespecFile } from "../parser.js";
import { validate as schemaValidate } from "../schema.js";
import type { Example, Intent, Rule, Source, SourceType } from "../schema.js";
import {
  addExample,
  addRule,
  addRuleExample,
  addSource,
  editRule,
  removeExample,
  removeRule,
  removeRuleExample,
  removeSource,
  replaceInFile,
  setDomain,
} from "../writer.js";

// ---- Config & API types ---------------------------------------------------

interface ApprovalConfig {
  enabled?: boolean;
  skipSessionPatterns?: string[];
  timeoutMs?: number;
  timeoutBehavior?: "allow" | "deny";
}

interface PluginConfig {
  approval?: ApprovalConfig;
}

interface BeforeToolCallEvent {
  toolName?: string;
  /** Legacy field name on older OpenClaw releases. */
  tool?: string;
  params?: unknown;
  context?: {
    sessionKey?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

interface PluginApi {
  registerTool: (def: ToolDef, opts?: { optional?: boolean }) => void;
  registerHook?: (
    events: string | string[],
    handler: (event: BeforeToolCallEvent) =>
      | { requireApproval?: object; block?: boolean; blockReason?: string }
      | void,
    opts: { name: string; description?: string; priority?: number },
  ) => void;
  config?: {
    plugins?: { entries?: Record<string, { config?: PluginConfig }> };
    [k: string]: unknown;
  };
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// ---- Helpers --------------------------------------------------------------

const DEFAULT_PATH = "rulespec.yaml";

function pathOf(params: Record<string, unknown>): string {
  const v = params.path;
  return typeof v === "string" && v.trim() ? v.trim() : DEFAULT_PATH;
}

function slugify(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initTemplate(domain: string): string {
  return `schema: rulespec/v1
domain: "${domain}"

rules:
  - id: example-rule
    rule: "Replace this with your first business rule"
    context: "When this rule should apply"
    intent: inform
    prompt: "### Example Rule\\nWhen this rule should apply: Replace this with your first business rule."
`;
}

async function scanSkillsDir(baseDir: string, found: Set<string>): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return;
  }
  for (const d of entries) {
    const sub = join(baseDir, d);
    try {
      if (!(await stat(sub)).isDirectory()) continue;
    } catch {
      continue;
    }
    const p = join(sub, "rulespec.yaml");
    if (existsSync(p)) found.add(p);
  }
}

async function findAllRulespecFiles(): Promise<string[]> {
  const found = new Set<string>();
  const { project, global } = knownAgentDirs();
  await scanSkillsDir("skills", found);
  for (const dir of project) await scanSkillsDir(dir, found);
  for (const dir of global) await scanSkillsDir(dir, found);
  try {
    for (const f of await readdir(".")) {
      if (f.endsWith(".rulespec.yaml")) found.add(f);
    }
  } catch {
    // cwd unreadable — nothing to add.
  }
  return [...found];
}

// ---- Plugin entry ---------------------------------------------------------

function register(api: PluginApi): void {
  const pluginCfg: PluginConfig = api.config?.plugins?.entries?.["rulespec"]?.config ?? {};
  const approvalCfg: ApprovalConfig = pluginCfg.approval ?? {};
  const approvalEnabled = approvalCfg.enabled !== false;
  const skipPatterns = Array.isArray(approvalCfg.skipSessionPatterns)
    ? approvalCfg.skipSessionPatterns.filter(
        (p): p is string => typeof p === "string" && p.length > 0,
      )
    : [];
  const approvalTimeoutMs =
    typeof approvalCfg.timeoutMs === "number" && approvalCfg.timeoutMs > 0
      ? approvalCfg.timeoutMs
      : 5 * 60_000;
  const approvalTimeoutBehavior: "allow" | "deny" =
    approvalCfg.timeoutBehavior === "allow" ? "allow" : "deny";

  // Approval gate — only on emit (publishes SKILL.md agents will follow).
  if (api.registerHook && approvalEnabled) {
    api.registerHook(
      "before_tool_call",
      (event) => {
        const toolName = event.toolName ?? event.tool;
        if (toolName !== "rulespec_emit") return;
        const sessionKey = event.context?.sessionKey ?? "";
        if (skipPatterns.some((pattern) => sessionKey.includes(pattern))) {
          return;
        }
        return {
          requireApproval: {
            title: "Emit rulespec to SKILL.md?",
            description: "`rulespec_emit` writes compiled SKILL.md files that any installed agent will subsequently follow.",
            severity: "warning",
            timeoutMs: approvalTimeoutMs,
            timeoutBehavior: approvalTimeoutBehavior,
          },
        };
      },
      {
        name: "rulespec-emit-approval",
        description: "Request user approval before publishing compiled rulespec SKILL.md files.",
      },
    );
  } else if (!api.registerHook) {
    api.logger?.warn(
      "rulespec: registerHook unavailable — rulespec_emit will run without approval. Update OpenClaw to enable.",
    );
  }

  // ---- Setup ------------------------------------------------------------

  api.registerTool({
    name: "rulespec_init",
    description:
      "Create a new rulespec.yaml. Defaults to skills/<slug>/rulespec.yaml; pass `agent` to target a specific agent's skills dir (claude-code, cursor, openclaw, codex, opencode), or `global: true` (with `agent`) to use the agent's global skills dir.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["domain"],
      properties: {
        domain: { type: "string", description: "Domain name, e.g. 'invoice processing'." },
        agent: {
          type: "string",
          enum: ["claude-code", "cursor", "openclaw", "codex", "opencode"],
          description: "Optional agent target. Determines the skills directory layout.",
        },
        global: { type: "boolean", description: "Place under the agent's global skills dir. Requires `agent`." },
        file: { type: "string", description: "Override the destination path (advanced)." },
      },
    },
    execute: async (params) => {
      const domain = (params.domain as string).trim();
      if (!domain) throw new Error("`domain` is required");
      const agent = typeof params.agent === "string" ? params.agent : undefined;
      const global = params.global === true;
      if (global && !agent) throw new Error("`global: true` requires `agent`");

      const slug = slugify(domain);
      let baseDir: string;
      if (agent) {
        baseDir = resolveAgentDir(agent, global);
      } else {
        baseDir = "skills";
      }

      const skillDir = join(baseDir, slug);
      const target = typeof params.file === "string" && params.file
        ? params.file
        : join(skillDir, "rulespec.yaml");

      if (existsSync(target)) {
        throw new Error(`${target} already exists`);
      }
      if (!params.file) {
        await mkdir(skillDir, { recursive: true });
      }
      await writeFile(target, initTemplate(domain), "utf-8");
      return { path: target };
    },
  });

  api.registerTool({
    name: "rulespec_set_domain",
    description: "Change the domain of an existing rulespec.yaml.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["domain"],
      properties: {
        path: { type: "string" },
        domain: { type: "string" },
      },
    },
    execute: async (params) => {
      const domain = (params.domain as string).trim();
      if (!domain) throw new Error("`domain` is required");
      await setDomain(pathOf(params), domain);
      return { ok: true };
    },
  });

  // ---- Rules ------------------------------------------------------------

  api.registerTool({
    name: "rulespec_list",
    description: "Read a rulespec.yaml and return its domain, rules, sources, and examples.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { path: { type: "string" } },
    },
    execute: async (params) => {
      const file = await parseRulespecFile(pathOf(params));
      return {
        domain: file.domain,
        rules: file.rules.map((r) => ({
          id: r.id,
          rule: r.rule,
          context: r.context,
          intent: r.intent,
          examples: r.examples ?? [],
        })),
        sources: file.sources ?? [],
        examples: file.examples ?? [],
      };
    },
  });

  api.registerTool({
    name: "rulespec_add_rule",
    description: "Append a new rule. The rule's `prompt` field is auto-compiled from `rule` + `context` + `intent`.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "rule", "context", "intent"],
      properties: {
        path: { type: "string" },
        id: { type: "string", description: "Stable identifier (kebab-case)." },
        rule: { type: "string", description: "The rule text." },
        context: { type: "string", description: "When this rule applies." },
        intent: { type: "string", enum: ["enforce", "inform", "suggest"] },
      },
    },
    execute: async (params) => {
      const rule: Rule = {
        id: (params.id as string).trim(),
        rule: (params.rule as string).trim(),
        context: (params.context as string).trim(),
        intent: params.intent as Intent,
        prompt: "", // populated by addRule
      };
      // addRule compiles the prompt internally.
      await addRule(pathOf(params), { ...rule, prompt: compileRule(rule) });
      return { ok: true };
    },
  });

  api.registerTool({
    name: "rulespec_edit_rule",
    description: "Update one or more fields of an existing rule. Recompiles `prompt`.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        path: { type: "string" },
        id: { type: "string" },
        rule: { type: "string" },
        context: { type: "string" },
        intent: { type: "string", enum: ["enforce", "inform", "suggest"] },
      },
    },
    execute: async (params) => {
      const updates: Partial<Pick<Rule, "rule" | "context" | "intent">> = {};
      if (typeof params.rule === "string") updates.rule = params.rule;
      if (typeof params.context === "string") updates.context = params.context;
      if (typeof params.intent === "string") updates.intent = params.intent as Intent;
      await editRule(pathOf(params), params.id as string, updates);
      return { ok: true };
    },
  });

  api.registerTool({
    name: "rulespec_remove_rule",
    description: "Remove a rule by id. Fails if it would leave zero rules.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        path: { type: "string" },
        id: { type: "string" },
      },
    },
    execute: async (params) => {
      await removeRule(pathOf(params), params.id as string);
      return { ok: true };
    },
  });

  // ---- Sources ----------------------------------------------------------

  api.registerTool({
    name: "rulespec_add_source",
    description: "Add an input data source (document / api / database / message / structured).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "type", "description"],
      properties: {
        path: { type: "string" },
        id: { type: "string" },
        type: {
          type: "string",
          enum: ["document", "api", "database", "message", "structured"],
        },
        description: { type: "string" },
        format: { type: "string", description: "Optional format hint (pdf, json, csv, …)." },
      },
    },
    execute: async (params) => {
      const source: Source = {
        id: params.id as string,
        type: params.type as SourceType,
        description: params.description as string,
      };
      if (typeof params.format === "string") source.format = params.format;
      await addSource(pathOf(params), source);
      return { ok: true };
    },
  });

  api.registerTool({
    name: "rulespec_remove_source",
    description: "Remove a source by id.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        path: { type: "string" },
        id: { type: "string" },
      },
    },
    execute: async (params) => {
      await removeSource(pathOf(params), params.id as string);
      return { ok: true };
    },
  });

  // ---- Examples ---------------------------------------------------------

  api.registerTool({
    name: "rulespec_add_example",
    description: "Append a global end-to-end input/output example.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["input", "output"],
      properties: {
        path: { type: "string" },
        input: { type: "object", description: "JSON object describing the input." },
        output: { type: "object", description: "JSON object describing the expected output." },
        note: { type: "string" },
      },
    },
    execute: async (params) => {
      const example: Example = {
        input: params.input as Record<string, unknown>,
        output: params.output as Record<string, unknown>,
      };
      if (typeof params.note === "string") example.note = params.note;
      await addExample(pathOf(params), example);
      return { ok: true };
    },
  });

  api.registerTool({
    name: "rulespec_remove_example",
    description: "Remove a global example by zero-based index.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["index"],
      properties: {
        path: { type: "string" },
        index: { type: "integer", minimum: 0 },
      },
    },
    execute: async (params) => {
      await removeExample(pathOf(params), params.index as number);
      return { ok: true };
    },
  });

  api.registerTool({
    name: "rulespec_add_rule_example",
    description: "Append a per-rule input/output example.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["rule_id", "input", "output"],
      properties: {
        path: { type: "string" },
        rule_id: { type: "string" },
        input: { type: "object" },
        output: { type: "object" },
        note: { type: "string" },
      },
    },
    execute: async (params) => {
      const example: Example = {
        input: params.input as Record<string, unknown>,
        output: params.output as Record<string, unknown>,
      };
      if (typeof params.note === "string") example.note = params.note;
      await addRuleExample(pathOf(params), params.rule_id as string, example);
      return { ok: true };
    },
  });

  api.registerTool({
    name: "rulespec_remove_rule_example",
    description: "Remove a per-rule example by zero-based index.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["rule_id", "index"],
      properties: {
        path: { type: "string" },
        rule_id: { type: "string" },
        index: { type: "integer", minimum: 0 },
      },
    },
    execute: async (params) => {
      await removeRuleExample(
        pathOf(params),
        params.rule_id as string,
        params.index as number,
      );
      return { ok: true };
    },
  });

  // ---- Build pipeline ---------------------------------------------------

  api.registerTool({
    name: "rulespec_compile",
    description: "Compile one rule (when `rule_id` given) or all rules and return the markdown prompt(s). Does not write to disk.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        rule_id: { type: "string", description: "Compile a single rule by id (else: all)." },
      },
    },
    execute: async (params) => {
      const file = await parseRulespecFile(pathOf(params));
      if (typeof params.rule_id === "string") {
        const rule = file.rules.find((r) => r.id === params.rule_id);
        if (!rule) throw new Error(`Rule with id "${params.rule_id}" not found`);
        return { compiled: compileRule(rule) };
      }
      return { compiled: compileRules(file) };
    },
  });

  api.registerTool({
    name: "rulespec_validate",
    description: "Validate a rulespec.yaml against the schema. Returns `{ valid: true }` on success or `{ valid: false, errors: [...] }` on failure.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { path: { type: "string" } },
    },
    execute: async (params) => {
      try {
        await parseRulespecFile(pathOf(params));
        return { valid: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, errors: [message] };
      }
    },
  });

  api.registerTool({
    name: "rulespec_emit",
    description: "Compile a rulespec.yaml and write the resulting SKILL.md alongside it (or to an override directory). When neither `path` nor `outdir` is given, every discovered rulespec.yaml under known skills directories is emitted.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string", description: "rulespec.yaml to emit. Default: scan all known skills dirs." },
        include_examples: { type: "boolean", description: "Include examples in the emitted SKILL.md. Default: false." },
        outdir: { type: "string", description: "Override base output directory (mutually exclusive with `agent`)." },
        agent: {
          type: "string",
          enum: ["claude-code", "cursor", "openclaw", "codex", "opencode"],
          description: "Emit into this agent's skills directory layout.",
        },
        global: { type: "boolean", description: "Use the agent's global skills directory (requires `agent`)." },
      },
    },
    execute: async (params) => {
      if (params.outdir && params.agent) {
        throw new Error("`outdir` and `agent` are mutually exclusive");
      }
      let overrideBase: string | undefined;
      if (typeof params.agent === "string") {
        overrideBase = resolveAgentDir(params.agent, params.global === true);
      }
      if (typeof params.outdir === "string") {
        overrideBase = params.outdir;
      }

      const sources = typeof params.path === "string" && params.path
        ? [params.path]
        : await findAllRulespecFiles();
      if (sources.length === 0) {
        throw new Error("No rulespec files found. Run `rulespec_init` first.");
      }

      const includeExamples = params.include_examples === true;
      const emitted: string[] = [];
      for (const f of sources) {
        const specFile = await parseRulespecFile(f);
        const md = emitRulesMd(specFile, { includeExamples });
        const targetDir = overrideBase
          ? resolve(overrideBase, emitDirName(specFile))
          : dirname(f);
        await mkdir(targetDir, { recursive: true });
        const targetPath = resolve(targetDir, "SKILL.md");
        await writeFile(targetPath, md, "utf-8");
        emitted.push(targetPath);
      }
      return { paths: emitted };
    },
  });

  // ---- Bulk -------------------------------------------------------------

  api.registerTool({
    name: "rulespec_replace",
    description: "Find-and-replace one occurrence of `old` with `new` in a rulespec.yaml. Validates the result and recompiles all rule prompts.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["old", "new"],
      properties: {
        path: { type: "string" },
        old: { type: "string", description: "Exact substring to replace (first occurrence only)." },
        new: { type: "string", description: "Replacement string." },
      },
    },
    execute: async (params) => {
      await replaceInFile(pathOf(params), params.old as string, params.new as string);
      return { ok: true };
    },
  });

  api.logger?.info(
    `rulespec plugin loaded — 16 tools registered${
      approvalEnabled ? "" : " (approval disabled)"
    }`,
  );
}

export default {
  id: "rulespec",
  register,
};
