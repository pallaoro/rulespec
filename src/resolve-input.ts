import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * Resolve a CLI value to an object:
 * 1. If it's valid JSON → parse it
 * 2. If it's a path to a .json file → read and parse it
 * 3. If it's a path to any other file → return { file: "<path>" }
 * 4. Otherwise → error
 */
export async function resolveInput(
  value: string,
  label: string,
): Promise<Record<string, unknown>> {
  // Try JSON first
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON, continue
  }

  // Try as file path
  if (existsSync(value)) {
    if (value.endsWith(".json")) {
      const content = await readFile(value, "utf-8");
      try {
        const parsed = JSON.parse(content);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          return parsed;
        }
      } catch {
        throw new Error(`File ${value} is not valid JSON`);
      }
    }
    // Non-JSON file — store as file reference
    return { file: value };
  }

  throw new Error(
    `Invalid ${label}: expected JSON string, .json file path, or file path. Got "${value}"`,
  );
}
