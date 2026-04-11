import { describe, it, expect } from "vitest";
import { emitRulesMd, emitDirName } from "../src/emitter.js";
import type { RulespecFile } from "../src/schema.js";

const makeFile = (overrides: Partial<RulespecFile> = {}): RulespecFile => ({
  schema: "rulespec/v1",
  domain: "invoice processing",
  rules: [
    {
      id: "duplicate-check",
      rule: "Reject invoices with duplicate invoice numbers",
      context: "Before processing any invoice",
      intent: "enforce",
      prompt:
        "### Duplicate Check\n**You must follow this rule.** Before processing any invoice: Reject invoices with duplicate invoice numbers.",
    },
    {
      id: "approval-threshold",
      rule: "Invoices over $5000 require manager approval",
      context: "After extraction, before posting",
      intent: "enforce",
      prompt:
        "### Approval Threshold\n**You must follow this rule.** After extraction, before posting: Invoices over $5000 require manager approval.",
    },
  ],
  ...overrides,
});

describe("emitDirName", () => {
  it("slugifies domain name", () => {
    expect(emitDirName(makeFile())).toBe("invoice-processing");
  });

  it("handles special characters", () => {
    expect(emitDirName(makeFile({ domain: "E-Commerce Support!" }))).toBe(
      "e-commerce-support",
    );
  });
});

describe("emitRulesMd", () => {
  it("includes YAML frontmatter", () => {
    const md = emitRulesMd(makeFile());
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("name: invoice-processing");
    expect(md).toContain("type: rules");
    expect(md).toContain("schema: rulespec/v1");
    expect(md).toContain("---\n");
  });

  it("includes description with rule names", () => {
    const md = emitRulesMd(makeFile());
    expect(md).toContain("Duplicate Check");
    expect(md).toContain("Approval Threshold");
  });

  it("renders rules with intent tags", () => {
    const md = emitRulesMd(makeFile());
    expect(md).toContain("### Duplicate Check [enforce]");
    expect(md).toContain("### Approval Threshold [enforce]");
  });

  it("includes inform intent tag", () => {
    const md = emitRulesMd(
      makeFile({
        rules: [
          {
            id: "greeting",
            rule: "Be nice",
            context: "Always",
            intent: "inform",
            prompt: "### Greeting\nAlways: Be nice.",
          },
        ],
      }),
    );
    expect(md).toContain("### Greeting [inform]");
  });

  it("renders sources table when present", () => {
    const md = emitRulesMd(
      makeFile({
        sources: [
          {
            id: "invoice",
            type: "document",
            format: "pdf",
            description: "Incoming vendor invoice",
          },
          {
            id: "vendor-lookup",
            type: "api",
            format: "json",
            description: "ERP vendor lookup",
          },
        ],
      }),
    );
    expect(md).toContain("## Sources");
    expect(md).toContain("| invoice | document | pdf | Incoming vendor invoice |");
    expect(md).toContain("| vendor-lookup | api | json | ERP vendor lookup |");
  });

  it("renders source schemas when present", () => {
    const md = emitRulesMd(
      makeFile({
        sources: [
          {
            id: "invoice",
            type: "document",
            format: "pdf",
            description: "Incoming vendor invoice",
            schema: { number: "string", vendor: "string" },
          },
        ],
      }),
    );
    expect(md).toContain("### invoice");
    expect(md).toContain("```yaml");
    expect(md).toContain("number: string");
  });

  it("omits sources section when no sources", () => {
    const md = emitRulesMd(makeFile());
    expect(md).not.toContain("## Sources");
  });

  it("excludes examples by default", () => {
    const md = emitRulesMd(
      makeFile({
        examples: [
          {
            input: { invoice: { number: "INV-1" } },
            output: { action: "approve" },
          },
        ],
      }),
    );
    expect(md).not.toContain("## Expected Behavior");
    expect(md).not.toContain("INV-1");
  });

  it("includes examples when opted in", () => {
    const md = emitRulesMd(
      makeFile({
        examples: [
          {
            note: "Simple approval",
            input: { invoice: { number: "INV-1" } },
            output: { action: "approve" },
          },
        ],
      }),
      { includeExamples: true },
    );
    expect(md).toContain("## Expected Behavior");
    expect(md).toContain("### Example 1: Simple approval");
    expect(md).toContain("**Input:**");
    expect(md).toContain("**Expected output:**");
    expect(md).toContain("INV-1");
  });
});
