# Landscape Analysis

Research conducted March 2026 on existing tools in the "business rules to LLM prompts" space.

## Closest to the concept

| Project | What it does | What's missing |
|---------|-------------|----------------|
| **IBM PDL** ([GitHub](https://github.com/IBM/prompt-declaration-language)) | YAML-based declarative prompts-as-data. Composable LLM calls, control flow, type checking. | Rules and prompts are the same thing. No compilation from business rules to prompts. |
| **BAML (BoundaryML)** ([GitHub](https://github.com/BoundaryML/baml)) | DSL for typed LLM functions with input/output schemas. | Focuses on output structure, not input business rules. |
| **DSPy** ([GitHub](https://github.com/stanfordnlp/dspy)) | "Programming, not prompting." Modular signatures, algorithmic prompt optimization. | Signatures are task descriptions, not business rules. Optimization is statistical from examples, not rule-compilation. |
| **IBM ODM + LLMs** ([GitHub](https://github.com/DecisionsDev/rule-based-llms)) | Combines IBM ODM rule engine with LLMs. LLM calls rule-based decision services. | Rules run alongside LLMs, not compiled into prompts. |
| **Priompt (Anysphere/Cursor)** ([GitHub](https://github.com/anysphere/priompt)) | JSX-based prompt assembly with priority-based context window management. | Priority system is about what fits in context, not encoding business rules. |

## Prompt management platforms

All version prompts-as-strings. None model business rules as structured data.

- **Humanloop** — prompt versioning, A/B testing, observability
- **PromptLayer** — prompt registry and logging
- **Agenta** — prompt management and evaluation
- **Pezzo** — prompt management platform
- **Portkey** — AI gateway with prompt management
- **MLflow 3 Prompt Registry** — git-like versioning of prompts as Unity Catalog entities

## Prompt templating / DSLs

Config and templates with variables, not rule compilation.

- **Banks** ([GitHub](https://github.com/masci/banks)) — Jinja2-based prompt templating
- **EdgeChains** ([GitHub](https://github.com/arakoodev/EdgeChains)) — Jsonnet-based prompt config management
- **Prompt Decorators** ([GitHub](https://github.com/synaptiai/prompt-decorators)) — composable behavior modifier tokens

## Traditional rules engines

No native LLM/prompt integration.

- **json-rules-engine** — JSON-based rules for Node.js
- **Drools** — Java rules engine
- **Open Policy Agent (OPA)** — policy-as-code in Rego
- **GoRules** ([GitHub](https://github.com/gorules/zen)) — visual decision tables + AI copilot (AI helps write rules, but rules are executed by engine, not compiled into prompts)

## Structured output / validation

Rules constrain outputs, not prompt generation.

- **Instructor** — Pydantic schemas for LLM outputs
- **Outlines** — constrained decoding
- **Guidance** (Microsoft) — grammar-guided generation

## Academic work

- **"BREX" benchmark** ([Paper](https://arxiv.org/html/2505.18542)) — 2,855 expert-annotated business rules as structured condition-action pairs. Goes rules FROM documents, not rules INTO prompts.
- **"Conversation Routines"** ([Paper](https://arxiv.org/abs/2501.11613)) — structured workflows for LLM conversations. Still manually written prompts, no structured rule representation.
- **"Hybrid LLM/Rule-based Approaches"** ([Paper](https://arxiv.org/pdf/2404.15604)) — rules preprocess data, not prompts.

## The gap

No existing tool treats business rules as a first-class structured data model that gets compiled into LLM prompts. The closest tools either:

1. Treat prompts themselves as the declarative artifact (PDL, BAML)
2. Run rules alongside LLMs (IBM ODM, GoRules)
3. Manage prompts-as-strings with versioning (Humanloop, PromptLayer)

The "rules in, prompts out" compilation concept is an open space. This is where rulekit sits.
