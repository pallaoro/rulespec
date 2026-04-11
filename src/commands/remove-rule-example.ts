import { removeRuleExample } from "../writer.js";

export async function removeRuleExampleCmd(
  file: string,
  id: string,
  indexStr: string,
): Promise<void> {
  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 0) {
    console.error(
      "Usage: rulespec remove-rule-example <rule-id> <index> (0-based)",
    );
    process.exit(1);
  }

  await removeRuleExample(file, id, index);
  console.log(`Removed example at index ${index} from rule "${id}"`);
}
