export type Intent = "enforce" | "inform" | "suggest";

export type SourceType =
  | "document"
  | "api"
  | "database"
  | "message"
  | "structured";

export interface Source {
  id: string;
  type: SourceType;
  format?: string;
  description: string;
  schema?: Record<string, unknown>;
}

export interface Example {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  note?: string;
}

export interface Rule {
  id: string;
  rule: string;
  context: string;
  intent: Intent;
  prompt: string;
  examples?: Example[];
}

export interface RulespecFile {
  schema: string;
  domain: string;
  model?: string;
  sources?: Source[];
  rules: Rule[];
  examples?: Example[];
}

export interface ValidationError {
  path: string;
  message: string;
}

type ValidationResult =
  | { ok: true; value: RulespecFile }
  | { ok: false; errors: ValidationError[] };

const VALID_INTENTS: Intent[] = ["enforce", "inform", "suggest"];
const VALID_SOURCE_TYPES: SourceType[] = [
  "document",
  "api",
  "database",
  "message",
  "structured",
];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function validate(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, errors: [{ path: "", message: "Expected an object" }] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.schema !== "rulespec/v1") {
    errors.push({
      path: "schema",
      message: `Expected "rulespec/v1", got ${JSON.stringify(obj.schema)}`,
    });
  }

  if (typeof obj.domain !== "string" || obj.domain.trim() === "") {
    errors.push({ path: "domain", message: "Expected a non-empty string" });
  }

  if (obj.model !== undefined) {
    if (typeof obj.model !== "string" || !obj.model.includes("/")) {
      errors.push({
        path: "model",
        message: `Expected format "provider/model-name" (e.g. "openai/gpt-4o"). Got ${JSON.stringify(obj.model)}`,
      });
    }
  }

  if (obj.sources !== undefined) {
    if (!Array.isArray(obj.sources)) {
      errors.push({ path: "sources", message: "Expected an array" });
    } else {
      const seenSourceIds = new Set<string>();
      for (let i = 0; i < obj.sources.length; i++) {
        const s = obj.sources[i] as Record<string, unknown>;
        const prefix = `sources[${i}]`;

        if (typeof s !== "object" || s === null || Array.isArray(s)) {
          errors.push({ path: prefix, message: "Expected an object" });
          continue;
        }

        if (typeof s.id !== "string" || s.id.trim() === "") {
          errors.push({
            path: `${prefix}.id`,
            message: "Expected a non-empty string",
          });
        } else if (!ID_PATTERN.test(s.id)) {
          errors.push({
            path: `${prefix}.id`,
            message: `Must be kebab-case. Got "${s.id}"`,
          });
        } else if (seenSourceIds.has(s.id)) {
          errors.push({
            path: `${prefix}.id`,
            message: `Duplicate source id "${s.id}"`,
          });
        } else {
          seenSourceIds.add(s.id);
        }

        if (!VALID_SOURCE_TYPES.includes(s.type as SourceType)) {
          errors.push({
            path: `${prefix}.type`,
            message: `Expected one of: ${VALID_SOURCE_TYPES.join(", ")}. Got ${JSON.stringify(s.type)}`,
          });
        }

        if (typeof s.description !== "string" || s.description.trim() === "") {
          errors.push({
            path: `${prefix}.description`,
            message: "Expected a non-empty string",
          });
        }

        if (s.format !== undefined && typeof s.format !== "string") {
          errors.push({
            path: `${prefix}.format`,
            message: "Expected a string",
          });
        }

        if (
          s.schema !== undefined &&
          (typeof s.schema !== "object" || s.schema === null || Array.isArray(s.schema))
        ) {
          errors.push({
            path: `${prefix}.schema`,
            message: "Expected an object",
          });
        }
      }
    }
  }

  if (obj.examples !== undefined) {
    if (!Array.isArray(obj.examples)) {
      errors.push({ path: "examples", message: "Expected an array" });
    } else {
      for (let i = 0; i < obj.examples.length; i++) {
        const e = obj.examples[i] as Record<string, unknown>;
        const prefix = `examples[${i}]`;

        if (typeof e !== "object" || e === null || Array.isArray(e)) {
          errors.push({ path: prefix, message: "Expected an object" });
          continue;
        }

        if (
          typeof e.input !== "object" ||
          e.input === null ||
          Array.isArray(e.input)
        ) {
          errors.push({
            path: `${prefix}.input`,
            message: "Expected an object",
          });
        }

        if (
          typeof e.output !== "object" ||
          e.output === null ||
          Array.isArray(e.output)
        ) {
          errors.push({
            path: `${prefix}.output`,
            message: "Expected an object",
          });
        }

        if (e.note !== undefined && typeof e.note !== "string") {
          errors.push({
            path: `${prefix}.note`,
            message: "Expected a string",
          });
        }
      }
    }
  }

  if (!Array.isArray(obj.rules)) {
    errors.push({ path: "rules", message: "Expected an array" });
    return { ok: false, errors };
  }

  if (obj.rules.length === 0) {
    errors.push({ path: "rules", message: "Must contain at least one rule" });
    return { ok: false, errors };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < obj.rules.length; i++) {
    const r = obj.rules[i] as Record<string, unknown>;
    const prefix = `rules[${i}]`;

    if (typeof r !== "object" || r === null || Array.isArray(r)) {
      errors.push({ path: prefix, message: "Expected an object" });
      continue;
    }

    if (typeof r.id !== "string" || r.id.trim() === "") {
      errors.push({ path: `${prefix}.id`, message: "Expected a non-empty string" });
    } else if (!ID_PATTERN.test(r.id)) {
      errors.push({
        path: `${prefix}.id`,
        message: `Must be kebab-case (lowercase letters, numbers, hyphens). Got "${r.id}"`,
      });
    } else if (seenIds.has(r.id)) {
      errors.push({ path: `${prefix}.id`, message: `Duplicate id "${r.id}"` });
    } else {
      seenIds.add(r.id);
    }

    if (typeof r.rule !== "string" || r.rule.trim() === "") {
      errors.push({ path: `${prefix}.rule`, message: "Expected a non-empty string" });
    }

    if (typeof r.context !== "string" || r.context.trim() === "") {
      errors.push({ path: `${prefix}.context`, message: "Expected a non-empty string" });
    }

    if (!VALID_INTENTS.includes(r.intent as Intent)) {
      errors.push({
        path: `${prefix}.intent`,
        message: `Expected one of: ${VALID_INTENTS.join(", ")}. Got ${JSON.stringify(r.intent)}`,
      });
    }

    if (r.prompt !== undefined && typeof r.prompt !== "string") {
      errors.push({ path: `${prefix}.prompt`, message: "Expected a string" });
    }

    if (r.examples !== undefined) {
      if (!Array.isArray(r.examples)) {
        errors.push({
          path: `${prefix}.examples`,
          message: "Expected an array",
        });
      } else {
        for (let j = 0; j < r.examples.length; j++) {
          const ex = r.examples[j] as Record<string, unknown>;
          const ep = `${prefix}.examples[${j}]`;

          if (typeof ex !== "object" || ex === null || Array.isArray(ex)) {
            errors.push({ path: ep, message: "Expected an object" });
            continue;
          }

          if (
            typeof ex.input !== "object" ||
            ex.input === null ||
            Array.isArray(ex.input)
          ) {
            errors.push({
              path: `${ep}.input`,
              message: "Expected an object",
            });
          }

          if (
            typeof ex.output !== "object" ||
            ex.output === null ||
            Array.isArray(ex.output)
          ) {
            errors.push({
              path: `${ep}.output`,
              message: "Expected an object",
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: data as unknown as RulespecFile };
}
