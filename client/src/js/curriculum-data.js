// Single source of truth for the demo curriculum. The Curriculum menu, each
// topic's opening lesson prompt, and progress tracking all derive from this one
// structure, so adding, reordering, or renaming a topic is a one-line data edit
// with no menu markup to touch.
//
// Shape: an ordered list of language tracks; each track has an icon and modules;
// each module has an ordered list of topics. A topic's `topic` string is its
// identity — it's sent to the chat function, embedded in the conversation's
// topicKey ("<language>::<topic>"), shown in the menu, and used as the progress
// key. `kickoff` is the opening message auto-sent when the topic is first opened
// (phrased as a natural beginner question, instead of a generic "Explain…"), so
// the AI has good context and the thread reads like a real conversation.
//
// The three tracks are intentionally parallel: each opens with a "what is it /
// the editor / your first …" Getting Started module, then a small Fundamentals
// sample — so every language presents the same shape to a complete beginner.

export const CURRICULUM = [
  {
    language: "HTML",
    icon: "fa-file-code",
    modules: [
      {
        name: "Getting Started",
        topics: [
          {
            topic: "What Is HTML?",
            kickoff:
              "I'm brand new to coding. What is HTML, what is it used for, and what can't it do on its own?",
          },
          {
            topic: "Writing HTML in the Editor",
            kickoff:
              "How do I write HTML in this app's HTML editor pane and see the result in the live preview?",
          },
          {
            topic: "Your First Web Page",
            kickoff:
              "Walk me through building my very first simple web page in HTML, step by step.",
          },
        ],
      },
      {
        name: "Fundamentals",
        topics: [
          {
            topic: "Elements & Tags",
            kickoff:
              "Explain HTML elements and tags for a complete beginner, with a small example.",
          },
          {
            topic: "Attributes & Links",
            kickoff:
              "What are HTML attributes, and how do I create a link to another page?",
          },
          {
            topic: "Lists & Images",
            kickoff: "How do I add a list and an image to my HTML page?",
          },
        ],
      },
    ],
  },
  {
    language: "CSS",
    icon: "fa-paint-brush",
    modules: [
      {
        name: "Getting Started",
        topics: [
          {
            topic: "What Is CSS?",
            kickoff:
              "I'm new to coding. What is CSS, what is it for, and how does it relate to HTML?",
          },
          {
            topic: "Writing CSS in the Editor",
            kickoff:
              "How do I use this app's CSS editor pane to style my HTML and see it update in the preview?",
          },
          {
            topic: "Your First Styles",
            kickoff:
              "Show me how to add my first CSS styles to a simple web page, step by step.",
          },
        ],
      },
      {
        name: "Fundamentals",
        topics: [
          {
            topic: "Selectors",
            kickoff:
              "Explain CSS selectors for a beginner — how do I target the elements I want to style?",
          },
          {
            topic: "Colors & Text",
            kickoff:
              "How do I change colors and style text with CSS? Give me a simple example.",
          },
          {
            topic: "The Box Model",
            kickoff:
              "Explain the CSS box model (content, padding, border, margin) simply, with an example.",
          },
        ],
      },
    ],
  },
  {
    language: "JavaScript",
    icon: "fa-code",
    modules: [
      {
        name: "Getting Started",
        topics: [
          {
            topic: "What Is JavaScript?",
            kickoff:
              "I'm brand new to coding. What is JavaScript, what can it do, and what can't it do?",
          },
          {
            topic: "The Editor & Console",
            kickoff:
              "How do I write JavaScript in this app's JS editor pane, run it, and read the output in the console panel below?",
          },
          {
            topic: "Hello, World!",
            kickoff:
              "Walk me through writing my first JavaScript program that prints 'Hello, World!' to the console.",
          },
        ],
      },
      {
        name: "Fundamentals",
        topics: [
          {
            topic: "Variables & Data Types",
            kickoff:
              "Explain JavaScript variables (let and const) and the basic data types for a complete beginner.",
          },
          {
            topic: "Conditionals & Loops",
            kickoff:
              "How do I make decisions with if/else and repeat actions with loops in JavaScript? Simple examples please.",
          },
          {
            topic: "Functions",
            kickoff:
              "Explain JavaScript functions for a beginner — declarations, function expressions, and arrow functions.",
          },
        ],
      },
    ],
  },
];

// Mirrors the server's key ("<language>::<topic>" — see functions/index.js).
// Used both to look up a topic's saved conversation and as the progress key.
export function topicKey(language, topic) {
  return `${language}::${topic}`;
}

// Flat, ordered list of every topic across all tracks — used for progress
// counts and lookups. Each entry carries its `language` for convenience.
export function allTopics() {
  return CURRICULUM.flatMap((track) =>
    track.modules.flatMap((module) =>
      module.topics.map((t) => ({ language: track.language, ...t }))
    )
  );
}

// The opening message to auto-send when a topic is first opened. Falls back to a
// generic phrasing if the topic isn't found (keeps callers safe if a topic is
// opened that isn't in the data).
export function getTopicKickoff(language, topic) {
  const match = allTopics().find(
    (t) => t.language === language && t.topic === topic
  );
  return match?.kickoff ?? `Explain the ${topic} topic in ${language}.`;
}
