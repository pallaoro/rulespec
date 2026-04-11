#!/usr/bin/env node

import { init } from "./commands/init.js";
import { add } from "./commands/add.js";
import { edit } from "./commands/edit.js";
import { remove } from "./commands/remove.js";
import { list } from "./commands/list.js";
import { compile } from "./commands/compile.js";
import { validateCmd } from "./commands/validate.js";
import { emit } from "./commands/emit.js";
import { setDomainCmd } from "./commands/set-domain.js";
import { addSourceCmd } from "./commands/add-source.js";
import { removeSourceCmd } from "./commands/remove-source.js";
import { addExampleCmd } from "./commands/add-example.js";
import { removeExampleCmd } from "./commands/remove-example.js";
import { replaceCmd } from "./commands/replace.js";
import { addRuleExampleCmd } from "./commands/add-rule-example.js";
import { removeRuleExampleCmd } from "./commands/remove-rule-example.js";

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function printHelp(): void {
  console.log(`rulespec — business rules as structured data

Usage:
  rulespec <command> [options]

Commands:
  init                    Create a rulespec.yaml in the current directory
  set-domain <domain>     Set the domain name
  add                     Add a new rule
  edit <id>               Modify an existing rule
  remove <id>             Remove a rule by id
  list                    List all rules
  add-source              Add a data source
  remove-source <id>      Remove a data source by id
  add-example             Add a global input/output example
  remove-example <index>  Remove an example by index (0-based)
  add-rule-example <id>   Add an example to a specific rule
  remove-rule-example <id> <index>  Remove an example from a rule
  compile [id]            Regenerate prompts and print markdown to stdout
  validate                Validate the rulespec file
  replace                 Find and replace text in rulespec.yaml (validates + recompiles)
  emit                    Generate skills/{domain}/SKILL.md for agents

Options:
  --file <path>           Path to rulespec file (default: rulespec.yaml)
  --help                  Show this help message

Init options:
  --domain <name>         Set the domain name (default: "your domain here")

Rule options (add / edit):
  --id <id>               Rule id (kebab-case, required for add)
  --rule <text>           The business rule
  --context <text>        When the rule applies
  --intent <type>         enforce, inform, or suggest

Source options (add-source):
  --id <id>               Source id (kebab-case)
  --type <type>           document, api, database, message, or structured
  --description <text>    What this source is
  --format <fmt>          Data format (optional, e.g. pdf, json, csv)

Example options (add-example):
  --input <json>          Input data as JSON string
  --output <json>         Expected output as JSON string
  --description <text>    What this example tests (optional)

Emit options:
  --outdir <path>         Output directory (default: skills)
  --include-examples true Include examples in SKILL.md (default: false)

Replace options:
  --old <text>            Text to find
  --new <text>            Replacement text`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const rest = args.slice(1);
  const flags = parseFlags(rest);
  const file = flags.file ?? "rulespec.yaml";

  switch (command) {
    case "init":
      await init(file, flags);
      break;
    case "set-domain":
      if (!rest[0] || rest[0].startsWith("--")) {
        console.error("Usage: rulespec set-domain <domain>");
        process.exit(1);
      }
      await setDomainCmd(file, rest[0]);
      break;
    case "add":
      await add(file, flags);
      break;
    case "edit":
      if (!rest[0] || rest[0].startsWith("--")) {
        console.error("Usage: rulespec edit <id> [--rule <text>] [--context <text>] [--intent <type>]");
        process.exit(1);
      }
      await edit(file, rest[0], flags);
      break;
    case "remove":
      if (!rest[0] || rest[0].startsWith("--")) {
        console.error("Usage: rulespec remove <id>");
        process.exit(1);
      }
      await remove(file, rest[0]);
      break;
    case "list":
      await list(file);
      break;
    case "add-source":
      await addSourceCmd(file, flags);
      break;
    case "remove-source":
      if (!rest[0] || rest[0].startsWith("--")) {
        console.error("Usage: rulespec remove-source <id>");
        process.exit(1);
      }
      await removeSourceCmd(file, rest[0]);
      break;
    case "add-example":
      await addExampleCmd(file, flags);
      break;
    case "remove-example":
      if (!rest[0] || rest[0].startsWith("--")) {
        console.error("Usage: rulespec remove-example <index>");
        process.exit(1);
      }
      await removeExampleCmd(file, rest[0]);
      break;
    case "add-rule-example":
      if (!rest[0] || rest[0].startsWith("--")) {
        console.error(
          'Usage: rulespec add-rule-example <rule-id> --input \'{"key":"val"}\' --output \'{"key":"val"}\'',
        );
        process.exit(1);
      }
      await addRuleExampleCmd(file, rest[0], flags);
      break;
    case "remove-rule-example": {
      const ruleId = rest[0];
      const exIdx = rest[1];
      if (!ruleId || ruleId.startsWith("--") || !exIdx) {
        console.error(
          "Usage: rulespec remove-rule-example <rule-id> <index>",
        );
        process.exit(1);
      }
      await removeRuleExampleCmd(file, ruleId, exIdx);
      break;
    }
    case "replace":
      await replaceCmd(file, flags);
      break;
    case "compile": {
      const ruleId = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
      await compile(file, ruleId);
      break;
    }
    case "validate":
      await validateCmd(file);
      break;
    case "emit":
      await emit(file, flags);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
