# Design Decisions

## Schema

### The four fields

Every rule has exactly four fields. This is intentional — more fields means more friction for business people writing rules.

| Field | Owner | Purpose |
|-------|-------|---------|
| `id` | Engineer | Unique identifier for referencing, tracking, diffing |
| `rule` | Business person | The actual business rule in plain language |
| `context` | Business person / Engineer | When and where this rule applies |
| `intent` | Business person | How strictly the rule should be enforced |

### Intent levels

- **`enforce`** — hard requirement. The compiled prompt uses directive language ("you must", "always", "never").
- **`inform`** — guidance. The compiled prompt uses softer language ("prefer", "when possible", "keep in mind").
- **`suggest`** — optional recommendation. The compiled prompt frames it as a best practice, not a mandate.

### File format

YAML over JSON. Reasons:
- More readable for non-engineers (business stakeholders will read these files)
- Supports comments (useful for annotating why a rule exists)
- Less syntactic noise (no braces, quotes optional)

JSON schema provided for validation in editors and CI.

## Rule independence

Each rule compiles independently. Changing rule A never affects rule B's compiled prompt. This is the core guarantee that makes iteration safe.

Consequences:
- Rules can be added, removed, or modified without side effects
- Parallel editing by multiple teams is safe
- Rollback is per-rule, not all-or-nothing
- Testing/evaluation can target a single rule

## Compilation

The compiler is a pure function: `(rule, strategy) → prompt text`.

- **Deterministic** — same input always produces same output
- **Stateless** — no dependency on other rules or prior compilations
- **Strategy-parameterized** — different strategies produce different prompt text from the same rule

### Composition

When multiple rules are compiled for a single LLM call, they need to be assembled. Options:

1. **Concatenation** — rules compile to paragraphs, stitched with a template. Simplest.
2. **Scoped injection** — rules tagged to specific agents/nodes/steps, injected only where relevant.
3. **Priority/override** — rules can override each other (e.g., `refund-window-holiday` overrides `refund-window` in December).

Starting with concatenation. Scoping and overrides are future work.

## CLI

The CLI is sugar on top of the format. Every CLI command maps to a YAML file operation:

- `rulekit add` → append to `rules` array
- `rulekit remove` → delete from `rules` array  
- `rulekit edit` → modify entry in `rules` array
- `rulekit compile` → read file, run compiler, output prompts
- `rulekit validate` → read file, check against JSON schema

You never need the CLI. You can hand-edit the YAML and call the compiler programmatically.

## Technology

- **TypeScript** — same ecosystem as ClawFlow, works as both CLI (`npx rulekit`) and library (`import { compile } from 'rulekit'`)
- **Zero runtime dependencies** — the compiler is pure string transformation
- **Published to npm** — `npm install rulekit` for library use, `npm install -g rulekit` for CLI
