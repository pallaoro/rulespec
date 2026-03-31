# Vision

## Core insight

Business rules change constantly. Prompts shouldn't be hand-edited every time a policy updates. The relationship between a business rule and the prompt it produces should be structured, traceable, and compilable.

## The Karpathy playbook

Inspired by [autoresearch](https://github.com/karpathy/autoresearch): don't build a framework, define a format. Autoresearch's power isn't the code — it's `program.md` as a standard. One file, one metric, fixed constraints. People adopt the format and build around it.

rulekit follows the same approach: **the format is the product**. The YAML schema is what matters. The CLI and compiler are convenience layers on top.

## Three separated concerns

1. **Business rule** — plain language, written by domain experts. Sacred. Never auto-generated.
2. **Context/metadata** — when the rule applies, how strict it is, what domain it belongs to.
3. **Compiled prompt** — the LLM-ready output. Can be auto-generated from rules or manually overridden. Regenerated when rules or strategy change.

## Why separation matters

- A policy change means editing one `rule` field, not hunting through a 500-line system prompt
- Prompt engineering improvements recompile all rules without touching any of them
- Rules and prompt strategies version independently in git
- `git blame` answers "who changed the refund policy and when?"
- `rulekit diff` answers "how did the prompt change as a result?"

## Positioning

rulekit is not:
- A prompt management platform (Humanloop, PromptLayer)
- A prompt templating engine (Banks, Jinja)
- A rules engine (Drools, OPA)
- A prompt optimizer (DSPy)

rulekit is:
- A **standard format** for expressing business rules as structured data
- A **compiler** that turns those rules into LLM prompts
- A bridge between business stakeholders and AI engineers

## Compilation strategies

The same rules can compile to different prompt formats depending on the target:

- **System prompt** — rules become paragraphs in a system message
- **Few-shot** — rules become example interactions
- **Tool-use** — rules become tool descriptions or constraints
- **Structured** — rules become JSON schema constraints

The strategy is swappable. The rules stay the same.

## Integration with ClawFlow

rulekit is a standalone open-source project. ClawFlow (openclaw-flow) can depend on it to manage business rules within agent workflow nodes. Agent nodes in ClawFlow could reference rulekit files, and rule changes would automatically update the prompts those agents use.

This is a downstream integration, not a coupling. rulekit should work with any LLM framework, not just ClawFlow.
