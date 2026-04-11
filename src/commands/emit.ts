import { mkdir, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRulespecFile } from "../parser.js";
import { emitRulesMd, emitDirName } from "../emitter.js";

async function emitOne(
  file: string,
  outdir: string,
  includeExamples: boolean,
): Promise<void> {
  const specFile = await parseRulespecFile(file);
  const dirName = emitDirName(specFile);
  const targetDir = resolve(outdir, dirName);
  await mkdir(targetDir, { recursive: true });

  const md = emitRulesMd(specFile, { includeExamples });
  const targetPath = resolve(targetDir, "SKILL.md");
  await writeFile(targetPath, md, "utf-8");

  console.log(`Emitted ${targetPath}`);
}

export async function emit(
  file: string,
  flags: Record<string, string>,
): Promise<void> {
  const outdir = flags.outdir ?? "skills";
  const includeExamples = flags["include-examples"] === "true";

  // If explicit --file, emit that one
  if (flags.file) {
    await emitOne(file, outdir, includeExamples);
    return;
  }

  // Scan for *.rulespec.yaml files
  const entries = await readdir(".").catch(() => []);
  const rulespecFiles = (entries as string[]).filter((f) =>
    f.endsWith(".rulespec.yaml"),
  );

  if (rulespecFiles.length === 0) {
    console.error(
      'No *.rulespec.yaml files found. Run "rulespec init --domain <name>" to create one.',
    );
    process.exit(1);
  }

  for (const f of rulespecFiles) {
    await emitOne(f, outdir, includeExamples);
  }
}
