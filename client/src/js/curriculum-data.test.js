import { describe, it, expect } from "vitest";
import {
  CURRICULUM,
  allTopics,
  topicKey,
  getTopicKickoff,
} from "./curriculum-data.js";

describe("curriculum-data", () => {
  it("flattens every track/module topic into allTopics()", () => {
    const expected = CURRICULUM.reduce(
      (n, track) =>
        n + track.modules.reduce((m, mod) => m + mod.topics.length, 0),
      0
    );
    expect(allTopics()).toHaveLength(expected);
  });

  it("gives every topic a unique topicKey (progress keys can't collide)", () => {
    const keys = allTopics().map((t) => topicKey(t.language, t.topic));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every topic a non-empty kickoff message", () => {
    for (const t of allTopics()) {
      expect(t.kickoff, `${t.language} · ${t.topic}`).toBeTruthy();
    }
  });

  it("returns the topic's own kickoff via getTopicKickoff()", () => {
    const first = allTopics()[0];
    expect(getTopicKickoff(first.language, first.topic)).toBe(first.kickoff);
  });

  it("falls back to a generic prompt for an unknown topic", () => {
    expect(getTopicKickoff("JavaScript", "Nope")).toBe(
      "Explain the Nope topic in JavaScript."
    );
  });
});
