import { describe, it, expect } from "vitest";
import {
  APTITUDE_ITEMS,
  PERSONALITY_ITEMS,
  scoreAptitude,
  scorePersonality,
  suggestRoles,
  buildResult,
} from "./assessment-data.js";

// Build an aptitude answer sheet with the first `n` items correct.
function aptitudeAnswers(n) {
  const answers = {};
  APTITUDE_ITEMS.slice(0, n).forEach((item) => {
    answers[item.id] = item.answer;
  });
  return answers;
}

describe("scoreAptitude", () => {
  it("scores all-correct as the top band", () => {
    const result = scoreAptitude(aptitudeAnswers(APTITUDE_ITEMS.length));
    expect(result.score).toBe(APTITUDE_ITEMS.length);
    expect(result.total).toBe(APTITUDE_ITEMS.length);
    expect(result.band).toBe("strong");
  });

  it("counts unanswered items as wrong and lands in the lowest band", () => {
    const result = scoreAptitude({});
    expect(result.score).toBe(0);
    expect(result.band).toBe("emerging");
  });

  it("puts a half-right score in the middle band", () => {
    const half = Math.round(APTITUDE_ITEMS.length / 2);
    expect(scoreAptitude(aptitudeAnswers(half)).band).toBe("solid");
  });
});

describe("scorePersonality", () => {
  it("defaults every unanswered item to neutral (all traits = 3)", () => {
    const traits = scorePersonality({});
    for (const trait of ["O", "C", "E", "A", "N"]) {
      expect(traits[trait]).toBe(3);
    }
  });

  it("reverse-scores reverse-keyed items", () => {
    // Answer every item "5". Openness has 1 forward + 3 reverse items, so it
    // averages (5 + 1 + 1 + 1) / 4 = 2; a trait with 2 forward + 2 reverse
    // (e.g. Extraversion) averages (5 + 5 + 1 + 1) / 4 = 3.
    const allFives = {};
    PERSONALITY_ITEMS.forEach((item) => {
      allFives[item.id] = 5;
    });
    const traits = scorePersonality(allFives);
    expect(traits.O).toBe(2);
    expect(traits.E).toBe(3);
  });
});

describe("suggestRoles", () => {
  it("returns two roles with name/blurb/firstTrack, deterministically", () => {
    const personality = { O: 3, C: 3, E: 3, A: 3, N: 3 };
    const aptitude = { score: 4, total: 8 };
    const roles = suggestRoles(personality, aptitude);
    expect(roles).toHaveLength(2);
    for (const role of roles) {
      expect(role.name).toBeTruthy();
      expect(role.blurb).toBeTruthy();
      expect(role.firstTrack).toBeTruthy();
    }
    // Same input → same output.
    expect(suggestRoles(personality, aptitude)).toEqual(roles);
  });

  it("surfaces a conscientiousness-weighted role for a high-C profile", () => {
    const roles = suggestRoles(
      { O: 1, C: 5, E: 1, A: 1, N: 3 },
      { score: 8, total: 8 }
    );
    const names = roles.map((r) => r.name);
    expect(
      names.some((n) => /Backend|QA|Automation/.test(n))
    ).toBe(true);
  });
});

describe("buildResult", () => {
  it("assembles aptitude + personality + roles", () => {
    const result = buildResult(aptitudeAnswers(6), {});
    expect(result.aptitude.score).toBe(6);
    expect(result.personality).toHaveProperty("O");
    expect(result.roles.length).toBeGreaterThan(0);
  });
});
