import { describe, it, expect } from "vitest";
import { fill } from "@/features/plugins/sandbox";

describe("plugin sandbox templating", () => {
  it("fills input and setting tokens", () => {
    expect(fill("Bearer {{setting.apiKey}}", {}, { apiKey: "abc" })).toBe("Bearer abc");
    expect(fill("/users/{{input.id}}", { id: 7 }, {})).toBe("/users/7");
  });

  it("blanks unknown scopes rather than leaking the raw token", () => {
    expect(fill("{{process.env.SECRET}}", {}, {})).toBe("");
  });

  it("fills nested structures", () => {
    expect(fill({ q: ["{{input.term}}"] }, { term: "lamp" }, {})).toEqual({ q: ["lamp"] });
  });
});
