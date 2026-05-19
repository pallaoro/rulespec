---
name: rulespec
description: >
  Define, manage, and compile business rules as structured YAML data into LLM-ready prompts and agent-loadable SKILL.md files.
  Use when the user wants to create business rules, define policies, set guardrails, enforce constraints, add compliance rules,
  manage refund policies, escalation rules, approval thresholds, SLA requirements, content moderation rules, or any operational
  policy an AI agent should follow. Also use when the user says "add a rule", "create a policy", "set a constraint",
  "define guardrails", or asks about rulespec, rulespec.yaml, or business rule management.
---

# rulespec — OpenClaw plugin

**Manage business rules for AI agents without breaking what already works.**

Adding a rule to a system prompt shouldn't risk invalidating the ones that are already there. Inline prompt editing doesn't scale — and other solutions aren't built for business rules.

rulespec treats each rule as an independent, validated unit. Add, edit, or remove one rule at a time — the rest stay untouched. The output is a structured `SKILL.md` that any AI agent can load.

## Use the native tools

This plugin registers **16 native OpenClaw tools** — call them directly instead of shelling out to the CLI. They run in-process (no subprocess), accept structured params, and surface real return values.

### Setup
| Tool | Inputs | What it does |
|------|--------|--------------|
| `rulespec_init` | `{ domain, agent?, global?, file? }` | Scaffold a new `rulespec.yaml`. Defaults to `skills/<slug>/rulespec.yaml`. Pass `agent` for a specific agent's skills dir (`claude-code`, `cursor`, `openclaw`, `codex`, `opencode`), or `global: true` (with `agent`) to use the agent's *global* skills dir. |
| `rulespec_set_domain` | `{ domain, path? }` | Change the domain of an existing `rulespec.yaml`. |

### Rules
| Tool | Inputs | What it does |
|------|--------|--------------|
| `rulespec_list` | `{ path? }` | Read a `rulespec.yaml` and return its domain, rules, sources, examples. |
| `rulespec_add_rule` | `{ id, rule, context, intent, path? }` — `intent` is `"enforce" \| "inform" \| "suggest"` | Append a new rule. `prompt` is auto-compiled from `rule` + `context` + `intent`. |
| `rulespec_edit_rule` | `{ id, rule?, context?, intent?, path? }` | Update one or more fields. Recompiles `prompt`. |
| `rulespec_remove_rule` | `{ id, path? }` | Remove a rule. Fails if it would leave zero rules. |

### Sources
| Tool | Inputs | What it does |
|------|--------|--------------|
| `rulespec_add_source` | `{ id, type, description, format?, path? }` — `type` is `"document" \| "api" \| "database" \| "message" \| "structured"` | Add an input data source. |
| `rulespec_remove_source` | `{ id, path? }` | Remove a source by id. |

### Examples
| Tool | Inputs | What it does |
|------|--------|--------------|
| `rulespec_add_example` | `{ input, output, note?, path? }` | Append a global end-to-end input/output example. `input` and `output` are JSON objects. |
| `rulespec_remove_example` | `{ index, path? }` | Remove a global example by zero-based index. |
| `rulespec_add_rule_example` | `{ rule_id, input, output, note?, path? }` | Append a per-rule example. |
| `rulespec_remove_rule_example` | `{ rule_id, index, path? }` | Remove a per-rule example by index. |

### Build pipeline
| Tool | Inputs | What it does |
|------|--------|--------------|
| `rulespec_compile` | `{ rule_id?, path? }` | Compile one rule (when `rule_id` given) or all rules. Returns the compiled markdown. Does not write to disk. |
| `rulespec_validate` | `{ path? }` | Validate a `rulespec.yaml` against the schema. Returns `{ valid: true }` or `{ valid: false, errors }`. |
| `rulespec_emit` | `{ path?, include_examples?, agent?, global?, outdir? }` | Compile and write `SKILL.md` alongside the source (or to an override directory). Without `path`, every discovered `rulespec.yaml` is emitted. **Approval-gated** — see "Emit approval" below. |

### Bulk
| Tool | Inputs | What it does |
|------|--------|--------------|
| `rulespec_replace` | `{ old, new, path? }` | Find-and-replace first occurrence. Validates the result and recompiles all rule prompts. |

## Workflow

```
rulespec_init        { domain: "invoice processing" }
  → creates skills/invoice-processing/rulespec.yaml
rulespec_add_source  { id: "invoice-pdf", type: "document", format: "pdf", description: "..." }
rulespec_add_rule    { id: "approve-under-50", rule: "...", context: "...", intent: "enforce" }
rulespec_add_rule    { id: "..." , rule: "...", context: "...", intent: "inform" }
rulespec_validate    {}
  → { valid: true }
rulespec_compile     {}
  → { compiled: "..." }   (preview, no write)
rulespec_emit        {}
  → writes skills/invoice-processing/SKILL.md
```

Once the source file exists, every subsequent tool auto-discovers it under `skills/*/rulespec.yaml`. Override with `path` when you need to.

## Layout

Each domain lives in its own skill folder. By default it lands under `skills/`; with `agent: "<id>"` it lands in that agent's skills directory instead:

```
skills/                       ← default (no agent flag)
  invoice-processing/
    rulespec.yaml             ← authored source — editable via tools
    SKILL.md                  ← emitted, agent-loadable (do not edit)

.claude/skills/               ← rulespec_init { agent: "claude-code" }
  customer-support/
    rulespec.yaml
    SKILL.md
```

Supported `agent` values: `claude-code`, `cursor`, `openclaw`, `codex`, `opencode`.

## File format

```yaml
schema: rulespec/v1
domain: "your domain here"

sources:                              # optional — what data the rules operate on
  - id: source-name
    type: document | api | database | message | structured
    format: pdf | json | csv          # optional
    description: "What this source is"
    schema:                           # optional — shape of the data
      field: type

rules:
  - id: rule-id                       # kebab-case, unique
    rule: "The business rule in plain language"
    context: "When this rule applies"
    intent: enforce | inform | suggest

examples:                             # optional — end-to-end golden standards
  - note: "What this example tests"
    input: { ... }
    output: { ... }
```

### Intent levels

- `enforce` — mandatory. Agent must follow this rule. Compiles to directive language.
- `inform` — guidance. Agent should be aware. Compiles to neutral language.
- `suggest` — recommendation. Agent may consider. Compiles to soft language.

## Emit approval

`rulespec_emit` is the only tool gated by an approval prompt — it's the operation that publishes a compiled `SKILL.md` that other agents will subsequently follow. Every other tool (including all writes to `rulespec.yaml`) runs silently.

Hosts that run unattended automation can bypass the emit approval for specific session contexts via the plugin config:

```jsonc
"plugins": {
  "entries": {
    "rulespec": {
      "config": {
        "approval": {
          "enabled": true,
          "skipSessionPatterns": ["email"]
        }
      }
    }
  }
}
```

Match against `ctx.sessionKey` substrings — e.g. `"email"` to auto-allow emits in inbound-email hook sessions.

## Programmatic library access

If you need rulespec from non-tool contexts (e.g. inside a flow or a script):

```typescript
import { loadRules } from "rulespec";
const rules = await loadRules("skills/my-domain/rulespec.yaml");
// rules is a compiled markdown string — inject into any system prompt or API call
```

## Key principles

- Prefer the **native tools** — they're in-process, structured, and the canonical interface in OpenClaw environments.
- Use `rulespec_replace` for safe find-and-replace: validates and recompiles after every change.
- One rule, one change — editing a rule only affects that rule's compiled output.
- Examples are excluded from the emitted `SKILL.md` by default (they may contain sensitive data).
- The `rulespec` CLI (`npx rulespec …`) remains available for non-OpenClaw contexts. Inside OpenClaw, always prefer the native tools.

Built by the team behind [Clawnify](https://www.clawnify.com).
