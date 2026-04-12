# Design

This document describes the architecture, data model, and key design decisions behind rulespec.

## Problem

Inline prompt editing doesn't scale. When business rules live inside system prompts as unstructured prose:

- Editing one rule risks invalidating others already working.
- Multiple teams editing the same prompt create merge conflicts and silent overwrites.
- There's no way to trace which rule a paragraph corresponds to.
- A/B testing a single rule change means duplicating the entire prompt.
- Auditors can't answer "where is the refund policy enforced in our AI?"

rulespec solves this by treating each business rule as an independent, validated unit — stored as structured YAML, compiled into LLM-ready markdown.

## Architecture

### Pipeline

Every operation flows through the same pipeline:

```
CLI args / API call
       |
       v
 +-----------+     +------------+     +------------+     +-----------+
 | parser.ts | --> | schema.ts  | --> | writer.ts  | --> | YAML file |
 | read YAML |     | validate   |     | mutate     |     | (on disk) |
 +-----------+     +------------+     +------------+     +-----------+
                                                               |
                                                               v
                                      +-------------+    +-----------+
                                      | emitter.ts  | <- | compiler  |
                                      | SKILL.md    |    | rule->txt |
                                      +-------------+    +-----------+
```

1. **Parse** — `parser.ts` reads a YAML file and returns a raw object.
2. **Validate** — `schema.ts` checks the object against the `rulespec/v1` schema. Returns all errors (not fail-fast).
3. **Mutate** — `writer.ts` applies changes (add/edit/remove rule, source, example). Every mutation re-validates before writing.
4. **Compile** — `compiler.ts` transforms each rule into a prompt string, shaped by its `intent` field.
5. **Emit** — `emitter.ts` assembles rules, sources, and optional examples into a SKILL.md with YAML frontmatter.

### Module responsibilities

| Module | Responsibility | Side effects |
|--------|---------------|--------------|
| `schema.ts` | Type definitions, validation logic | None (pure) |
| `parser.ts` | YAML file reading + validation | File read |
| `compiler.ts` | Rule-to-prompt text transformation | None (pure) |
| `emitter.ts` | SKILL.md generation | None (pure) |
| `writer.ts` | All file mutations (add/edit/remove/replace) | File read + write |
| `generate.ts` | Optional AI-assisted prompt compilation | Network (LLM API) |
| `resolve-input.ts` | CLI input polymorphism (JSON string, .json file, any file) | File read |
| `index.ts` | Public API surface + `loadRules()` convenience function | File read |
| `cli.ts` | Command dispatcher, flag parsing, help text | stdout |
| `commands/*.ts` | Thin wrappers: parse flags, call writer, print feedback | Delegates to writer |

## Data model

### Schema (`rulespec/v1`)

```
RulespecFile
├── schema: "rulespec/v1"           # version identifier
├── domain: string                  # business domain (required)
├── model?: "provider/model-name"   # optional, for AI-assisted compilation
├── sources?: Source[]              # what data the rules operate on
├── rules: Rule[]                   # at least one required
└── examples?: Example[]            # global input/output golden standards
```

### Rule

A rule has four fields owned by different stakeholders:

| Field | Type | Owner | Purpose |
|-------|------|-------|---------|
| `id` | kebab-case string | Engineer | Unique, stable identifier |
| `rule` | string | Business person | The rule in plain language |
| `context` | string | Shared | When this rule applies |
| `intent` | `enforce` \| `inform` \| `suggest` | Business person | How strictly to follow it |
| `prompt` | string (auto-generated) | System | Compiled output, regenerated on mutation |
| `examples?` | Example[] | Shared | Rule-specific input/output pairs |

### Intent semantics

Intent is the compilation lever. Same rule data, different prompt weight:

| Intent | Prefix | Meaning |
|--------|--------|---------|
| `enforce` | `**You must follow this rule.**` | Mandatory |
| `inform` | *(none)* | Guidance |
| `suggest` | `Consider the following:` | Recommendation |

### Source

Describes a data input the rules operate on:

```typescript
{
  id: string          // kebab-case
  type: "document" | "api" | "database" | "message" | "structured"
  format?: string     // e.g. "pdf", "json", "csv"
  description: string
  schema?: object     // optional structured schema
}
```

### Example

Input/output golden standard for evaluation:

```typescript
{
  input: object       // input data
  output: object      // expected output
  note?: string       // context
}
```

Examples exist at two levels: global (across all rules) and per-rule (scoped to one rule). They contain real data and are excluded from emitted output by default.

### Validation rules

- IDs must match `/^[a-z0-9][a-z0-9-]*$/` (kebab-case).
- No duplicate rule IDs or source IDs within a file.
- `rules` must be a non-empty array.
- `intent` must be one of the three valid values.
- `source.type` must be from the valid enum.
- Validation accumulates all errors, not fail-fast.

## Compilation

### Default strategy

`compileRule()` is a pure function:

```
### {TitleCase(id)}
{INTENT_PREFIX[intent]}{context}: {rule}.
```

Punctuation is normalized — if the rule already ends with `.`, `!`, or `?`, no period is appended.

### AI-assisted strategy

When `model` is set in the rulespec file and the optional `ai` peer dependency is installed, `compile` can use `generatePrompt()` instead. This sends each rule to an LLM for domain-aware prompt generation. The result is stored in the `prompt` field and can be hand-edited afterward.

The AI path is fully optional — default compilation always works with zero dependencies beyond `yaml`.

## Emission

`emitRulesMd()` generates a SKILL.md with:

1. **YAML frontmatter** — `name` (slugified domain), `description`, `type: rules`, `schema: rulespec/v1`.
2. **Sources table** (if sources exist) — markdown table with id, type, format, description. Source schemas rendered as YAML code blocks.
3. **Rules section** — each rule as `### {Title} [{intent}]` with compiled body.
4. **Examples section** (opt-in via `--include-examples`) — input/output pairs as YAML code blocks.

### File layout

```
project/
├── rulespec.yaml                    # or {domain}.rulespec.yaml
└── skills/
    └── {domain}/
        └── SKILL.md                 # emitted output
```

Multiple rulespec files are supported — `emit` scans for all `*.rulespec.yaml` and generates a SKILL.md for each domain.

## Key design decisions

### Format first, tooling second

The YAML file is the product. The CLI is convenience. The schema is declarative and not coupled to the CLI — the same file works with the programmatic API or any YAML-aware tool.

### One rule, one change

Editing a rule only recompiles that rule's prompt. No cascading rewrites. This means independent teams can add or modify rules without risk of breaking each other's work, and `git blame` traces every change to its author.

### Validate before write

Every mutation in `writer.ts` calls `readAndValidate()` before persisting. The `replace` command goes further — it validates the *result* of the replacement before writing. This prevents corrupt states and provides clear error messages with field paths (e.g., `rules[0].intent: Expected one of: enforce, inform, suggest`).

### Intent shapes output, not data

The `intent` field controls how a rule compiles into a prompt, but the underlying rule text stays the same. This separates *what* (the business rule) from *how strictly* (the prompt engineering). Changing intent from `suggest` to `enforce` is a one-field edit, not a prompt rewrite.

### Schema up, data stays down

The spec (rules + source schemas) is safe to share and commit. Examples contain real data and are excluded from emitted output by default — included only with an explicit `--include-examples` flag.

### Minimal dependencies

One runtime dependency (`yaml`). AI-assisted compilation is an optional peer dependency. This keeps the install fast and the attack surface small.

## Public API

The library exports everything needed to integrate rulespec into any LLM workflow:

```typescript
// Load and compile rules in one call
loadRules(path?, options?): Promise<string>

// Individual pipeline stages
parseRulespecFile(path): Promise<RulespecFile>
validate(data): ValidationResult
compileRule(rule): string
compileRules(file, options?): string
emitRulesMd(file, options?): string
generatePrompt(rule, file): Promise<string>

// Mutations
addRule, editRule, removeRule
addSource, removeSource
addExample, removeExample
addRuleExample, removeRuleExample
setDomain, replaceInFile
```

`loadRules()` is the primary integration point — it reads a rulespec file, compiles all rules, and returns a markdown string ready to inject into a system prompt.

## Testing

Five test suites cover the pipeline:

| Suite | Covers |
|-------|--------|
| `schema.test.ts` | All validation paths: valid/invalid files, duplicates, enums, required fields |
| `parser.test.ts` | File reading, missing file errors, validation error reporting |
| `compiler.test.ts` | Intent prefixes, kebab-to-title conversion, punctuation normalization |
| `emitter.test.ts` | Frontmatter, sources table, intent tags, schema blocks, examples |
| `writer.test.ts` | Add/edit/remove rules, duplicate detection, last-rule protection, examples |

Tests use vitest with fixtures in `/fixtures/` (valid, with-sources, and invalid YAML files). Writer tests create temporary files that are cleaned up after each run.
