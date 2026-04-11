import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

function slugify(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTemplate(domain: string): string {
  return `schema: rulespec/v1
domain: "${domain}"

rules:
  - id: example-rule
    rule: "Replace this with your first business rule"
    context: "When this rule should apply"
    intent: inform
    prompt: "### Example Rule\\nWhen this rule should apply: Replace this with your first business rule."
`;
}

export async function init(
  file: string,
  flags: Record<string, string>,
): Promise<void> {
  const domain = flags.domain;

  if (!domain) {
    console.error(
      'Usage: rulespec init --domain "invoice processing"',
    );
    process.exit(1);
  }

  // If no explicit --file, derive from domain
  const targetFile =
    flags.file ? file : `${slugify(domain)}.rulespec.yaml`;

  if (existsSync(targetFile)) {
    console.error(`${targetFile} already exists`);
    process.exit(1);
  }

  await writeFile(targetFile, buildTemplate(domain), "utf-8");
  console.log(`Created ${targetFile}`);
}
