import { describe, it, expect } from "vitest";
import { buildSystemPrompt, systemMessages } from "./prompts.js";

describe("buildSystemPrompt", () => {
  it("returns null for an unknown role", () => {
    expect(
      buildSystemPrompt("notARole", { language: "JS", topic: "loops" })
    ).toBe(null);
  });

  it("returns the bare persona when no lesson context is given", () => {
    expect(buildSystemPrompt("curriculumExplainer")).toBe(
      systemMessages.curriculumExplainer
    );
  });

  it("returns the bare persona when only one of language/topic is given", () => {
    expect(buildSystemPrompt("curriculumExplainer", { language: "JS" })).toBe(
      systemMessages.curriculumExplainer
    );
    expect(buildSystemPrompt("curriculumExplainer", { topic: "loops" })).toBe(
      systemMessages.curriculumExplainer
    );
  });

  it("appends the lesson context (persona + language + topic) when both are given", () => {
    const prompt = buildSystemPrompt("codeExplainer", {
      language: "JavaScript",
      topic: "Arrays",
    });
    expect(prompt).toContain(systemMessages.codeExplainer);
    expect(prompt).toContain("Lesson context");
    expect(prompt).toContain("Arrays");
    expect(prompt).toContain("JavaScript");
    // Soft-redirect wording keeps every role anchored to the active topic.
    expect(prompt).toContain("guide them back to Arrays");
  });
});
