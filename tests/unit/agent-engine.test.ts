import { describe, it, expect } from "vitest";
import { interpolate } from "@/features/agent/action-engine";
import { evaluateCondition } from "@/features/agent/condition-engine";

describe("action engine interpolation", () => {
  it("resolves a whole-string token to its typed value", () => {
    expect(interpolate("{{battery}}", { battery: 42 })).toBe(42);
  });

  it("substitutes tokens inside a longer string", () => {
    expect(interpolate("Battery at {{battery}}%", { battery: 42 })).toBe("Battery at 42%");
  });

  it("walks dotted paths and blanks unknown tokens", () => {
    expect(interpolate("{{device.name}}", { device: { name: "Desk lamp" } })).toBe("Desk lamp");
    expect(interpolate("value: {{missing}}", {})).toBe("value: ");
  });

  it("interpolates nested parameter trees", () => {
    const result = interpolate({ body: { text: "{{msg}}" }, tags: ["{{msg}}"] }, { msg: "hi" });
    expect(result).toEqual({ body: { text: "hi" }, tags: ["hi"] });
  });
});

describe("condition engine", () => {
  it("always passes the empty condition", () => {
    expect(evaluateCondition({ type: "always", operator: "eq", value: "" }).passed).toBe(true);
  });

  it("compares variables numerically", () => {
    const spec = { type: "variable", operator: "gt", value: "10", target: "count" } as never;
    expect(evaluateCondition(spec, { count: 20 }).passed).toBe(true);
    expect(evaluateCondition(spec, { count: 5 }).passed).toBe(false);
  });
});
