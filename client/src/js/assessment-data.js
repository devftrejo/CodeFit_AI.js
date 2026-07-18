// Single source of truth for the fit assessment: the item banks + all scoring.
// Pure data and logic (no DOM, no Firebase), so it unit-tests cleanly and the
// assessment UI (assessment.js) just renders it and persists the result.
//
// Everything here is license-safe:
//   - Aptitude items are ORIGINAL (pattern/logic/code-trace/ordering).
//   - Personality uses the Mini-IPIP (Donnellan et al., 2006), a 20-item Big
//     Five measure drawn from the International Personality Item Pool, which is
//     PUBLIC DOMAIN. No MBTI/Myers-Briggs name or items are used.
//
// The assessment is a completion gate, not a pass/fail: finishing it unlocks the
// app for everyone. Scores drive an encouraging readout, never a block.

// --- Aptitude (original multiple-choice items) -----------------------------
// Each item: id, prompt, options[], and answer = index of the correct option.
export const APTITUDE_ITEMS = [
  {
    id: "apt-seq-num",
    prompt: "What number comes next?\n2, 4, 8, 16, …",
    options: ["18", "24", "32", "30"],
    answer: 2,
  },
  {
    id: "apt-seq-alpha",
    prompt: "Which letter continues the pattern?\nA, C, E, G, …",
    options: ["F", "H", "I", "J"],
    answer: 2,
  },
  {
    id: "apt-syllogism",
    prompt:
      "All widgets are gadgets. All gadgets are tools.\nWhich statement must be true?",
    options: [
      "All tools are widgets",
      "It cannot be determined",
      "All widgets are tools",
      "No widgets are tools",
    ],
    answer: 2,
  },
  {
    id: "apt-trace-arith",
    prompt: "After this runs, what is x?\nlet x = 3;\nx = x + 4;\nx = x * 2;",
    options: ["10", "14", "11", "20"],
    answer: 1,
  },
  {
    id: "apt-trace-loop",
    prompt:
      "What does total equal?\nlet total = 0;\nfor (let i = 1; i <= 4; i++) {\n  total += i;\n}",
    options: ["6", "8", "10", "4"],
    answer: 2,
  },
  {
    id: "apt-boolean",
    prompt: "What does this evaluate to?\ntrue && (false || true)",
    options: ["false", "true", "an error", "undefined"],
    answer: 1,
  },
  {
    id: "apt-conditional",
    prompt:
      "What is stored in result?\nlet n = 5;\nlet result = n % 2 === 0 ? 'even' : 'odd';",
    options: ["even", "5", "odd", "nothing"],
    answer: 2,
  },
  {
    id: "apt-ordering",
    prompt:
      "You want a program that greets a user by their name.\nWhich order of steps makes sense?",
    options: [
      "Print “Hello, ” + name, then ask for the name, then store it",
      "Ask for the name, store it, then print “Hello, ” + name",
      "Store it, print the greeting, then ask for the name",
      "Print the name, store it, then ask for it",
    ],
    answer: 1,
  },
];

// --- Personality (Mini-IPIP Big Five, public domain) -----------------------
// trait ∈ { E, A, C, N, O }; reverse-keyed items are scored 6 − rating.
// Canonical Mini-IPIP order (interleaved across traits to reduce response bias).
export const PERSONALITY_ITEMS = [
  { id: "ipip-1", text: "Am the life of the party.", trait: "E", reverse: false },
  { id: "ipip-2", text: "Sympathize with others’ feelings.", trait: "A", reverse: false },
  { id: "ipip-3", text: "Get chores done right away.", trait: "C", reverse: false },
  { id: "ipip-4", text: "Have frequent mood swings.", trait: "N", reverse: false },
  { id: "ipip-5", text: "Have a vivid imagination.", trait: "O", reverse: false },
  { id: "ipip-6", text: "Don’t talk a lot.", trait: "E", reverse: true },
  { id: "ipip-7", text: "Am not interested in other people’s problems.", trait: "A", reverse: true },
  { id: "ipip-8", text: "Often forget to put things back in their proper place.", trait: "C", reverse: true },
  { id: "ipip-9", text: "Am relaxed most of the time.", trait: "N", reverse: true },
  { id: "ipip-10", text: "Am not interested in abstract ideas.", trait: "O", reverse: true },
  { id: "ipip-11", text: "Talk to a lot of different people at parties.", trait: "E", reverse: false },
  { id: "ipip-12", text: "Feel others’ emotions.", trait: "A", reverse: false },
  { id: "ipip-13", text: "Like order.", trait: "C", reverse: false },
  { id: "ipip-14", text: "Get upset easily.", trait: "N", reverse: false },
  { id: "ipip-15", text: "Have difficulty understanding abstract ideas.", trait: "O", reverse: true },
  { id: "ipip-16", text: "Keep in the background.", trait: "E", reverse: true },
  { id: "ipip-17", text: "Am not really interested in others.", trait: "A", reverse: true },
  { id: "ipip-18", text: "Make a mess of things.", trait: "C", reverse: true },
  { id: "ipip-19", text: "Seldom feel blue.", trait: "N", reverse: true },
  { id: "ipip-20", text: "Do not have a good imagination.", trait: "O", reverse: true },
];

// 5-point agreement scale used for every personality item.
export const LIKERT = [
  { value: 1, label: "Very inaccurate" },
  { value: 2, label: "Moderately inaccurate" },
  { value: 3, label: "Neither" },
  { value: 4, label: "Moderately accurate" },
  { value: 5, label: "Very accurate" },
];

// Display metadata for each Big Five trait (name + one-line, plain-language gloss).
export const TRAIT_META = {
  O: { name: "Openness", blurb: "curiosity, imagination, love of new ideas" },
  C: { name: "Conscientiousness", blurb: "organization, follow-through, attention to detail" },
  E: { name: "Extraversion", blurb: "energy from people and collaboration" },
  A: { name: "Agreeableness", blurb: "empathy, cooperation, team focus" },
  N: { name: "Emotional sensitivity", blurb: "how strongly day-to-day ups and downs land" },
};

export const TRAIT_ORDER = ["O", "C", "E", "A", "N"];

// Encouraging aptitude bands — descriptive, never a fail.
export const APTITUDE_BANDS = {
  strong: {
    label: "Strong analytical signals",
    blurb:
      "You spotted patterns and traced logic quickly — a real asset for coding.",
  },
  solid: {
    label: "Solid problem-solving instincts",
    blurb:
      "You’ve got a good feel for patterns and logic; practice will sharpen it fast.",
  },
  emerging: {
    label: "Building your foundations",
    blurb:
      "Problem-solving is a skill you grow by doing — the lessons ahead are built exactly for that.",
  },
};

// --- Scoring ---------------------------------------------------------------

function aptitudeBand(score, total) {
  const pct = total === 0 ? 0 : score / total;
  if (pct >= 0.75) return "strong";
  if (pct >= 0.45) return "solid";
  return "emerging";
}

// answers: { [itemId]: chosenOptionIndex }. Unanswered items count as wrong.
export function scoreAptitude(answers = {}) {
  let score = 0;
  for (const item of APTITUDE_ITEMS) {
    if (answers[item.id] === item.answer) score += 1;
  }
  const total = APTITUDE_ITEMS.length;
  return { score, total, band: aptitudeBand(score, total) };
}

// answers: { [itemId]: rating 1–5 }. Returns each trait averaged to a 1–5 score
// (reverse-keyed items flipped first). Missing answers default to the neutral 3.
export function scorePersonality(answers = {}) {
  const buckets = { O: [], C: [], E: [], A: [], N: [] };
  for (const item of PERSONALITY_ITEMS) {
    const raw = answers[item.id] ?? 3;
    const value = item.reverse ? 6 - raw : raw;
    buckets[item.trait].push(value);
  }
  const result = {};
  for (const trait of Object.keys(buckets)) {
    const vals = buckets[trait];
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    // Round to one decimal so stored/displayed values stay tidy.
    result[trait] = Math.round(avg * 10) / 10;
  }
  return result;
}

// --- Role suggestions (illustrative, deterministic) ------------------------
// Each role scores against the trait profile (1–5) plus the aptitude signal
// (normalized to 1–5). Top scorers are surfaced as "roles that often suit a
// profile like yours" — guidance, not a verdict.
const ROLES = [
  {
    key: "frontend",
    name: "Frontend / UI Developer",
    firstTrack: "HTML",
    blurb: "Building what people see and interact with.",
    weights: { O: 1.0, E: 0.5, apt: 0.3 },
  },
  {
    key: "creative",
    name: "Creative / Design Engineer",
    firstTrack: "CSS",
    blurb: "Where visual craft meets code.",
    weights: { O: 1.1, A: 0.3, apt: 0.2 },
  },
  {
    key: "backend",
    name: "Backend / Systems Developer",
    firstTrack: "JavaScript",
    blurb: "The logic and data behind the scenes.",
    weights: { C: 1.0, apt: 0.8 },
  },
  {
    key: "data",
    name: "Data & Analytics",
    firstTrack: "JavaScript",
    blurb: "Finding the story in the numbers.",
    weights: { O: 0.6, C: 0.4, apt: 1.0 },
  },
  {
    key: "automation",
    name: "Automation & Scripting",
    firstTrack: "JavaScript",
    blurb: "Making repetitive work disappear.",
    weights: { C: 0.9, apt: 0.6 },
  },
  {
    key: "qa",
    name: "QA & Test Engineering",
    firstTrack: "JavaScript",
    blurb: "Making sure things actually work.",
    weights: { C: 1.1, A: 0.3 },
  },
  {
    key: "collab",
    name: "Product-facing / Team Developer",
    firstTrack: "HTML",
    blurb: "Coding closely with people and product.",
    weights: { E: 1.0, A: 0.7 },
  },
];

// Map an aptitude {score,total} to a 1–5 signal comparable with trait scores.
function aptitudeSignal(aptitude) {
  const pct = aptitude && aptitude.total ? aptitude.score / aptitude.total : 0;
  return 1 + pct * 4;
}

// Returns the top `count` roles for a profile: [{ name, blurb, firstTrack }].
export function suggestRoles(personality = {}, aptitude = {}, count = 2) {
  const apt = aptitudeSignal(aptitude);
  const scored = ROLES.map((role) => {
    let total = 0;
    for (const [key, weight] of Object.entries(role.weights)) {
      const value = key === "apt" ? apt : (personality[key] ?? 3);
      total += weight * value;
    }
    return { role, total };
  });
  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, count).map(({ role }) => ({
    name: role.name,
    blurb: role.blurb,
    firstTrack: role.firstTrack,
  }));
}

// Build the full readout the results screen renders and we persist.
export function buildResult(aptitudeAnswers, personalityAnswers) {
  const aptitude = scoreAptitude(aptitudeAnswers);
  const personality = scorePersonality(personalityAnswers);
  const roles = suggestRoles(personality, aptitude);
  return { aptitude, personality, roles };
}
