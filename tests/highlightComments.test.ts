import { describe, expect, it } from "vitest";
import { highlightComments } from "../lib/highlightComments";

describe("highlightComments", () => {
  it("wraps a line comment in a code-comment span", () => {
    expect(highlightComments("// hello")).toBe('<span class="code-comment">// hello</span>');
  });

  it("wraps a block comment in a code-comment span", () => {
    expect(highlightComments("/* a\nb */")).toBe('<span class="code-comment">/* a\nb */</span>');
  });

  it("leaves plain code (variables, keywords) uncolored", () => {
    expect(highlightComments("var x = 1;")).toBe("var x = 1;");
  });

  it("does not treat // inside a string as a comment", () => {
    const src = 'var url = "http://example.com";';
    expect(highlightComments(src)).toBe(src);
  });

  it("colors a trailing comment after real code on the same line", () => {
    const out = highlightComments("var x = 1; // set x");
    expect(out).toBe('var x = 1; <span class="code-comment">// set x</span>');
  });

  it("HTML-escapes code outside of comments", () => {
    expect(highlightComments("if (a < b) {}")).toBe("if (a &lt; b) {}");
  });

  it("HTML-escapes text inside comments too", () => {
    expect(highlightComments("// a < b")).toBe('<span class="code-comment">// a &lt; b</span>');
  });

  it("does not confuse a single-quoted string containing // for a comment", () => {
    const src = "var s = 'a // not a comment';";
    expect(highlightComments(src)).toBe(src);
  });
});
