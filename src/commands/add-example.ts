import { addExample } from "../writer.js";
import { resolveInput } from "../resolve-input.js";

export async function addExampleCmd(
  file: string,
  flags: Record<string, string>,
): Promise<void> {
  const { input, output, note } = flags;

  if (!input || !output) {
    console.error(
      "Usage: rulespec add-example --input <json|file> --output <json|file> [--note <text>]",
    );
    process.exit(1);
  }

  const parsedInput = await resolveInput(input, "--input");
  const parsedOutput = await resolveInput(output, "--output");

  await addExample(file, {
    input: parsedInput,
    output: parsedOutput,
    note: note || undefined,
  });

  console.log(
    `Added example${note ? `: "${note}"` : ""}`,
  );
}
