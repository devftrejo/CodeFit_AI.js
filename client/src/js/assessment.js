// Fit assessment flow (assessment.html only). Renders the two item banks from
// assessment-data.js, collects answers, scores them, persists the result to
// users/{uid}.assessment (plain client write — same profile doc as prefs and
// progress, no Cloud Function or rules change), and shows the fit readout. The
// app is gated on this being complete (see entries/app.js), but the gate is
// *completion*, not a score — finishing always unlocks the lessons.

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { db } from "./firebase.js";
import {
  APTITUDE_ITEMS,
  PERSONALITY_ITEMS,
  LIKERT,
  TRAIT_META,
  TRAIT_ORDER,
  APTITUDE_BANDS,
  buildResult,
} from "./assessment-data.js";
import { CURRICULUM } from "./curriculum-data.js";

// The two banks flattened into one ordered list, shown ONE question at a time so
// the learner can't look ahead. Aptitude first, then personality.
const QUESTIONS = [
  ...APTITUDE_ITEMS.map((item) => ({
    item,
    kind: "choice",
    stepKey: "aptitude",
    section: "Part 1 of 2 · Problem-solving",
  })),
  ...PERSONALITY_ITEMS.map((item) => ({
    item,
    kind: "likert",
    stepKey: "personality",
    section: "Part 2 of 2 · Work style",
  })),
];
const TOTAL = QUESTIONS.length;

// answers[stepKey][itemId] = chosen value (option index for choice, 1–5 for likert)
const answers = { aptitude: {}, personality: {} };
let current = 0;

let uid = null;

// Cache DOM once.
const introEl = document.getElementById("assessment-intro");
const quizEl = document.getElementById("assessment-quiz");
const resultsEl = document.getElementById("assessment-results");
const questionsEl = document.getElementById("assessment-questions");
const stepLabelEl = document.getElementById("assessment-step-label");
const progressBar = document.getElementById("assessment-progress-bar");
const startButton = document.getElementById("assessment-start");
const backButton = document.getElementById("assessment-back");
const nextButton = document.getElementById("assessment-next");

// --- Rendering one question at a time --------------------------------------

function answeredCount() {
  return (
    Object.keys(answers.aptitude).length +
    Object.keys(answers.personality).length
  );
}

function updateProgress() {
  const pct = Math.round((answeredCount() / TOTAL) * 100);
  progressBar.style.width = `${pct}%`;
}

function isAnswered(q) {
  return answers[q.stepKey][q.item.id] !== undefined;
}

function lowerFirst(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// A single labelled radio input. Recording an answer enables "Continue".
function radioOption(stepKey, itemId, value, labelText, checked) {
  const label = document.createElement("label");
  label.className = "assessment-option";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = itemId;
  input.value = String(value);
  input.checked = Boolean(checked);
  input.addEventListener("change", () => {
    answers[stepKey][itemId] = value;
    nextButton.disabled = false;
    updateProgress();
  });

  const span = document.createElement("span");
  span.textContent = labelText;

  label.append(input, span);
  return label;
}

// One choice (aptitude) question: prompt (may contain code) + radio options.
function renderChoiceItem(item, number) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "assessment-question";

  const legend = document.createElement("legend");
  legend.className = "assessment-q-number";
  legend.textContent = `Question ${number} of ${TOTAL}`;
  fieldset.appendChild(legend);

  const prompt = document.createElement("div");
  prompt.className = "assessment-prompt";
  prompt.textContent = item.prompt; // textContent + CSS pre-wrap keeps code readable
  fieldset.appendChild(prompt);

  const options = document.createElement("div");
  options.className = "assessment-options";
  item.options.forEach((text, optIndex) => {
    options.appendChild(
      radioOption(
        "aptitude",
        item.id,
        optIndex,
        text,
        answers.aptitude[item.id] === optIndex
      )
    );
  });
  fieldset.appendChild(options);
  return fieldset;
}

// One Likert (personality) question: statement + the 5-point accuracy scale.
function renderLikertItem(item, number) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "assessment-question assessment-likert";

  const legend = document.createElement("legend");
  legend.className = "assessment-q-number";
  legend.textContent = `Question ${number} of ${TOTAL}`;
  fieldset.appendChild(legend);

  const statement = document.createElement("p");
  statement.className = "assessment-statement";
  statement.textContent = `“I ${lowerFirst(item.text)}”`;
  fieldset.appendChild(statement);

  const scale = document.createElement("div");
  scale.className = "assessment-scale";
  LIKERT.forEach(({ value, label }) => {
    scale.appendChild(
      radioOption(
        "personality",
        item.id,
        value,
        label,
        answers.personality[item.id] === value
      )
    );
  });
  fieldset.appendChild(scale);
  return fieldset;
}

function renderQuestion() {
  const q = QUESTIONS[current];
  stepLabelEl.textContent = q.section;
  questionsEl.innerHTML = "";

  const render = q.kind === "choice" ? renderChoiceItem : renderLikertItem;
  questionsEl.appendChild(render(q.item, current + 1));

  backButton.textContent = current === 0 ? "Back to intro" : "Back";
  nextButton.textContent =
    current === TOTAL - 1 ? "See my results" : "Continue";
  // Can't advance until this question is answered — no looking ahead.
  nextButton.disabled = !isAnswered(q);

  updateProgress();
  quizEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Navigation ------------------------------------------------------------

function handleBack() {
  if (current === 0) {
    quizEl.hidden = true;
    introEl.hidden = false;
    introEl.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  current -= 1;
  renderQuestion();
}

async function handleNext() {
  // Continue is disabled until the question is answered; this just guards
  // keyboard activation.
  if (!isAnswered(QUESTIONS[current])) return;
  if (current < TOTAL - 1) {
    current += 1;
    renderQuestion();
    return;
  }
  await finish();
}

// --- Finish + persist + results --------------------------------------------

async function finish() {
  nextButton.disabled = true;
  nextButton.textContent = "Saving…";

  const result = buildResult(answers.aptitude, answers.personality);

  try {
    await setDoc(
      doc(db, "users", uid),
      {
        assessment: { ...result, completedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Don't trap the learner on a transient write error — let them continue;
    // the app gate will simply re-prompt next time if it truly didn't save.
    console.error("Saving assessment failed:", error);
  }

  showResults(result);
}

// First topic of a curriculum track, for the "start here" nudge.
function firstTopicOf(trackLanguage) {
  const track = CURRICULUM.find((t) => t.language === trackLanguage);
  return track?.modules[0]?.topics[0]?.topic ?? null;
}

function showResults(result) {
  introEl.hidden = true;
  quizEl.hidden = true;
  resultsEl.hidden = false;
  resultsEl.innerHTML = "";

  const band = APTITUDE_BANDS[result.aptitude.band];

  const heading = document.createElement("h1");
  heading.className = "assessment-title";
  heading.textContent = "Your fit snapshot";
  resultsEl.appendChild(heading);

  const lead = document.createElement("p");
  lead.className = "assessment-lead";
  lead.textContent =
    "Here’s what your answers suggest. Think of it as a compass, not a verdict — the best way to know if coding fits you is to start doing it.";
  resultsEl.appendChild(lead);

  // Aptitude band
  const aptCard = document.createElement("div");
  aptCard.className = "assessment-result-block";
  aptCard.innerHTML = `
    <h2 class="assessment-result-h"><i class="fa-solid fa-puzzle-piece"></i> Problem-solving</h2>
    <p class="assessment-band">${band.label} <span class="assessment-band-score">(${result.aptitude.score} / ${result.aptitude.total})</span></p>
    <p class="assessment-band-blurb"></p>`;
  aptCard.querySelector(".assessment-band-blurb").textContent = band.blurb;
  resultsEl.appendChild(aptCard);

  // Personality trait bars
  const traitCard = document.createElement("div");
  traitCard.className = "assessment-result-block";
  const traitHeading = document.createElement("h2");
  traitHeading.className = "assessment-result-h";
  traitHeading.innerHTML = `<i class="fa-solid fa-compass"></i> Work style`;
  traitCard.appendChild(traitHeading);

  TRAIT_ORDER.forEach((trait) => {
    const meta = TRAIT_META[trait];
    const score = result.personality[trait]; // 1–5
    const pct = Math.round(((score - 1) / 4) * 100);

    const row = document.createElement("div");
    row.className = "assessment-trait";

    const label = document.createElement("div");
    label.className = "assessment-trait-label";
    label.innerHTML = `<span class="assessment-trait-name">${meta.name}</span> <span class="assessment-trait-blurb">${meta.blurb}</span>`;

    const track = document.createElement("div");
    track.className = "assessment-trait-track";
    const fill = document.createElement("div");
    fill.className = "assessment-trait-fill";
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    row.append(label, track);
    traitCard.appendChild(row);
  });
  resultsEl.appendChild(traitCard);

  // Suggested roles
  const roleCard = document.createElement("div");
  roleCard.className = "assessment-result-block";
  roleCard.innerHTML = `<h2 class="assessment-result-h"><i class="fa-solid fa-briefcase"></i> Roles that often suit a profile like yours</h2>`;
  const roleList = document.createElement("div");
  roleList.className = "assessment-roles";
  result.roles.forEach((role) => {
    const chip = document.createElement("div");
    chip.className = "assessment-role";
    const name = document.createElement("span");
    name.className = "assessment-role-name";
    name.textContent = role.name;
    const blurb = document.createElement("span");
    blurb.className = "assessment-role-blurb";
    blurb.textContent = role.blurb;
    chip.append(name, blurb);
    roleList.appendChild(chip);
  });
  roleCard.appendChild(roleList);
  resultsEl.appendChild(roleCard);

  // Next-step nudge, tied to the top role's suggested track.
  const topTrack = result.roles[0]?.firstTrack;
  const firstTopic = topTrack ? firstTopicOf(topTrack) : null;
  const nudge = document.createElement("p");
  nudge.className = "assessment-nudge";
  if (firstTopic && topTrack) {
    nudge.textContent = `A good place to start: the ${topTrack} track — open “${firstTopic}” from the Curriculum menu.`;
  } else {
    nudge.textContent =
      "A good place to start: pick a topic from the Curriculum menu once you’re in.";
  }
  resultsEl.appendChild(nudge);

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "assessment-primary";
  cta.textContent = "Start learning →";
  cta.addEventListener("click", () => window.location.assign("/app.html"));
  resultsEl.appendChild(cta);

  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Entry point -----------------------------------------------------------

export async function init(user) {
  uid = user.uid;

  // If they've already completed it, show a read-only re-view of the result
  // instead of making them retake it.
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const stored = snap.exists() ? snap.data().assessment : null;
    if (stored?.completedAt) {
      showResults(stored);
      return;
    }
  } catch (error) {
    console.error("Loading assessment state failed:", error);
    // Fall through to the intro — better to let them take it than to hang.
  }

  startButton.addEventListener("click", () => {
    introEl.hidden = true;
    quizEl.hidden = false;
    current = 0;
    renderQuestion();
  });
  backButton.addEventListener("click", handleBack);
  nextButton.addEventListener("click", handleNext);
}
