# rulespec

Business rules as structured data. Compiles into LLM-ready prompts and agent-loadable SKILL.md files.

[![npm](https://img.shields.io/npm/v/rulespec)](https://www.npmjs.com/package/rulespec)
[![license](https://img.shields.io/npm/l/rulespec)](LICENSE)

*Business rules change constantly. Prompts shouldn't be hand-edited every time a policy updates. rulespec is a standard format for expressing business rules as structured data, and a compiler that turns them into LLM-ready prompts — or SKILL.md files that AI agents load directly. You change the rule, recompile, and only that prompt changes. Everything else stays untouched.*

## Quick start

```bash
npx rulespec init --domain "customer support"

npx rulespec add --id refund-policy \
  --rule "Refunds allowed within 30 days for unused items" \
  --context "Customer asks about returns" \
  --intent enforce

npx rulespec add --id escalation \
  --rule "Escalate to human after 2 failed attempts" \
  --context "Automated support cannot resolve" \
  --intent enforce

npx rulespec emit
# → skills/customer-support/SKILL.md
```

No global install needed — `npx` downloads and runs it automatically.

## Install as an agent skill

```bash
npx skills add pallaoro/rulespec
```

This installs the rulespec skill into your agent (Claude Code, Cursor, Codex, OpenClaw, etc.) so it knows how to use the CLI when you ask it to create or manage business rules.

## How it works

A rulespec file is deliberately simple. Business rules are data, not prose buried in a system prompt:

```yaml
# rulespec.yaml
schema: rulespec/v1
domain: "invoice processing"

sources:
  - id: invoice
    type: document
    format: pdf
    description: "Incoming vendor invoice"
    schema:
      number: string
      vendor: string
      amount: number
      currency: string

  - id: erp-api
    type: api
    format: json
    description: "ERP vendor lookup"

rules:
  - id: duplicate-check
    rule: "Reject invoices with duplicate invoice numbers"
    context: "Before processing any invoice"
    intent: enforce

  - id: approval-threshold
    rule: "Invoices over $5000 require manager approval"
    context: "After extraction, before posting"
    intent: enforce

  - id: greeting
    rule: "Address the submitter by first name in confirmation messages"
    context: "After processing decision"
    intent: inform

examples:
  - description: "Foreign currency invoice requiring approval"
    input:
      invoice: { number: "INV-1001", vendor: "Acme GmbH", amount: 7200, currency: "EUR" }
    output:
      action: "require-approval"
      approver: "finance-mgr"

  - description: "Duplicate invoice rejection"
    input:
      invoice: { number: "INV-0999", vendor: "Local Supply" }
      existing_invoices: ["INV-0999"]
    output:
      action: "reject"
      reason: "duplicate"
```

### Fields

**Rules** have four fields:

| Field | Owner | Purpose |
|-------|-------|---------|
| `id` | Engineer | Unique identifier (kebab-case) |
| `rule` | Business person | The business rule in plain language |
| `context` | Shared | When this rule applies |
| `intent` | Business person | `enforce`, `inform`, or `suggest` |

**Intent** shapes the compiled output:
- `enforce` — mandatory. Compiles to `**You must follow this rule.**`
- `inform` — guidance. Neutral language.
- `suggest` — recommendation. Compiles to `Consider the following:`

**Sources** (optional) describe what data the rules operate on — type, format, schema.

**Examples** (optional) are input/output golden standards for evaluation. They exist at two levels:
- **Global examples** — end-to-end test cases across all rules
- **Per-rule examples** — scoped to a single rule

## CLI commands

### Setup
```bash
rulespec init --domain "invoice processing"
rulespec set-domain "customer support"
```

### Rules
```bash
rulespec add --id <id> --rule <text> --context <text> --intent <enforce|inform|suggest>
rulespec edit <id> [--rule <text>] [--context <text>] [--intent <type>]
rulespec remove <id>
rulespec list
```

### Sources
```bash
rulespec add-source --id <id> --type <document|api|database|message|structured> --description <text> [--format <fmt>]
rulespec remove-source <id>
```

### Examples
```bash
# Global examples
rulespec add-example --input '{"amount": 100}' --output '{"action": "approve"}' --description "Small amount"
rulespec add-example --input /path/to/input.json --output /path/to/expected.json
rulespec add-example --input /path/to/invoice.pdf --output '{"vendor": "Acme", "total": 500}'
rulespec remove-example <index>

# Rule-specific examples
rulespec add-rule-example <rule-id> --input '{"days": 5}' --output '{"refund": true}'
rulespec add-rule-example <rule-id> --input /path/to/document.pdf --output '{"extracted": "data"}'
rulespec remove-rule-example <rule-id> <index>
```

Input/output accepts three formats:
- **Inline JSON** — `'{"key": "val"}'`
- **JSON file** — `/path/to/data.json` (read and parsed)
- **Any file** — `/path/to/doc.pdf` (stored as `{ file: "/path/to/doc.pdf" }`)

### Find & replace
```bash
rulespec replace --old "30 days" --new "60 days"
```
Safe find-and-replace: validates the result and recompiles all prompts automatically.

### Build & emit
```bash
rulespec compile [id]                  # Preview compiled prompts
rulespec validate                      # Check file against schema
rulespec emit                          # Generate skills/{domain}/SKILL.md
rulespec emit --include-examples true  # Include examples in output
rulespec emit --outdir <path>          # Custom output directory (default: skills)
```

All commands accept `--file <path>` (default: `rulespec.yaml`).

## Output

`rulespec emit` generates a SKILL.md in the skills directory:

```
skills/
  invoice-processing/
    SKILL.md
  customer-support/
    SKILL.md
```

The emitted SKILL.md uses YAML frontmatter for agent discovery and intent tags (`[enforce]`, `[inform]`, `[suggest]`) that tell the agent how strictly to follow each rule:

```markdown
---
name: invoice-processing
description: Business rules for invoice processing. 3 rules: Duplicate Check, Approval Threshold, Greeting.
type: rules
schema: rulespec/v1
---

> **Do not edit this file directly.** It is generated by `rulespec emit` from `rulespec.yaml`.
> To change rules, use the `rulespec` CLI and re-emit.

## Rules

### Duplicate Check [enforce]
**You must follow this rule.** Before processing any invoice: Reject invoices with duplicate invoice numbers.

### Approval Threshold [enforce]
**You must follow this rule.** After extraction, before posting: Invoices over $5000 require manager approval.

### Greeting [inform]
After processing decision: Address the submitter by first name in confirmation messages.
```

## Design choices

- **Format first, tooling second.** The YAML file is the product. The CLI is convenience.
- **One rule, one change.** Editing a rule only affects that rule's compiled prompt. No cascading rewrites.
- **Intent shapes output.** Same rule, different prompt weight — controlled by one field.
- **Business people own rules, engineers own strategy.** Rules are plain language. Compilation is where prompt engineering lives.
- **Sources describe, examples prove.** Together they form a complete, evaluable specification.
- **Schema up, data stays down.** The spec (rules + source schemas) is safe to share. Examples contain real data and are excluded from output by default.

## Why not just edit prompts directly?

You can. It works until:

- A policy changes and you update 3 of 7 places it appears
- Two teams edit the same system prompt and one overwrites the other
- You can't tell which rule a paragraph of prompt corresponds to
- You want to A/B test one rule change without risking the rest
- An auditor asks "where is the refund policy enforced in our AI?"

rulespec makes rules traceable, diffable, and independently versionable. `git blame` shows who changed a rule and when. Examples prove the rules work.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js, TypeScript |
| **Format** | YAML (rulespec/v1 schema) |
| **Output** | Markdown (SKILL.md with YAML frontmatter) |
| **Dependencies** | `yaml` (single runtime dep) |
| **AI generation** | Optional — AI SDK peer dep for LLM-assisted prompt compilation |

## License

MIT

Built by the team behind [Clawnify](https://www.clawnify.com).
