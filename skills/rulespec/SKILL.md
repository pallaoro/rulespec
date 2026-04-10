---
name: rulespec
description: Create and manage business rules as structured data that compile into LLM-ready prompts and RULES.md files for AI agents. Use when the user wants to define, organize, validate, or compile business rules, policies, or constraints.
---

# rulespec

rulespec is a CLI tool and standard format for expressing business rules as structured data. Rules are written in plain language by domain experts, stored in `rulespec.yaml`, and compiled into prompts or RULES.md files that agents load directly.

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
  - description: "What this example tests"
    input: { ... }
    output: { ... }
```

### Intent levels

- `enforce` — mandatory. Agent must follow this rule. Compiles to directive language.
- `inform` — guidance. Agent should be aware. Compiles to neutral language.
- `suggest` — recommendation. Agent may consider. Compiles to soft language.

## CLI commands

```bash
rulespec init                         # Create a rulespec.yaml with an example rule
rulespec add --id <id> --rule <text> --context <text> --intent <enforce|inform|suggest>
rulespec remove <id>                  # Remove a rule by id
rulespec list                         # List all rules in a table
rulespec compile [id]                 # Compile rules into markdown prompts
rulespec validate                     # Check the file against the schema
rulespec emit                         # Generate rules/{domain}/RULES.md for agents
rulespec emit --include-examples true # Include examples in the emitted RULES.md
rulespec emit --outdir <path>         # Custom output directory (default: rules)
```

All commands accept `--file <path>` to specify a different file (default: `rulespec.yaml`).

## Workflow

1. `rulespec init` to create the file
2. Add rules with `rulespec add` or by editing `rulespec.yaml` directly
3. `rulespec validate` to check for errors
4. `rulespec compile` to preview the compiled prompts
5. `rulespec emit` to generate `rules/{domain}/RULES.md` for agent consumption

## Output: RULES.md

`rulespec emit` generates a RULES.md file with YAML frontmatter that agents load:

```
rules/
  invoice-processing/
    RULES.md
  customer-support/
    RULES.md
```

RULES.md uses intent tags (`[enforce]`, `[inform]`, `[suggest]`) so the agent knows how strictly to treat each rule. Rules marked `[enforce]` should always be followed. `[inform]` provides guidance. `[suggest]` is optional.

## Key principles

- One rule, one change — editing a rule only affects that rule's compiled output
- Business people own rules (plain language), engineers own compilation strategy
- Examples are for local evaluation — they contain real data and are excluded from RULES.md by default
- Sources describe what data the rules operate on, making the spec self-contained
