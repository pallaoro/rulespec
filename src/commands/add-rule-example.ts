import { addRuleExample } from "../writer.js";
import { resolveInput } from "../resolve-input.js";

export async function addRuleExampleCmd(
  file: string,
  id: string,
  flags: Record<string, string>,
): Promise<void> {
  const { input, output, note } = flags;

  if (!input || !output) {
    console.error(
      "Usage: rulespec add-rule-example <rule-id> --input <json|file> --output <json|file> [--note <text>]",
    );
    process.exit(1);
  }

  const parsedInput = await resolveInput(input, "--input");
  const parsedOutput = await resolveInput(output, "--output");

  await addRuleExample(file, id, {
    input: parsedInput,
    output: parsedOutput,
    note: note || undefined,
  });

  console.log(`Added example to rule "${id}"${note ? `: "${note}"` : ""}`);
}
