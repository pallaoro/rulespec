import { describe, it, expect } from "vitest";
import { validate } from "../src/schema.js";

const validBase = {
  schema: "rulespec/v1",
  domain: "test",
  rules: [
    {
      id: "test-rule",
      rule: "Do the thing",
      context: "When needed",
      intent: "inform",
    },
  ],
};

describe("validate sources", () => {
  it("accepts valid sources", () => {
    const result = validate({
      ...validBase,
      sources: [
        {
          id: "invoice",
          type: "document",
          format: "pdf",
          description: "An invoice",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts sources with schema", () => {
    const result = validate({
      ...validBase,
      sources: [
        {
          id: "invoice",
          type: "document",
          description: "An invoice",
          schema: { number: "string" },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid source type", () => {
    const result = validate({
      ...validBase,
      sources: [
        { id: "invoice", type: "invalid", description: "An invoice" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("sources[0].type");
    }
  });

  it("rejects duplicate source ids", () => {
    const result = validate({
      ...validBase,
      sources: [
        { id: "invoice", type: "document", description: "First" },
        { id: "invoice", type: "api", description: "Second" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toContain("Duplicate");
    }
  });

  it("rejects empty source description", () => {
    const result = validate({
      ...validBase,
      sources: [{ id: "invoice", type: "document", description: "" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("sources[0].description");
    }
  });

  it("allows file without sources", () => {
    const result = validate(validBase);
    expect(result.ok).toBe(true);
  });
});

describe("validate global examples", () => {
  it("accepts valid examples", () => {
    const result = validate({
      ...validBase,
      examples: [
        {
          input: { invoice: { number: "INV-1" } },
          output: { action: "approve" },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts examples with note", () => {
    const result = validate({
      ...validBase,
      examples: [
        {
          note: "Simple case",
          input: { x: 1 },
          output: { y: 2 },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects example with missing input", () => {
    const result = validate({
      ...validBase,
      examples: [{ output: { y: 2 } }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("examples[0].input");
    }
  });

  it("rejects example with missing output", () => {
    const result = validate({
      ...validBase,
      examples: [{ input: { x: 1 } }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("examples[0].output");
    }
  });

  it("allows file without examples", () => {
    const result = validate(validBase);
    expect(result.ok).toBe(true);
  });
});

describe("validate per-rule examples", () => {
  it("accepts rules with examples", () => {
    const result = validate({
      ...validBase,
      rules: [
        {
          ...validBase.rules[0],
          examples: [
            { input: { amount: 100 }, output: { approved: true } },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects per-rule example with non-object input", () => {
    const result = validate({
      ...validBase,
      rules: [
        {
          ...validBase.rules[0],
          examples: [{ input: "bad", output: { y: 1 } }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("rules[0].examples[0].input");
    }
  });
});
